import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { clockHandRotation } from "./clockLayout";
import { advanceCoverInertia, coverCharge, coverGlassRadius, type CoverControlState } from "./coverInteraction";
export type { CoverControlState } from "./coverInteraction";

export class CoverSculpture {
  readonly group = new THREE.Group();
  private readonly vessel = new THREE.Group();
  private readonly materials: THREE.Material[] = [];
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly lightMaterial: THREE.MeshStandardMaterial;
  private readonly grainGeometry = new THREE.BufferGeometry();
  private readonly grainPositions = new Float32Array(1100 * 3);
  private readonly shadowTexture: THREE.CanvasTexture;
  private readonly grainTexture: THREE.CanvasTexture;
  private readonly reducedMotion: boolean;
  private readonly chronometer = new THREE.Group();
  private readonly clockHands: THREE.Line[] = [];
  private readonly ventMeshes: THREE.InstancedMesh[] = [];
  private readonly timezoneOffset = new Date().getTimezoneOffset();
  private aspect = 1;
  private cover = true;
  private viewWidth = 1;
  private viewHeight = 1;
  private readonly stageObserver = new ResizeObserver(() => this.measureReserveStage());
  private observedStage: Element | null = null;
  private stageBounds: { x: number; y: number; width: number; height: number } | null = null;
  private readonly reserveRing: THREE.Mesh;
  private reserve = -1;
  private flowPhase = 0;
  private lastUpdateAt = 0;
  private readonly coverAccents = new THREE.Group();
  private readonly finishPairs: Array<{ mesh: THREE.Mesh; original: THREE.Material; cover: THREE.Material }> = [];
  private readonly glassMesh: THREE.Mesh;
  private readonly originalGlass: THREE.LatheGeometry;
  private readonly curvedGlass: THREE.LatheGeometry;
  private readonly grainMaterial: THREE.PointsMaterial;
  private readonly energyPositions = new Float32Array(96 * 3);
  private readonly energyGeometry = new THREE.BufferGeometry();
  private readonly energyMaterial = new THREE.PointsMaterial({ color: 0xd5bdff, size: 0.034, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  private readonly neckEchoMaterial = new THREE.MeshBasicMaterial({ color: 0xc5a0f5, transparent: true, opacity: 0, depthWrite: false });
  private readonly neckEcho: THREE.Mesh;
  private readonly dialIndicator = new THREE.Group();
  private hoverLight = 0;

  constructor(renderer: THREE.WebGLRenderer, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.group.name = "cover-time-vessel";
    this.group.position.z = -5;
    this.group.add(this.vessel);

    const studio = new THREE.Scene();
    const surroundGeometry = new THREE.SphereGeometry(18, 24, 16);
    const surroundMaterial = new THREE.MeshBasicMaterial({ color: 0x201a2c, side: THREE.BackSide });
    studio.add(new THREE.Mesh(surroundGeometry, surroundMaterial));
    const cardGeometry = new THREE.PlaneGeometry(2.8, 11);
    const cardMaterial = new THREE.MeshBasicMaterial({ color: 0xd9d7e5, side: THREE.DoubleSide });
    for (const [x, y, z] of [[-5, 2, 4], [5, 3, 1], [1, 7, -4]]) {
      const card = new THREE.Mesh(cardGeometry, cardMaterial);
      card.position.set(x, y, z);
      card.lookAt(0, 0, 0);
      studio.add(card);
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.environment = pmrem.fromScene(studio, 0.02);
    pmrem.dispose();
    surroundGeometry.dispose(); surroundMaterial.dispose(); cardGeometry.dispose(); cardMaterial.dispose();

    const metal = new THREE.MeshPhysicalMaterial({ color: 0x9993a2, metalness: 0.92, roughness: 0.28,
      envMap: this.environment.texture, envMapIntensity: 1.5, clearcoat: 0.55, clearcoatRoughness: 0.24 });
    const warmMetal = metal.clone(); warmMetal.color.set(0xaaa0b6); warmMetal.roughness = 0.25;
    const graphite = new THREE.MeshPhysicalMaterial({ color: 0x24212d, metalness: 0.68, roughness: 0.34,
      envMap: this.environment.texture, envMapIntensity: 1.1, clearcoat: 0.45 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xabb8cc, metalness: 0, roughness: 0.08,
      transmission: 0.78, thickness: 0.14, ior: 1.45, transparent: true, opacity: 0.32,
      envMap: this.environment.texture, envMapIntensity: 1.25, clearcoat: 0.85,
      side: THREE.FrontSide, depthWrite: false });
    this.lightMaterial = new THREE.MeshStandardMaterial({ color: 0xb18af5, emissive: 0x752cda,
      emissiveIntensity: 1, metalness: 0.35, roughness: 0.24, envMap: this.environment.texture });
    this.materials.push(metal, warmMetal, graphite, glass, this.lightMaterial);
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0, parent = this.vessel) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z); parent.add(mesh); return mesh;
    };

    const annulus = (outer: number, inner: number, height: number, y: number, material: THREE.Material) =>
      add(new THREE.LatheGeometry([
        new THREE.Vector2(inner, -height / 2), new THREE.Vector2(outer - 0.02, -height / 2),
        new THREE.Vector2(outer, -height / 2 + 0.02), new THREE.Vector2(outer, height / 2 - 0.02),
        new THREE.Vector2(outer - 0.02, height / 2), new THREE.Vector2(inner, height / 2),
        new THREE.Vector2(inner, -height / 2),
      ], 96), material, 0, y);
    // Open, stepped caps and finely ribbed light bands follow the physical vessel.
    for (const direction of [-1, 1]) {
      annulus(1.14, 0.87, 0.21, direction * 1.91, metal);
      annulus(1.015, 0.85, 0.075, direction * 1.735, warmMetal);
      annulus(1.03, 0.85, 0.06, direction * 1.8, this.lightMaterial);
      const vents = new THREE.InstancedMesh(new THREE.BoxGeometry(0.019, 0.065, 0.05), graphite, 72);
      const matrix = new THREE.Matrix4();
      const rotation = new THREE.Quaternion();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3(1, 1, 1);
      for (let index = 0; index < 72; index += 1) {
        const angle = index / 72 * Math.PI * 2;
        position.set(Math.sin(angle) * 1.029, direction * 1.8, Math.cos(angle) * 1.029);
        rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
        matrix.compose(position, rotation, scale); vents.setMatrixAt(index, matrix);
      }
      vents.instanceMatrix.needsUpdate = true;
      this.ventMeshes.push(vents); this.vessel.add(vents);
      const rim = add(new THREE.TorusGeometry(0.88, 0.013, 10, 80), this.lightMaterial, 0, direction * 1.68);
      rim.rotation.x = Math.PI / 2;
    }
    // These are the device's functional lower tiers, not a separate display plinth.
    annulus(1.19, 0.12, 0.17, -2.09, metal);
    annulus(1.1, 0.13, 0.055, -1.99, this.lightMaterial);
    const profile: THREE.Vector2[] = [];
    for (let index = 0; index <= 64; index += 1) {
      const y = -1.66 + index / 64 * 3.32;
      const radius = 0.075 + 0.78 * Math.pow(Math.abs(y) / 1.66, 1.14);
      profile.push(new THREE.Vector2(radius, y));
    }
    this.originalGlass = new THREE.LatheGeometry(profile, 96);
    this.curvedGlass = new THREE.LatheGeometry(profile.map(point => new THREE.Vector2(coverGlassRadius(point.y), point.y)), 96);
    this.glassMesh = add(this.originalGlass, glass);
    const collar = add(new THREE.TorusGeometry(0.15, 0.025, 12, 64), this.lightMaterial);
    collar.rotation.x = Math.PI / 2;
    annulus(0.16, 0.075, 0.065, 0, warmMetal);
    for (const angle of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
      add(new THREE.CylinderGeometry(0.016, 0.016, 3.64, 10), warmMetal, Math.cos(angle) * 0.97, 0, Math.sin(angle) * 0.97);
    }
    for (let strand = 0; strand < 2; strand += 1) {
      const points: THREE.Vector3[] = [];
      for (let index = 0; index <= 100; index += 1) {
        const t = index / 100;
        const angle = t * Math.PI * 2.2 + strand * Math.PI + 0.32;
        points.push(new THREE.Vector3(Math.cos(angle) * 0.94, -1.67 + t * 3.34, Math.sin(angle) * 0.94));
      }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 180, 0.078, 18, false), warmMetal);
    }

    const controller = new THREE.Group(); controller.position.set(1.5, -0.48, 0.2); this.vessel.add(controller);
    const black = new THREE.MeshStandardMaterial({ color: 0x07070c, metalness: 0.32, roughness: 0.3 });
    this.materials.push(black);
    add(new RoundedBoxGeometry(0.46, 2.48, 0.4, 2, 0.018), metal, 0, -0.28, -0.035, controller);
    add(new RoundedBoxGeometry(0.38, 2.37, 0.07, 2, 0.01), graphite, 0, -0.3, 0.21, controller);
    add(new RoundedBoxGeometry(0.54, 0.14, 0.5, 2, 0.012), metal, 0, -1.61, 0.02, controller);
    add(new RoundedBoxGeometry(0.58, 0.22, 0.54, 2, 0.016), graphite, 0, -1.78, 0.02, controller);
    for (const [width, y, z] of [[0.34, 1.015, -0.06], [0.4, 0.94, 0.06]]) {
      add(new RoundedBoxGeometry(width, 0.09, 0.32, 2, 0.007), graphite, 0, y, z, controller);
    }
    const dial = add(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 80), metal, 0, 0.74, 0.27, controller);
    dial.rotation.x = Math.PI / 2;
    const dialCenter = add(new THREE.CylinderGeometry(0.29, 0.29, 0.05, 80), black, 0, 0.74, 0.37, controller);
    dialCenter.rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(0.31, 0.011, 10, 80), warmMetal, 0, 0.74, 0.372, controller);
    add(new THREE.TorusGeometry(0.135, 0.013, 12, 64), this.lightMaterial, 0, 0.74, 0.402, controller);
    const engravingMaterial = new THREE.LineBasicMaterial({ color: 0xb8a5ce, transparent: true, opacity: 0.4 });
    this.materials.push(engravingMaterial);
    const dialMarks: number[] = [];
    for (let index = 0; index < 24; index += 1) {
      const angle = index / 24 * Math.PI * 2;
      for (const radius of [0.306, 0.322]) dialMarks.push(Math.cos(angle) * radius, 0.74 + Math.sin(angle) * radius, 0.374);
    }
    const marksGeometry = new THREE.BufferGeometry();
    marksGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dialMarks, 3));
    controller.add(new THREE.LineSegments(marksGeometry, engravingMaterial));
    for (const [y, height] of [[0.07, 0.54], [-0.68, 0.42], [-1.2, 0.42]]) {
      add(new RoundedBoxGeometry(0.33, height, 0.035, 2, 0.009), metal, 0, y, 0.257, controller);
      add(new THREE.BoxGeometry(0.285, height - 0.045, 0.02), black, 0, y, 0.28, controller);
      if (y < 0) add(new THREE.BoxGeometry(0.19, 0.065, 0.035), graphite, 0, y + 0.015, 0.31, controller);
      add(new THREE.BoxGeometry(0.21, 0.015, 0.009), this.lightMaterial, 0, y + (y < 0 ? -0.09 : 0.045), 0.332, controller);
    }
    for (const x of [-0.085, 0, 0.085]) {
      const bezel = add(new THREE.CylinderGeometry(0.027, 0.027, 0.035, 20), metal, x, -0.32, 0.29, controller);
      bezel.rotation.x = Math.PI / 2;
      add(new THREE.SphereGeometry(0.018, 12, 8), this.lightMaterial, x, -0.32, 0.315, controller);
    }

    const calibrationMaterial = new THREE.LineBasicMaterial({ color: 0x6f659e, transparent: true, opacity: 0.38 });
    this.materials.push(calibrationMaterial);
    const calibrationPositions: number[] = [];
    for (let index = 0; index < 60; index += 1) {
      const angle = index * Math.PI / 30;
      for (const radius of [index % 5 === 0 ? 2.48 : 2.56, 2.64]) {
        calibrationPositions.push(Math.cos(angle) * radius + 0.1, Math.sin(angle) * radius, -1.4);
      }
    }
    const calibrationGeometry = new THREE.BufferGeometry();
    calibrationGeometry.setAttribute("position", new THREE.Float32BufferAttribute(calibrationPositions, 3));
    this.chronometer.add(new THREE.LineSegments(calibrationGeometry, calibrationMaterial));
    const arcPoints: THREE.Vector3[] = [];
    for (let index = 0; index <= 96; index += 1) {
      const angle = index / 96 * Math.PI * 2;
      arcPoints.push(new THREE.Vector3(Math.cos(angle) * 2.82 + 0.1, Math.sin(angle) * 2.82, -1.5));
    }
    this.chronometer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(arcPoints), calibrationMaterial));
    for (const [length, opacity] of [[1.32, 0.58], [2.1, 0.52], [2.6, 0.78]]) {
      const material = new THREE.LineBasicMaterial({ color: 0x7760a5, transparent: true, opacity });
      this.materials.push(material);
      const hand = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.26, 0), new THREE.Vector3(0, length, 0),
      ]), material);
      const spindle = new THREE.Group();
      spindle.position.set(0.1, 0, -1.38);
      spindle.add(hand); this.clockHands.push(hand); this.chronometer.add(spindle);
    }
    this.group.add(this.chronometer);
    const shadowCanvas = document.createElement("canvas"); shadowCanvas.width = shadowCanvas.height = 128;
    const context = shadowCanvas.getContext("2d")!;
    const gradient = context.createRadialGradient(64, 64, 12, 64, 64, 64);
    gradient.addColorStop(0, "rgba(49,37,63,0.38)"); gradient.addColorStop(1, "rgba(49,37,63,0)");
    context.fillStyle = gradient; context.fillRect(0, 0, 128, 128);
    this.shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMaterial = new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, depthWrite: false });
    this.materials.push(shadowMaterial);
    const shadow = add(new THREE.PlaneGeometry(5.3, 5.3), shadowMaterial, 0.2, -2.22, 0, this.group);
    shadow.rotation.x = -Math.PI / 2;
    this.reserveRing = add(new THREE.TorusGeometry(1.08, 0.013, 8, 64, Math.PI), this.lightMaterial, 0, -1.71);
    this.reserveRing.rotation.x = Math.PI / 2;

    this.grainGeometry.setAttribute("position", new THREE.BufferAttribute(this.grainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    const grainCanvas = document.createElement("canvas"); grainCanvas.width = grainCanvas.height = 32;
    const grainContext = grainCanvas.getContext("2d")!;
    const grainGradient = grainContext.createRadialGradient(16, 16, 0, 16, 16, 14);
    grainGradient.addColorStop(0, "rgba(255,255,255,1)");
    grainGradient.addColorStop(0.4, "rgba(255,255,255,0.85)");
    grainGradient.addColorStop(1, "rgba(255,255,255,0)");
    grainContext.fillStyle = grainGradient; grainContext.fillRect(0, 0, 32, 32);
    this.grainTexture = new THREE.CanvasTexture(grainCanvas);
    const grainMaterial = new THREE.PointsMaterial({ map: this.grainTexture, color: 0x795493, size: 0.019,
      transparent: true, opacity: 0.78, alphaTest: 0.02, depthWrite: false });
    this.grainMaterial = grainMaterial;
    this.materials.push(grainMaterial);
    const grains = new THREE.Points(this.grainGeometry, grainMaterial); grains.frustumCulled = false; this.vessel.add(grains);
    const fillLight = new THREE.PointLight(0xe0d5ee, 7, 8, 2); fillLight.position.set(-1.6, 1.5, 2); this.group.add(fillLight);
    const rimLight = new THREE.PointLight(0x9676c2, 4, 7, 2); rimLight.position.set(1.8, 0.4, -0.7); this.group.add(rimLight);

    // Cover finishes are reversible. The idle/reserve view keeps its existing materials and glass.
    const finishes = new Map<THREE.Material, THREE.Material>();
    this.vessel.traverse(object => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return;
      const original = object.material;
      if (!(original instanceof THREE.MeshPhysicalMaterial)) return;
      let finish = finishes.get(original);
      if (!finish) {
        const physical = original.clone();
        if (original === glass) {
          physical.color.set(0xa59bb5); physical.opacity = 0.34; physical.transmission = 0.72;
          physical.roughness = 0.085; physical.thickness = 0.14; physical.clearcoat = 0.8; physical.envMapIntensity = 1.25;
        } else if (original === metal || original === warmMetal) {
          physical.color.set(original === metal ? 0x9f98ab : 0xada3bb);
          physical.roughness = 0.25; physical.clearcoat = 0.65; physical.clearcoatRoughness = 0.22; physical.envMapIntensity = 1.35;
        }
        finish = physical; finishes.set(original, finish); this.materials.push(finish);
      }
      this.finishPairs.push({ mesh: object, original, cover: finish });
    });
    this.vessel.add(this.coverAccents);
    this.energyGeometry.setAttribute("position", new THREE.BufferAttribute(this.energyPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.energyMaterial.map = this.grainTexture;
    const energy = new THREE.Points(this.energyGeometry, this.energyMaterial); energy.frustumCulled = false;
    this.coverAccents.add(energy);
    this.neckEcho = add(new THREE.TorusGeometry(0.17, 0.009, 8, 64), this.neckEchoMaterial, 0, 0, 0, this.coverAccents);
    this.neckEcho.rotation.x = Math.PI / 2;
    this.dialIndicator.position.set(1.5, 0.26, 0.61);
    const indicator = add(new THREE.SphereGeometry(0.015, 10, 8), this.lightMaterial, 0, 0.135, 0, this.dialIndicator);
    indicator.name = "cover-dial-index";
    this.coverAccents.add(this.dialIndicator);
    this.materials.push(this.energyMaterial, this.neckEchoMaterial);
    this.applyCoverFinish(true);
    this.group.visible = false;
  }

  private applyCoverFinish(cover: boolean): void {
    for (const pair of this.finishPairs) pair.mesh.material = cover ? pair.cover : pair.original;
    this.glassMesh.geometry = cover ? this.curvedGlass : this.originalGlass;
    this.coverAccents.visible = cover;
  }

  resize(aspect: number, width: number, height: number): void {
    this.aspect = aspect;
    this.viewWidth = width;
    this.viewHeight = height;
    this.measureReserveStage();
    this.placeVessel();
  }

  measureReserveStage(): void {
    const stage = document.querySelector(".app--entered .idle-vessel-stage");
    if (stage !== this.observedStage) {
      this.stageObserver.disconnect();
      this.observedStage = stage;
      if (stage) this.stageObserver.observe(stage);
    }
    if (!stage) { this.stageBounds = null; return; }
    const rect = stage.getBoundingClientRect();
    this.stageBounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    if (!this.cover) this.placeVessel();
  }

  private placeVessel(): void {
    if (!this.cover && this.stageBounds) {
      const { x, y, width, height } = this.stageBounds;
      const planeHeight = 10 * Math.tan(THREE.MathUtils.degToRad(16));
      const unitsPerPixel = planeHeight / this.viewHeight;
      const scale = Math.max(0, Math.min((width - 48) / 3.7, (height - 48) / 4.8)) * unitsPerPixel;
      this.group.scale.setScalar(scale);
      this.group.position.set(((x + width / 2) / this.viewWidth - 0.5) * planeHeight * this.aspect - scale * 0.36,
        (0.5 - (y + height / 2) / this.viewHeight) * planeHeight, -5);
      return;
    }
    const portrait = this.aspect < 1;
    this.group.scale.setScalar(this.cover ? portrait ? 0.2 : this.aspect < 1.45 ? 0.3 : 0.34 : portrait ? 0.19 : 0.28);
    this.group.position.set(portrait ? -0.04 : this.aspect < 1.45 ? 0.51 : this.cover ? 0.85 : 0.95,
      this.cover ? portrait ? -0.12 : 0.08 : portrait ? -0.3 : 0.22, -5);
  }

  update(now: number, visible: boolean, minutes: number, pointerX: number, pointerY: number, controls: CoverControlState, cover = true): void {
    this.group.visible = visible;
    if (!visible) return;
    if (this.cover !== cover) { this.cover = cover; this.applyCoverFinish(cover); this.measureReserveStage(); this.placeVessel(); }
    this.chronometer.visible = cover;
    if (minutes !== this.reserve) {
      this.reserve = minutes;
      this.reserveRing.geometry.dispose();
      this.reserveRing.geometry = new THREE.TorusGeometry(1.08, 0.013, 8, 80, Math.max(0.02, Math.min(1, minutes / 60) * Math.PI * 2));
    }
    const age = (now - controls.pulseAt) / 1000;
    const pulse = controls.pulseAt > 0 ? Math.exp(-Math.max(0, age) * 1.8) * (cover ? controls.pulsePower : 1) : 0;
    const time = this.reducedMotion ? 0 : now / 1000;
    const delta = this.lastUpdateAt ? Math.min(0.05, (now - this.lastUpdateAt) / 1000) : 0;
    this.lastUpdateAt = now;
    if (cover) advanceCoverInertia(controls, delta, this.reducedMotion);
    const charge = cover ? coverCharge(now, controls) : 0;
    this.hoverLight = cover ? this.hoverLight + ((controls.hovering ? 1 : 0) - this.hoverLight) * 0.07 : 0;
    if (!controls.flowPaused && !this.reducedMotion) this.flowPhase += delta * 0.065 * controls.flowDirection * (1 + pulse * (cover ? 3.2 : 0.7) + charge * 1.8);
    const target = -0.32 + controls.yaw + (this.reducedMotion ? 0 : pointerX * 0.13 + Math.sin(time * 0.16) * 0.055);
    this.vessel.rotation.y += (target - this.vessel.rotation.y) * 0.07;
    this.vessel.rotation.x += ((this.reducedMotion ? 0.04 : 0.04 - pointerY * 0.045) + (cover ? controls.pitch : 0) - this.vessel.rotation.x) * 0.05;
    this.vessel.position.y = cover && !this.reducedMotion ? Math.sin(time * 1.1) * 0.025 + charge * 0.035 : 0;
    this.lightMaterial.emissiveIntensity = 0.65 + pulse * 2 + charge * 1.1 + this.hoverLight * 0.65 + (this.reducedMotion ? 0 : Math.sin(time * 0.8) * 0.12);
    this.grainMaterial.size = cover ? 0.019 + charge * 0.003 + pulse * 0.005 : 0.019;
    this.grainMaterial.opacity = cover ? 0.78 + charge * 0.14 : 0.78;
    if (cover) {
      this.dialIndicator.rotation.z = -this.flowPhase * Math.PI * 12 - controls.yaw * 0.2;
      this.energyMaterial.opacity = this.reducedMotion ? 0 : Math.min(0.85, charge * 0.4 + pulse * 0.85);
      const travel = charge > 0 ? this.flowPhase * 3 : age * 0.65;
      for (let index = 0; index < 96; index++) {
        const strand = index < 48 ? 0 : 1;
        const t = ((travel * controls.flowDirection - (index % 48) / 48 * 0.18) % 1 + 1) % 1;
        const angle = t * Math.PI * 2.2 + strand * Math.PI + 0.32;
        this.energyPositions[index * 3] = Math.cos(angle) * 1.021;
        this.energyPositions[index * 3 + 1] = -1.67 + t * 3.34;
        this.energyPositions[index * 3 + 2] = Math.sin(angle) * 1.021;
      }
      this.energyGeometry.attributes.position.needsUpdate = true;
      this.neckEcho.scale.setScalar(1 + Math.min(1, Math.max(0, age)) * 1.3);
      this.neckEchoMaterial.opacity = this.reducedMotion ? 0 : pulse * 0.65;
    }
    const wallTime = Date.now();
    if (!this.reducedMotion) {
      this.clockHands[0].rotation.z = clockHandRotation(wallTime, this.timezoneOffset, 43_200);
      this.clockHands[1].rotation.z = clockHandRotation(wallTime, this.timezoneOffset, 3_600);
      this.clockHands[2].rotation.z = clockHandRotation(wallTime, this.timezoneOffset, 60);
    }
    this.chronometer.rotation.z += (controls.yaw * 0.08 - this.chronometer.rotation.z) * 0.04;
    const count = this.reducedMotion ? 420 : 1100;
    this.grainGeometry.setDrawRange(0, count);
    for (let index = 0; index < count; index += 1) {
      const phase = ((index / count + this.flowPhase) % 1 + 1) % 1;
      const y = 1.58 - phase * 3.16;
      // A fine continuous neck stream, wider grains inside the two glass chambers.
      const width = Math.max(0.014, Math.pow(Math.abs(y) / 1.58, 1.4) * 0.68);
      const angle = index * 2.399963;
      const radius = Math.sqrt((index * 0.618033) % 1) * width;
      this.grainPositions[index * 3] = Math.cos(angle) * radius;
      this.grainPositions[index * 3 + 1] = y;
      this.grainPositions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    this.grainGeometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.stageObserver.disconnect();
    this.group.traverse((object) => (object as THREE.Mesh).geometry?.dispose());
    // One of these geometries is detached when the scene is disposed.
    (this.glassMesh.geometry === this.curvedGlass ? this.originalGlass : this.curvedGlass).dispose();
    for (const vents of this.ventMeshes) vents.dispose();
    for (const material of this.materials) material.dispose();
    this.environment.dispose(); this.shadowTexture.dispose(); this.grainTexture.dispose(); this.group.clear();
  }
}
