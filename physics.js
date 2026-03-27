/**
 * RocketPhysics — flight simulation with phase-based Euler integration.
 */
export class RocketPhysics {
  constructor() {
    // User-controllable parameters
    this.thrust = 20;    // Newtons
    this.mass = 0.5;   // kg
    this.burnTime = 3.0;   // seconds
    this.gravity = 9.81;  // m/s^2

    // Simulation state
    this.time = 0;
    this.altitude = 0;     // metres
    this.velocity = 0;     // m/s (positive = up)
    this.phase = 'idle'; // idle | burn | coast | descent | landed
    this.launched = false;
    this.posX = 0;
    this.posZ = 0;
    this.tiltX = 0;
    this.tiltZ = 0;

    // Realism constants (v8.3)
    this.initialMass = 0.5; // kg
    this.fuelMass = 0.2; // kg (of the 0.5kg total)
    this.dragCd = 0.5; // Standard rocket drag coefficient
    this.area = Math.PI * Math.pow(0.06, 2); // 0.0113 m^2
    this.airDensity = 1.225; // kg/m^3 at sea level
  }

  /* ── Computed properties (analytical, used for readouts) ── */

  get netForce() {
    return this.thrust - this.mass * this.gravity;
  }

  get acceleration() {
    const f = this.netForce;
    return f / this.mass;
  }

  get burnoutVelocity() {
    const a = this.acceleration;
    return a > 0 ? a * this.burnTime : 0;
  }

  get maxHeight() {
    const a = this.acceleration;
    if (a <= 0) return 0;
    const tb = this.burnTime;
    const vb = a * tb;
    const g = this.gravity;
    // Height during burn + coast to apogee
    const hBurn = 0.5 * a * tb * tb;
    const hCoast = (vb * vb) / (2 * g);
    return hBurn + hCoast;
  }

  get totalFlightTime() {
    const a = this.acceleration;
    if (a <= 0) return 0;
    const tb = this.burnTime;
    const vb = a * tb;
    const g = this.gravity;
    const hMax = this.maxHeight;
    // burn time + coast-to-apogee + fall-from-apogee
    const tCoast = vb / g;
    const tFall = Math.sqrt(2 * hMax / g);
    return tb + tCoast + tFall;
  }

  get thrustToWeightRatio() {
    return this.thrust / (this.mass * this.gravity);
  }

  /* ── Simulation control ── */

  reset() {
    this.time = 0;
    this.altitude = 0;
    this.velocity = 0;
    this.posX = 0;
    this.posZ = 0;
    this.tiltX = 0;
    this.tiltZ = 0;
    this.phase = 'idle';
    this.launched = false;
    this.mass = this.initialMass;
  }

  launch() {
    if (this.thrustToWeightRatio <= 1) return false;
    this.reset();
    this.phase = 'burn';
    this.launched = true;

    // Initial random tilt (v8.4 accuracy)
    this.tiltX = (Math.random() - 0.5) * 0.1;
    this.tiltZ = (Math.random() - 0.5) * 0.1;
    return true;
  }

  step(dt) {
    if (this.phase === 'idle' || this.phase === 'landed') return;

    // 1. Dynamic Mass (Lost fuel during burn)
    if (this.phase === 'burn' && this.time < this.burnTime) {
      const burnRate = this.fuelMass / this.burnTime;
      this.mass = Math.max(this.initialMass - this.fuelMass, this.mass - burnRate * dt);
    }

    // 2. Forces
    let fThrust = (this.phase === 'burn') ? this.thrust : 0;
    let fGravity = this.mass * this.gravity;

    // Drag: Fd = 0.5 * rho * v^2 * Cd * A
    let fDrag = 0.5 * this.airDensity * Math.pow(this.velocity, 2) * this.dragCd * this.area;
    if (this.velocity > 0) fDrag *= -1; // Drag opposes motion

    let fNet = fThrust - fGravity + fDrag;
    let a = fNet / this.mass;

    // 3. Integration (Euler)
    this.velocity += a * dt;
    this.altitude += this.velocity * dt;

    // Horizontal drift based on tilt
    if (this.phase === 'burn') {
      this.posX += this.velocity * Math.sin(this.tiltZ) * dt;
      this.posZ += this.velocity * Math.sin(this.tiltX) * dt;
    }

    this.time += dt;

    // Phase transitions
    if (this.phase === 'burn' && this.time >= this.burnTime) {
      this.phase = this.velocity > 0 ? 'coast' : 'descent';
    }
    if (this.phase === 'coast' && this.velocity <= 0) {
      this.phase = 'descent';
    }
    if ((this.phase === 'coast' || this.phase === 'descent') && this.altitude <= 0) {
      this.altitude = 0;
      this.velocity = 0;
      this.phase = 'landed';
    }
  }
}
