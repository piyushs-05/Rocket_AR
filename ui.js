import { RocketPhysics } from './physics.js';

/**
 * UIController — manages bottom sheet, sliders, readouts, and step flow.
 */
export class UIController {
  constructor(physics, rocketBuilder) {
    /** @type {RocketPhysics} */
    this.physics = physics;
    this.rocketBuilder = rocketBuilder;
    this.currentStep = 'place'; // place | build | launch

    this._setupSliders();
    this._setupButtons();
    this._setupSheet();
  }

  /* ── Sliders ─────────────────────────────────────────── */
  _setupSliders() {
    this._bindSlider('p-thrust', 'v-thrust', v => `${v.toFixed(1)} N`, v => { this.physics.thrust = v; });
    this._bindSlider('p-mass', 'v-mass', v => `${v.toFixed(2)} kg`, v => { this.physics.mass = v; });
    this._bindSlider('p-burntime', 'v-burntime', v => `${v.toFixed(1)} s`, v => { this.physics.burnTime = v; });
  }

  _bindSlider(sliderId, valId, format, onChange) {
    const slider = document.getElementById(sliderId);
    const valEl = document.getElementById(valId);
    if (!slider || !valEl) return;
    const update = () => {
      const v = parseFloat(slider.value);
      valEl.textContent = format(v);
      onChange(v);
      this.updateReadouts();
    };
    slider.addEventListener('input', update);
    update();
  }

  /* ── Buttons ─────────────────────────────────────────── */
  _setupButtons() {
    const launchBtn = document.getElementById('btn-launch');
    const resetBtn = document.getElementById('btn-reset');

    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        if (!this.rocketBuilder.assembled) return;
        if (this.physics.thrustToWeightRatio <= 1) {
          this.flashStatus('Thrust too low!', true);
          return;
        }
        this.physics.launch();
        // Collapse sheet to peek during flight
        const sheet = document.getElementById('bottom-sheet');
        if (sheet) sheet.classList.add('sheet-peek');
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.physics.reset();
        this.rocketBuilder.resetAssembly();
        this.updateLaunchButton(false);
        document.dispatchEvent(new Event('rocket-reset'));
      });
    }
  }

  /* ── Bottom sheet toggle ─────────────────────────────── */
  _setupSheet() {
    const handle = document.getElementById('sheet-handle');
    if (!handle) return;
    handle.addEventListener('click', () => {
      const sheet = document.getElementById('bottom-sheet');
      if (!sheet) return;
      sheet.classList.toggle('sheet-peek');
    });
  }

  /* ── Step management ─────────────────────────────────── */
  setStep(step) {
    this.currentStep = step;
    const steps = document.querySelectorAll('#step-bar .step');
    const order = ['place', 'build', 'launch'];
    const idx = order.indexOf(step);

    steps.forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i < idx) el.classList.add('done');
      if (i === idx) el.classList.add('active');
    });
  }

  setHint(text) {
    const hint = document.getElementById('hint');
    const hintText = document.getElementById('hint-text');
    if (!hint || !hintText) return;
    if (text) {
      hintText.textContent = text;
      hint.classList.remove('hint-hidden');
      hint.classList.add('hint-visible');
    } else {
      hint.classList.add('hint-hidden');
      hint.classList.remove('hint-visible');
    }
  }

  showSheet(peek) {
    const sheet = document.getElementById('bottom-sheet');
    if (!sheet) return;
    sheet.classList.remove('sheet-hidden');
    if (peek) {
      sheet.classList.add('sheet-peek');
    } else {
      sheet.classList.remove('sheet-peek');
    }
  }

  hideSheet() {
    const sheet = document.getElementById('bottom-sheet');
    if (sheet) sheet.classList.add('sheet-hidden');
  }

  peekSheet(peek) {
    const sheet = document.getElementById('bottom-sheet');
    if (!sheet) return;
    sheet.classList.remove('sheet-hidden');
    if (peek) sheet.classList.add('sheet-peek');
    else sheet.classList.remove('sheet-peek');
  }

  /* ── Readouts ────────────────────────────────────────── */
  updateReadouts() {
    const p = this.physics;
    this._setText('r-netforce', p.netForce.toFixed(1) + ' N');
    this._setText('r-accel', p.acceleration.toFixed(1) + ' m/s\u00B2');
    this._setText('r-maxheight', p.maxHeight.toFixed(1) + ' m');
    this._setText('r-flighttime', p.totalFlightTime.toFixed(1) + ' s');
    this._setText('r-burnoutvel', p.burnoutVelocity.toFixed(1) + ' m/s');

    // Status
    let status = '--';
    if (this.rocketBuilder.assembled) {
      const map = {
        idle: 'Ready', burn: 'Burning', coast: 'Coasting',
        descent: 'Falling', landed: 'Landed',
      };
      status = map[p.phase] || 'Ready';
    }
    this._setText('r-status', status);

    // Equations
    this._setText('eq-netforce', `F = ${p.thrust.toFixed(1)} - ${p.mass.toFixed(2)}\u00D7${p.gravity} = ${p.netForce.toFixed(1)} N`);
    this._setText('eq-accel', `a = ${p.netForce.toFixed(1)} / ${p.mass.toFixed(2)} = ${p.acceleration.toFixed(1)} m/s\u00B2`);
  }

  update(dt) {
    this.updateReadouts();
  }

  updateARHint(found) {
    const hintText = document.getElementById('hint-text');
    if (!hintText) return;
    if (found) {
      hintText.textContent = `Target Detected! LOCKING...`;
      hintText.parentElement.classList.add('hint-success');
    } else {
      hintText.textContent = `Point at target image...`;
      hintText.parentElement.classList.remove('hint-success');
    }
  }

  showDebug(show) {
    const dbg = document.getElementById('debug-info');
    if (dbg) dbg.style.display = show ? 'block' : 'none';
  }

  updateDebug(data) {
    const dbg = document.getElementById('debug-info');
    if (!dbg) return;
    dbg.innerHTML = `
      <b>ROCKET AR DEBUG [v${this.version}]</b><br/>
      MODE: ${data.mode}<br/>
      REF: ${data.refSpace}<br/>
      ANCHOR: ${data.anchor || 'N/A'}<br/>
      LOCK: ${data.stable}/${data.target}<br/>
      POS: ${data.posX}, ${data.posY}, ${data.posZ}
    `;
  }

  updateLaunchButton(assembled) {
    const btn = document.getElementById('btn-launch');
    if (!btn) return;
    if (assembled) {
      btn.classList.remove('disabled');
      btn.removeAttribute('disabled');
    } else {
      btn.classList.add('disabled');
      btn.setAttribute('disabled', 'true');
    }
  }

  flashStatus(msg, isError) {
    const el = document.getElementById('r-status');
    if (!el) return;
    el.textContent = msg;
    if (isError) el.style.color = 'var(--red)';
    setTimeout(() => { el.style.color = ''; }, 1500);
  }

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ── Legacy compat ───────────────────────────────────── */
  show() { }
  hide() { }
}
