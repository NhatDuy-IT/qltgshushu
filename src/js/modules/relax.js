import { audioEngine, SOUND_CHANNELS } from '../audio-engine.js';

const PRESETS = [
  { name: 'Tập trung sâu', map: { rain: 0.45, brown: 0.35 } },
  { name: 'Mưa quán cà phê', map: { rain: 0.55, cafe: 0.5 } },
  { name: 'Biển đêm thư giãn', map: { ocean: 0.65, forest: 0.25 } }
];

export const pomodoro = {
  mode: 'focus', // focus | short | long
  durations: { focus: 25, short: 5, long: 15 },
  remainingSec: 25 * 60,
  running: false,
  sessionsDone: 0,
  _interval: null,
  _onTick: null,

  setMode(mode) {
    this.pause();
    this.mode = mode;
    this.remainingSec = (this.durations[mode] || 25) * 60;
    this._onTick?.();
  },

  setCustomMinutes(mode, mins) {
    const val = Math.max(1, Math.min(120, Number(mins) || 25));
    this.durations[mode] = val;
    if (this.mode === mode && !this.running) {
      this.remainingSec = val * 60;
    }
    this._onTick?.();
  },

  start(app) {
    if (this.running) return;
    this.running = true;
    this._interval = setInterval(() => {
      if (this.remainingSec > 0) {
        this.remainingSec -= 1;
        this._onTick?.();
      } else {
        this.pause();
        audioEngine.playChime();
        if (this.mode === 'focus') {
          this.sessionsDone += 1;
          app?.toast('Hoàn thành phiên tập trung! Hãy thư giãn một chút 🌿');
        } else {
          app?.toast('Hết giờ nghỉ! Bắt đầu phiên mới nhé.');
        }
        this.remainingSec = (this.durations[this.mode] || 25) * 60;
        this._onTick?.();
      }
    }, 1000);
    this._onTick?.();
  },

  pause() {
    this.running = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._onTick?.();
  },

  reset() {
    this.pause();
    this.remainingSec = (this.durations[this.mode] || 25) * 60;
    this._onTick?.();
  }
};

export function renderRelaxModule(container, app) {
  const totalSec = (pomodoro.durations[pomodoro.mode] || 25) * 60;
  const progress = totalSec > 0 ? 1 - pomodoro.remainingSec / totalSec : 0;
  const r = 98;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - progress);

  const mins = String(Math.floor(pomodoro.remainingSec / 60)).padStart(2, '0');
  const secs = String(pomodoro.remainingSec % 60).padStart(2, '0');
  const modeLabels = { focus: 'Tập trung sâu', short: 'Nghỉ ngắn', long: 'Nghỉ dài' };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Relax &amp; Pomodoro</h1>
        <p class="page-subtitle">Âm thanh môi trường (Web Audio) &amp; đồng hồ tập trung — vẫn phát nền khi bạn chuyển tab</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-glass btn-sm" id="relax-mute-btn">
          ${audioEngine.muted ? '🔇 Đang tắt tiếng' : '🔊 Đang bật tiếng'}
        </button>
        <button class="btn btn-glass btn-sm" id="relax-stop-all">Dừng tất cả âm</button>
      </div>
    </div>

    <div class="relax-grid">
      <!-- Pomodoro Timer Panel -->
      <section class="panel glass-panel pomodoro-panel">
        <div class="pill-group" style="width:100%; justify-content:center;">
          <button class="pill-btn ${pomodoro.mode === 'focus' ? 'active' : ''}" data-pomo-mode="focus">Tập trung (${pomodoro.durations.focus}p)</button>
          <button class="pill-btn ${pomodoro.mode === 'short' ? 'active' : ''}" data-pomo-mode="short">Nghỉ ngắn (${pomodoro.durations.short}p)</button>
          <button class="pill-btn ${pomodoro.mode === 'long' ? 'active' : ''}" data-pomo-mode="long">Nghỉ dài (${pomodoro.durations.long}p)</button>
        </div>

        <div class="pomo-ring-wrap">
          <svg width="224" height="224" viewBox="0 0 224 224">
            <circle cx="112" cy="112" r="${r}" fill="none" stroke="var(--accent-soft)" stroke-width="10"/>
            <circle
              id="pomo-progress-circle"
              cx="112" cy="112" r="${r}"
              fill="none"
              stroke="var(--accent)"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${circ}"
              stroke-dashoffset="${dashOffset}"
              style="transition: stroke-dashoffset 0.5s linear;"
            />
          </svg>
          <div class="pomo-time-display">
            <div class="pomo-clock" id="pomo-clock-text">${mins}:${secs}</div>
            <div class="pomo-mode-label">${modeLabels[pomodoro.mode]}</div>
          </div>
        </div>

        <div style="display:flex; gap:10px;">
          <button class="btn btn-dark" id="pomo-toggle" style="min-width:130px;">
            ${pomodoro.running ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
          </button>
          <button class="btn btn-glass" id="pomo-reset">Đặt lại</button>
        </div>

        <div style="width:100%; padding-top:14px; border-top:1px solid var(--glass-border-subtle); display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; font-size:12.5px;">
            <span class="muted">Phiên tập trung đã xong hôm nay</span>
            <strong>🍅 ${pomodoro.sessionsDone} phiên</strong>
          </div>
          <div class="form-row-3" style="text-align:left;">
            <div class="form-group">
              <label class="form-label">Tập trung (p)</label>
              <input type="number" class="form-input" min="1" max="120" value="${pomodoro.durations.focus}" data-pomo-dur="focus" style="padding:6px 8px;" />
            </div>
            <div class="form-group">
              <label class="form-label">Nghỉ ngắn (p)</label>
              <input type="number" class="form-input" min="1" max="60" value="${pomodoro.durations.short}" data-pomo-dur="short" style="padding:6px 8px;" />
            </div>
            <div class="form-group">
              <label class="form-label">Nghỉ dài (p)</label>
              <input type="number" class="form-input" min="1" max="60" value="${pomodoro.durations.long}" data-pomo-dur="long" style="padding:6px 8px;" />
            </div>
          </div>
        </div>
      </section>

      <!-- Ambient Sound Mixer -->
      <section class="panel glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Bộ trộn âm thanh (Ambient Sound Mixer)</h2>
            <p class="page-subtitle">Kéo thanh trượt để phối trộn không gian thư giãn riêng của bạn</p>
          </div>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
          ${PRESETS.map((p, idx) => `
            <button class="btn btn-glass btn-xs" data-sound-preset="${idx}">✨ ${p.name}</button>
          `).join('')}
        </div>

        <div class="sound-grid">
          ${SOUND_CHANNELS.map((ch) => {
            const vol = Math.round((audioEngine.volumes[ch.id] || 0) * 100);
            const active = vol > 0 && !audioEngine.muted;
            return `
              <div class="sound-card glass-card ${active ? 'is-playing' : ''}" data-sound-card="${ch.id}">
                <div class="sound-card-head">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:20px;">${ch.icon}</span>
                    <div>
                      <div style="font-weight:700; font-size:13.5px;">${ch.name}</div>
                      <div class="muted" style="font-size:11px;">${ch.desc}</div>
                    </div>
                  </div>
                  <span style="font-size:12px; font-weight:700;" data-vol-label="${ch.id}">${vol}%</span>
                </div>
                <input
                  type="range"
                  class="range-slider"
                  min="0"
                  max="100"
                  value="${vol}"
                  data-sound-slider="${ch.id}"
                  aria-label="Âm lượng ${ch.name}"
                />
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;

  // Subscribe live tick to update clock without full DOM tear-down
  pomodoro._onTick = () => {
    app.updateRelaxIndicator();
    const clockEl = container.querySelector('#pomo-clock-text');
    const circleEl = container.querySelector('#pomo-progress-circle');
    const toggleBtn = container.querySelector('#pomo-toggle');
    if (!clockEl) return;
    const m = String(Math.floor(pomodoro.remainingSec / 60)).padStart(2, '0');
    const s = String(pomodoro.remainingSec % 60).padStart(2, '0');
    clockEl.textContent = `${m}:${s}`;
    const tot = (pomodoro.durations[pomodoro.mode] || 25) * 60;
    const pct = tot > 0 ? 1 - pomodoro.remainingSec / tot : 0;
    if (circleEl) circleEl.setAttribute('stroke-dashoffset', String(circ * (1 - pct)));
    if (toggleBtn) toggleBtn.textContent = pomodoro.running ? '⏸ Tạm dừng' : '▶ Bắt đầu';
  };

  // Bind Pomodoro events
  container.querySelectorAll('[data-pomo-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pomodoro.setMode(btn.dataset.pomoMode);
      app.render();
    });
  });

  container.querySelector('#pomo-toggle')?.addEventListener('click', () => {
    if (pomodoro.running) pomodoro.pause();
    else pomodoro.start(app);
    app.updateRelaxIndicator();
  });

  container.querySelector('#pomo-reset')?.addEventListener('click', () => {
    pomodoro.reset();
    app.updateRelaxIndicator();
  });

  container.querySelectorAll('[data-pomo-dur]').forEach((inp) => {
    inp.addEventListener('change', () => {
      pomodoro.setCustomMinutes(inp.dataset.pomoDur, inp.value);
      app.render();
    });
  });

  // Bind Ambient Sound events
  container.querySelectorAll('[data-sound-slider]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const id = slider.dataset.soundSlider;
      const val = Number(slider.value);
      audioEngine.setVolume(id, val / 100);
      const lbl = container.querySelector(`[data-vol-label="${id}"]`);
      if (lbl) lbl.textContent = `${val}%`;
      const card = container.querySelector(`[data-sound-card="${id}"]`);
      if (card) card.classList.toggle('is-playing', val > 0 && !audioEngine.muted);
      app.updateRelaxIndicator();
    });
  });

  container.querySelectorAll('[data-sound-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = PRESETS[Number(btn.dataset.soundPreset)];
      if (!preset) return;
      audioEngine.applyPreset(preset.map);
      app.updateRelaxIndicator();
      app.render();
      app.toast(`Đã bật không gian "${preset.name}"`);
    });
  });

  container.querySelector('#relax-mute-btn')?.addEventListener('click', () => {
    audioEngine.toggleMute();
    app.updateRelaxIndicator();
    app.render();
  });

  container.querySelector('#relax-stop-all')?.addEventListener('click', () => {
    audioEngine.stopAll();
    app.updateRelaxIndicator();
    app.render();
    app.toast('Đã tắt toàn bộ âm thanh nền.');
  });
}
