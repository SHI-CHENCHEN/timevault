import * as THREE from "three";
import type { HandMirrorVisualState } from "./types";
import { handFieldPolicy } from "./handFieldPolicy";

export interface GestureParticleContext {
  visible: boolean;
  step: 0 | 1 | 2;
  totalSold: number;
  reserve: number;
  totalRecovered: number;
  countdownRemaining: number | null;
}

const LABELS = ["LOST TIME", "TIME RESERVE", "TIME RETURNED"] as const;
const PALETTES = [
  [0x9a78ff, 0xc3b3f4, 0x778dd8, 0xc8c4d1],
  [0x8f6cff, 0xb49cff, 0x7387d9, 0xd0cadb],
  [0x9c8cff, 0xb5c1ef, 0x7485c7, 0xd4d0dc],
] as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const hash = (value: number) => {
  const result = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return result - Math.floor(result);
};

export class GestureParticleField {
  readonly group = new THREE.Group();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material: THREE.PointsMaterial;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly textTargets: Float32Array;
  private readonly coreTargets: Float32Array;
  private readonly disperseTargets: Float32Array;
  private readonly colors: Float32Array;
  private readonly motionSeeds: Float32Array;
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly colorAttribute: THREE.BufferAttribute;
  private readonly count: number;
  private readonly reducedMotion: boolean;
  private visibleCount: number;
  private targetOpacity = 0;
  private context: GestureParticleContext = {
    visible: false,
    step: 0,
    totalSold: 0,
    reserve: 0,
    totalRecovered: 0,
    countdownRemaining: null,
  };
  private fieldWidth = 4.5;
  private fieldHeight = 2.55;
  private viewportHeight = 2 * 5 * Math.tan(16 * Math.PI / 180);
  private viewportWidth = this.viewportHeight;
  private targetKey = "";
  private disposed = false;
  private readonly leftTrail = new Float32Array(12 * 5);
  private readonly activeTrails = new Float32Array(12 * 5);
  private leftTrailCursor = 0;
  private lastTrailAt = -Infinity;

  constructor(count: number, reducedMotion: boolean) {
    this.count = count;
    this.visibleCount = count;
    this.reducedMotion = reducedMotion;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.textTargets = new Float32Array(count * 3);
    this.coreTargets = new Float32Array(count * 3);
    this.disperseTargets = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.motionSeeds = new Float32Array(count * 6);
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      this.positions[offset] = (hash(index + 1) - 0.5) * 3.8;
      this.positions[offset + 1] = (hash(index + 2) - 0.5) * 2.2;
      this.positions[offset + 2] = (hash(index + 3) - 0.5) * 0.7;
      // These hashes do not depend on a hand or time. Compute once, not up to
      // 72,000 times per animation frame while the detector is also running.
      const seed = index * 6;
      const t = hash(index * 1.913 + 311);
      this.motionSeeds[seed] = t;
      this.motionSeeds[seed + 1] = hash(index + 313) * 2.4;
      this.motionSeeds[seed + 2] = Math.sin(t * Math.PI) * (hash(index + 314) - 0.18);
      this.motionSeeds[seed + 3] = (hash(index + 315) - 0.5) * 0.13;
      this.motionSeeds[seed + 4] = hash(index + 17) * 0.5;
      this.motionSeeds[seed + 5] = 0.08 + hash(index + 19) * 0.12;
    }
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.colorAttribute = new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute("position", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    this.geometry.setDrawRange(0, count);
    this.material = new THREE.PointsMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      size: reducedMotion ? 0.019 : 0.015,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(this.geometry, this.material);
    points.frustumCulled = false;
    this.group.add(points);
    this.group.position.z = -5;
    this.group.visible = false;
    this.setColors(0);
    this.rebuildTargets();
    void document.fonts?.ready.then(() => {
      if (!this.disposed) {
        this.targetKey = "";
        this.rebuildTargets();
      }
    });
  }

  setContext(context: GestureParticleContext): void {
    const stepChanged = context.step !== this.context.step;
    this.context = context;
    this.targetOpacity = context.visible ? 0.84 : 0;
    if (stepChanged) this.setColors(context.step);
    const dataValue = context.step === 0 ? context.totalSold : context.step === 1 ? context.reserve : context.totalRecovered;
    this.material.size = (this.reducedMotion ? 0.018 : 0.014) + Math.min(0.004, dataValue / 30_000);
    this.rebuildTargets();
  }

  resize(aspect: number): void {
    // The field sits five units in front of DigitalOrbit's 32-degree camera.
    // Palm input spans that full visible plane, not the inset text safe area.
    this.viewportWidth = this.viewportHeight * aspect;
    const nextHeight = aspect < 1 ? 2.25 : 2.62;
    const nextWidth = nextHeight * Math.max(1, aspect);
    if (Math.abs(nextWidth - this.fieldWidth) < 0.08 && Math.abs(nextHeight - this.fieldHeight) < 0.08) return;
    this.fieldWidth = nextWidth;
    this.fieldHeight = nextHeight;
    this.targetKey = "";
    this.rebuildTargets();
  }

  update(deltaMs: number, now: number, hand: HandMirrorVisualState): void {
    this.material.opacity = lerp(this.material.opacity, this.targetOpacity, this.targetOpacity > 0 ? 0.08 : 0.14);
    this.group.visible = this.material.opacity > 0.006;
    if (!this.group.visible) return;

    const delta = Math.min(0.034, deltaMs / 1000);
    const { coreWeight, disperseWeight, rightPullStrength } = handFieldPolicy(hand);
    const bothHands = hand.leftDetected && hand.rightDetected;
    const handSpan = bothHands ? Math.hypot(hand.rightPalmX - hand.leftPalmX, hand.rightPalmY - hand.leftPalmY) : 0;
    const filamentWeight = bothHands ? clamp(0.18 + handSpan * 0.22, 0, 0.42) : 0;
    const textWeight = Math.max(0, 1 - coreWeight - disperseWeight) * (1 - filamentWeight);
    const targetOpacity = this.targetOpacity + (hand.active ? hand.motionEnergy * 0.13 : 0);
    this.material.opacity = lerp(this.material.opacity, targetOpacity, targetOpacity > 0 ? 0.08 : 0.14);
    this.material.size = lerp(this.material.size, (this.reducedMotion ? 0.018 : 0.0145) + hand.motionEnergy * 0.008, 0.05);
    const pulse = this.reducedMotion ? 1 : 1 + (coreWeight * 0.018 + hand.motionEnergy * 0.012) * Math.sin(now * Math.PI * 0.002);
    const drift = this.reducedMotion ? 0 : disperseWeight * 0.000055 * deltaMs;
    this.group.rotation.z += drift + (hand.rightRotation * disperseWeight * 0.04 - this.group.rotation.z) * 0.012;
    this.group.scale.setScalar(pulse);

    const leftPalmX = (hand.leftPalmX - 0.5) * this.viewportWidth;
    const leftPalmY = (0.5 - hand.leftPalmY) * this.viewportHeight;
    const rightPalmX = (hand.rightPalmX - 0.5) * this.viewportWidth;
    const rightPalmY = (0.5 - hand.rightPalmY) * this.viewportHeight;
    const leftStrength = hand.active ? hand.leftRepelStrength : 0;
    // Only the left palm repels. The right hand attracts locally when pinched;
    // open/fist poses change the whole shape instead of duplicating left-palm push.
    const rightStrength = rightPullStrength;
    const spring = this.reducedMotion ? 8.2 : 7.1;
    const damping = this.reducedMotion ? 0.82 : 0.87 - hand.motionEnergy * 0.025;
    const count = this.visibleCount;
    const filamentDx = rightPalmX - leftPalmX;
    const filamentDy = rightPalmY - leftPalmY;
    const filamentLength = Math.max(0.01, Math.hypot(filamentDx, filamentDy));
    const normalX = -filamentDy / filamentLength;
    const normalY = filamentDx / filamentLength;
    const ribbonWidth = 0.018 + (1 - Math.max(hand.leftPinch, hand.rightPinch)) * 0.055 + hand.motionEnergy * 0.035;
    const arcScale = 0.12 + hand.motionEnergy * 0.16;
    const disperseAngle = now * 0.00004 * (0.3 + disperseWeight);

    if (leftStrength > 0.05 && now - this.lastTrailAt > 42) {
      const trailOffset = this.leftTrailCursor * 5;
      this.leftTrail[trailOffset] = leftPalmX;
      this.leftTrail[trailOffset + 1] = leftPalmY;
      this.leftTrail[trailOffset + 2] = now;
      this.leftTrail[trailOffset + 3] = leftStrength;
      this.leftTrail[trailOffset + 4] = 0.34 + hand.leftPalmSize * 0.58 + hand.motionEnergy * 0.16;
      this.leftTrailCursor = (this.leftTrailCursor + 1) % 12;
      this.lastTrailAt = now;
    }

    let trailCount = 0;
    for (let index = 0; index < 12; index += 1) {
      const source = index * 5;
      const age = now - this.leftTrail[source + 2];
      if (age < 0 || age > 1400 || this.leftTrail[source + 3] <= 0) continue;
      const recovery = 1 - age / 1400;
      const radius = this.leftTrail[source + 4] * (0.74 + recovery * 0.26);
      const target = trailCount++ * 5;
      this.activeTrails[target] = this.leftTrail[source];
      this.activeTrails[target + 1] = this.leftTrail[source + 1];
      this.activeTrails[target + 2] = radius;
      this.activeTrails[target + 3] = radius * radius;
      this.activeTrails[target + 4] = recovery * this.leftTrail[source + 3] * 0.0048;
    }

    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      let targetX = this.textTargets[offset] * textWeight
        + this.coreTargets[offset] * coreWeight * (1 - filamentWeight)
        + this.disperseTargets[offset] * disperseWeight * (1 - filamentWeight);
      let targetY = this.textTargets[offset + 1] * textWeight
        + this.coreTargets[offset + 1] * coreWeight * (1 - filamentWeight)
        + this.disperseTargets[offset + 1] * disperseWeight * (1 - filamentWeight);
      let targetZ = this.textTargets[offset + 2] * textWeight
        + this.coreTargets[offset + 2] * coreWeight * (1 - filamentWeight)
        + this.disperseTargets[offset + 2] * disperseWeight * (1 - filamentWeight);

      if (filamentWeight > 0) {
        const seed = index * 6;
        const t = this.motionSeeds[seed];
        const wave = Math.sin(t * Math.PI * 5 + now * 0.0022 + this.motionSeeds[seed + 1]);
        const arc = this.motionSeeds[seed + 2] * arcScale;
        const curveX = lerp(leftPalmX, rightPalmX, t) + normalX * (ribbonWidth * wave + arc);
        const curveY = lerp(leftPalmY, rightPalmY, t) + normalY * (ribbonWidth * wave + arc);
        targetX += curveX * filamentWeight;
        targetY += curveY * filamentWeight;
        targetZ += (this.motionSeeds[seed + 3] + wave * 0.035) * filamentWeight;
      }

      if (!this.reducedMotion && disperseWeight > 0.05) {
        const angle = disperseAngle + this.motionSeeds[index * 6 + 4] + hand.rightRotation * this.motionSeeds[index * 6 + 5];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = targetX * cos - targetY * sin;
        targetY = targetX * sin + targetY * cos;
        targetX = rotatedX;
      }

      let velocityX = this.velocities[offset] + (targetX - this.positions[offset]) * spring * delta;
      let velocityY = this.velocities[offset + 1] + (targetY - this.positions[offset + 1]) * spring * delta;
      let velocityZ = this.velocities[offset + 2] + (targetZ - this.positions[offset + 2]) * spring * delta;

      for (let handIndex = 0; handIndex < 2; handIndex += 1) {
        const palmX = handIndex === 0 ? leftPalmX : rightPalmX;
        const palmY = handIndex === 0 ? leftPalmY : rightPalmY;
        const strength = handIndex === 0 ? leftStrength : rightStrength;
        const motionX = handIndex === 0 ? hand.leftVelocityX : hand.rightVelocityX;
        const motionY = handIndex === 0 ? hand.leftVelocityY : hand.rightVelocityY;
        if (strength <= 0.015) continue;
        if (handIndex === 1 && leftStrength > 0.015) {
          const leftRadius = 0.4 + hand.leftPalmSize * 0.66 + leftStrength * 0.15 + hand.motionEnergy * 0.2;
          const leftDx = this.positions[offset] - leftPalmX;
          const leftDy = this.positions[offset + 1] - leftPalmY;
          if (leftDx * leftDx + leftDy * leftDy < leftRadius * leftRadius) continue;
        }
        const dx = this.positions[offset] - palmX;
        const dy = this.positions[offset + 1] - palmY;
        const palmSize = handIndex === 0 ? hand.leftPalmSize : hand.rightPalmSize;
        const radius = 0.4 + palmSize * 0.66 + strength * 0.15 + hand.motionEnergy * 0.2;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared >= radius * radius) continue;
        const distance = Math.max(0.025, Math.sqrt(distanceSquared));
        const falloff = 1 - distance / radius;
        const direction = handIndex === 0 ? 1 : -1;
        const force = falloff * strength * (0.03 + hand.motionEnergy * 0.028) * direction;
        velocityX += (dx / distance) * force + motionX * falloff * 0.006;
        velocityY += (dy / distance) * force - motionY * falloff * 0.006;
        velocityX += (-dy / distance) * hand.motionEnergy * falloff * 0.009;
        velocityY += (dx / distance) * hand.motionEnergy * falloff * 0.009;
        velocityZ += Math.abs(force) * 0.42;
      }

      for (let trailIndex = 0; trailIndex < trailCount; trailIndex += 1) {
        const trailOffset = trailIndex * 5;
        const trailX = this.activeTrails[trailOffset];
        const trailY = this.activeTrails[trailOffset + 1];
        const trailRadius = this.activeTrails[trailOffset + 2];
        const trailDx = this.positions[offset] - trailX;
        const trailDy = this.positions[offset + 1] - trailY;
        const trailDistanceSquared = trailDx * trailDx + trailDy * trailDy;
        if (trailDistanceSquared >= this.activeTrails[trailOffset + 3]) continue;
        const trailDistance = Math.max(0.03, Math.sqrt(trailDistanceSquared));
        const trailFalloff = 1 - trailDistance / trailRadius;
        const trailForce = trailFalloff * this.activeTrails[trailOffset + 4];
        velocityX += (trailDx / trailDistance) * trailForce;
        velocityY += (trailDy / trailDistance) * trailForce;
      }

      if (hand.rightDetected && Math.abs(hand.rightRotation) > 0.04) {
        const dx = this.positions[offset] - rightPalmX;
        const dy = this.positions[offset + 1] - rightPalmY;
        const distance = Math.max(0.08, Math.hypot(dx, dy));
        const rotationalFalloff = clamp(1 - distance / (0.9 + hand.rightPalmSize * 0.8));
        const rotationForce = hand.rightRotation * rotationalFalloff * (0.0028 + disperseWeight * 0.0042);
        velocityX += (-dy / distance) * rotationForce;
        velocityY += (dx / distance) * rotationForce;
      }

      velocityX *= damping;
      velocityY *= damping;
      velocityZ *= damping;
      const speed = Math.hypot(velocityX, velocityY, velocityZ);
      const maxSpeed = 0.054 + hand.motionEnergy * 0.022;
      if (speed > maxSpeed) {
        const speedScale = maxSpeed / speed;
        velocityX *= speedScale;
        velocityY *= speedScale;
        velocityZ *= speedScale;
      }
      this.velocities[offset] = velocityX;
      this.velocities[offset + 1] = velocityY;
      this.velocities[offset + 2] = velocityZ;
      this.positions[offset] += velocityX;
      this.positions[offset + 1] += velocityY;
      this.positions[offset + 2] += velocityZ;
    }
    this.positionAttribute.needsUpdate = true;
  }

  adaptPerformance(fps: number): void {
    if (fps > 0 && fps < 42 && this.visibleCount > Math.floor(this.count * 0.58)) {
      this.visibleCount = Math.max(Math.floor(this.count * 0.58), Math.floor(this.visibleCount * 0.82));
      this.geometry.setDrawRange(0, this.visibleCount);
    } else if (fps > 56 && this.visibleCount < this.count) {
      this.visibleCount = Math.min(this.count, this.visibleCount + Math.ceil(this.count * 0.06));
      this.geometry.setDrawRange(0, this.visibleCount);
    }
  }

  dispose(): void {
    this.disposed = true;
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }

  private setColors(step: 0 | 1 | 2): void {
    const palette = PALETTES[step];
    for (let index = 0; index < this.count; index += 1) {
      const color = new THREE.Color(palette[Math.floor(hash(index + step * 37) * palette.length) % palette.length]);
      const offset = index * 3;
      this.colors[offset] = color.r;
      this.colors[offset + 1] = color.g;
      this.colors[offset + 2] = color.b;
    }
    this.colorAttribute.needsUpdate = true;
  }

  private rebuildTargets(): void {
    const dataValue = this.context.step === 0
      ? this.context.totalSold
      : this.context.step === 1
        ? this.context.reserve
        : this.context.countdownRemaining ?? this.context.totalRecovered;
    const key = `${this.context.step}:${Math.round(this.fieldWidth * 10)}:${Math.round(this.fieldHeight * 10)}:${Math.round(dataValue / 5)}`;
    if (key === this.targetKey) return;
    this.targetKey = key;
    this.buildTextTargets(LABELS[this.context.step], dataValue);
    this.buildCoreTargets();
    this.buildDisperseTargets();
  }

  private buildTextTargets(label: string, dataValue: number): void {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 300;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    let fontSize = 164;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    do {
      context.font = `500 ${fontSize}px \"Helvetica Neue\", Arial, sans-serif`;
      if (context.measureText(label).width <= 1080) break;
      fontSize -= 6;
    } while (fontSize > 72);
    context.fillText(label, canvas.width / 2, canvas.height / 2);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const samples: number[] = [];
    const stride = this.count > 10_000 ? 4 : 3;
    for (let y = 8; y < canvas.height - 8; y += stride) {
      for (let x = 8; x < canvas.width - 8; x += stride) {
        if (pixels[(y * canvas.width + x) * 4 + 3] > 90) samples.push(x, y);
      }
    }
    const sampleCount = Math.max(1, samples.length / 2);
    const depthScale = Math.min(1, dataValue / 120);
    for (let index = 0; index < this.count; index += 1) {
      const sampleIndex = (index * 7919 + this.context.step * 101) % sampleCount;
      const x = samples[sampleIndex * 2] ?? canvas.width / 2;
      const y = samples[sampleIndex * 2 + 1] ?? canvas.height / 2;
      const offset = index * 3;
      this.textTargets[offset] = (x / canvas.width - 0.5) * this.fieldWidth * 0.92 + (hash(index + 7) - 0.5) * 0.012;
      this.textTargets[offset + 1] = (0.5 - y / canvas.height) * this.fieldHeight * 0.78 + (hash(index + 8) - 0.5) * 0.012;
      this.textTargets[offset + 2] = (hash(index + 9) - 0.5) * (0.08 + depthScale * 0.12);
    }
  }

  private buildCoreTargets(): void {
    const maxRadius = Math.min(1.04, this.fieldHeight * 0.39);
    const ringRadii = [0.28, 0.46, 0.68, 0.88, 1].map((value) => value * maxRadius);
    for (let index = 0; index < this.count; index += 1) {
      const offset = index * 3;
      const ring = index % ringRadii.length;
      let angle = hash(index * 3 + 41) * Math.PI * 2;
      const gap = (ring * 0.83 + this.context.step * 0.47) % (Math.PI * 2);
      const delta = Math.atan2(Math.sin(angle - gap), Math.cos(angle - gap));
      if (Math.abs(delta) < 0.2 + ring * 0.018) angle += 0.28 + ring * 0.02;
      const fragmentNoise = index % 11 === 0 ? (hash(index + 50) - 0.5) * 0.18 : (hash(index + 50) - 0.5) * 0.028;
      const radius = ringRadii[ring] + fragmentNoise;
      this.coreTargets[offset] = Math.cos(angle) * radius;
      this.coreTargets[offset + 1] = Math.sin(angle) * radius;
      this.coreTargets[offset + 2] = Math.sin(angle * 3 + ring) * 0.11 + (hash(index + 51) - 0.5) * 0.06;
    }
  }

  private buildDisperseTargets(): void {
    for (let index = 0; index < this.count; index += 1) {
      const offset = index * 3;
      const angle = hash(index + 101) * Math.PI * 2;
      const radius = Math.pow(hash(index + 102), 0.62);
      this.disperseTargets[offset] = Math.cos(angle) * radius * this.fieldWidth * 0.52;
      this.disperseTargets[offset + 1] = Math.sin(angle) * radius * this.fieldHeight * 0.5;
      this.disperseTargets[offset + 2] = (hash(index + 103) - 0.5) * 1.15;
    }
  }
}
