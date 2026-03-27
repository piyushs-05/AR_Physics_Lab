import { PendulumPhysics } from './physics.js';
import { RampPhysics }     from './ramp-physics.js';

/**
 * UIController — binds HTML controls to physics engines and manages panel state.
 */
export class UIController {
  constructor(physics, rampPhysics) {
    /** @type {PendulumPhysics} */
    this.physics = physics;
    /** @type {RampPhysics} */
    this.rampPhysics = rampPhysics;

    this._setupToggles();
    this._setupPendulumSliders();
    this._setupRampSliders();
    this._setupButtons();
  }

  /* ── Panel toggles ────────────────────────────────────── */
  _setupToggles() {
    this._wireToggle('panel-toggle', 'panel-body');
    this._wireToggle('doc-toggle', 'doc-body');
  }

  _wireToggle(headerId, bodyId) {
    const header = document.getElementById(headerId);
    const body   = document.getElementById(bodyId);
    if (!header || !body) return;
    header.addEventListener('click', () => {
      body.classList.toggle('hidden');
      header.classList.toggle('collapsed');
    });
  }

  /* ── Pendulum sliders ─────────────────────────────────── */
  _setupPendulumSliders() {
    this._bindSlider('p-gravity', 'v-gravity', 2, v => { this.physics.gravity = v; });
    this._bindSlider('p-length',  'v-length',  2, v => { this.physics.length  = v; });
    this._bindSlider('p-mass',    'v-mass',    2, v => { this.physics.mass    = v; });
    this._bindSlider('p-damping', 'v-damping', 3, v => { this.physics.damping = v; });
    this._bindSlider('p-angle',   'v-angle',   0, () => {});
  }

  /* ── Ramp sliders ─────────────────────────────────────── */
  _setupRampSliders() {
    this._bindSlider('rp-gravity', 'rv-gravity', 2, v => {
      this.rampPhysics.gravity = v;
    });
    this._bindSlider('rp-angle', 'rv-angle', 0, v => {
      this.rampPhysics.rampAngle = v;
      this.rampPhysics.reset();
      document.dispatchEvent(new Event('ramp-rebuild'));
    });
    this._bindSlider('rp-length', 'rv-length', 2, v => {
      this.rampPhysics.rampLength = v;
      this.rampPhysics.reset();
      document.dispatchEvent(new Event('ramp-rebuild'));
    });
    this._bindSlider('rp-mass', 'rv-mass', 2, v => {
      this.rampPhysics.ballMass = v;
    });
    this._bindSlider('rp-friction', 'rv-friction', 3, v => {
      this.rampPhysics.friction = v;
    });
  }

  /* ── Shared slider helper ─────────────────────────────── */
  _bindSlider(sliderId, valId, decimals, onChange) {
    const slider = document.getElementById(sliderId);
    const valEl  = document.getElementById(valId);
    if (!slider || !valEl) return;
    const update = () => {
      const v = parseFloat(slider.value);
      valEl.textContent = v.toFixed(decimals);
      onChange(v);
    };
    slider.addEventListener('input', update);
    update(); // initial sync
  }

  /* ── Reset / Pause buttons ────────────────────────────── */
  _setupButtons() {
    const resetBtn = document.getElementById('btn-reset');
    const pauseBtn = document.getElementById('btn-pause');

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (this._isRampActive()) {
          this.rampPhysics.reset();
          document.dispatchEvent(new Event('ramp-rebuild'));
        } else {
          const angle = parseFloat(document.getElementById('p-angle').value);
          this.physics.reset(angle);
        }
        if (pauseBtn) pauseBtn.textContent = '⏸ Pause';
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (this._isRampActive()) {
          this.rampPhysics.paused = !this.rampPhysics.paused;
          pauseBtn.textContent = this.rampPhysics.paused ? '▶ Play' : '⏸ Pause';
        } else {
          this.physics.paused = !this.physics.paused;
          pauseBtn.textContent = this.physics.paused ? '▶ Play' : '⏸ Pause';
        }
      });
    }
  }

  _isRampActive() {
    const rp = document.getElementById('ramp-params');
    return rp && rp.style.display !== 'none';
  }

  /* ── Readouts ─────────────────────────────────────────── */
  updateReadouts(experiment) {
    if (experiment === 'ramp') {
      this._updateRampReadouts();
    } else {
      this._updatePendulumReadouts();
    }
  }

  _updatePendulumReadouts() {
    const p = this.physics;
    this._setText('r-angle',   (p.theta * 180 / Math.PI).toFixed(1) + '°');
    this._setText('r-angvel',  p.omega.toFixed(3) + ' rad/s');
    this._setText('r-ke',      p.kineticEnergy.toFixed(3) + ' J');
    this._setText('r-pe',      p.potentialEnergy.toFixed(3) + ' J');
    this._setText('r-total',   p.totalEnergy.toFixed(3) + ' J');
    this._setText('r-observed-period', p.observedPeriod ? p.observedPeriod.toFixed(3) + ' s' : '— s');
    this._setText('eq-period', `T = 2π√(L/g) = ${p.theoreticalPeriod.toFixed(3)} s`);
  }

  _updateRampReadouts() {
    const rp = this.rampPhysics;
    this._setText('rr-velocity', rp.v.toFixed(3) + ' m/s');
    this._setText('rr-height',   rp.currentHeight.toFixed(3) + ' m');
    this._setText('rr-ke',       rp.kineticEnergy.toFixed(3) + ' J');
    this._setText('rr-pe',       rp.potentialEnergy.toFixed(3) + ' J');
    this._setText('rr-total',    rp.totalEnergy.toFixed(3) + ' J');
    this._setText('rr-maxvel',   rp.maxVelocity.toFixed(3) + ' m/s');
    this._setText('rr-distance', rp.s.toFixed(3) + ' m');
    this._setText('rr-time',     rp.time.toFixed(2) + ' s');
    this._setText('eq-ramp-speed', `v = √(10gh/7) = ${rp.theoreticalSpeed.toFixed(3)} m/s`);
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ── Show / Hide ──────────────────────────────────────── */
  show() {
    document.getElementById('param-panel').style.display = '';
    document.getElementById('doc-panel').style.display   = '';
    document.getElementById('btn-back').style.display     = '';
  }

  hide() {
    document.getElementById('param-panel').style.display = 'none';
    document.getElementById('doc-panel').style.display   = 'none';
    document.getElementById('btn-back').style.display     = 'none';
  }
}
