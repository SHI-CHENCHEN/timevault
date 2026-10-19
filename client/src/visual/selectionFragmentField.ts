import * as THREE from "three";
import { createActiveFragment, disposeObject } from "./orbitGeometry";
import { clockFieldSizing, clockSlot } from "./clockLayout";

export class SelectionFragmentField {
  readonly group = new THREE.Group();
  private readonly reducedMotion: boolean;
  private bounds = { x: 0, y: 0, width: 0, height: 0 };
  private viewWidth = 1;
  private viewHeight = 1;
  private readonly fieldObserver: ResizeObserver;
  private observedField: Element | null = null;

  constructor(reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    this.group.name = "selection-fragment-field";
    this.group.position.z = -5;
    this.group.visible = false;
    this.fieldObserver = new ResizeObserver(() => this.measure());
  }

  setFragments(count: number, material: THREE.Material): void {
    disposeObject(this.group);
    for (let index = 0; index < count; index += 1) {
      this.group.add(createActiveFragment(index, count, material));
    }
    this.measure();
  }

  resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.measure();
  }

  measure(): void {
    const field = document.querySelector(".fragment-clock");
    if (field !== this.observedField) {
      this.fieldObserver.disconnect();
      this.observedField = field;
      if (field) this.fieldObserver.observe(field);
    }
    if (!field) return;
    const rect = field.getBoundingClientRect();
    this.bounds = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  update(now: number, visible: boolean, fov: number): void {
    this.group.visible = visible && this.bounds.width > 0;
    if (!this.group.visible) return;
    const count = this.group.children.length;
    const planeHeight = 10 * Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const unitsPerPixel = planeHeight / this.viewHeight;
    const planeWidth = planeHeight * this.viewWidth / this.viewHeight;
    this.group.position.x = ((this.bounds.x + this.bounds.width / 2) / this.viewWidth - 0.5) * planeWidth;
    this.group.position.y = (0.5 - (this.bounds.y + this.bounds.height / 2) / this.viewHeight) * planeHeight;
    const { radius, unitPixels } = clockFieldSizing(this.bounds.width, this.bounds.height);
    const unitScale = unitPixels * unitsPerPixel / 0.46;
    for (let index = 0; index < count; index += 1) {
      const object = this.group.children[index];
      const slot = clockSlot(index);
      const phase = index * 1.73;
      const driftX = this.reducedMotion ? 0 : Math.sin(now * 0.0007 + phase) * 0.008;
      const driftY = this.reducedMotion ? 0 : Math.cos(now * 0.0006 + phase) * 0.008;
      object.position.set(slot.x * radius * unitsPerPixel + driftX, -slot.y * radius * unitsPerPixel + driftY, 0);
      object.rotation.set(-0.12, this.reducedMotion ? 0.18 : 0.18 + Math.sin(now * 0.00035 + phase) * 0.2, -slot.angle - Math.PI / 2);
      object.scale.setScalar(unitScale);
    }
  }

  dispose(): void {
    this.fieldObserver.disconnect();
    disposeObject(this.group);
  }
}
