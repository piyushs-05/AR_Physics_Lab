/**
 * RampPhysics — Ball rolling down an inclined plane.
 *
 * State:  s (distance along ramp, m), v (velocity along ramp, m/s)
 * ODE:    s' = v
 *         v' = g(sinα − μ·cosα) · (5/7)   [rolling solid sphere]
 *
 * When s >= rampLength, ball transitions to flat surface with friction.
 * When s <= 0 (at top), ball is held if v <= 0.
 */
export class RampPhysics {
  constructor() {
    // Parameters
    this.gravity     = 9.81;   // m/s²
    this.rampAngle   = 30;     // degrees
    this.rampLength  = 2.0;    // m
    this.ballMass    = 1.0;    // kg
    this.friction    = 0.05;   // kinetic friction coefficient
    this.ballRadius  = 0.05;   // m (visual only, not a parameter)

    // State
    this.s       = 0;       // position along ramp (0 = top)
    this.v       = 0;       // velocity along ramp (positive = downhill)
    this.time    = 0;
    this.paused  = false;
    this.onFlat  = false;   // whether ball has left the ramp
    this.flatX   = 0;       // horizontal position on flat surface

    // Measurements
    this.maxVelocity = 0;
  }

  get angleRad() {
    return (this.rampAngle * Math.PI) / 180;
  }

  /** Theoretical final speed at bottom (energy conservation, no friction) */
  get theoreticalSpeed() {
    const h = this.rampLength * Math.sin(this.angleRad);
    // v = sqrt(10/7 · g · h) for rolling sphere
    return Math.sqrt((10 / 7) * this.gravity * h);
  }

  /** Height of ball above the ramp base */
  get currentHeight() {
    if (this.onFlat) return 0;
    return (this.rampLength - this.s) * Math.sin(this.angleRad);
  }

  get kineticEnergy() {
    // Translational + rotational: (1/2)mv² + (1/2)(2/5 mr²)(v/r)² = 7/10 mv²
    return 0.7 * this.ballMass * this.v * this.v;
  }

  get potentialEnergy() {
    return this.ballMass * this.gravity * this.currentHeight;
  }

  get totalEnergy() {
    return this.kineticEnergy + this.potentialEnergy;
  }

  /** Ball position in local ramp coordinates {x, y} where ramp base is at origin */
  get ballPosition() {
    const a = this.angleRad;
    if (this.onFlat) {
      return { x: this.rampLength * Math.cos(a) + this.flatX, y: this.ballRadius };
    }
    // s=0 is top, s=rampLength is bottom
    const distFromBottom = this.rampLength - this.s;
    return {
      x: (this.rampLength - distFromBottom) * Math.cos(a),
      y: distFromBottom * Math.sin(a) + this.ballRadius,
    };
  }

  reset() {
    this.s      = 0;
    this.v      = 0;
    this.time   = 0;
    this.onFlat = false;
    this.flatX  = 0;
    this.maxVelocity = 0;
  }

  _accelOnRamp() {
    const a = this.angleRad;
    const netForce = Math.sin(a) - this.friction * Math.cos(a);
    // Rolling factor: 5/7 for solid sphere
    return (5 / 7) * this.gravity * Math.max(netForce, 0);
  }

  _accelOnFlat() {
    if (Math.abs(this.v) < 0.001) return 0;
    // Friction decelerates on flat
    const sign = this.v > 0 ? -1 : 1;
    return sign * (5 / 7) * this.gravity * this.friction;
  }

  step(dt) {
    if (this.paused) return;

    if (!this.onFlat) {
      // On ramp — RK4
      const accel = this._accelOnRamp();

      const k1v = accel;
      const k1s = this.v;

      const k2v = accel;
      const k2s = this.v + 0.5 * dt * k1v;

      const k3v = accel;
      const k3s = this.v + 0.5 * dt * k2v;

      const k4v = accel;
      const k4s = this.v + dt * k3v;

      this.v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
      this.s += (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);

      // Clamp at top
      if (this.s < 0) {
        this.s = 0;
        this.v = Math.max(this.v, 0);
      }

      // Transition to flat
      if (this.s >= this.rampLength) {
        this.onFlat = true;
        this.flatX = 0;
        // Keep velocity (now horizontal)
      }
    } else {
      // On flat surface
      const accel = this._accelOnFlat();
      this.v += accel * dt;
      this.flatX += this.v * dt;

      // Stop if friction brings to rest
      if (Math.abs(this.v) < 0.001) {
        this.v = 0;
      }
    }

    if (Math.abs(this.v) > this.maxVelocity) {
      this.maxVelocity = Math.abs(this.v);
    }

    this.time += dt;
  }
}
