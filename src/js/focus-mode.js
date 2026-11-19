import { escapeHtml, formatDateShort } from './utils.js';
import { audioEngine } from './audio-engine.js';
import { pomodoro } from './modules/relax.js';

let focusOpen = false;
let focusedTaskId = '';
let prevTickHandler = null;

const QUICK_SOUNDS = [
  { id: 'rain', label: '🌧️ Tiếng mưa' },
  { id: 'cafe', label: '☕ Quán cà phê' },
  { id: 'brown', label: '🤎 Tiếng ồn nâu' }
];

export function isFocusModeOpen() {
  return focusOpen;
}

export function openFocusMode(app, taskId = '') {
  const root = document.getElementById('focus-mode-root');
  if (!root) return;

  const openTasks = (app.state.tasks || []).filter((t) => t.status !== 'done');
  focusedTaskId = taskId || openTasks[0]?.id || '';
  focusOpen = true;
  root.hidden = false;
  document.body.style.overflow = 'hidden';

  prevTickHandler = pomodoro._onTick;
  renderFocusOverlay(root, app);
}

export function closeFocusMode(app) {
  const root = document.getElementById('focus-mode-root');
  if (!root) return;
  focusOpen = false;
  root.hidden = true;
  root.innerHTML = '';
  document.body.style.overflow = '';
  pomodoro._onTick = prevTickHandler;
  app?.updateRelaxIndicator();
}

function renderFocusOverlay(root, app) {
  const openTasks = (app.state.tasks || []).filter((t) => t.status !== 'done');
  const activeTask = openTasks.find((t) => t.id === focusedTaskId) || openTasks[0] || null;
  if (activeTask) focusedTaskId = activeTask.id;

  const totalSec = (pomodoro.durations[pomodoro.mode] || 25) * 60;
  const progress = totalSec > 0 ? 1 - pomodoro.remainingSec / totalSec : 0;
  const r = 96;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - progress);
  const mins = String(Math.floor(pomodoro.remainingSec / 60)).padStart(2, '0');
  const secs = String(pomodoro.remainingSec % 60).padStart(2, '0');

  root.innerHTML = `
    <div class="focus-container glass-panel-strong">
      <div style="width:100%; display:flex; align-items:center; justify-content:space-between;">
        <span class="badge badge-neutral">🎯 CHẾ ĐỘ TẬP TRUNG (FOCUS MODE)</span>
        <button type="button" class="btn btn-glass btn-xs" id="focus-exit-btn">Thoát (ESC)</button>
      </div>

      <!-- Focused Single Task -->
      <div class="focus-task-box">
        ${openTasks.length
          ? `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
              <span class="muted" style="font-size:11.5px; font-weight:700;">MỤC TIÊU HIỆN TẠI</span>
              <select class="form-select" id="focus-task-select" style="width:auto; max-width:220px; padding:4px 8px; font-size:12px;">
                ${openTasks.map((t) => `<option value="${t.id}" ${t.id === focusedTaskId ? 'selected' : ''}>${escapeHtml(t.title)}</option>`).join('')}
              </select>
            </div>
            <div style="font-family:var(--font-display); font-size:19px; font-weight:800; line-height:1.3;">
              ${escapeHtml(activeTask.title)}
            </div>
            <div class="muted" style="font-size:12.5px;">
              ${activeTask.client ? `${escapeHtml(activeTask.client)} • ` : ''}${activeTask.time ? `${activeTask.time} ` : ''}${formatDateShort(activeTask.date)}
            </div>
            <div style="margin-top:4px;">
              <button type="button" class="btn btn-glass btn-xs" id="focus-mark-done">✓ Đánh dấu hoàn thành việc này</button>
            </div>
          `
          : `<div style="font-weight:700; font-size:15px;">🎉 Bạn đã hoàn thành hết việc đang mở! Hãy thư giãn hoặc tập trung tự do.</div>`
        }
      </div>

      <!-- Pomodoro Ring -->
      <div class="pomo-ring-wrap">
        <svg width="218" height="218" viewBox="0 0 218 218">
          <circle cx="109" cy="109" r="${r}" fill="none" stroke="var(--accent-soft)" stroke-width="10"/>
          <circle
            id="focus-pomo-ring"
            cx="109" cy="109" r="${r}"
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
          <div class="pomo-clock" id="focus-pomo-clock">${mins}:${secs}</div>
          <div class="pomo-mode-label">${pomodoro.mode === 'focus' ? 'Tập trung sâu' : 'Đang nghỉ ngắn'}</div>
        </div>
      </div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">
        <button type="button" class="btn btn-dark" id="focus-pomo-toggle" style="min-width:136px;">
          ${pomodoro.running ? '⏸ Tạm dừng' : '▶ Bắt đầu'}
        </button>
        <button type="button" class="btn btn-glass" id="focus-pomo-reset">Đặt lại</button>
        <button type="button" class="btn btn-glass" id="focus-pomo-switch">
          ${pomodoro.mode === 'focus' ? 'Chuyển nghỉ 5p' : 'Chuyển tập trung 25p'}
        </button>
      </div>

      <!-- Quick White Noise Controls -->
      <div style="width:100%; text-align:left;">
        <div class="muted" style="font-size:11px; font-weight:700; margin-bottom:8px; letter-spacing:0.06em;">ÂM THANH NỀN TẬP TRUNG</div>
        <div class="focus-sound-bar">
          ${QUICK_SOUNDS.map((s) => {
            const vol = Math.round((audioEngine.volumes[s.id] || 0) * 100);
            return `
              <div class="glass-card" style="padding:9px 11px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:600;">
                  <span>${s.label}</span>
                  <span data-fvol-lbl="${s.id}">${vol}%</span>
                </div>
                <input type="range" class="range-slider" min="0" max="100" value="${vol}" data-fvol="${s.id}" />
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Live tick updater
  pomodoro._onTick = () => {
    app.updateRelaxIndicator();
    const clk = root.querySelector('#focus-pomo-clock');
    const ring = root.querySelector('#focus-pomo-ring');
    const btn = root.querySelector('#focus-pomo-toggle');
    if (!clk) return;
    const m = String(Math.floor(pomodoro.remainingSec / 60)).padStart(2, '0');
    const s = String(pomodoro.remainingSec % 60).padStart(2, '0');
    clk.textContent = `${m}:${s}`;
    const tot = (pomodoro.durations[pomodoro.mode] || 25) * 60;
    const pct = tot > 0 ? 1 - pomodoro.remainingSec / tot : 0;
    if (ring) ring.setAttribute('stroke-dashoffset', String(circ * (1 - pct)));
    if (btn) btn.textContent = pomodoro.running ? '⏸ Tạm dừng' : '▶ Bắt đầu';
  };

  root.querySelector('#focus-exit-btn')?.addEventListener('click', () => closeFocusMode(app));

  root.querySelector('#focus-task-select')?.addEventListener('change', (e) => {
    focusedTaskId = e.target.value;
    renderFocusOverlay(root, app);
  });

  root.querySelector('#focus-mark-done')?.addEventListener('click', () => {
    const task = app.state.tasks.find((t) => t.id === focusedTaskId);
    if (!task) return;
    task.status = 'done';
    app.commit('Tuyệt vời! Bạn đã hoàn thành mục tiêu tập trung 🎉');
    focusedTaskId = '';
    renderFocusOverlay(root, app);
  });

  root.querySelector('#focus-pomo-toggle')?.addEventListener('click', () => {
    if (pomodoro.running) pomodoro.pause();
    else pomodoro.start(app);
  });

  root.querySelector('#focus-pomo-reset')?.addEventListener('click', () => pomodoro.reset());

  root.querySelector('#focus-pomo-switch')?.addEventListener('click', () => {
    pomodoro.setMode(pomodoro.mode === 'focus' ? 'short' : 'focus');
    renderFocusOverlay(root, app);
  });

  root.querySelectorAll('[data-fvol]').forEach((sl) => {
    sl.addEventListener('input', () => {
      const id = sl.dataset.fvol;
      const val = Number(sl.value);
      audioEngine.setVolume(id, val / 100);
      const lbl = root.querySelector(`[data-fvol-lbl="${id}"]`);
      if (lbl) lbl.textContent = `${val}%`;
      app.updateRelaxIndicator();
    });
  });
}
