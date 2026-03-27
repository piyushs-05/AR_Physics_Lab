import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MindARThree } from 'mindar-image-three';
import { PendulumPhysics } from './physics.js';
import { RampPhysics }     from './ramp-physics.js';
import { UIController }    from './ui.js';

/* ════════════════════════════════════════════════════════════
   Constants & State
   ════════════════════════════════════════════════════════════ */
const SCALE = 0.3;

let renderer, scene, camera, controls;
let clock;
let isAR = false;
let mindarThree = null;
let arAnchor = null;
let currentExperiment = 'pendulum'; // 'pendulum' | 'ramp'

// Pendulum
let physics, ui;
let pendulumGroup, pivotMesh, rodMesh, bobMesh, trailLine;
const TRAIL_MAX = 200;
const trailPositions = [];

// Ramp
let rampPhysics;
let rampGroup, rampBallMesh, rampTrailLine;
const rampTrailPositions = [];

// Grid (3D mode)
let gridHelper;

// Interaction (pendulum drag)
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let isDragging = false;
let wasPausedBeforeDrag = false;
const dragSamples = [];

/* ════════════════════════════════════════════════════════════
   Boot
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  physics     = new PendulumPhysics();
  rampPhysics = new RampPhysics();
  ui          = new UIController(physics, rampPhysics);
  clock       = new THREE.Clock();

  // Camera check
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    document.getElementById('ar-status').textContent = 'AR ready — have the target image ready';
  } else {
    document.getElementById('btn-ar').style.display = 'none';
    document.getElementById('ar-status').textContent = 'Camera not available — use 3D Viewer';
  }

  document.getElementById('btn-ar').addEventListener('click', () => startAR());
  document.getElementById('btn-3d').addEventListener('click', () => start3D());
  document.getElementById('btn-back').addEventListener('click', () => goBack());

  // Experiment selector tabs (splash + in-mode)
  document.querySelectorAll('.exp-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const exp = btn.dataset.exp;
      if (exp !== currentExperiment) switchExperiment(exp);
    });
  });

  // Rebuild ramp geometry when physics params change
  document.addEventListener('ramp-rebuild', () => {
    if (!scene) return;
    rebuildRamp();
  });
});

/* ════════════════════════════════════════════════════════════
   Experiment Switching
   ════════════════════════════════════════════════════════════ */
function switchExperiment(exp) {
  currentExperiment = exp;

  // Update all tab buttons
  document.querySelectorAll('.exp-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.exp === exp);
  });

  // Toggle param / doc panels
  const show = (id, vis) => {
    const el = document.getElementById(id);
    if (el) el.style.display = vis ? '' : 'none';
  };
  show('pendulum-params', exp === 'pendulum');
  show('ramp-params',     exp === 'ramp');
  show('pendulum-docs',   exp === 'pendulum');
  show('ramp-docs',       exp === 'ramp');

  // Toggle 3D groups
  if (pendulumGroup) pendulumGroup.visible = (exp === 'pendulum');
  if (rampGroup)     rampGroup.visible     = (exp === 'ramp');

  // Reset active experiment
  if (exp === 'pendulum') {
    physics.reset(parseFloat(document.getElementById('p-angle')?.value || 45));
    trailPositions.length = 0;
  } else {
    rampPhysics.reset();
    rampTrailPositions.length = 0;
  }

  // Adjust camera / grid for 3D mode
  if (!isAR && controls && camera) {
    if (exp === 'pendulum') {
      controls.target.set(0, -0.15, 0);
      camera.position.set(0.3, 0.15, 0.6);
      if (gridHelper) gridHelper.position.y = -physics.length * SCALE - 0.15;
    } else {
      const h = rampPhysics.rampLength * Math.sin(rampPhysics.angleRad) * SCALE;
      controls.target.set(0, h * 0.4, 0);
      camera.position.set(0, h * 0.5 + 0.3, 0.8);
      if (gridHelper) gridHelper.position.y = -0.004;
    }
    controls.update();
  }

  // Reset pause button
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
}

/* ════════════════════════════════════════════════════════════
   Scene & Geometry
   ════════════════════════════════════════════════════════════ */
function addLights(targetScene) {
  targetScene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xfff4d6, 1.2);
  dir.position.set(2, 4, 3);
  dir.castShadow = true;
  targetScene.add(dir);
  const pt = new THREE.PointLight(0xe8c872, 0.6, 10);
  pt.position.set(0, 2, 0);
  targetScene.add(pt);
}

function buildScene() {
  scene = new THREE.Scene();
  addLights(scene);
  buildPendulum();
  buildRamp();
  pendulumGroup.visible = (currentExperiment === 'pendulum');
  rampGroup.visible     = (currentExperiment === 'ramp');
}

/* ── Pendulum ──────────────────────────────────────────── */
function buildPendulum() {
  pendulumGroup = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xe8c872, metalness: 0.7, roughness: 0.25,
  });

  // Pivot
  pivotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 16), goldMat);
  pendulumGroup.add(pivotMesh);

  // Support bar
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.02, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.5, roughness: 0.5 }),
  );
  bar.position.y = 0.01;
  pendulumGroup.add(bar);

  // Rod
  const rodGeo = new THREE.CylinderGeometry(0.006, 0.006, 1, 8);
  rodGeo.translate(0, -0.5, 0); // pivot at top
  rodMesh = new THREE.Mesh(
    rodGeo,
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.4, roughness: 0.5 }),
  );
  pendulumGroup.add(rodMesh);

  // Bob
  bobMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xe8c872, metalness: 0.85, roughness: 0.15 }),
  );
  pendulumGroup.add(bobMesh);

  // Trail
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position',
    new THREE.Float32BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
  trailLine = new THREE.Line(trailGeo,
    new THREE.LineBasicMaterial({ color: 0x72c4e8, transparent: true, opacity: 0.4 }));
  pendulumGroup.add(trailLine);

  scene.add(pendulumGroup);
}

/* ── Ramp ──────────────────────────────────────────────── */
function buildRamp() {
  rampGroup = new THREE.Group();

  const rp       = rampPhysics;
  const len      = rp.rampLength * SCALE;
  const angle    = rp.angleRad;
  const h        = len * Math.sin(angle);
  const base     = len * Math.cos(angle);
  const rampW    = 0.18;
  const flatLen  = 0.4;

  // — Ramp surface (tilted box) —
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x556677, metalness: 0.3, roughness: 0.6,
  });
  const surf = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, rampW), surfaceMat);
  surf.position.set(base / 2, h / 2, 0);
  surf.rotation.z = -angle;
  rampGroup.add(surf);

  // — Flat ground —
  const flatMat = new THREE.MeshStandardMaterial({
    color: 0x445566, metalness: 0.3, roughness: 0.6,
  });
  const flat = new THREE.Mesh(new THREE.BoxGeometry(flatLen, 0.008, rampW), flatMat);
  flat.position.set(base + flatLen / 2, 0, 0);
  rampGroup.add(flat);

  // — Side supports (triangular) —
  if (base > 0.01 && h > 0.01) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(base, 0);
    shape.lineTo(0, h);
    shape.closePath();

    const supportGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.005, bevelEnabled: false,
    });
    const supportMat = new THREE.MeshStandardMaterial({
      color: 0x334455, metalness: 0.4, roughness: 0.5,
      transparent: true, opacity: 0.6,
    });

    const front = new THREE.Mesh(supportGeo, supportMat);
    front.position.z = rampW / 2;
    rampGroup.add(front);

    const back = new THREE.Mesh(supportGeo, supportMat.clone());
    back.position.z = -rampW / 2 - 0.005;
    rampGroup.add(back);
  }

  // — Rolling ball —
  const ballR = Math.max(rp.ballRadius * SCALE, 0.015);
  rampBallMesh = new THREE.Mesh(
    new THREE.SphereGeometry(ballR, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xe8c872, metalness: 0.85, roughness: 0.15 }),
  );
  rampGroup.add(rampBallMesh);

  // — Ball trail —
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position',
    new THREE.Float32BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
  rampTrailLine = new THREE.Line(trailGeo,
    new THREE.LineBasicMaterial({ color: 0x72e89a, transparent: true, opacity: 0.4 }));
  rampGroup.add(rampTrailLine);

  scene.add(rampGroup);
  positionRamp();
}

/** Centre ramp horizontally; in AR lift above anchor. */
function positionRamp() {
  if (!rampGroup) return;
  const base = rampPhysics.rampLength * Math.cos(rampPhysics.angleRad) * SCALE;
  if (isAR) {
    rampGroup.position.set(-base / 2, 0.3, 0);
  } else {
    rampGroup.position.set(-base / 2, 0, 0);
  }
}

function rebuildRamp() {
  const parent = rampGroup?.parent || scene;

  // Dispose old geometry / material
  if (rampGroup) {
    if (rampGroup.parent) rampGroup.parent.remove(rampGroup);
    rampGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material?.dispose) child.material.dispose();
    });
  }
  rampTrailPositions.length = 0;

  buildRamp(); // adds to `scene`

  // Re-parent if it was attached elsewhere (e.g. AR anchor)
  if (parent !== scene && parent) {
    scene.remove(rampGroup);
    parent.add(rampGroup);
  }
  positionRamp();
  rampGroup.visible = (currentExperiment === 'ramp');
}

/* ════════════════════════════════════════════════════════════
   Visual Updates
   ════════════════════════════════════════════════════════════ */
function updatePendulumVisuals() {
  const L  = physics.length * SCALE;
  const th = physics.theta;

  rodMesh.scale.y = L;
  rodMesh.rotation.z = th;

  const bx = L * Math.sin(th);
  const by = -L * Math.cos(th);
  bobMesh.position.set(bx, by, 0);

  const s = 0.7 + 0.3 * (physics.mass / 10);
  bobMesh.scale.setScalar(s);

  // Trail
  trailPositions.push(bx, by, 0);
  if (trailPositions.length > TRAIL_MAX * 3) trailPositions.splice(0, 3);
  const posAttr = trailLine.geometry.getAttribute('position');
  for (let i = 0; i < TRAIL_MAX; i++) {
    const idx = i * 3;
    if (idx < trailPositions.length) {
      posAttr.array[idx]     = trailPositions[idx];
      posAttr.array[idx + 1] = trailPositions[idx + 1];
      posAttr.array[idx + 2] = trailPositions[idx + 2];
    }
  }
  posAttr.needsUpdate = true;
  trailLine.geometry.setDrawRange(0, Math.floor(trailPositions.length / 3));
}

function updateRampVisuals() {
  const pos = rampPhysics.ballPosition;
  rampBallMesh.position.set(pos.x * SCALE, pos.y * SCALE, 0);

  // Rolling rotation
  const circ = 2 * Math.PI * rampPhysics.ballRadius;
  const dist = rampPhysics.s + (rampPhysics.onFlat ? rampPhysics.flatX : 0);
  rampBallMesh.rotation.z = -(dist / circ) * 2 * Math.PI;

  // Trail
  const bx = pos.x * SCALE;
  const by = pos.y * SCALE;
  rampTrailPositions.push(bx, by, 0);
  if (rampTrailPositions.length > TRAIL_MAX * 3) rampTrailPositions.splice(0, 3);
  const posAttr = rampTrailLine.geometry.getAttribute('position');
  for (let i = 0; i < TRAIL_MAX; i++) {
    const idx = i * 3;
    if (idx < rampTrailPositions.length) {
      posAttr.array[idx]     = rampTrailPositions[idx];
      posAttr.array[idx + 1] = rampTrailPositions[idx + 1];
      posAttr.array[idx + 2] = rampTrailPositions[idx + 2];
    }
  }
  posAttr.needsUpdate = true;
  rampTrailLine.geometry.setDrawRange(0, Math.floor(rampTrailPositions.length / 3));
}

/* ════════════════════════════════════════════════════════════
   Pointer Interaction (pendulum bob drag)
   ════════════════════════════════════════════════════════════ */
function getActiveCamera() { return camera; }

function isBobHit(clientX, clientY) {
  if (currentExperiment !== 'pendulum') return false;
  pointerNDC.x =  (clientX / window.innerWidth)  * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  const cam = getActiveCamera();
  if (!cam) return false;
  raycaster.setFromCamera(pointerNDC, cam);

  if (raycaster.intersectObject(bobMesh, false).length > 0) return true;

  const bobWorld = new THREE.Vector3();
  bobMesh.getWorldPosition(bobWorld);
  const closest = new THREE.Vector3();
  raycaster.ray.closestPointToPoint(bobWorld, closest);
  const s = 0.7 + 0.3 * (physics.mass / 10);
  return closest.distanceTo(bobWorld) < 0.06 * s * 3;
}

function screenToAngle(clientX, clientY) {
  pointerNDC.x =  (clientX / window.innerWidth)  * 2 - 1;
  pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  const cam = getActiveCamera();
  if (!cam) return null;
  raycaster.setFromCamera(pointerNDC, cam);

  const pivotWorld = new THREE.Vector3();
  pivotMesh.getWorldPosition(pivotWorld);
  const planeNormal = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(pendulumGroup.getWorldQuaternion(new THREE.Quaternion()));
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, pivotWorld);

  const intersection = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, intersection)) return null;

  const localPt = pendulumGroup.worldToLocal(intersection);
  const theta = Math.atan2(localPt.x, -localPt.y);

  const maxAngle = (170 * Math.PI) / 180;
  return Math.max(-maxAngle, Math.min(maxAngle, theta));
}

function onPointerDown(event) {
  if (isDragging) return;
  const el = event.target;
  if (el.closest && (el.closest('#param-panel') || el.closest('#doc-panel')
      || el.closest('#btn-back') || el.closest('#exp-tabs'))) return;

  if (!isBobHit(event.clientX, event.clientY)) return;

  event.preventDefault();
  event.stopPropagation();

  isDragging = true;
  wasPausedBeforeDrag = physics.paused;
  physics.paused = true;
  if (!isAR && controls) controls.enabled = false;
  if (event.target.setPointerCapture) event.target.setPointerCapture(event.pointerId);

  trailPositions.length = 0;
  dragSamples.length = 0;
  if (renderer) renderer.domElement.style.cursor = 'grabbing';
  bobMesh.material.emissive.setHex(0x443300);
}

function onPointerMove(event) {
  if (!isDragging) {
    if (!isAR && renderer && bobMesh && currentExperiment === 'pendulum') {
      renderer.domElement.style.cursor = isBobHit(event.clientX, event.clientY) ? 'grab' : '';
    }
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const angle = screenToAngle(event.clientX, event.clientY);
  if (angle === null) return;

  physics.setAngle(angle, 0);

  dragSamples.push({ angle, time: performance.now() });
  if (dragSamples.length > 3) dragSamples.shift();

  const angleDeg = Math.round(Math.abs(angle) * 180 / Math.PI);
  const slider = document.getElementById('p-angle');
  if (slider) {
    slider.value = Math.max(5, Math.min(170, angleDeg));
    const valEl = document.getElementById('v-angle');
    if (valEl) valEl.textContent = angleDeg;
  }
}

function onPointerUp(event) {
  if (!isDragging) return;
  isDragging = false;

  let flickOmega = 0;
  if (dragSamples.length >= 2) {
    const oldest = dragSamples[0];
    const newest = dragSamples[dragSamples.length - 1];
    const dt = (newest.time - oldest.time) / 1000;
    if (dt > 0.001 && dt < 0.2) {
      flickOmega = (newest.angle - oldest.angle) / dt;
      flickOmega = Math.max(-15, Math.min(15, flickOmega));
    }
  }

  physics.setAngle(physics.theta, flickOmega);
  physics.paused = wasPausedBeforeDrag;
  if (!isAR && controls) controls.enabled = true;
  if (renderer) renderer.domElement.style.cursor = '';
  bobMesh.material.emissive.setHex(0x000000);
}

function addPointerListeners(target, useCapture) {
  target.addEventListener('pointerdown', onPointerDown, useCapture ? { capture: true } : undefined);
  target.addEventListener('pointermove', onPointerMove);
  target.addEventListener('pointerup',   onPointerUp);
  target.addEventListener('pointercancel', onPointerUp);
}

function removePointerListeners(target) {
  target.removeEventListener('pointerdown', onPointerDown, { capture: true });
  target.removeEventListener('pointerdown', onPointerDown);
  target.removeEventListener('pointermove', onPointerMove);
  target.removeEventListener('pointerup',   onPointerUp);
  target.removeEventListener('pointercancel', onPointerUp);
}

/* ════════════════════════════════════════════════════════════
   Shared Animation Loop
   ════════════════════════════════════════════════════════════ */
function stepAndRender() {
  const dt    = Math.min(clock.getDelta(), 0.05);
  const steps = 4;

  if (currentExperiment === 'pendulum') {
    for (let i = 0; i < steps; i++) physics.step(dt / steps);
    updatePendulumVisuals();
  } else {
    for (let i = 0; i < steps; i++) rampPhysics.step(dt / steps);
    updateRampVisuals();
  }

  ui.updateReadouts(currentExperiment);
  if (!isAR && controls) controls.update();
  renderer.render(scene, camera);
}

/* ════════════════════════════════════════════════════════════
   3D Viewer Mode
   ════════════════════════════════════════════════════════════ */
function start3D() {
  isAR = false;
  document.getElementById('splash').style.display = 'none';
  document.getElementById('canvas-container').style.display = '';

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 100);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  buildScene();

  // Grid
  gridHelper = new THREE.GridHelper(2, 20, 0x333333, 0x1a1a1a);
  scene.add(gridHelper);

  // Camera / grid per experiment
  if (currentExperiment === 'pendulum') {
    camera.position.set(0.3, 0.15, 0.6);
    controls.target.set(0, -0.15, 0);
    gridHelper.position.y = -physics.length * SCALE - 0.15;
  } else {
    const h = rampPhysics.rampLength * Math.sin(rampPhysics.angleRad) * SCALE;
    camera.position.set(0, h * 0.5 + 0.3, 0.8);
    controls.target.set(0, h * 0.4, 0);
    gridHelper.position.y = -0.004;
  }

  scene.background = new THREE.Color(0x0a0b0f);
  scene.fog = new THREE.Fog(0x0a0b0f, 2, 6);

  ui.show();
  document.getElementById('exp-tabs').style.display = '';

  // Apply current experiment panel visibility
  switchExperiment(currentExperiment);

  window.addEventListener('resize', onResize3D);
  addPointerListeners(renderer.domElement, true);
  renderer.setAnimationLoop(stepAndRender);
}

function onResize3D() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ════════════════════════════════════════════════════════════
   AR Mode (MindAR Image Tracking)
   ════════════════════════════════════════════════════════════ */
async function startAR() {
  isAR = true;
  const container = document.getElementById('canvas-container');
  document.getElementById('splash').style.display = 'none';
  container.style.display = '';
  container.classList.add('ar-mode');

  mindarThree = new MindARThree({
    container,
    imageTargetSrc: './vendor/target.mind',
  });
  renderer = mindarThree.renderer;
  scene    = mindarThree.scene;
  camera   = mindarThree.camera;

  addLights(scene);

  buildPendulum();
  buildRamp();

  arAnchor = mindarThree.addAnchor(0);
  scene.remove(pendulumGroup);
  scene.remove(rampGroup);
  arAnchor.group.add(pendulumGroup);
  arAnchor.group.add(rampGroup);

  pendulumGroup.position.set(0, 0.5, 0);
  positionRamp(); // centres + lifts ramp above anchor

  pendulumGroup.visible = (currentExperiment === 'pendulum');
  rampGroup.visible     = (currentExperiment === 'ramp');

  // Hint
  document.getElementById('placement-hint').style.display = '';
  arAnchor.onTargetFound = () => {
    document.getElementById('placement-hint').style.display = 'none';
  };
  arAnchor.onTargetLost = () => {
    document.getElementById('placement-hint').style.display = '';
  };

  try {
    await mindarThree.start();
  } catch (err) {
    console.error('MindAR failed:', err);
    alert('Could not start AR. Falling back to 3D mode.');
    goBack();
    start3D();
    return;
  }

  ui.show();
  document.getElementById('exp-tabs').style.display = '';
  switchExperiment(currentExperiment);

  addPointerListeners(renderer.domElement, true);
  renderer.setAnimationLoop(stepAndRender);
}

/* ════════════════════════════════════════════════════════════
   Navigation
   ════════════════════════════════════════════════════════════ */
function goBack() {
  if (mindarThree) {
    mindarThree.stop();
    mindarThree = null;
    arAnchor = null;
  }

  if (renderer) {
    removePointerListeners(renderer.domElement);
    renderer.setAnimationLoop(null);
    renderer.dispose();
    renderer = null;
  }

  isDragging = false;
  trailPositions.length = 0;
  rampTrailPositions.length = 0;
  gridHelper = null;

  const container = document.getElementById('canvas-container');
  container.classList.remove('ar-mode');
  container.innerHTML = '';

  ui.hide();
  document.getElementById('placement-hint').style.display = 'none';
  document.getElementById('exp-tabs').style.display = 'none';
  container.style.display = 'none';
  document.getElementById('splash').style.display = '';

  physics.reset(45);
  rampPhysics.reset();
}
