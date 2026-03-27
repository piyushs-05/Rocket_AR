import * as THREE from 'three';

/**
 * RocketBuilder — creates the two-part rocket geometry and manages
 * assembly interaction, exhaust particles, and launch visuals.
 */
export class RocketBuilder {
  constructor(scene) {
    this.scene = scene;
    this.assembled = false;

    // Assembly group (both parts become children once assembled)
    this.rocketGroup = new THREE.Group();
    scene.add(this.rocketGroup);

    // Build the two parts
    this.noseGroup = this._buildNoseCone();
    this.bodyGroup = this._buildBody();
    this.rocketGroup.add(this.noseGroup);
    this.rocketGroup.add(this.bodyGroup);

    // Positions
    this.bodyTopY = 0.15;             // top of body cylinder
    this.noseSnapY = this.bodyTopY;    // where the nose base sits when snapped
    this.noseStartY = this.bodyTopY + 0.2; // starting separated position

    this.noseGroup.position.set(0, this.noseStartY, 0);
    this.bodyGroup.position.set(0, 0, 0);

    // Exhaust
    this._buildExhaust();

    // Snap animation state
    this.snapAnim = null; // { elapsed, duration }

    // Nose pulse state (visual drag affordance)
    this.nosePulse = false;
    this._pulseTime = 0;
  }

  /* ── Nose Cone ── */
  _buildNoseCone() {
    const group = new THREE.Group();

    const coneGeo = new THREE.ConeGeometry(0.06, 0.15, 16);
    coneGeo.translate(0, 0.075, 0); // base at y=0, tip at y=0.15
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xe85050,
      metalness: 0.7,
      roughness: 0.3,
    });
    this.noseMesh = new THREE.Mesh(coneGeo, coneMat);
    group.add(this.noseMesh);

    // Invisible hit target — 3x larger for easier touch on mobile
    const hitGeo = new THREE.SphereGeometry(0.14, 8, 8);
    hitGeo.translate(0, 0.075, 0);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.noseHitMesh = new THREE.Mesh(hitGeo, hitMat);
    group.add(this.noseHitMesh);

    return group;
  }

  /* ── Body / Engine ── */
  _buildBody() {
    const group = new THREE.Group();

    // Main cylinder — top at y=0.15, bottom at y=-0.15
    const bodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.3, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.6,
      roughness: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(bodyMesh);

    // Engine nozzle (inverted cone at bottom)
    const nozzleGeo = new THREE.ConeGeometry(0.04, 0.08, 12);
    nozzleGeo.translate(0, -0.04, 0); // base at y=0, tip at y=-0.08
    nozzleGeo.rotateX(Math.PI);        // flip: base down
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.8,
      roughness: 0.2,
    });
    const nozzleMesh = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzleMesh.position.y = -0.15;
    group.add(nozzleMesh);

    // 4 Fins
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.08, 0);
    finShape.lineTo(0, 0.12);
    finShape.closePath();

    const finExtrudeSettings = { depth: 0.005, bevelEnabled: false };
    const finMat = new THREE.MeshStandardMaterial({
      color: 0xe8c872,
      metalness: 0.5,
      roughness: 0.4,
    });

    for (let i = 0; i < 4; i++) {
      const finGeo = new THREE.ExtrudeGeometry(finShape, finExtrudeSettings);
      const fin = new THREE.Mesh(finGeo, finMat);
      fin.position.y = -0.15;
      fin.position.x = 0.06 * Math.cos(i * Math.PI / 2);
      fin.position.z = 0.06 * Math.sin(i * Math.PI / 2);
      fin.rotation.y = -i * Math.PI / 2;
      group.add(fin);
    }

    return group;
  }

  /* ── Exhaust Particles ── */
  _buildExhaust() {
    const MAX_PARTICLES = 300;
    const positions = new Float32Array(MAX_PARTICLES * 3);
    // Start off-screen
    for (let i = 0; i < MAX_PARTICLES; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -999;
      positions[i * 3 + 2] = 0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xff6600,
      size: 0.015,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.exhaustParticles = new THREE.Points(geo, mat);
    this.exhaustParticles.visible = false;
    this.rocketGroup.add(this.exhaustParticles);

    // Per-particle velocity
    this.particleVelocities = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particleVelocities.push(new THREE.Vector3());
    }
    this._particleCount = MAX_PARTICLES;
  }

  /* ── Assembly Interaction ── */

  /** Set nose Y position during drag (constrained) */
  setNoseY(y) {
    const minY = this.noseSnapY;
    const maxY = this.noseSnapY + 0.25;
    this.noseGroup.position.y = Math.max(minY, Math.min(maxY, y));
  }

  /** Try to snap nose onto body. Returns true if snapped. */
  trySnap() {
    if (this.assembled) return false;
    const dist = this.noseGroup.position.y - this.noseSnapY;
    if (dist < 0.10) {
      this.noseGroup.position.y = this.noseSnapY;
      this.assembled = true;
      // Start snap bounce animation
      this.snapAnim = { elapsed: 0, duration: 0.25 };
      return true;
    }
    return false;
  }

  /** Reset to unassembled state */
  resetAssembly() {
    this.assembled = false;
    this.noseGroup.position.y = this.noseStartY;
    this.noseGroup.scale.setScalar(1);
    this.nosePulse = false;
    this._pulseTime = 0;
    this.noseMesh.material.emissive.setHex(0x000000);
    this.rocketGroup.position.y = 0;
    this.rocketGroup.scale.setScalar(1);
    this.exhaustParticles.visible = false;
    this.snapAnim = null;
  }

  /* ── Launch Visuals ── */

  /** Move rocket in 3D based on physics state */
  setLaunchPosition(x, y, z, tiltX, tiltZ, scale) {
    // Clamp visual height
    const visualY = Math.min(y * scale, 3.5);
    this.rocketGroup.position.set(x * scale, Math.max(0, visualY), z * scale);
    this.rocketGroup.rotation.x = tiltX;
    this.rocketGroup.rotation.z = tiltZ;
  }

  /** Update exhaust particles each frame */
  updateExhaust(dt, isThrusting) {
    this.exhaustParticles.visible = isThrusting;
    if (!isThrusting) return;

    const posAttr = this.exhaustParticles.geometry.getAttribute('position');
    const arr = posAttr.array;

    // Nozzle position in rocket-group local space
    const nozzleY = this.bodyGroup.position.y - 0.23;

    for (let i = 0; i < this._particleCount; i++) {
      const idx = i * 3;
      let py = arr[idx + 1];

      // Reset particles that have fallen too far
      if (py < nozzleY - 0.3 || py > 100) {
        arr[idx] = (Math.random() - 0.5) * 0.03; // x spread
        arr[idx + 1] = nozzleY;
        arr[idx + 2] = (Math.random() - 0.5) * 0.03; // z spread
        const vel = this.particleVelocities[i];
        vel.set(
          (Math.random() - 0.5) * 0.3,
          -(1.0 + Math.random() * 1.5),
          (Math.random() - 0.5) * 0.3
        );
      }

      // Move particle
      const vel = this.particleVelocities[i];
      arr[idx] += vel.x * dt;
      arr[idx + 1] += vel.y * dt;
      arr[idx + 2] += vel.z * dt;
    }
    posAttr.needsUpdate = true;
  }

  /** Update snap bounce animation */
  updateSnapAnim(dt) {
    if (!this.snapAnim) return;
    this.snapAnim.elapsed += dt;
    const t = this.snapAnim.elapsed / this.snapAnim.duration;
    if (t >= 1) {
      this.rocketGroup.scale.setScalar(1);
      this.snapAnim = null;
      return;
    }
    const s = 1.0 + 0.1 * Math.sin(Math.PI * t);
    this.rocketGroup.scale.setScalar(s);
  }

  /** Enable/disable nose pulse glow */
  setNosePulse(on) {
    this.nosePulse = on;
    this._pulseTime = 0;
    if (!on) {
      this.noseMesh.material.emissive.setHex(0x000000);
      this.noseGroup.scale.setScalar(1);
    }
  }

  /** Animate nose pulse each frame */
  updateNosePulse(dt) {
    if (!this.nosePulse || this.assembled) return;
    this._pulseTime += dt;
    const intensity = 0.15 + 0.1 * Math.sin(this._pulseTime * 3.0);
    this.noseMesh.material.emissive.setRGB(intensity, intensity * 0.3, 0);
    const s = 1.0 + 0.03 * Math.sin(this._pulseTime * 2.5);
    this.noseGroup.scale.setScalar(s);
  }

  /** Get nose cone meshes for raycasting */
  getNoseMeshes() {
    return [this.noseMesh, this.noseHitMesh];
  }
}
