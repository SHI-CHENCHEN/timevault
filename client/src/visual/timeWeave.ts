import * as THREE from "three";

export class TimeWeave {
  readonly group = new THREE.Group();
  private readonly folds = new THREE.Group();
  private readonly ribbonGeometry = new THREE.BufferGeometry();
  private readonly ribbonMaterial: THREE.MeshPhysicalMaterial;
  private readonly edgeGeometry: THREE.EdgesGeometry;
  private readonly edgeMaterial: THREE.LineBasicMaterial;
  private readonly grainGeometry = new THREE.BufferGeometry();
  private readonly grainMaterial: THREE.ShaderMaterial;
  private readonly reducedMotion: boolean;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.group.name = "time-weave";
    this.group.position.set(0, 0.06, -5);
    this.group.add(this.folds);

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const segments = 144;
    const silver = new THREE.Color(0xd5cbdc);
    const violet = new THREE.Color(0x8470b8);
    const warm = new THREE.Color(0xc6b1ae);
    for (let lane = 0; lane < 18; lane += 1) {
      const offset = positions.length / 3;
      const phase = lane * 0.058;
      const color = lane % 5 === 0 ? warm : lane % 3 === 0 ? violet : silver;
      for (let step = 0; step <= segments; step += 1) {
        const t = step / segments;
        const angle = t * Math.PI * 1.84 + phase;
        const radius = 0.87 + lane * 0.011 + Math.sin(angle * 3 + phase) * 0.045;
        for (const side of [-1, 1]) {
          const ribbonWidth = side * (0.013 + Math.sin(t * Math.PI) * 0.012);
          positions.push(
            Math.cos(angle) * (radius + ribbonWidth),
            Math.sin(angle) * (radius + ribbonWidth) * 0.9,
            Math.sin(angle * 2 + lane * 0.095) * 0.32 + (lane - 9) * 0.008,
          );
          colors.push(color.r, color.g, color.b);
        }
        if (step < segments) {
          const a = offset + step * 2;
          indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      }
    }
    this.ribbonGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    this.ribbonGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    this.ribbonGeometry.setIndex(indices);
    this.ribbonGeometry.computeVertexNormals();
    this.ribbonMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.5,
      roughness: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.16,
      iridescence: 0.32,
      iridescenceIOR: 1.36,
      emissive: 0x21132d,
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.86,
    });
    this.folds.add(new THREE.Mesh(this.ribbonGeometry, this.ribbonMaterial));
    this.edgeGeometry = new THREE.EdgesGeometry(this.ribbonGeometry, 32);
    this.edgeMaterial = new THREE.LineBasicMaterial({ color: 0xb6a3cf, transparent: true, opacity: 0.18 });
    this.folds.add(new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial));

    const count = reducedMotion ? 420 : 960;
    const seeds = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      seeds[index * 3] = (index * 0.61803398875) % 1;
      seeds[index * 3 + 1] = (index * 0.41421356237) % 1;
      seeds[index * 3 + 2] = index % 3;
    }
    this.grainGeometry.setAttribute("position", new THREE.BufferAttribute(seeds, 3));
    this.grainMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uReserve: { value: 0.15 },
        uEnergy: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uReserve;
        uniform float uEnergy;
        varying float vLight;
        void main() {
          float phase = position.x * 6.283185;
          float angle = phase + uTime * (0.08 + position.y * 0.025);
          float loose = step(0.68 + uReserve * 0.2, position.y);
          float radius = 0.91 + position.y * 0.26 + loose * 0.48;
          vec3 p = vec3(cos(angle) * radius,
            sin(angle) * radius * 0.9,
            sin(angle * 2.0 + position.y) * 0.36);
          p += normalize(p) * uEnergy * 0.04;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (1.6 + position.y * 1.2 + uEnergy * 0.8) * (5.0 / -mv.z);
          vLight = 0.25 + pow(max(0.0, sin(phase + uTime * 0.3)), 8.0) * 0.5;
        }
      `,
      fragmentShader: `
        varying float vLight;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float alpha = (1.0 - smoothstep(0.12, 0.5, d)) * vLight;
          gl_FragColor = vec4(0.72, 0.59, 0.9, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const grains = new THREE.Points(this.grainGeometry, this.grainMaterial);
    grains.frustumCulled = false;
    this.folds.add(grains);
    this.group.visible = false;
  }

  resize(aspect: number): void {
    const scale = aspect < 1 ? 0.4 : aspect < 1.45 ? 0.64 : 0.8;
    this.group.scale.setScalar(scale);
    this.group.position.x = 0;
    this.group.position.y = aspect < 1 ? 0.18 : 0.07;
  }

  update(now: number, visible: boolean, minutes: number, pointerX: number, pointerY: number, energy: number): void {
    this.group.visible = visible;
    if (!visible) return;
    const time = this.reducedMotion ? 0 : now / 1000;
    this.grainMaterial.uniforms.uTime.value = time;
    this.grainMaterial.uniforms.uReserve.value = Math.min(1, minutes / 240);
    this.grainMaterial.uniforms.uEnergy.value = this.reducedMotion ? 0 : Math.min(1, energy);
    this.folds.rotation.x = 0.34 + (this.reducedMotion ? 0 : Math.sin(time * 0.13) * 0.1 + pointerY * 0.1);
    this.folds.rotation.y = -0.28 + (this.reducedMotion ? 0 : Math.sin(time * 0.08) * 0.18 + pointerX * 0.16);
    this.folds.rotation.z = -0.4 + (this.reducedMotion ? 0 : Math.sin(time * 0.06) * 0.1);
    this.ribbonMaterial.emissiveIntensity = 0.32 + (this.reducedMotion ? 0 : energy * 0.18 + Math.sin(time * 0.4) * 0.05);
  }

  dispose(): void {
    this.ribbonGeometry.dispose();
    this.ribbonMaterial.dispose();
    this.edgeGeometry.dispose();
    this.edgeMaterial.dispose();
    this.grainGeometry.dispose();
    this.grainMaterial.dispose();
    this.group.clear();
  }
}
