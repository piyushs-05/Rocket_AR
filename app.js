import * as THREE from 'three';
import { RocketPhysics } from './physics.js';
import { RocketBuilder } from './rocket.js';
import { UIController } from './ui.js';

/* ════════════════════════════════════════════════════════════
   State
   ════════════════════════════════════════════════════════════ */
const SCALE = 0.45;

let mindarThree = null;
let renderer, scene, camera;
let clock;
let physics, rocketBuilder, ui;
let arAnchor = null;
let rocketPlaced = false;

/* ════════════════════════════════════════════════════════════
   Boot
   ════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  physics = new RocketPhysics();
  clock = new THREE.Clock();

  const startBtn = document.getElementById('btn-start-ar');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startBtn.style.display = 'none';
      const loadingText = document.getElementById('loading-text');
      if (loadingText) loadingText.textContent = 'Launching Camera...';
      startAR();
    });
  }
});

async function startAR() {
  const container = document.getElementById('canvas-container');
  const loading = document.getElementById('loading');
  const overlay = document.getElementById('xr-overlay');

  const { MindARThree } = window.MINDAR.IMAGE;

  mindarThree = new MindARThree({
    container,
    imageTargetSrc: './target.mind',
  });

  renderer = mindarThree.renderer;
  scene = mindarThree.scene;
  camera = mindarThree.camera;

  // Lighting (Fixed No-Color issue in v8.2)
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  const directLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directLight.position.set(1, 2, 0.5);
  scene.add(directLight);

  // Assembly
  rocketBuilder = new RocketBuilder(scene);
  ui = new UIController(physics, rocketBuilder);
  ui.version = VERSION;

  // Anchor Setup
  arAnchor = mindarThree.addAnchor(0);

  // Intermediate container to handle orientation so rocket Y = Image Normal
  const arContainer = new THREE.Group();
  arAnchor.group.add(arContainer);
  arContainer.rotation.x = Math.PI / 2; // Rocket Y now points out of image
  arContainer.position.z = 0.05;        // Slight lift from surface

  // Parent rocket to the container
  rocketBuilder.rocketGroup.visible = false;
  scene.remove(rocketBuilder.rocketGroup);
  arContainer.add(rocketBuilder.rocketGroup);

  // v8.3: Increased model size for better presence
  rocketBuilder.rocketGroup.scale.setScalar(1.5);
  rocketBuilder.rocketGroup.position.set(0, 0, 0);
  rocketBuilder.rocketGroup.rotation.set(0, 0, 0);

  arAnchor.onTargetFound = () => {
    console.log('Target Found');
    ui.flashStatus('Target Detected!', false);
    if (!rocketPlaced) {
      rocketPlaced = true;
      rocketBuilder.rocketGroup.visible = true;
      goToStep('build');
    }
  };

  arAnchor.onTargetLost = () => {
    console.log('Target Lost');
    ui.flashStatus('Target Lost', true);
  };


  try {
    await mindarThree.start();
    if (loading) loading.classList.add('hidden');
    if (overlay) overlay.style.display = '';

    goToStep('place');
    addPointerListeners(renderer.domElement);
    renderer.setAnimationLoop(stepPhysicsAndRender);
  } catch (e) {
    console.error('MindAR start failed:', e);
    ui.flashStatus('AR Camera Failed!', true);
    if (overlay) overlay.style.display = '';
  }
}

/* ════════════════════════════════════════════════════════════
   Step Flow
   ════════════════════════════════════════════════════════════ */
function goToStep(step) {
  ui.setStep(step);
  if (step === 'place') {
    ui.setHint('Point at the target image...');
  } else if (step === 'build') {
    ui.setHint('Drag the nose cone to build!');
    ui.peekSheet(true);
  } else if (step === 'launch') {
    ui.setHint('System Ready. LAUNCH!');
  }
}

/* ════════════════════════════════════════════════════════════
   Loop
   ════════════════════════════════════════════════════════════ */
function stepPhysicsAndRender() {
  const dt = Math.min(clock.getDelta(), 0.05);
  physics.step(dt);

  if (physics.launched && physics.phase !== 'idle') {
    rocketBuilder.setLaunchPosition(
      physics.posX,
      physics.altitude,
      physics.posZ,
      physics.tiltX,
      physics.tiltZ,
      SCALE
    );
    rocketBuilder.updateExhaust(dt, physics.phase === 'burn');

    // Engine Vibration
    if (physics.phase === 'burn') {
      const shake = (Math.random() - 0.5) * 0.01;
      rocketBuilder.rocketGroup.position.x += shake;
      rocketBuilder.rocketGroup.position.z += shake;
    }
  }

  ui.update(dt);
  mindarThree.video.style.opacity = 1; // Ensure visible
  renderer.render(scene, camera);
}

function activeAnchorData() {
  return arAnchor && arAnchor.group.visible;
}

/* ════════════════════════════════════════════════════════════
   Interactions
   ════════════════════════════════════════════════════════════ */
function addPointerListeners(el) {
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
}

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let isDragging = false;

function onPointerDown(e) {
  if (ui.currentStep !== 'build') return;
  pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointerNDC, camera);
  const intersects = raycaster.intersectObject(rocketBuilder.noseMesh, true);
  if (intersects.length > 0) {
    isDragging = true;
    rocketBuilder.noseMesh.material.emissive.setHex(0x333333);
  }
}

function onPointerMove(e) {
  if (!isDragging) return;
  const y = screenToWorldY(e.clientX, e.clientY);
  if (y === null) return;
  rocketBuilder.setNoseY(y);

  if (rocketBuilder.trySnap()) {
    isDragging = false;
    rocketBuilder.noseMesh.material.emissive.setHex(0x000000);
    ui.updateLaunchButton(true);
    goToStep('launch');
  }
}

function onPointerUp() {
  if (!isDragging) return;
  isDragging = false;
  rocketBuilder.noseMesh.material.emissive.setHex(0x000000);
}

function screenToWorldY(sx, sy) {
  pointerNDC.x = (sx / window.innerWidth) * 2 - 1;
  pointerNDC.y = -(sy / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointerNDC, camera);

  const planeNormal = new THREE.Vector3(0, 1, 0);
  const plane = new THREE.Plane(planeNormal, 0);
  const targetPt = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, targetPt)) {
    return targetPt.y;
  }
  return null;
}

// Reset handler
document.addEventListener('rocket-reset', () => {
  rocketPlaced = false;
  rocketBuilder.rocketGroup.visible = false;
  physics.reset();
  rocketBuilder.resetAssembly();
  ui.updateLaunchButton(false);
  goToStep('place');
});
