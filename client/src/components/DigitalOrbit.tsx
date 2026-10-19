import { useEffect, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { TIME_OPTIONS, type InstallationSnapshot, type InteractionScreen } from "@timevault/shared";
import {
  createActiveFragment,
  createBrokenArc,
  createMicroGeometry,
  createOrbitMaterials,
  createReserveObject,
  disposeObject,
  getVisualStructureSpecs,
  type OrbitMaterials,
} from "../visual/orbitGeometry";
import { createTemporalApparatus } from "../visual/apparatusGeometry";
import { CoverSculpture, type CoverControlState } from "../visual/coverSculpture";
import { SelectionFragmentField } from "../visual/selectionFragmentField";
import { GestureParticleField } from "../visual/gestureParticles";
import type { HandMirrorVisualState, VisualDebugOptions } from "../visual/types";
import { OrbitFallback } from "./OrbitFallback";

interface SceneState {
  snapshot: InstallationSnapshot;
  debug: VisualDebugOptions;
  introActive: boolean;
  screenEnteredAt: number;
  inputPulseAt: number;
}

interface SceneApi {
  sync: (snapshot: InstallationSnapshot, debug: VisualDebugOptions, introActive: boolean, handMirrorEnabled: boolean) => void;
  dispose: () => void;
}

const easeOut = (value: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
const mix = (from: number, to: number, amount: number) => from + (to - from) * amount;
const RECEIPT_SCREENS = new Set<InteractionScreen>([
  "CONFIRMATION", "TRANSACTION_PROCESSING", "TRANSACTION_COMPLETE", "BUYBACK_COUNTDOWN", "BUYBACK_COMPLETE",
]);

function activeScreen(screen: InteractionScreen): boolean {
  return [
    "TIME_SELECTION",
    "CONFIRMATION",
    "TRANSACTION_PROCESSING",
    "TRANSACTION_COMPLETE",
    "BUYBACK_COUNTDOWN",
    "BUYBACK_COMPLETE",
  ].includes(screen);
}

export function DigitalOrbit({
  snapshot,
  debug,
  introActive = false,
  handMirrorEnabled = false,
  handMirrorRef,
  coverControlRef,
}: {
  snapshot: InstallationSnapshot;
  debug: VisualDebugOptions;
  introActive?: boolean;
  handMirrorEnabled?: boolean;
  handMirrorRef: MutableRefObject<HandMirrorVisualState>;
  coverControlRef: MutableRefObject<CoverControlState>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SceneApi | null>(null);
  const [fallback, setFallback] = useState(false);
  const [fps, setFps] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      setFallback(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.32;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.055);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 7.05);
    scene.add(camera);

    const world = new THREE.Group();
    const guideGroup = new THREE.Group();
    const reserveGroup = new THREE.Group();
    const activeGroup = new THREE.Group();
    const anchorGroup = new THREE.Group();
    const spineGroup = new THREE.Group();
    const pointerTrailGroup = new THREE.Group();
    const timeBandGroup = new THREE.Group();
    const apparatus = createTemporalApparatus();
    world.add(timeBandGroup, apparatus.group, guideGroup, spineGroup, pointerTrailGroup, reserveGroup, activeGroup, anchorGroup);
    scene.add(world);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particleCount = reducedMotion ? 4_800 : window.innerWidth < 1280 ? 8_200 : 12_000;
    const gestureParticles = new GestureParticleField(particleCount, reducedMotion);
    camera.add(gestureParticles.group);
    const coverSculpture = new CoverSculpture(renderer, reducedMotion);
    const selectionField = new SelectionFragmentField(reducedMotion);
    camera.add(coverSculpture.group, selectionField.group);

    const materials = createOrbitMaterials();
    const ambient = new THREE.AmbientLight(0x8095d8, 0.84);
    const keyLight = new THREE.DirectionalLight(0xd9e1ff, 3.2);
    keyLight.position.set(-2, 3, 5);
    const violetLight = new THREE.PointLight(0x8d63ff, 12, 12, 1.8);
    violetLight.position.set(2.4, -1.7, 2.8);
    scene.add(ambient, keyLight, violetLight);

    const timeBandMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x5c5962,
      emissive: 0x111018,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.024,
      metalness: 0.05,
      roughness: 0.42,
      clearcoat: 0.34,
      clearcoatRoughness: 0.48,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const timeBandSpecs = [
      { inner: 3.0, outer: 3.17, start: -2.84, length: 1.38, z: -0.48 },
      { inner: 3.26, outer: 3.4, start: -2.72, length: 1.14, z: -0.54 },
      { inner: 3.5, outer: 3.61, start: -2.58, length: 0.94, z: -0.6 },
    ];
    for (const band of timeBandSpecs) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(band.inner, band.outer, 96, 1, band.start, band.length),
        timeBandMaterial,
      );
      mesh.position.z = band.z;
      timeBandGroup.add(mesh);
    }

    guideGroup.add(createBrokenArc(2.55, -2.72, 1.62, materials.trace));
    guideGroup.add(createBrokenArc(2.55, -0.72, 1.1, materials.trace));
    guideGroup.add(createBrokenArc(2.55, 0.72, 1.42, materials.trace));
    guideGroup.add(createBrokenArc(1.67, -2.1, 3.7, materials.trace));
    guideGroup.add(createBrokenArc(1.05, -0.5, 4.4, materials.trace));

    const spineMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x6f4ee8,
      emissive: 0x2a145f,
      emissiveIntensity: 0.72,
      transparent: true,
      opacity: 0.16,
      metalness: 0.18,
      roughness: 0.16,
      clearcoat: 0.92,
      clearcoatRoughness: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let index = 0; index < 16; index += 1) {
      const fragment = new THREE.Mesh(createMicroGeometry(0.46 + (index % 5) * 0.1), spineMaterial);
      const angle = index * 2.399 + 0.35;
      const radius = 1.6 + (index % 4) * 0.58;
      const baseX = Math.cos(angle) * radius + 0.45;
      const baseY = Math.sin(angle) * radius;
      const layer = index % 3;
      fragment.position.set(baseX, baseY, -0.72 + layer * 0.24);
      fragment.rotation.set((index % 3) * 0.2, (index % 4) * 0.32, -0.56 + index * 0.19);
      fragment.userData.phase = index * 0.83;
      fragment.userData.baseX = baseX;
      fragment.userData.baseY = baseY;
      fragment.userData.layer = layer;
      spineGroup.add(fragment);
    }

    const pointerTrailMaterials: THREE.MeshPhysicalMaterial[] = [];
    for (let index = 0; index < 10; index += 1) {
      const material = new THREE.MeshPhysicalMaterial({
        color: index < 3 ? 0xd6c7ff : 0x8f68ef,
        emissive: index < 3 ? 0x5e36a8 : 0x271250,
        emissiveIntensity: 0.62,
        transparent: true,
        opacity: Math.max(0.08, 0.5 - index * 0.04),
        metalness: 0.12,
        roughness: 0.2,
        clearcoat: 0.9,
        clearcoatRoughness: 0.16,
        depthWrite: false,
      });
      pointerTrailMaterials.push(material);
      const fragment = new THREE.Mesh(createMicroGeometry(0.18 + (index % 3) * 0.04), material);
      fragment.position.set(0, 0, 0.74 - index * 0.055);
      fragment.scale.setScalar(1 - index * 0.065);
      fragment.userData.phase = index * 0.71;
      pointerTrailGroup.add(fragment);
    }

    const radialPositions: number[] = [];
    for (const angle of [-2.55, -1.84, -0.92, 0.5, 1.28, 2.58]) {
      radialPositions.push(Math.cos(angle) * 1.25, Math.sin(angle) * 1.25, -0.1);
      radialPositions.push(Math.cos(angle) * 2.78, Math.sin(angle) * 2.78, -0.1);
    }
    const radialGeometry = new THREE.BufferGeometry();
    radialGeometry.setAttribute("position", new THREE.Float32BufferAttribute(radialPositions, 3));
    guideGroup.add(new THREE.LineSegments(radialGeometry, materials.trace));

    const atmosphereGeometry = new THREE.BufferGeometry();
    const atmospherePositions: number[] = [];
    for (let index = 0; index < 72; index += 1) {
      const radius = 2.9 + ((index * 37) % 19) * 0.075;
      const angle = index * 2.399;
      atmospherePositions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, -0.7 + (index % 7) * 0.18);
    }
    atmosphereGeometry.setAttribute("position", new THREE.Float32BufferAttribute(atmospherePositions, 3));
    const atmosphereMaterial = new THREE.PointsMaterial({ color: 0x7583b8, transparent: true, opacity: 0.16, size: 0.018 });
    const atmosphere = new THREE.Points(atmosphereGeometry, atmosphereMaterial);
    world.add(atmosphere);

    for (let index = 0; index < 16; index += 1) {
      const angle = -Math.PI * 0.78 + (index / 16) * Math.PI * 1.56;
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xff69db, wireframe: true }),
      );
      marker.position.set(Math.cos(angle) * 2.4, Math.sin(angle) * 2.4, 0.45);
      anchorGroup.add(marker);
    }

    const pointer = new THREE.Vector2();
    const previousPointer = new THREE.Vector2();
    let pointerEnergy = 0;
    let pointerActiveAt = -Infinity;
    const state: SceneState = { snapshot, debug, introActive, screenEnteredAt: performance.now(), inputPulseAt: 0 };
    let compositionKey = "";
    let activeKey = "";
    let previousScreen = snapshot.interaction.currentScreen;
    let previousMinutes = snapshot.interaction.selectedMinutes;
    let frameCount = 0;
    let lastFpsAt = performance.now();
    let lastFrameAt = performance.now();

    const rebuildReserve = () => {
      disposeObject(reserveGroup);
      for (const spec of getVisualStructureSpecs(state.snapshot.composition.structures)) {
        reserveGroup.add(createReserveObject(spec, materials));
      }
    };

    const rebuildActive = () => {
      disposeObject(activeGroup);
      selectionField.setFragments(0, materials.active);
      if (!activeScreen(state.snapshot.interaction.currentScreen)) return;
      const count = Math.min(12, state.snapshot.interaction.selectedMinutes / 5);
      const material = state.snapshot.interaction.currentMode === "BUY" ? materials.recovered : materials.active;
      if (state.snapshot.interaction.currentScreen === "TIME_SELECTION") {
        selectionField.setFragments(count, material);
        return;
      }
      for (let index = 0; index < count; index += 1) activeGroup.add(createActiveFragment(index, count, material));
    };

    const sync = (
      nextSnapshot: InstallationSnapshot,
      nextDebug: VisualDebugOptions,
      nextIntroActive: boolean,
      nextHandMirrorEnabled: boolean,
    ) => {
      state.snapshot = nextSnapshot;
      state.debug = nextDebug;
      state.introActive = nextIntroActive;
      const nextCompositionKey = nextSnapshot.composition.structures
        .map((structure) => `${structure.id}:${structure.kind}:${structure.minutes}`)
        .join("|");
      if (nextCompositionKey !== compositionKey) {
        compositionKey = nextCompositionKey;
        rebuildReserve();
      }
      const nextActiveKey = `${nextSnapshot.interaction.currentScreen}:${nextSnapshot.interaction.currentMode}:${nextSnapshot.interaction.selectedMinutes}`;
      if (nextActiveKey !== activeKey) {
        activeKey = nextActiveKey;
        rebuildActive();
      }
      if (nextSnapshot.interaction.currentScreen !== previousScreen) {
        previousScreen = nextSnapshot.interaction.currentScreen;
        state.screenEnteredAt = performance.now();
      }
      if (nextSnapshot.interaction.selectedMinutes !== previousMinutes) {
        previousMinutes = nextSnapshot.interaction.selectedMinutes;
        state.inputPulseAt = performance.now();
      }
      anchorGroup.visible = nextDebug.showOrbitAnchors;
      gestureParticles.setContext({
        visible: nextHandMirrorEnabled && nextSnapshot.interaction.currentScreen === "REFLECTION",
        step: nextSnapshot.interaction.reflectionStep,
        totalSold: nextSnapshot.account.totalSold,
        reserve: nextSnapshot.account.timeReserve,
        totalRecovered: nextSnapshot.account.totalRecovered,
        countdownRemaining: nextSnapshot.countdown?.remainingSeconds ?? null,
      });
    };

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      gestureParticles.resize(camera.aspect);
      coverSculpture.resize(camera.aspect, width, height);
      selectionField.resize(width, height);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();
    const onLayoutScroll = () => {
      if (state.snapshot.interaction.currentScreen === "TIME_SELECTION") selectionField.measure();
      if (state.snapshot.interaction.currentScreen === "IDLE") coverSculpture.measureReserveStage();
    };
    const onLayoutSettled = (event: AnimationEvent) => {
      if (event.animationName === "v31-selection-enter") onLayoutScroll();
    };
    window.addEventListener("scroll", onLayoutScroll, true);
    window.addEventListener("animationend", onLayoutSettled, true);

    const onPointerMove = (event: PointerEvent) => {
      const nextX = (event.clientX / window.innerWidth) * 2 - 1;
      const nextY = -((event.clientY / window.innerHeight) * 2 - 1);
      pointerEnergy = Math.min(1.4, pointerEnergy + Math.hypot(nextX - previousPointer.x, nextY - previousPointer.y) * 5.5);
      pointer.set(nextX, nextY);
      previousPointer.copy(pointer);
      pointerActiveAt = performance.now();
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const animate = (now: number) => {
      const delta = Math.min(34, now - lastFrameAt);
      lastFrameAt = now;
      if (document.hidden) return;
      const { interaction } = state.snapshot;
      const screen = interaction.currentScreen;
      const inState = (now - state.screenEnteredAt) / 1000;
      const pulse = Math.exp(-(now - state.inputPulseAt) / 540);
      const quiet = screen === "BUYBACK_COUNTDOWN";
      const intro = state.introActive && screen === "IDLE";
      const blackField = screen !== "IDLE";
      const receiptScreen = RECEIPT_SCREENS.has(screen);
      const durationIndex = Math.max(0, TIME_OPTIONS.indexOf(interaction.selectedMinutes));
      const flowIndex = screen === "REFLECTION" ? interaction.reflectionStep - 1 : durationIndex - 2;
      const targetX = intro ? 0.82 : ["HISTORY", "REFLECTION"].includes(screen) ? 1.85 : screen === "TIME_SELECTION" ? 1.04 : screen === "IDLE" ? 1.18 : 0.45;
      const targetY = screen === "TIME_SELECTION" ? flowIndex * -0.16 : screen === "REFLECTION" ? flowIndex * -0.1 : 0;
      const targetScale = intro ? 1.18 : quiet ? 0.86 : screen === "TIME_SELECTION" ? 1.08 : screen === "IDLE" ? 1.1 : 1;
      world.position.x += (targetX - world.position.x) * 0.045;
      world.position.y += (targetY - world.position.y) * 0.055;
      world.scale.x += (targetScale + pulse * 0.018 - world.scale.x) * 0.045;
      world.scale.y += (targetScale + pulse * 0.018 - world.scale.y) * 0.045;
      camera.position.x += (pointer.x * (intro ? 0.34 : 0.17) - camera.position.x) * (intro ? 0.034 : 0.022);
      camera.position.y += (pointer.y * (intro ? 0.24 : 0.12) - camera.position.y) * (intro ? 0.034 : 0.022);
      world.rotation.x += ((intro ? pointer.y * 0.035 : 0) - world.rotation.x) * 0.028;
      world.rotation.y += ((intro ? pointer.x * 0.05 : 0) - world.rotation.y) * 0.028;
      camera.lookAt(world.position.x * 0.12, 0, 0);
      violetLight.intensity = (intro ? 10.4 : quiet ? 4.2 : 7.4) + pulse * 5;
      violetLight.position.x = 2.4 + pointer.x * (intro ? 1.1 : 0.25);
      violetLight.position.y = -1.7 + pointer.y * (intro ? 0.85 : 0.2);
      reserveGroup.rotation.z += delta * (intro ? 0.00018 : quiet ? 0.000018 : 0.000055);
      guideGroup.rotation.z -= delta * (intro ? 0.000075 : quiet ? 0.000006 : 0.000014);
      reserveGroup.visible = state.debug.showClusterGroups && !blackField && !intro;
      guideGroup.visible = state.debug.showOrbitAnchors && !blackField && !intro;
      atmosphere.visible = false;
      timeBandGroup.visible = false;
      timeBandGroup.rotation.z += delta * (intro ? 0.00013 : screen === "TIME_SELECTION" ? 0.000055 : 0.000024);
      timeBandGroup.position.y += ((screen === "TIME_SELECTION" ? flowIndex * -0.22 : screen === "REFLECTION" ? flowIndex * -0.14 : 0) - timeBandGroup.position.y) * 0.06;
      timeBandGroup.position.x = Math.sin(now * 0.00018) * (intro ? 0.12 : 0.035);
      timeBandMaterial.opacity = intro ? 0.022 + Math.sin(now * 0.00052) * 0.004 : screen === "TIME_SELECTION" ? 0.019 : 0.012;
      atmosphere.rotation.z += delta * (intro ? 0.000028 : 0.000009);
      atmosphere.rotation.x = intro ? Math.sin(now * 0.00016) * 0.025 : 0;
      atmosphereMaterial.opacity = intro ? 0.28 : 0.16;
      // The cover's continuous time weave replaces decorative loose shards.
      spineGroup.visible = false;
      spineGroup.rotation.z += delta * (intro ? 0.000032 : 0.000008);
      spineGroup.children.forEach((fragment, index) => {
        const phase = Number(fragment.userData.phase ?? 0);
        const baseX = Number(fragment.userData.baseX ?? 0);
        const baseY = Number(fragment.userData.baseY ?? 0);
        const layer = Number(fragment.userData.layer ?? 0);
        fragment.rotation.z += delta * (index % 2 ? 0.00012 : -0.00009);
        fragment.rotation.y += delta * (index % 3 ? 0.00006 : -0.00008);
        fragment.position.z = -0.74 + layer * 0.24 + Math.sin(now * (0.00038 + layer * 0.00008) + phase) * 0.16;
        fragment.position.x = baseX + Math.sin(now * 0.00022 + phase) * (0.08 + layer * 0.04) + pointer.x * (0.035 + layer * 0.04);
        fragment.position.y = baseY + Math.cos(now * 0.00018 + phase) * (0.07 + layer * 0.035) + pointer.y * (0.025 + layer * 0.035);
        const hoverDx = fragment.position.x - pointer.x * 3.1;
        const hoverDy = fragment.position.y - pointer.y * 1.8;
        const hoverDistance = Math.max(0.08, Math.hypot(hoverDx, hoverDy));
        const hoverPush = Math.max(0, 1 - hoverDistance / 0.9) * pointerEnergy * 0.14;
        fragment.position.x += (hoverDx / hoverDistance) * hoverPush;
        fragment.position.y += (hoverDy / hoverDistance) * hoverPush;
        fragment.scale.setScalar(0.82 + layer * 0.14 + Math.sin(now * 0.00044 + phase) * 0.05);
      });
      pointerEnergy += (0 - pointerEnergy) * 0.055;
      apparatus.group.visible = !intro && screen !== "IDLE" && screen !== "TIME_SELECTION" && screen !== "HISTORY" && !receiptScreen;
      apparatus.group.rotation.y = reducedMotion ? 0 : Math.sin(now * 0.00016) * 0.055 + pointer.x * 0.025;
      apparatus.group.rotation.x = reducedMotion ? 0 : Math.cos(now * 0.00013) * 0.016 - pointer.y * 0.012;
      apparatus.group.position.y = 0.2 + (reducedMotion ? 0 : Math.sin(now * 0.00022) * 0.035);
      apparatus.setPresence(
        screen === "REFLECTION" ? 0.075 : screen === "BUYBACK_COUNTDOWN" ? 0.18 : activeScreen(screen) ? 0.26 : 0.22,
        reducedMotion ? 1 : 0.72 + Math.sin(now * 0.0014) * 0.28 + pulse * 0.32,
      );
      const trailFade = Math.max(0, 1 - (now - pointerActiveAt) / 1800);
      pointerTrailGroup.visible = !intro && screen !== "TIME_SELECTION" && !receiptScreen && (activeScreen(screen) || screen === "MODE_SELECTION") && trailFade > 0.015;
      pointerTrailGroup.children.forEach((fragment, index) => {
        const leader = index === 0 ? null : pointerTrailGroup.children[index - 1];
        const targetX = leader ? leader.position.x : pointer.x * 2.85 - 0.42;
        const targetY = leader ? leader.position.y : pointer.y * 1.72;
        const follow = index === 0 ? 0.19 : Math.max(0.075, 0.16 - index * 0.007);
        fragment.position.x += (targetX - fragment.position.x) * follow;
        fragment.position.y += (targetY - fragment.position.y) * follow;
        fragment.position.z = 0.8 - index * 0.06 + Math.sin(now * 0.001 + index) * 0.045;
        fragment.rotation.x += delta * (0.00016 + index * 0.000006);
        fragment.rotation.y -= delta * (0.00013 + index * 0.000005);
        fragment.rotation.z = Math.atan2(targetY - fragment.position.y, targetX - fragment.position.x) + index * 0.18;
        const scale = (1 - index * 0.055) * (0.78 + trailFade * 0.34 + pointerEnergy * 0.24);
        fragment.scale.setScalar(scale);
        pointerTrailMaterials[index].opacity = Math.max(0.025, trailFade * ((intro ? 0.58 : 0.42) - index * 0.034));
      });
      for (const object of reserveGroup.children) {
        const age = (now - Number(object.userData.bornAt ?? now)) / 900;
        const born = 0.72 + easeOut(age) * 0.28;
        const breathe = quiet ? 0 : Math.sin(now * 0.00042 + Number(object.userData.phase ?? 0)) * 0.012;
        object.scale.setScalar(born + breathe);
      }

      activeGroup.visible = activeScreen(screen) && screen !== "TIME_SELECTION" && !receiptScreen;
      const mode = interaction.currentMode;
      const countdownFraction = state.snapshot.countdown
        ? state.snapshot.countdown.remainingSeconds / Math.max(1, state.snapshot.countdown.totalSeconds)
        : 1;
      activeGroup.children.forEach((object, index) => {
        const data = object.userData as { angle: number; phase: number; count: number };
        let angle = data.angle;
        let radius = 1.16 + (index % 3) * 0.13;
        let opacity = 0.88;
        let scale = 1;
        let depth = 0.38 + (index % 3) * 0.08;

        if (mode === "SELL") {
          if (screen === "TIME_SELECTION") radius += Math.sin(now * 0.0007 + data.phase) * 0.1 + pulse * 0.3;
          if (screen === "CONFIRMATION") radius = 0.58 + index * 0.025;
          if (screen === "TRANSACTION_PROCESSING") {
            const progress = easeOut(inState / 2.05);
            radius = mix(0.58, 2.26 + (index % 2) * 0.13, progress);
            angle = mix(data.angle * 0.45, -2.45 + index * 0.42, progress);
            scale = mix(1.08, 0.82, progress);
          }
          if (screen === "TRANSACTION_COMPLETE") {
            radius = 2.3;
            opacity = Math.max(0, 1 - inState / 1.25);
            scale = 0.82;
          }
        } else {
          angle = -2.55 + index * 0.46;
          radius = 1.72 + (index % 2) * 0.09;
          if (screen === "CONFIRMATION") radius = 1.56;
          if (screen === "TRANSACTION_PROCESSING") {
            const progress = easeOut(inState / 2.05);
            radius = mix(1.68, 1.05, progress);
            angle = mix(angle, -Math.PI * 0.72 + (index / Math.max(1, data.count)) * Math.PI * 1.44, progress);
            scale = mix(0.82, 1.08, progress);
          }
          if (screen === "BUYBACK_COUNTDOWN") {
            angle = -Math.PI / 2 + (index / Math.max(1, data.count)) * Math.PI * 2;
            const threshold = (index + 0.4) / Math.max(1, data.count);
            const consumed = countdownFraction < threshold;
            radius = 1.45 + (consumed ? (threshold - countdownFraction) * 0.8 : 0);
            opacity = consumed ? 0.08 : 0.72;
            scale = consumed ? 0.18 : 0.9;
            depth = 0.3;
          }
          if (screen === "BUYBACK_COMPLETE") {
            const progress = easeOut(inState / 1.8);
            radius = mix(1.45, 2.8, progress);
            opacity = 1 - progress;
            scale = mix(0.9, 0.25, progress);
          }
        }

        object.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, depth);
        object.rotation.z = angle + Math.PI / 2 + Math.sin(now * 0.0004 + data.phase) * 0.08;
        object.visible = opacity > 0.1;
        const unitScale = Math.min(1.22, 0.92 + data.count * 0.022);
        object.scale.setScalar(scale * Math.max(0.2, opacity) * unitScale * (1 + pulse * 0.32));
      });

      coverSculpture.update(now, intro || screen === "IDLE", state.snapshot.account.timeReserve, pointer.x, pointer.y, coverControlRef.current, intro);
      selectionField.update(now, screen === "TIME_SELECTION", camera.fov);
      gestureParticles.update(delta, now, handMirrorRef.current);
      frameCount += 1;
      if (now - lastFpsAt >= 1000) {
        const measuredFps = Math.round((frameCount * 1000) / (now - lastFpsAt));
        gestureParticles.adaptPerformance(measuredFps);
        if (state.debug.showFps) setFps(measuredFps);
        frameCount = 0;
        lastFpsAt = now;
      }
      renderer.render(scene, camera);
    };

    apiRef.current = {
      sync,
      dispose: () => {
        renderer.setAnimationLoop(null);
        resizeObserver.disconnect();
        window.removeEventListener("scroll", onLayoutScroll, true);
        window.removeEventListener("animationend", onLayoutSettled, true);
        window.removeEventListener("pointermove", onPointerMove);
        disposeObject(reserveGroup);
        disposeObject(activeGroup);
        disposeObject(guideGroup);
        disposeObject(spineGroup);
        disposeObject(pointerTrailGroup);
        disposeObject(timeBandGroup);
        disposeObject(anchorGroup);
        apparatus.dispose();
        coverSculpture.dispose();
        selectionField.dispose();
        atmosphereGeometry.dispose();
        atmosphereMaterial.dispose();
        spineMaterial.dispose();
        timeBandMaterial.dispose();
        for (const material of pointerTrailMaterials) material.dispose();
        for (const material of Object.values(materials) as Array<THREE.Material>) material.dispose();
        gestureParticles.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      },
    };
    sync(snapshot, debug, introActive, handMirrorEnabled);
    renderer.setAnimationLoop(animate);

    return () => {
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, []);

  useEffect(
    () => apiRef.current?.sync(snapshot, debug, introActive, handMirrorEnabled),
    [snapshot, debug, introActive, handMirrorEnabled],
  );

  const debugVisible = Object.values(debug).some(Boolean);
  return (
    <div className={`digital-orbit-layer ${fallback ? "digital-orbit-layer--fallback" : ""}`} aria-hidden="true">
      {fallback
        ? snapshot.interaction.currentScreen === "TIME_SELECTION" ? null : <OrbitFallback snapshot={snapshot} handMirrorActive={handMirrorEnabled} />
        : <div className="digital-orbit-canvas" ref={hostRef} />}
      {debugVisible ? (
        <div className="visual-debug-overlay">
          {debug.showFps ? <span>FPS {fps}</span> : null}
          {debug.showFragmentCount ? <span>FRAGMENTS {snapshot.account.fragmentCount}</span> : null}
          {debug.showRawReserveMinutes ? <span>RESERVE {snapshot.account.timeReserve} MIN</span> : null}
          {debug.showClusterGroups ? <span>GROUPS {snapshot.composition.structures.length}</span> : null}
          {debug.showOrbitAnchors ? <span>ANCHORS 16</span> : null}
          {debug.showFragmentIds ? (
            <div>{snapshot.composition.structures.slice(0, 8).map((item) => <span key={item.id}>{item.id.slice(0, 8)}</span>)}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
