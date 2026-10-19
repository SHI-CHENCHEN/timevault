import * as THREE from "three";

export interface TemporalApparatus {
  group: THREE.Group;
  setPresence: (presence: number, pulse: number) => void;
  dispose: () => void;
}

function physicalMaterial(
  color: number,
  emissive: number,
  opacity: number,
  metalness: number,
  roughness: number,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    emissive,
    emissiveIntensity: emissive === 0 ? 0 : 0.4,
    transparent: true,
    opacity,
    metalness,
    roughness,
    clearcoat: 0.86,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  material.userData.baseOpacity = opacity;
  material.userData.baseEmissive = material.emissiveIntensity;
  return material;
}

function addTube(
  group: THREE.Group,
  points: THREE.Vector3[],
  radius: number,
  material: THREE.Material,
): void {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 128, radius, 10, false), material));
}

export function createTemporalApparatus(): TemporalApparatus {
  const group = new THREE.Group();
  group.name = "temporal-apparatus";
  group.position.set(0.18, 0.2, -0.78);
  group.scale.setScalar(0.62);

  const silver = physicalMaterial(0xb9b4b8, 0x17141b, 0.48, 0.88, 0.24);
  const champagne = physicalMaterial(0xc4aea1, 0x231719, 0.42, 0.82, 0.2);
  const graphite = physicalMaterial(0x25232d, 0x0a0810, 0.54, 0.72, 0.34);
  const glass = physicalMaterial(0x8290aa, 0x15182c, 0.16, 0.08, 0.08);
  glass.transmission = 0.66;
  glass.thickness = 0.8;
  glass.ior = 1.42;
  glass.iridescence = 0.16;
  const violet = physicalMaterial(0x9c72ff, 0x7c20ff, 0.72, 0.3, 0.14);
  violet.emissiveIntensity = 1.25;
  violet.userData.baseEmissive = 1.25;
  const trace = new THREE.LineBasicMaterial({ color: 0xd1c9d1, transparent: true, opacity: 0.18 });
  trace.userData.baseOpacity = 0.18;
  const materials: THREE.Material[] = [silver, champagne, graphite, glass, violet, trace];

  for (const y of [-2.05, 2.05]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.34, 0.15, 64), silver);
    cap.position.y = y;
    group.add(cap);

    const inset = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.14, 0.07, 64), graphite);
    inset.position.y = y + (y > 0 ? -0.11 : 0.11);
    group.add(inset);

    const energyRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.028, 10, 96), violet);
    energyRing.position.y = y + (y > 0 ? -0.16 : 0.16);
    energyRing.scale.y = 0.22;
    group.add(energyRing);
  }

  for (const x of [-1.14, 1.14]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 3.9, 10), champagne);
    rod.position.set(x, 0, 0.08);
    group.add(rod);
  }

  const upper = new THREE.Mesh(new THREE.ConeGeometry(0.98, 1.86, 64, 1, true), glass);
  upper.position.y = 0.96;
  upper.rotation.z = Math.PI;
  group.add(upper);
  const lower = new THREE.Mesh(new THREE.ConeGeometry(0.98, 1.86, 64, 1, true), glass);
  lower.position.y = -0.96;
  group.add(lower);

  for (const cone of [upper, lower]) {
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(cone.geometry, 18), trace);
    edges.position.copy(cone.position);
    edges.rotation.copy(cone.rotation);
    group.add(edges);
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 10, 48), violet);
  collar.scale.y = 0.3;
  group.add(collar);

  for (let strand = 0; strand < 2; strand += 1) {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 96; index += 1) {
      const t = index / 96;
      const angle = t * Math.PI * 3.4 + strand * Math.PI;
      const envelope = 0.68 + Math.abs(t - 0.5) * 0.68;
      points.push(new THREE.Vector3(
        Math.cos(angle) * envelope,
        -1.88 + t * 3.76,
        0.12 + Math.sin(angle) * 0.18,
      ));
    }
    addTube(group, points, strand === 0 ? 0.075 : 0.048, strand === 0 ? silver : champagne);
  }

  const dial = new THREE.Group();
  dial.position.set(1.7, 0.2, 0.12);
  const dialBody = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.11, 48), graphite);
  dialBody.rotation.x = Math.PI / 2;
  dial.add(dialBody);
  const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 10, 64), violet);
  dial.add(dialRing);
  const dialStem = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.62, 0.16), graphite);
  dialStem.position.y = -1.02;
  dial.add(dialStem);
  group.add(dial);

  const setPresence = (presence: number, pulse: number) => {
    const safePresence = Math.max(0, Math.min(1, presence));
    for (const material of materials) {
      material.opacity = Number(material.userData.baseOpacity ?? 1) * safePresence;
      if (material instanceof THREE.MeshPhysicalMaterial) {
        material.emissiveIntensity = Number(material.userData.baseEmissive ?? 0) * (0.7 + pulse * 0.3);
      }
    }
  };

  return {
    group,
    setPresence,
    dispose: () => {
      group.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      for (const material of materials) material.dispose();
      group.clear();
    },
  };
}
