/**
 * PendulumPhysics — Simple pendulum simulation using RK4 integration.
 * 
 * State:  θ (angle from vertical, radians), ω (angular velocity, rad/s)
 * ODE:    θ' = ω
 *         ω' = -(g/L) sin(θ) - b·ω
 */
export class PendulumPhysics {
  constructor() {
    // Parameters
    this.gravity  = 9.81;   // m/s²
    this.length   = 1.0;    // m
    this.mass     = 1.0;    // kg
    this.damping  = 0.02;   // damping coefficient
    
    // State
    this.theta    = Math.PI / 4;  // initial angle (45°)
    this.omega    = 0;             // angular velocity
    this.time     = 0;
    this.paused   = false;
    
    // Period measurement
    this._lastCrossTime = null;
    this._crossCount    = 0;
    this._prevTheta     = this.theta;
    this.observedPeriod = null;
  }

  /** Theoretical small-angle period */
  get theoreticalPeriod() {
    return 2 * Math.PI * Math.sqrt(this.length / this.gravity);
  }

  /** Kinetic energy: 0.5 * m * v² where v = L * ω */
  get kineticEnergy() {
    const v = this.length * this.omega;
    return 0.5 * this.mass * v * v;
  }

  /** Potential energy: m * g * h where h = L(1 - cosθ) */
  get potentialEnergy() {
    return this.mass * this.gravity * this.length * (1 - Math.cos(this.theta));
  }

  get totalEnergy() {
    return this.kineticEnergy + this.potentialEnergy;
  }

  /** Position of the bob in local coordinates (pivot at origin) */
  get bobPosition() {
    return {
      x: this.length * Math.sin(this.theta),
      y: -this.length * Math.cos(this.theta),
    };
  }

  /** Reset simulation with current parameters */
  reset(initialAngleDeg = 45) {
    this.theta = (initialAngleDeg * Math.PI) / 180;
    this.omega = 0;
    this.time  = 0;
    this._lastCrossTime = null;
    this._crossCount    = 0;
    this._prevTheta     = this.theta;
    this.observedPeriod = null;
  }

  /** Set angle and angular velocity directly (e.g. from user drag). */
  setAngle(theta, omega = 0) {
    this.theta = theta;
    this.omega = omega;
    this._prevTheta = theta;
  }

  /**
   * Acceleration function: ω' = f(θ, ω)
   */
  _accel(theta, omega) {
    return -(this.gravity / this.length) * Math.sin(theta) - this.damping * omega;
  }

  /**
   * Advance simulation by dt seconds using 4th-order Runge-Kutta.
   */
  step(dt) {
    if (this.paused) return;

    // RK4
    const k1_theta = this.omega;
    const k1_omega = this._accel(this.theta, this.omega);

    const k2_theta = this.omega + 0.5 * dt * k1_omega;
    const k2_omega = this._accel(this.theta + 0.5 * dt * k1_theta, this.omega + 0.5 * dt * k1_omega);

    const k3_theta = this.omega + 0.5 * dt * k2_omega;
    const k3_omega = this._accel(this.theta + 0.5 * dt * k2_theta, this.omega + 0.5 * dt * k2_omega);

    const k4_theta = this.omega + dt * k3_omega;
    const k4_omega = this._accel(this.theta + dt * k3_theta, this.omega + dt * k3_omega);

    this._prevTheta = this.theta;
    this.theta += (dt / 6) * (k1_theta + 2 * k2_theta + 2 * k3_theta + k4_theta);
    this.omega += (dt / 6) * (k1_omega + 2 * k2_omega + 2 * k3_omega + k4_omega);
    this.time  += dt;

    // Measure period by detecting zero-crossings (θ going positive → negative)
    if (this._prevTheta > 0 && this.theta <= 0) {
      if (this._lastCrossTime !== null) {
        // Full period = 2 half-swings
        this._crossCount++;
        if (this._crossCount % 2 === 0) {
          this.observedPeriod = this.time - this._lastCrossTime;
          this._lastCrossTime = this.time;
        }
      } else {
        this._lastCrossTime = this.time;
        this._crossCount = 0;
      }
    }
  }
}
