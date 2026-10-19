import * as THREE from "three";
import type { ReserveStructure } from "@timevault/shared";

export interface OrbitMaterials {
  micro: THREE.MeshPhysicalMaterial;
  cluster: THREE.MeshPhysicalMaterial;
  shard: THREE.MeshPhysicalMaterial;
  major: THREE.MeshPhysicalMaterial;
  active: THREE.MeshPhysicalMaterial;
  recovered: THREE.MeshPhysicalMaterial;
  trace: THREE.LineBasicMaterial;
}

export interface VisualStructureSpec {
  id: string;
  kind: ReserveStructure["kind"];
  minutes: number;
  angle: number;
  radius: number;
  depth: number;
  phase: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function stableUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_295;
}

export function getVisualStructureSpecs(structures: ReserveStructure[]): VisualStructureSpec[] {
  return structures.slice(0, 48).map((structure, index) => {
    const variation = stableUnit(structure.id);
    let angle = -Math.PI * 0.72 + index * GOLDEN_ANGLE + (variation - 0.5) * 0.22;
    angle %= Math.PI * 2;
    // Preserve a deliberate break in the orbit rather than forming a perfect clock face.
    if (angle > -0.2 && angle < 0.34) angle += 0.52;
    return {
      id: structure.id,
      kind: structure.kind,
      minutes: structure.minutes,
      angle,
      radius: structure.kind === "MICRO" ? 2.05 : structure.kind === "CLUSTER" ? 2.18 : 2.37,
      depth: (variation - 0.5) * 0.5,
      phase: variation * Math.PI * 2,
    };
  });
}

export function createOrbitMaterials(): OrbitMaterials {
  const material = (color: number, emissive: number, opacity: number) =>
    new THREE.MeshPhysicalMaterial({
      color,
      emissive,
      emissiveIntensity: 0.42,
      transparent: true,
      opacity,
      metalness: 0.18,
      roughness: 0.12,
      clearcoat: 0.96,
      clearcoatRoughness: 0.16,
      iridescence: 0.28,
      iridescenceIOR: 1.38,
      thickness: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

  return {
    micro: material(0x9a94a6, 0x241b38, 0.64),
    cluster: material(0xb8aec1, 0x352052, 0.68),
    shard: material(0xc5b2aa, 0x42233f, 0.72),
    major: material(0xb7b1b3, 0x282230, 0.34),
    active: material(0xb596ff, 0x7328d6, 0.86),
    recovered: material(0x8fb8e9, 0x17396b, 0.84),
    trace: new THREE.LineBasicMaterial({ color: 0xaaa2a8, transparent: true, opacity: 0.11 }),
  };
}

function createExtrudedShape(points: Array<[number, number]>, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) shape.lineTo(x, y);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.025,
    bevelThickness: 0.025,
  });
  geometry.center();
  return geometry;
}

export function createMicroGeometry(scale = 1): THREE.ExtrudeGeometry {
  const geometry = createExtrudedShape(
    [
      [-0.17, -0.06],
      [-0.03, -0.14],
      [0.18, -0.07],
      [0.11, 0.13],
      [-0.12, 0.1],
    ],
    0.08,
  );
  geometry.scale(scale, scale, scale);
  return geometry;
}

export function createShardGeometry(): THREE.ExtrudeGeometry {
  return createExtrudedShape(
    [
      [-0.34, -0.1],
      [-0.08, -0.25],
      [0.42, -0.12],
      [0.3, 0.14],
      [-0.18, 0.22],
    ],
    0.12,
  );
}

export function createReserveObject(spec: VisualStructureSpec, materials: OrbitMaterials): THREE.Object3D {
  const object = new THREE.Group();
  object.name = spec.id;
  object.userData = { ...spec, bornAt: performance.now() };

  if (spec.kind === "MAJOR") {
    const length = 0.64 + Math.min(0.18, spec.minutes / 600);
    for (let layer = 0; layer < 3; layer += 1) {
      const geometry = new THREE.RingGeometry(
        2.12 + layer * 0.1,
        2.24 + layer * 0.12,
        48,
        1,
        spec.angle + layer * 0.035,
        length - layer * 0.04,
      );
      const mesh = new THREE.Mesh(geometry, materials.major);
      mesh.position.z = spec.depth + layer * 0.045;
      mesh.rotation.x = (layer - 1) * 0.045;
      object.add(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 18), materials.trace);
      edge.position.z = spec.depth + layer * 0.045 + 0.012;
      edge.rotation.x = mesh.rotation.x;
      object.add(edge);
    }
    return object;
  }

  if (spec.kind === "SHARD") {
    for (let layer = 0; layer < 3; layer += 1) {
      const geometry = createShardGeometry();
      const mesh = new THREE.Mesh(geometry, materials.shard);
      mesh.position.set((layer - 1) * 0.13, Math.abs(layer - 1) * 0.08, layer * 0.055);
      mesh.rotation.set((layer - 1) * 0.08, (layer - 1) * -0.1, (layer - 1) * 0.19);
      mesh.scale.setScalar(1 - Math.abs(layer - 1) * 0.12);
      object.add(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 22), materials.trace);
      edge.position.copy(mesh.position);
      edge.rotation.copy(mesh.rotation);
      edge.scale.copy(mesh.scale);
      object.add(edge);
    }
  } else if (spec.kind === "CLUSTER") {
    for (let index = 0; index < 3; index += 1) {
      const mesh = new THREE.Mesh(createMicroGeometry(0.72), materials.cluster);
      mesh.position.set((index - 1) * 0.18, Math.abs(index - 1) * 0.09, index * 0.025);
      mesh.rotation.z = (index - 1) * 0.24;
      object.add(mesh);
    }
  } else {
    object.add(new THREE.Mesh(createMicroGeometry(0.8), materials.micro));
  }

  object.position.set(Math.cos(spec.angle) * spec.radius, Math.sin(spec.angle) * spec.radius, spec.depth);
  object.rotation.z = spec.angle + Math.PI / 2;
  return object;
}

export function createActiveFragment(index: number, count: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(createMicroGeometry(1.08 + (index % 4) * 0.12), material);
  mesh.userData = {
    index,
    count,
    angle: -Math.PI * 0.72 + (index / Math.max(count, 1)) * Math.PI * 1.44,
    phase: index * 1.73,
  };
  return mesh;
}

export function createBrokenArc(radius: number, start: number, length: number, material: THREE.Material): THREE.Line {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, start, start + length, false, 0);
  const points = curve.getPoints(90).map((point) => new THREE.Vector3(point.x, point.y, 0));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
  object.clear();
}
