import {
  uid,
  escapeHtml,
  toDateKey,
  addDays,
  parseDateTime,
  formatDateFullVi,
  formatDateShort,
  formatVND,
  formatCountdownVi,
  getGreetingVi,
  calculateStreak,
  ICONS
} from '../utils.js';
import { openTaskModal } from './tasks.js';

export function renderDashboardModule(container, app) {
  const { state } = app;
  const now = new Date();
  const todayKey = toDateKey(now);
  const weekEndKey = toDateKey(addDays(now, 7));
  const currentMonthPrefix = todayKey.slice(0, 7);

  const tasks = state.tasks || [];
  const todayItems = tasks
    .filter((t) => t.date === todayKey)
    .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

  const upcomingBookings = tasks
    .filter((t) => t.type === 'booking' && t.status !== 'done' && t.date >= todayKey)
    .sort((a, b) => `${a.date} ${a.time || '23:59'}`.localeCompare(`${b.date} ${b.time || '23:59'}`))
    .slice(0, 4);

  const weekDeadlines = tasks
    .filter((t) => t.isDeadline && t.status !== 'done' && t.date >= todayKey && t.date <= weekEndKey)
    .sort((a, b) => `${a.date} ${a.time || '23:59'}`.localeCompare(`${b.date} ${b.time || '23:59'}`));

  const monthIncome = (state.transactions || [])
    .filter((tx) => tx.type === 'income' && (tx.date || '').startsWith(currentMonthPrefix))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const habits = state.habits || [];
  const habitsDoneToday = habits.filter((h) => (h.completedDates || []).includes(todayKey)).length;
  const habitPct = habits.length ? Math.round((habitsDoneToday / habits.length) * 100) : 0;

  const last7Keys = [];
  for (let i = 6; i >= 0; i -= 1) last7Keys.push(toDateKey(addDays(now, -i)));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${getGreetingVi()}, ShuShu ✨</h1>
        <p class="page-subtitle">${formatDateFullVi(now)} • Tập trung vào những điều quan trọng nhất hôm nay</p>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-glass btn-sm" id="dash-add-habit">+ Thói quen</button>
        <button class="btn btn-dark btn-sm" id="dash-add-task">${ICONS.plus}<span>Thêm lịch / Booking</span></button>
      </div>
    </div>

    <!-- KPI Row -->
    <div class="kpi-grid">
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Lịch trình hôm nay</span>
        <span class="kpi-value">${todayItems.filter(t => t.status === 'done').length}/${todayItems.length}</span>
        <span class="kpi-sub">${todayItems.filter(t => t.status !== 'done').length} mục còn lại trong ngày</span>
      </div>
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Booking sắp diễn ra</span>
        <span class="kpi-value">${upcomingBookings.length}</span>
        <span class="kpi-sub">${upcomingBookings[0] ? `Gần nhất: ${formatDateShort(upcomingBookings[0].date)} ${upcomingBookings[0].time || ''}` : 'Chưa có lịch mới'}</span>
      </div>
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Thu nhập tháng ${now.getMonth() + 1}</span>
        <span class="kpi-value" style="color:var(--emerald);">${formatVND(monthIncome)}</span>
        <span class="kpi-sub">Từ Booking &amp; dự án</span>
      </div>
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Thói quen hôm nay</span>
        <span class="kpi-value">${habitPct}%</span>
        <span class="kpi-sub">${habitsDoneToday}/${habits.length} thói quen đã hoàn tất</span>
      </div>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Today + Upcoming Bookings + Deadlines -->
      <div class="dash-stack">
        <!-- Upcoming Bookings with Countdown -->
        <section class="panel glass-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">Booking sắp diễn ra</h2>
              <p class="page-subtitle">Đếm ngược thời gian đến lịch hẹn khách hàng</p>
            </div>
            <button class="btn btn-glass btn-xs" data-go="tasks">Xem tất cả</button>
          </div>
          <div style="display:flex; flex-direction:column; gap:9px;">
            ${upcomingBookings.length
              ? upcomingBookings.map((b) => {
                  const target = parseDateTime(b.date, b.time || '09:00');
                  const payMap = { unpaid: 'Chưa cọc', deposited: 'Đã cọc', paid: 'Đã tất toán' };
                  const payCls = { unpaid: 'badge-rose', deposited: 'badge-amber', paid: 'badge-emerald' };
                  return `
                    <div class="booking-countdown-card glass-card" data-dash-task="${b.id}">
                      <div style="min-width:0;">
                        <div style="font-weight:700; font-size:14px;">${escapeHtml(b.title)}</div>
                        <div class="muted" style="font-size:12px; margin-top:2px;">
                          ${escapeHtml(b.client || 'Khách hàng')} • ${b.time || ''} ${formatDateShort(b.date)}
                        </div>
                        <div style="display:flex; gap:6px; align-items:center; margin-top:6px;">
                          <span class="badge ${payCls[b.paymentStatus || 'unpaid']}">${payMap[b.paymentStatus || 'unpaid']}</span>
                          ${Number(b.price) > 0 ? `<span style="font-size:12px; font-weight:700; color:var(--emerald);">${formatVND(b.price)}</span>` : ''}
                        </div>
                      </div>
                      <span class="countdown-pill">${formatCountdownVi(target)}</span>
                    </div>
                  `;
                }).join('')
              : `<div class="empty-state" style="padding:20px;">Chưa có Booking nào sắp tới.</div>`
            }
          </div>
        </section>

        <!-- Today's Tasks -->
        <section class="panel glass-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">Lịch trình hôm nay</h2>
              <p class="page-subtitle">Bấm ô vuông để đánh dấu hoàn thành nhanh</p>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${todayItems.length
              ? todayItems.map((t) => {
                  const isDone = t.status === 'done';
                  return `
                    <div class="task-card glass-card ${isDone ? 'is-done' : ''}" data-dash-task="${t.id}">
                      <div class="task-card-row">
                        <div class="task-card-left">
                          <button class="task-check-btn status-${t.status}" data-dash-toggle="${t.id}" aria-label="Hoàn thành">
                            ${isDone ? ICONS.check : ''}
                          </button>
                          <div>
                            <div class="task-card-title">${escapeHtml(t.title)}</div>
                            <div class="task-card-sub">
                              ${t.time ? `<strong>${escapeHtml(t.time)}</strong>` : ''}
                              ${t.client ? `• ${escapeHtml(t.client)}` : ''}
                            </div>
                          </div>
                        </div>
                        ${t.isDeadline ? '<span class="badge badge-rose">! Deadline</span>' : ''}
                      </div>
                    </div>
                  `;
                }).join('')
              : `<div class="empty-state" style="padding:20px;">Hôm nay bạn đang rảnh! Hãy tận hưởng hoặc thêm mục tiêu mới.</div>`
            }
          </div>
        </section>
      </div>

      <!-- Right Column: Habit Tracker + Nearest Deadlines -->
      <div class="dash-stack">
        <!-- Habit Tracker -->
        <section class="panel glass-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">Habit Tracker</h2>
              <p class="page-subtitle">Duy trì thói quen tốt mỗi ngày</p>
            </div>
            <button class="btn btn-glass btn-xs" id="habit-add-inline">+ Thêm</button>
          </div>

          <div class="habit-progress-wrap">
            <div class="habit-progress-meta">
              <span>Tiến độ hôm nay</span>
              <span>${habitsDoneToday}/${habits.length} (${habitPct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${habitPct}%"></div>
            </div>
          </div>

          <div class="habit-list">
            ${habits.length
              ? habits.map((h) => {
                  const dates = h.completedDates || [];
                  const doneToday = dates.includes(todayKey);
                  const streak = calculateStreak(dates);
                  return `
                    <div class="habit-item glass-card">
                      <div class="habit-left">
                        <button class="habit-toggle ${doneToday ? 'checked' : ''}" data-toggle-habit="${h.id}" aria-label="Đánh dấu thói quen">
                          ${doneToday ? ICONS.check : ''}
                        </button>
                        <div style="min-width:0;">
                          <div style="font-weight:600; font-size:13.5px; ${doneToday ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">
                            ${escapeHtml(h.icon || '✨')} ${escapeHtml(h.name)}
                          </div>
                          <div class="habit-dots" title="7 ngày gần nhất">
                            ${last7Keys.map((dk) => `<span class="habit-dot ${dates.includes(dk) ? 'done' : ''}"></span>`).join('')}
                          </div>
                        </div>
                      </div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span class="habit-streak">🔥 ${streak} ngày</span>
                        <button class="icon-btn" style="width:28px;height:28px;" data-del-habit="${h.id}" title="Xóa thói quen">${ICONS.trash}</button>
                      </div>
                    </div>
                  `;
                }).join('')
              : `<div class="empty-state" style="padding:20px;">Chưa có thói quen nào. Bấm "+ Thêm" để bắt đầu chuỗi streak!</div>`
            }
          </div>
        </section>

        <!-- Weekly Deadlines -->
        <section class="panel glass-panel">
          <div class="panel-header">
            <div>
              <h2 class="section-title">Deadline gần nhất (7 ngày tới)</h2>
              <p class="page-subtitle">Ưu tiên xử lý đúng hạn</p>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:8px;">
            ${weekDeadlines.length
              ? weekDeadlines.map((d) => {
                  const target = parseDateTime(d.date, d.time || '17:00');
                  return `
                    <div class="glass-card" style="padding:11px 13px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer;" data-dash-task="${d.id}">
                      <div>
                        <div style="font-weight:700; font-size:13.5px; color:var(--alert-deadline-text);">! ${escapeHtml(d.title)}</div>
                        <div class="muted" style="font-size:12px;">${escapeHtml(d.client || 'Công việc')} • ${formatDateShort(d.date)} ${d.time || ''}</div>
                      </div>
                      <span class="badge badge-rose">${formatCountdownVi(target)}</span>
                    </div>
                  `;
                }).join('')
              : `<div class="empty-state" style="padding:18px;">Không có deadline gấp trong 7 ngày tới 🎉</div>`
            }
          </div>
        </section>
      </div>
    </div>
  `;

  // Bind events
  container.querySelector('#dash-add-task')?.addEventListener('click', () => {
    openTaskModal(app, null, { date: todayKey });
  });

  const triggerHabitModal = () => openHabitModal(app);
  container.querySelector('#dash-add-habit')?.addEventListener('click', triggerHabitModal);
  container.querySelector('#habit-add-inline')?.addEventListener('click', triggerHabitModal);

  container.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => app.navigate(btn.dataset.go));
  });

  container.querySelectorAll('[data-dash-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item = app.state.tasks.find((t) => t.id === btn.dataset.dashToggle);
      if (!item) return;
      item.status = item.status === 'done' ? 'pending' : 'done';
      app.commit(item.status === 'done' ? 'Tuyệt vời! Đã hoàn thành.' : 'Đã mở lại công việc.');
    });
  });

  container.querySelectorAll('[data-dash-task]').forEach((card) => {
    card.addEventListener('click', () => {
      const item = app.state.tasks.find((t) => t.id === card.dataset.dashTask);
      if (item) openTaskModal(app, item);
    });
  });

  container.querySelectorAll('[data-toggle-habit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const h = app.state.habits.find((x) => x.id === btn.dataset.toggleHabit);
      if (!h) return;
      h.completedDates = h.completedDates || [];
      const idx = h.completedDates.indexOf(todayKey);
      if (idx >= 0) {
        h.completedDates.splice(idx, 1);
      } else {
        h.completedDates.push(todayKey);
      }
      app.commit(idx >= 0 ? 'Đã bỏ đánh dấu thói quen.' : 'Giữ vững phong độ! 🔥');
    });
  });

  container.querySelectorAll('[data-del-habit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.state.habits = app.state.habits.filter((h) => h.id !== btn.dataset.delHabit);
      app.commit('Đã xóa thói quen.');
    });
  });
}

function openHabitModal(app) {
  const icons = ['💧', '📖', '🏃‍♀️', '✨', '🧘', '🥗', '✍️', '🎧', '☀️', '💤'];
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Thêm thói quen hằng ngày</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="habit-form" class="modal-body">
      <div class="form-group">
        <label class="form-label">Tên thói quen *</label>
        <input class="form-input" name="name" required placeholder="VD: Thiền 10 phút, Uống đủ 2L nước..." />
      </div>
      <div class="form-group">
        <label class="form-label">Biểu tượng</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${icons.map((ic, i) => `
            <label style="cursor:pointer;">
              <input type="radio" name="icon" value="${ic}" ${i === 0 ? 'checked' : ''} style="display:none;" />
              <span class="glass-card habit-icon-opt" style="display:inline-flex;width:38px;height:38px;align-items:center;justify-content:center;font-size:18px;border-radius:12px;">${ic}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <span></span>
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm">Tạo thói quen</button>
        </div>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    const updateIconHighlight = () => {
      modalEl.querySelectorAll('input[name="icon"]').forEach((inp) => {
        const span = inp.nextElementSibling;
        span.style.borderColor = inp.checked ? 'var(--accent)' : 'var(--glass-border-subtle)';
        span.style.background = inp.checked ? 'var(--accent-soft)' : 'var(--card-inner-bg)';
      });
    };
    updateIconHighlight();
    modalEl.querySelectorAll('input[name="icon"]').forEach((inp) => inp.addEventListener('change', updateIconHighlight));

    modalEl.querySelector('#habit-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get('name') || '').trim();
      if (!name) return;
      app.state.habits.push({
        id: uid('habit'),
        name,
        icon: fd.get('icon') || '✨',
        completedDates: []
      });
      app.closeModal();
      app.commit('Đã thêm thói quen mới!');
    });
  });
}
