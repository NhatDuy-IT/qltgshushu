import {
  uid,
  escapeHtml,
  toDateKey,
  addDays,
  formatDateShort,
  formatDateFullVi,
  formatMonthYearVi,
  formatVND,
  downloadTaskICS,
  findScheduleConflicts,
  ICONS
} from '../utils.js';
import { openFocusMode } from '../focus-mode.js';

const uiState = {
  panelTab: 'work',        // 'work' (Công việc & Lịch trình) | 'booking'
  calFilter: 'all',        // 'all' | 'task' | 'booking' | 'personal'
  calView: 'month',        // 'month' | 'week' | 'day'
  cursorDate: new Date()
};

const PAYMENT_LABELS = {
  unpaid: { text: 'Chưa cọc', cls: 'badge-rose' },
  deposited: { text: 'Đã cọc', cls: 'badge-amber' },
  paid: { text: 'Đã tất toán', cls: 'badge-emerald' }
};

const TYPE_LABELS = {
  task: 'Công việc',
  booking: 'Booking',
  personal: 'Cá nhân'
};

/**
 * Allows deep-linking from Push Notifications directly to a specific date/item.
 */
export function focusCalendarDateAndItem(app, { date, itemId }) {
  if (date) {
    const [y, m, d] = date.split('-').map(Number);
    if (y && m && d) {
      uiState.cursorDate = new Date(y, m - 1, d);
    }
  }
  app.render();
  if (itemId) {
    const found = (app.state.tasks || []).find((t) => t.id === itemId);
    if (found) {
      openTaskModal(app, found);
      return;
    }
  }
  if (date) {
    openDayModal(app, date);
  }
}

export function renderTasksModule(container, app) {
  const { state } = app;
  const tasks = state.tasks || [];

  const leftItems = tasks.filter((t) => {
    if (uiState.panelTab === 'booking') return t.type === 'booking';
    return t.type !== 'booking';
  });

  const pendingItems = leftItems.filter((t) => t.status === 'pending').sort(sortByDateTime);
  const activeItems = leftItems.filter((t) => t.status === 'active').sort(sortByDateTime);
  const doneItems = leftItems.filter((t) => t.status === 'done').sort(sortByDateTime);

  const calendarHtml = renderCalendarSection(tasks);

  container.innerHTML = `
    <div class="tasks-workspace">
      <!-- LEFT COLUMN: TASK & BOOKING PANEL -->
      <section class="task-left-panel glass-panel" aria-label="Danh sách quản lý">
        <div class="task-panel-top">
          <div class="task-panel-bar">
            <div>
              <h1 class="section-title" style="font-size:17px;">Quản lý lịch trình</h1>
              <p class="page-subtitle" style="font-size:12px;">${tasks.filter(t => t.status !== 'done').length} mục đang mở</p>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="icon-btn glass-card" id="btn-open-crm" title="Danh bạ khách hàng (Mini CRM)" aria-label="Danh bạ khách hàng">
                ${ICONS.users}
              </button>
              <button class="btn btn-dark btn-sm" id="btn-add-task">
                ${ICONS.plus}
                <span>Thêm mới</span>
              </button>
            </div>
          </div>

          <div class="pill-group task-panel-tabs" role="tablist">
            <button class="pill-btn ${uiState.panelTab === 'work' ? 'active' : ''}" data-panel-tab="work">
              Công việc &amp; Lịch trình
            </button>
            <button class="pill-btn ${uiState.panelTab === 'booking' ? 'active' : ''}" data-panel-tab="booking">
              Booking (${tasks.filter(t => t.type === 'booking').length})
            </button>
          </div>
        </div>

        ${renderStatusGroup('Sắp tới / Chờ xử lý', 'pending', pendingItems)}
        ${renderStatusGroup('Đang thực hiện / Đã chốt lịch', 'active', activeItems)}
        ${renderStatusGroup('Hoàn thành', 'done', doneItems)}

        <div class="muted mobile-only" style="font-size:11px; justify-content:center; padding-top:4px;">
          💡 Mẹo Mobile: Vuốt phải để Hoàn thành • Vuốt trái để Dời sang ngày mai
        </div>
      </section>

      <!-- RIGHT COLUMN: MASTER CALENDAR VIEW -->
      <section class="calendar-panel glass-panel" aria-label="Lịch tổng hợp">
        ${calendarHtml}
      </section>
    </div>
  `;

  bindTasksEvents(container, app);
}

function sortByDateTime(a, b) {
  const ka = `${a.date || '9999-99-99'} ${a.time || '23:59'}`;
  const kb = `${b.date || '9999-99-99'} ${b.time || '23:59'}`;
  return ka.localeCompare(kb);
}

function renderStatusGroup(label, statusKey, items) {
  return `
    <div class="status-group">
      <div class="status-group-header">
        <span class="status-dot ${statusKey}"></span>
        <span class="status-group-name">${label}</span>
        <span class="status-group-count">${items.length}</span>
      </div>
      <div class="task-list">
        ${items.length
          ? items.map(renderTaskCard).join('')
          : `<div class="muted" style="font-size:12px; padding: 6px 10px;">Chưa có mục nào</div>`
        }
      </div>
    </div>
  `;
}

function renderTaskCard(t) {
  const isDone = t.status === 'done';
  const payBadge = t.type === 'booking' ? PAYMENT_LABELS[t.paymentStatus || 'unpaid'] : null;
  const isToday = t.date === toDateKey(new Date());
  const dateLabel = t.date
    ? `${t.time ? t.time + ' • ' : ''}${isToday ? 'Hôm nay' : formatDateShort(t.date)}`
    : 'Chưa hẹn ngày';

  return `
    <div class="swipe-card-wrap" data-swipe-id="${t.id}">
      <div class="swipe-bg-right">✓ Hoàn thành</div>
      <div class="swipe-bg-left">→ Dời ngày mai / Xóa</div>
      <article class="task-card glass-card ${isDone ? 'is-done' : ''}" data-open-task="${t.id}">
        <div class="task-card-row">
          <div class="task-card-left">
            <button
              class="task-check-btn status-${t.status}"
              data-cycle-status="${t.id}"
              title="Bấm để đổi trạng thái nhanh"
              aria-label="Đổi trạng thái"
            >
              ${isDone ? ICONS.check : t.status === 'active' ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--status-active);display:block;"></span>' : ''}
            </button>
            <div style="min-width:0; flex:1;">
              <div class="task-card-title">${escapeHtml(t.title)}</div>
              <div class="task-card-sub">
                ${t.client ? `<span>${escapeHtml(t.client)}</span>` : `<span>${TYPE_LABELS[t.type] || 'Công việc'}</span>`}
                ${t.isDeadline ? `<span class="badge badge-rose">! Deadline</span>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div class="task-card-meta">
          <span class="task-time-chip ${t.isDeadline && !isDone ? 'urgent' : ''}">
            ${dateLabel}
          </span>
          <div style="display:flex; align-items:center; gap:6px;">
            ${t.type === 'booking' && Number(t.price) > 0
              ? `<span class="task-price-chip">${formatVND(t.price)}</span>`
              : ''
            }
            ${payBadge ? `<span class="badge ${payBadge.cls}">${payBadge.text}</span>` : ''}
            ${t.type === 'personal' ? `<span class="badge badge-sky">Cá nhân</span>` : ''}
          </div>
        </div>
      </article>
    </div>
  `;
}

function renderCalendarSection(tasks) {
  const year = uiState.cursorDate.getFullYear();
  const month = uiState.cursorDate.getMonth();

  const filtered = tasks.filter((t) => {
    if (uiState.calFilter === 'all') return true;
    return t.type === uiState.calFilter;
  });

  const byDate = new Map();
  for (const t of filtered) {
    if (!t.date) continue;
    if (!byDate.has(t.date)) byDate.set(t.date, []);
    byDate.get(t.date).push(t);
  }
  for (const arr of byDate.values()) arr.sort(sortByDateTime);

  const headerTitle = uiState.calView === 'day'
    ? formatDateFullVi(uiState.cursorDate)
    : formatMonthYearVi(year, month);

  let bodyHtml = '';
  if (uiState.calView === 'month') {
    bodyHtml = renderMonthGrid(year, month, byDate);
  } else if (uiState.calView === 'week') {
    bodyHtml = renderWeekGrid(uiState.cursorDate, byDate);
  } else {
    bodyHtml = renderDayView(uiState.cursorDate, byDate);
  }

  return `
    <div class="calendar-toolbar">
      <div class="calendar-title-group">
        <h2 class="calendar-month-title">${headerTitle}</h2>
      </div>
      <div class="calendar-controls-right">
        <div class="pill-group" role="tablist" aria-label="Chế độ xem lịch">
          <button class="pill-btn ${uiState.calView === 'month' ? 'active' : ''}" data-cal-view="month">Tháng</button>
          <button class="pill-btn ${uiState.calView === 'week' ? 'active' : ''}" data-cal-view="week">Tuần</button>
          <button class="pill-btn ${uiState.calView === 'day' ? 'active' : ''}" data-cal-view="day">Ngày</button>
        </div>
        <div class="calendar-nav-btns">
          <button class="icon-btn glass-card" id="cal-prev" aria-label="Trước">${ICONS['chevron-left']}</button>
          <button class="btn btn-glass btn-xs" id="cal-today">Hôm nay</button>
          <button class="icon-btn glass-card" id="cal-next" aria-label="Sau">${ICONS['chevron-right']}</button>
        </div>
      </div>
    </div>

    <div class="calendar-subbar">
      <div class="pill-group" role="tablist" aria-label="Lọc loại lịch">
        <button class="pill-btn ${uiState.calFilter === 'all' ? 'active' : ''}" data-cal-filter="all">Tất cả</button>
        <button class="pill-btn ${uiState.calFilter === 'task' ? 'active' : ''}" data-cal-filter="task">Công việc</button>
        <button class="pill-btn ${uiState.calFilter === 'booking' ? 'active' : ''}" data-cal-filter="booking">Booking</button>
        <button class="pill-btn ${uiState.calFilter === 'personal' ? 'active' : ''}" data-cal-filter="personal">Cá nhân</button>
      </div>
      <div style="display:flex; gap:10px; align-items:center; font-size:11.5px; color:var(--text-muted); flex-wrap:wrap;">
        <span title="Kéo thả thẻ lịch sang ngày khác để đổi ngày hẹn">✋ Kéo thả để đổi ngày</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span class="status-dot pending"></span>Chờ xử lý</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span class="status-dot active"></span>Đã chốt/Đang làm</span>
        <span style="display:inline-flex;align-items:center;gap:4px;"><span class="status-dot done"></span>Hoàn thành</span>
      </div>
    </div>

    ${bodyHtml}
  `;
}

function formatCalendarPill(t) {
  let cls = `cal-event-pill type-${t.type}`;
  let label = t.title;

  if (t.isDeadline && t.status !== 'done') {
    cls += ' is-deadline-alert';
    label = `! Deadline ${t.title}`;
  } else if (t.type === 'booking' && t.status !== 'done') {
    cls += ' is-booking-alert';
    const guest = t.client ? t.client.split('•')[0].trim() : t.title;
    label = `! Lịch hẹn ${t.time ? t.time + ' - ' : ''}${guest}`;
  } else if (t.time) {
    label = `${t.time} ${t.title}`;
  }

  if (t.status === 'done') cls += ' is-done';
  return { cls, label };
}

function renderMonthGrid(year, month, byDate) {
  const todayKey = toDateKey(new Date());
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = addDays(firstDay, -startOffset);

  const weekdays = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
  const shortWeekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = addDays(gridStart, i);
    const key = toDateKey(d);
    const isOtherMonth = d.getMonth() !== month;
    const isToday = key === todayKey;
    const dayItems = byDate.get(key) || [];
    const maxVisible = 3;
    const visible = dayItems.slice(0, maxVisible);
    const extraCount = dayItems.length - maxVisible;

    cells.push(`
      <div class="cal-day-cell ${isOtherMonth ? 'is-other-month' : ''} ${isToday ? 'is-today' : ''}" data-open-day="${key}" data-drop-date="${key}">
        <div class="cal-day-header">
          <span class="cal-day-num">${d.getDate()}</span>
          ${dayItems.length ? `<span style="font-size:10px;color:var(--text-faint);font-weight:700;">${dayItems.length}</span>` : ''}
        </div>
        <div class="cal-events">
          ${visible.map((t) => {
            const pill = formatCalendarPill(t);
            return `<span class="${pill.cls}" draggable="true" data-drag-task="${t.id}" data-open-task="${t.id}" title="Kéo sang ngày khác để đổi lịch • ${escapeHtml(t.title)}">${escapeHtml(pill.label)}</span>`;
          }).join('')}
          ${extraCount > 0 ? `<button class="cal-more-btn" type="button" data-open-day="${key}">+${extraCount} mục khác</button>` : ''}
        </div>
      </div>
    `);
  }

  return `
    <div class="calendar-weekdays">
      ${weekdays.map((w, i) => `<div class="calendar-weekday"><span class="desktop-wd">${w}</span><span class="mobile-wd" style="display:none;">${shortWeekdays[i]}</span></div>`).join('')}
    </div>
    <div class="calendar-month-grid">
      ${cells.join('')}
    </div>
  `;
}

function renderWeekGrid(cursorDate, byDate) {
  const todayKey = toDateKey(new Date());
  const dayOfWeek = (cursorDate.getDay() + 6) % 7;
  const monday = addDays(cursorDate, -dayOfWeek);
  const names = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

  const cols = [];
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(monday, i);
    const key = toDateKey(d);
    const items = byDate.get(key) || [];
    const isToday = key === todayKey;

    cols.push(`
      <div class="cal-week-col ${isToday ? 'is-today' : ''}" data-drop-date="${key}">
        <div class="cal-week-col-head" data-open-day="${key}">
          <div class="cal-week-dayname">${names[i]}</div>
          <div class="cal-week-daynum">${d.getDate()}/${d.getMonth() + 1}</div>
        </div>
        <div class="cal-events" style="gap:6px;">
          ${items.length
            ? items.map((t) => {
                const pill = formatCalendarPill(t);
                return `<div class="${pill.cls}" draggable="true" data-drag-task="${t.id}" style="white-space:normal; cursor:pointer; padding:6px 8px;" data-open-task="${t.id}">
                  <div>${escapeHtml(pill.label)}</div>
                  ${t.client ? `<div style="font-size:10px;opacity:0.78;margin-top:2px;">${escapeHtml(t.client)}</div>` : ''}
                </div>`;
              }).join('')
            : `<div class="muted" style="font-size:11.5px; text-align:center; padding:14px 4px;">Trống lịch</div>`
          }
        </div>
      </div>
    `);
  }

  return `<div class="calendar-week-grid">${cols.join('')}</div>`;
}

function renderDayView(cursorDate, byDate) {
  const key = toDateKey(cursorDate);
  const items = byDate.get(key) || [];

  return `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span class="muted" style="font-size:13px;">Có <strong>${items.length}</strong> lịch trình trong ngày này</span>
      <button class="btn btn-dark btn-xs" data-add-on-date="${key}">+ Thêm lịch ngày này</button>
    </div>
    <div class="cal-day-agenda">
      ${items.length
        ? items.map((t) => `
          <div class="cal-agenda-card glass-card" data-open-task="${t.id}">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="min-width:56px; font-weight:800; font-size:15px; color:var(--text-primary);">${escapeHtml(t.time || '--:--')}</div>
              <div>
                <div style="font-weight:700; font-size:14px;">${escapeHtml(t.title)}</div>
                <div class="muted" style="font-size:12px;">${escapeHtml(t.client || TYPE_LABELS[t.type])}</div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${t.isDeadline ? '<span class="badge badge-rose">! Deadline</span>' : ''}
              ${t.type === 'booking' ? `<span class="badge ${(PAYMENT_LABELS[t.paymentStatus || 'unpaid']).cls}">${(PAYMENT_LABELS[t.paymentStatus || 'unpaid']).text}</span>` : ''}
              <span class="status-dot ${t.status}"></span>
            </div>
          </div>
        `).join('')
        : `<div class="empty-state"><div class="empty-state-icon">🌿</div>Ngày này chưa có lịch hẹn hay công việc nào.</div>`
      }
    </div>
  `;
}

function bindTasksEvents(container, app) {
  container.querySelector('#btn-add-task')?.addEventListener('click', () => {
    openTaskModal(app, null, {
      type: uiState.panelTab === 'booking' ? 'booking' : 'task',
      date: toDateKey(new Date())
    });
  });

  container.querySelector('#btn-open-crm')?.addEventListener('click', () => {
    openClientsCrmModal(app);
  });

  container.querySelectorAll('[data-panel-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.panelTab = btn.dataset.panelTab;
      app.render();
    });
  });

  container.querySelectorAll('[data-cal-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.calFilter = btn.dataset.calFilter;
      app.render();
    });
  });

  container.querySelectorAll('[data-cal-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.calView = btn.dataset.calView;
      app.render();
    });
  });

  container.querySelector('#cal-prev')?.addEventListener('click', () => {
    const d = new Date(uiState.cursorDate);
    if (uiState.calView === 'month') d.setMonth(d.getMonth() - 1);
    else if (uiState.calView === 'week') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    uiState.cursorDate = d;
    app.render();
  });

  container.querySelector('#cal-next')?.addEventListener('click', () => {
    const d = new Date(uiState.cursorDate);
    if (uiState.calView === 'month') d.setMonth(d.getMonth() + 1);
    else if (uiState.calView === 'week') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    uiState.cursorDate = d;
    app.render();
  });

  container.querySelector('#cal-today')?.addEventListener('click', () => {
    uiState.cursorDate = new Date();
    app.render();
  });

  // Cycle status quickly (with Booking -> Finance auto prompt when marked Done!)
  container.querySelectorAll('[data-cycle-status]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.cycleStatus;
      const item = app.state.tasks.find((t) => t.id === id);
      if (!item) return;
      const order = ['pending', 'active', 'done'];
      const nextStatus = order[(order.indexOf(item.status) + 1) % order.length];
      item.status = nextStatus;
      app.commit('Đã cập nhật trạng thái!');

      if (item.type === 'booking' && nextStatus === 'done' && Number(item.price) > 0 && item.paymentStatus !== 'paid') {
        const remaining = Math.max(0, Number(item.price) - (Number(item.deposit) || 0));
        if (remaining > 0) {
          openBookingFinancePrompt(app, item, {
            amount: remaining,
            label: `Tất toán Booking: ${item.title}`,
            targetPaymentStatus: 'paid'
          });
        }
      }
    });
  });

  // Open task/booking detail modal
  container.querySelectorAll('[data-open-task]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.dataset.openTask;
      const item = app.state.tasks.find((t) => t.id === id);
      if (item) openTaskModal(app, item);
    });
  });

  // Open day detail modal
  container.querySelectorAll('[data-open-day]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-open-task]')) return;
      e.stopPropagation();
      openDayModal(app, el.dataset.openDay);
    });
  });

  container.querySelectorAll('[data-add-on-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openTaskModal(app, null, { date: btn.dataset.addOnDate });
    });
  });

  // =========================================================================
  // DRAG & DROP RESCHEDULE ON MASTER CALENDAR
  // =========================================================================
  let draggedTaskId = null;

  container.querySelectorAll('[data-drag-task]').forEach((pill) => {
    pill.addEventListener('dragstart', (e) => {
      draggedTaskId = pill.dataset.dragTask;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedTaskId);
      pill.style.opacity = '0.5';
    });
    pill.addEventListener('dragend', () => {
      pill.style.opacity = '1';
      draggedTaskId = null;
      container.querySelectorAll('.cal-drop-target').forEach((c) => c.classList.remove('cal-drop-target'));
    });
  });

  container.querySelectorAll('[data-drop-date]').forEach((cell) => {
    cell.addEventListener('dragover', (e) => {
      if (!draggedTaskId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cell.classList.add('cal-drop-target');
    });
    cell.addEventListener('dragleave', () => {
      cell.classList.remove('cal-drop-target');
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('cal-drop-target');
      const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
      const newDate = cell.dataset.dropDate;
      if (!taskId || !newDate) return;

      const task = app.state.tasks.find((t) => t.id === taskId);
      if (!task || task.date === newDate) return;

      const conflicts = findScheduleConflicts(app.state.tasks, { ...task, date: newDate }, task.id);
      task.date = newDate;
      task.reminderSent = false; // Re-arm reminder for new date
      if (conflicts.length) {
        app.commit(`Đã đổi sang ${formatDateShort(newDate)} (⚠️ Lưu ý trùng giờ với "${conflicts[0].title}")`);
      } else {
        app.commit(`Đã dời "${task.title}" sang ngày ${formatDateShort(newDate)}!`);
      }
    });
  });

  // =========================================================================
  // MOBILE SWIPE GESTURES ON TASK CARDS (Right = Done, Left = Tomorrow / Delete)
  // =========================================================================
  container.querySelectorAll('.swipe-card-wrap').forEach((wrap) => {
    const card = wrap.querySelector('.task-card');
    const taskId = wrap.dataset.swipeId;
    if (!card || !taskId) return;

    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let tracking = false;

    card.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      deltaX = 0;
      tracking = true;
      card.style.transition = 'none';
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(deltaX) < 12) {
        tracking = false;
        return;
      }
      deltaX = Math.max(-130, Math.min(130, dx));
      card.style.transform = `translateX(${deltaX}px)`;
      wrap.classList.toggle('swiping-right', deltaX > 24);
      wrap.classList.toggle('swiping-left', deltaX < -24);
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (!tracking) return;
      tracking = false;
      card.style.transition = 'transform 180ms ease';
      card.style.transform = '';
      wrap.classList.remove('swiping-right', 'swiping-left');

      const task = app.state.tasks.find((t) => t.id === taskId);
      if (!task) return;

      if (deltaX > 76) {
        // Swipe Right -> Mark Done
        task.status = task.status === 'done' ? 'pending' : 'done';
        app.commit(task.status === 'done' ? '✓ Đã đánh dấu hoàn thành!' : 'Đã mở lại công việc.');
      } else if (deltaX < -76) {
        // Swipe Left -> Quick sheet to postpone to tomorrow or delete
        openSwipeLeftActionModal(app, task);
      }
    });
  });
}

function openSwipeLeftActionModal(app, task) {
  const tomorrowKey = toDateKey(addDays(new Date(), 1));
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Thao tác nhanh</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <div class="modal-body">
      <div style="font-weight:700; font-size:14.5px;">${escapeHtml(task.title)}</div>
      <p class="muted" style="font-size:12.5px;">Chọn hành động bạn muốn áp dụng cho mục này:</p>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <button type="button" class="btn btn-dark" id="sw-postpone">📅 Dời sang ngày mai (${formatDateShort(tomorrowKey)})</button>
        <button type="button" class="btn btn-glass" id="sw-focus">🎯 Bắt đầu Tập trung (Focus Mode)</button>
        <button type="button" class="btn btn-danger" id="sw-delete">🗑 Xóa mục này</button>
      </div>
    </div>
  `;
  app.openModal(html, (modalEl) => {
    modalEl.querySelector('#sw-postpone')?.addEventListener('click', () => {
      task.date = tomorrowKey;
      task.reminderSent = false;
      app.closeModal();
      app.commit(`Đã dời sang ngày mai (${formatDateShort(tomorrowKey)})!`);
    });
    modalEl.querySelector('#sw-focus')?.addEventListener('click', () => {
      app.closeModal();
      openFocusMode(app, task.id);
    });
    modalEl.querySelector('#sw-delete')?.addEventListener('click', () => {
      app.state.tasks = app.state.tasks.filter((t) => t.id !== task.id);
      app.closeModal();
      app.commit('Đã xóa lịch trình.');
    });
  });
}

export function openDayModal(app, dateKey) {
  const items = (app.state.tasks || []).filter((t) => t.date === dateKey).sort(sortByDateTime);

  const html = `
    <div class="modal-header">
      <div>
        <h3 class="modal-title">${formatDateFullVi(dateKey)}</h3>
        <p class="page-subtitle">${items.length} lịch trình trong ngày</p>
      </div>
      <button class="icon-btn" data-close-modal aria-label="Đóng">✕</button>
    </div>
    <div class="modal-body">
      ${items.length
        ? items.map((t) => `
          <div class="glass-card" style="padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer;" data-day-edit="${t.id}">
            <div style="display:flex; align-items:center; gap:10px; min-width:0;">
              <span class="status-dot ${t.status}"></span>
              <div style="min-width:0;">
                <div style="font-weight:700; font-size:13.5px;">${escapeHtml(t.title)}</div>
                <div class="muted" style="font-size:12px;">
                  ${t.time ? `<strong>${escapeHtml(t.time)}</strong> • ` : ''}${escapeHtml(t.client || TYPE_LABELS[t.type])}
                </div>
              </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              ${t.isDeadline ? '<span class="badge badge-rose">! Deadline</span>' : ''}
              ${t.type === 'booking' ? `<span class="badge ${PAYMENT_LABELS[t.paymentStatus || 'unpaid'].cls}">${PAYMENT_LABELS[t.paymentStatus || 'unpaid'].text}</span>` : ''}
              <button type="button" class="icon-btn" style="width:28px;height:28px;" data-day-ics="${t.id}" title="Xuất file .ics">${ICONS.download}</button>
            </div>
          </div>
        `).join('')
        : `<div class="empty-state" style="padding:24px 10px;">Chưa có lịch nào trong ngày này.</div>`
      }
    </div>
    <div class="modal-footer">
      <button class="btn btn-glass btn-sm" data-close-modal>Đóng</button>
      <button class="btn btn-dark btn-sm" id="day-modal-add">+ Thêm lịch vào ngày này</button>
    </div>
  `;

  app.openModal(html, (modalEl) => {
    modalEl.querySelectorAll('[data-day-ics]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = app.state.tasks.find((t) => t.id === btn.dataset.dayIcs);
        if (item && downloadTaskICS(item)) {
          app.toast('Đã xuất file lịch .ics!');
        }
      });
    });
    modalEl.querySelectorAll('[data-day-edit]').forEach((row) => {
      row.addEventListener('click', () => {
        const item = app.state.tasks.find((t) => t.id === row.dataset.dayEdit);
        if (item) openTaskModal(app, item);
      });
    });
    modalEl.querySelector('#day-modal-add')?.addEventListener('click', () => {
      openTaskModal(app, null, { date: dateKey });
    });
  });
}

export function openTaskModal(app, existing = null, defaults = {}) {
  const item = existing || {
    type: defaults.type || 'task',
    title: '',
    client: defaults.client || '',
    clientId: defaults.clientId || '',
    clientPhone: defaults.clientPhone || '',
    date: defaults.date || toDateKey(new Date()),
    time: '09:00',
    duration: 60,
    status: 'pending',
    isDeadline: false,
    price: 0,
    deposit: 0,
    paymentStatus: 'unpaid',
    remindBefore: 30,
    notes: ''
  };

  const isBooking = item.type === 'booking';
  const prevPaymentStatus = existing ? existing.paymentStatus : 'unpaid';
  const prevStatus = existing ? existing.status : 'pending';
  let conflictConfirmed = false;

  const html = `
    <div class="modal-header">
      <div>
        <h3 class="modal-title">${existing ? 'Chi tiết & Chỉnh sửa' : 'Thêm lịch trình / Booking mới'}</h3>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        ${existing ? `
          <button type="button" class="btn btn-glass btn-xs" id="tf-focus-btn" title="Tập trung vào việc này">🎯 Focus</button>
          <button type="button" class="btn btn-glass btn-xs" id="tf-export-ics" title="Xuất file lịch .ics cho khách / điện thoại">📅 .ics</button>
        ` : ''}
        <button class="icon-btn" data-close-modal aria-label="Đóng">✕</button>
      </div>
    </div>
    <form id="task-form" class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phân loại</label>
          <select class="form-select" name="type" id="tf-type">
            <option value="task" ${item.type === 'task' ? 'selected' : ''}>Công việc</option>
            <option value="booking" ${item.type === 'booking' ? 'selected' : ''}>Booking khách hàng</option>
            <option value="personal" ${item.type === 'personal' ? 'selected' : ''}>Lịch cá nhân</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Trạng thái</label>
          <select class="form-select" name="status">
            <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>⚫ Sắp tới / Chờ xử lý</option>
            <option value="active" ${item.status === 'active' ? 'selected' : ''}>🔴 Đang làm / Đã chốt lịch</option>
            <option value="done" ${item.status === 'done' ? 'selected' : ''}>🔵 Hoàn thành</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Tiêu đề công việc / Booking *</label>
        <input class="form-input" name="title" required placeholder="VD: Booking chụp ảnh Lookbook, Gửi báo giá..." value="${escapeHtml(item.title)}" />
      </div>

      <!-- Mini CRM Autocomplete Client Field -->
      <div class="form-row">
        <div class="form-group crm-input-wrap">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label class="form-label">Khách hàng / Địa điểm</label>
            <button type="button" id="tf-view-crm" style="font-size:11px; font-weight:700; color:var(--sky);">Lịch sử khách →</button>
          </div>
          <input class="form-input" id="tf-client-input" name="client" autocomplete="off" placeholder="Gõ tên để gợi ý khách cũ..." value="${escapeHtml(item.client)}" />
          <input type="hidden" name="clientId" id="tf-client-id" value="${escapeHtml(item.clientId || '')}" />
          <div id="crm-suggestions" class="crm-dropdown glass-panel-strong" hidden></div>
        </div>
        <div class="form-group">
          <label class="form-label">SĐT / Zalo khách hàng</label>
          <input class="form-input" id="tf-client-phone" name="clientPhone" placeholder="VD: 0909 412 882" value="${escapeHtml(item.clientPhone || '')}" />
        </div>
      </div>

      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Ngày hẹn / Deadline</label>
          <input class="form-input" type="date" name="date" id="tf-date" value="${escapeHtml(item.date)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Giờ bắt đầu</label>
          <input class="form-input" type="time" name="time" id="tf-time" value="${escapeHtml(item.time)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Thời lượng (phút)</label>
          <select class="form-select" name="duration" id="tf-duration">
            <option value="30" ${Number(item.duration) === 30 ? 'selected' : ''}>30 phút</option>
            <option value="60" ${(Number(item.duration) || 60) === 60 ? 'selected' : ''}>1 tiếng</option>
            <option value="90" ${Number(item.duration) === 90 ? 'selected' : ''}>1 tiếng 30p</option>
            <option value="120" ${Number(item.duration) === 120 ? 'selected' : ''}>2 tiếng</option>
            <option value="180" ${Number(item.duration) === 180 ? 'selected' : ''}>3 tiếng</option>
          </select>
        </div>
      </div>

      <!-- Live Conflict Detection Alert -->
      <div id="tf-conflict-alert" class="conflict-box" hidden></div>

      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Nhắc lịch tự động</label>
          <select class="form-select" name="remindBefore">
            <option value="-1" ${Number(item.remindBefore) === -1 ? 'selected' : ''}>Không nhắc</option>
            <option value="0" ${Number(item.remindBefore) === 0 ? 'selected' : ''}>Đúng giờ hẹn</option>
            <option value="15" ${Number(item.remindBefore) === 15 ? 'selected' : ''}>Trước 15 phút</option>
            <option value="30" ${Number(item.remindBefore) === 30 ? 'selected' : ''}>Trước 30 phút</option>
            <option value="60" ${Number(item.remindBefore) === 60 ? 'selected' : ''}>Trước 1 tiếng</option>
            <option value="1440" ${Number(item.remindBefore) === 1440 ? 'selected' : ''}>Trước 1 ngày</option>
          </select>
        </div>
        <div class="form-group" style="justify-content:flex-end;">
          <label style="display:flex; align-items:center; gap:9px; font-size:12.5px; font-weight:600; cursor:pointer; padding:9px 0;">
            <input type="checkbox" name="isDeadline" ${item.isDeadline ? 'checked' : ''} style="width:16px;height:16px;" />
            <span>Đánh dấu <strong>! Deadline</strong> nổi bật</span>
          </label>
        </div>
      </div>

      <!-- Booking Finance Section -->
      <div id="tf-booking-fields" style="display:${isBooking ? 'flex' : 'none'}; flex-direction:column; gap:12px; padding:12px; border-radius:14px; background:var(--accent-soft);">
        <div style="font-size:12px; font-weight:700; color:var(--text-secondary);">Thông tin giá &amp; đặt cọc Booking (Tự gợi ý đồng bộ sang Finance)</div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Giá Booking (VNĐ)</label>
            <input class="form-input" type="number" min="0" step="50000" name="price" value="${Number(item.price) || 0}" />
          </div>
          <div class="form-group">
            <label class="form-label">Tiền đã cọc (VNĐ)</label>
            <input class="form-input" type="number" min="0" step="50000" name="deposit" value="${Number(item.deposit) || 0}" />
          </div>
          <div class="form-group">
            <label class="form-label">Thanh toán</label>
            <select class="form-select" name="paymentStatus">
              <option value="unpaid" ${item.paymentStatus === 'unpaid' ? 'selected' : ''}>Chưa cọc</option>
              <option value="deposited" ${item.paymentStatus === 'deposited' ? 'selected' : ''}>Đã cọc</option>
              <option value="paid" ${item.paymentStatus === 'paid' ? 'selected' : ''}>Đã tất toán</option>
            </select>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Ghi chú chi tiết</label>
        <textarea class="form-textarea" id="tf-notes" name="notes" placeholder="Yêu cầu khách hàng, địa chỉ chi tiết, tài liệu cần chuẩn bị...">${escapeHtml(item.notes)}</textarea>
      </div>

      <div class="modal-footer">
        ${existing ? `<button type="button" class="btn btn-danger btn-sm" id="tf-delete">Xóa mục này</button>` : '<span></span>'}
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" id="tf-submit-btn" class="btn btn-dark btn-sm">${existing ? 'Lưu thay đổi' : 'Tạo lịch mới'}</button>
        </div>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    const typeSelect = modalEl.querySelector('#tf-type');
    const bookingBox = modalEl.querySelector('#tf-booking-fields');
    const dateInput = modalEl.querySelector('#tf-date');
    const timeInput = modalEl.querySelector('#tf-time');
    const durInput = modalEl.querySelector('#tf-duration');
    const conflictBox = modalEl.querySelector('#tf-conflict-alert');
    const submitBtn = modalEl.querySelector('#tf-submit-btn');

    // Focus Mode & .ics buttons
    modalEl.querySelector('#tf-focus-btn')?.addEventListener('click', () => {
      app.closeModal();
      openFocusMode(app, existing.id);
    });
    modalEl.querySelector('#tf-export-ics')?.addEventListener('click', () => {
      if (downloadTaskICS(existing)) {
        app.toast('Đã tải xuống file lịch .ics!');
      }
    });

    typeSelect.addEventListener('change', () => {
      bookingBox.style.display = typeSelect.value === 'booking' ? 'flex' : 'none';
    });

    // Live Conflict Checker
    const refreshConflicts = () => {
      conflictConfirmed = false;
      const conflicts = findScheduleConflicts(
        app.state.tasks,
        { date: dateInput.value, time: timeInput.value, duration: Number(durInput.value) || 60 },
        existing?.id || null
      );
      if (conflicts.length) {
        conflictBox.hidden = false;
        conflictBox.innerHTML = `
          <div style="font-weight:700; color:var(--amber);">⚠️ Cảnh báo trùng khung giờ trong ngày ${formatDateShort(dateInput.value)}:</div>
          ${conflicts.map((c) => `<div>• <strong>${escapeHtml(c.time)}</strong> — ${escapeHtml(c.title)}${c.client ? ` (${escapeHtml(c.client)})` : ''}</div>`).join('')}
        `;
      } else {
        conflictBox.hidden = true;
        conflictBox.innerHTML = '';
        submitBtn.textContent = existing ? 'Lưu thay đổi' : 'Tạo lịch mới';
      }
      return conflicts;
    };

    dateInput.addEventListener('change', refreshConflicts);
    timeInput.addEventListener('change', refreshConflicts);
    durInput.addEventListener('change', refreshConflicts);
    refreshConflicts();

    // Mini CRM Autocomplete
    const clientInput = modalEl.querySelector('#tf-client-input');
    const clientIdInput = modalEl.querySelector('#tf-client-id');
    const clientPhoneInput = modalEl.querySelector('#tf-client-phone');
    const notesInput = modalEl.querySelector('#tf-notes');
    const dropdown = modalEl.querySelector('#crm-suggestions');

    const renderCrmSuggestions = () => {
      const q = (clientInput.value || '').trim().toLowerCase();
      const clients = app.state.clients || [];
      const matches = clients.filter((c) =>
        !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      ).slice(0, 6);

      if (!matches.length) {
        dropdown.hidden = true;
        return;
      }

      dropdown.hidden = false;
      dropdown.innerHTML = matches.map((c) => `
        <button type="button" class="crm-option" data-pick-cli="${c.id}">
          <div style="display:flex; justify-content:space-between; gap:8px;">
            <strong style="font-size:13px;">${escapeHtml(c.name)}</strong>
            <span class="muted" style="font-size:11.5px;">${escapeHtml(c.phone || '')}</span>
          </div>
          ${c.notes ? `<span class="muted" style="font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.notes)}</span>` : ''}
        </button>
      `).join('');

      dropdown.querySelectorAll('[data-pick-cli]').forEach((opt) => {
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const c = clients.find((x) => x.id === opt.dataset.pickCli);
          if (!c) return;
          clientInput.value = c.location ? `${c.name} • ${c.location}` : c.name;
          clientIdInput.value = c.id;
          if (c.phone) clientPhoneInput.value = c.phone;
          if (!notesInput.value.trim() && c.notes) notesInput.value = c.notes;
          dropdown.hidden = true;
        });
      });
    };

    clientInput.addEventListener('focus', renderCrmSuggestions);
    clientInput.addEventListener('input', () => {
      clientIdInput.value = '';
      renderCrmSuggestions();
    });
    clientInput.addEventListener('blur', () => {
      setTimeout(() => { dropdown.hidden = true; }, 160);
    });

    modalEl.querySelector('#tf-view-crm')?.addEventListener('click', () => {
      openClientsCrmModal(app, clientIdInput.value || '');
    });

    modalEl.querySelector('#tf-delete')?.addEventListener('click', () => {
      app.state.tasks = app.state.tasks.filter((t) => t.id !== existing.id);
      app.closeModal();
      app.commit('Đã xóa lịch trình.');
    });

    modalEl.querySelector('#task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);

      const candidate = {
        date: fd.get('date') || toDateKey(new Date()),
        time: fd.get('time') || '',
        duration: Number(fd.get('duration')) || 60
      };

      // Conflict detection requires explicit 2nd click confirmation before saving
      const conflicts = findScheduleConflicts(app.state.tasks, candidate, existing?.id || null);
      if (conflicts.length && !conflictConfirmed) {
        conflictConfirmed = true;
        submitBtn.textContent = '⚠️ Vẫn lưu dù trùng giờ';
        app.toast(`Phát hiện trùng giờ với "${conflicts[0].title}"! Bấm lại để xác nhận lưu.`, 'error');
        return;
      }

      const data = {
        type: fd.get('type'),
        title: String(fd.get('title') || '').trim(),
        client: String(fd.get('client') || '').trim(),
        clientId: String(fd.get('clientId') || '').trim(),
        clientPhone: String(fd.get('clientPhone') || '').trim(),
        date: candidate.date,
        time: candidate.time,
        duration: candidate.duration,
        status: fd.get('status') || 'pending',
        isDeadline: fd.get('isDeadline') === 'on',
        price: Number(fd.get('price')) || 0,
        deposit: Number(fd.get('deposit')) || 0,
        paymentStatus: fd.get('paymentStatus') || 'unpaid',
        remindBefore: Number(fd.get('remindBefore')),
        reminderSent: false,
        notes: String(fd.get('notes') || '').trim()
      };

      if (!data.title) return;

      // Auto upsert client into Mini CRM if it's a Booking with a client name
      if (data.type === 'booking' && data.client) {
        data.clientId = upsertClientFromBooking(app, data);
      }

      let savedItem = existing;
      if (existing) {
        Object.assign(existing, data);
      } else {
        savedItem = {
          id: uid('task'),
          ...data,
          createdAt: new Date().toISOString()
        };
        app.state.tasks.unshift(savedItem);
      }

      app.closeModal();
      app.commit(existing ? 'Đã lưu cập nhật!' : 'Đã thêm lịch trình mới & đồng bộ Reminder!');

      // Auto Booking -> Finance Confirmation Dialog when newly Deposited or Completed/Paid
      if (savedItem.type === 'booking') {
        const becameDeposited = savedItem.paymentStatus === 'deposited' && prevPaymentStatus !== 'deposited';
        const becamePaid = savedItem.paymentStatus === 'paid' && prevPaymentStatus !== 'paid';
        const becameDone = savedItem.status === 'done' && prevStatus !== 'done';

        if (becameDeposited && savedItem.deposit > 0) {
          openBookingFinancePrompt(app, savedItem, {
            amount: savedItem.deposit,
            label: `Tiền cọc Booking: ${savedItem.title}`,
            targetPaymentStatus: 'deposited'
          });
        } else if ((becamePaid || becameDone) && savedItem.price > 0) {
          const alreadyLogged = (app.state.transactions || [])
            .filter((tx) => tx.bookingId === savedItem.id && tx.type === 'income')
            .reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
          const toRecord = Math.max(0, savedItem.price - alreadyLogged);
          if (toRecord > 0) {
            openBookingFinancePrompt(app, savedItem, {
              amount: toRecord,
              label: `Tất toán Booking: ${savedItem.title}`,
              targetPaymentStatus: 'paid'
            });
          }
        }
      }
    });
  });
}

function upsertClientFromBooking(app, bookingData) {
  app.state.clients = app.state.clients || [];
  const parts = bookingData.client.split('•').map((s) => s.trim());
  const cleanName = parts[0];
  const location = parts[1] || '';

  let cli = bookingData.clientId
    ? app.state.clients.find((c) => c.id === bookingData.clientId)
    : app.state.clients.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());

  if (cli) {
    if (bookingData.clientPhone) cli.phone = bookingData.clientPhone;
    if (location && !cli.location) cli.location = location;
    return cli.id;
  }

  const newCli = {
    id: uid('cli'),
    name: cleanName,
    phone: bookingData.clientPhone || '',
    zalo: bookingData.clientPhone || '',
    location,
    notes: bookingData.notes ? bookingData.notes.slice(0, 160) : '',
    createdAt: new Date().toISOString()
  };
  app.state.clients.unshift(newCli);
  return newCli.id;
}

/**
 * Confirmation modal to push a Booking deposit/settlement directly into Finance.
 */
function openBookingFinancePrompt(app, booking, { amount, label, targetPaymentStatus }) {
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">💰 Đồng bộ doanh thu sang Finance?</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="bf-sync-form" class="modal-body">
      <p style="font-size:13.5px;">
        Booking <strong>${escapeHtml(booking.title)}</strong> vừa chuyển sang trạng thái
        <strong>${targetPaymentStatus === 'paid' ? 'Hoàn thành / Tất toán' : 'Đã cọc'}</strong>.
        Bạn có muốn tự động ghi nhận khoản thu này vào tab <strong>Finance</strong> ngay không?
      </p>
      <div class="form-group">
        <label class="form-label">Nội dung khoản thu</label>
        <input class="form-input" name="txTitle" value="${escapeHtml(label)}" required />
      </div>
      <div class="form-group">
        <label class="form-label">Số tiền ghi nhận (VNĐ)</label>
        <input class="form-input" type="number" min="1000" step="10000" name="txAmount" value="${amount}" required />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-glass btn-sm" data-close-modal>Để sau</button>
        <button type="submit" class="btn btn-dark btn-sm">✓ Đẩy sang Finance ngay</button>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    modalEl.querySelector('#bf-sync-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const txAmount = Number(fd.get('txAmount')) || 0;
      const txTitle = String(fd.get('txTitle') || label).trim();
      if (txAmount <= 0) return;

      app.state.transactions.unshift({
        id: uid('tx'),
        type: 'income',
        title: txTitle,
        category: 'Booking',
        amount: txAmount,
        date: toDateKey(new Date()),
        bookingId: booking.id,
        notes: booking.client || ''
      });

      if (targetPaymentStatus === 'paid') {
        booking.paymentStatus = 'paid';
        booking.deposit = booking.price;
      }

      app.closeModal();
      app.commit(`Đã ghi nhận +${formatVND(txAmount)} vào Finance!`);
    });
  });
}

/**
 * Mini CRM Modal — View/Add/Edit Clients & Full Booking History per Client
 */
export function openClientsCrmModal(app, selectedClientId = '') {
  const getClients = () => app.state.clients || [];
  const getTasks = () => app.state.tasks || [];

  const getFilteredList = (searchQ = '') => {
    const q = searchQ.trim().toLowerCase();
    return getClients().filter((c) =>
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  };

  const getHistory = (c) => getTasks().filter((t) =>
    t.type === 'booking' && (
      t.clientId === c.id ||
      (t.client || '').toLowerCase().includes((c.name || '').toLowerCase())
    )
  ).sort(sortByDateTime).reverse();

  const renderInner = (activeId, searchQ = '') => {
    const clients = getClients();
    const list = getFilteredList(searchQ);
    const active = list.find((c) => c.id === activeId) || list[0] || null;
    const history = active ? getHistory(active) : [];
    const totalSpent = history.reduce((s, b) => s + (Number(b.price) || 0), 0);

    return `
      <div class="modal-header">
        <div>
          <h3 class="modal-title">👤 Danh bạ khách hàng (Mini CRM)</h3>
          <p class="page-subtitle">${clients.length} khách hàng đã lưu • Tự gợi ý khi tạo Booking</p>
        </div>
        <button class="icon-btn" data-close-modal>✕</button>
      </div>
      <div class="modal-body" style="gap:12px;">
        <div style="display:flex; gap:8px;">
          <input class="form-input" id="crm-search" placeholder="Tìm theo tên, SĐT/Zalo..." value="${escapeHtml(searchQ)}" />
          <button type="button" class="btn btn-dark btn-sm" id="crm-new-btn">+ Khách mới</button>
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; max-height:110px; overflow-y:auto;">
          ${list.length
            ? list.map((c) => `
              <button type="button" class="pill-btn ${active?.id === c.id ? 'active' : ''}" style="border:1px solid var(--glass-border-subtle);" data-crm-select="${c.id}">
                ${escapeHtml(c.name)}
              </button>
            `).join('')
            : `<span class="muted" style="font-size:12.5px;">${clients.length ? 'Không tìm thấy khách hàng phù hợp.' : 'Danh bạ đang trống. Bấm "+ Khách mới" để thêm.'}</span>`
          }
        </div>

        ${active ? `
          <div class="glass-card" style="padding:14px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
              <div>
                <div style="font-size:16px; font-weight:800;">${escapeHtml(active.name)}</div>
                <div class="muted" style="font-size:12.5px;">
                  📞 ${escapeHtml(active.phone || 'Chưa có SĐT')} ${active.location ? `• 📍 ${escapeHtml(active.location)}` : ''}
                </div>
              </div>
              <div style="display:flex; gap:6px; align-items:center;">
                <button type="button" class="btn btn-dark btn-xs" id="crm-quick-book">+ Tạo Booking</button>
                <button type="button" class="btn btn-danger btn-xs" id="crm-del-cli" data-del-id="${active.id}" title="Xóa khách hàng này">Xóa</button>
              </div>
            </div>
            ${active.notes ? `<div style="font-size:12.5px; padding:8px 10px; border-radius:10px; background:var(--accent-soft);">📝 ${escapeHtml(active.notes)}</div>` : ''}
            <div style="display:flex; gap:12px; font-size:12px; font-weight:700; flex-wrap:wrap;">
              <span>Lịch sử: ${history.length} Booking</span>
              <span style="color:var(--emerald);">Tổng doanh thu: ${formatVND(totalSpent)}</span>
            </div>
          </div>

          <div style="display:flex; flex-direction:column; gap:6px; max-height:190px; overflow-y:auto;">
            <div class="form-label">Lịch sử Booking của ${escapeHtml(active.name)}</div>
            ${history.length
              ? history.map((b) => `
                <div class="glass-card" style="padding:9px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px; cursor:pointer;" data-crm-open-task="${b.id}">
                  <div>
                    <div style="font-weight:700; font-size:13px;">${escapeHtml(b.title)}</div>
                    <div class="muted" style="font-size:11.5px;">${formatDateShort(b.date)} ${b.time || ''} • ${formatVND(b.price)}</div>
                  </div>
                  <span class="badge ${PAYMENT_LABELS[b.paymentStatus || 'unpaid'].cls}">${PAYMENT_LABELS[b.paymentStatus || 'unpaid'].text}</span>
                </div>
              `).join('')
              : `<div class="muted" style="font-size:12px;">Chưa có lịch Booking nào gắn với khách này.</div>`
            }
          </div>
        ` : ''}
      </div>
    `;
  };

  let currentId = selectedClientId;
  let currentSearch = '';

  const mount = () => {
    app.openModal(renderInner(currentId, currentSearch), (modalEl) => {
      modalEl.querySelector('#crm-search')?.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        mount();
        const inp = document.querySelector('#crm-search');
        if (inp) {
          inp.focus();
          inp.setSelectionRange(currentSearch.length, currentSearch.length);
        }
      });

      modalEl.querySelectorAll('[data-crm-select]').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentId = btn.dataset.crmSelect;
          mount();
        });
      });

      modalEl.querySelector('#crm-new-btn')?.addEventListener('click', () => {
        openAddClientFormModal(app);
      });

      const list = getFilteredList(currentSearch);
      const active = list.find((c) => c.id === currentId) || list[0] || null;

      modalEl.querySelector('#crm-quick-book')?.addEventListener('click', () => {
        if (!active) return;
        openTaskModal(app, null, {
          type: 'booking',
          client: active.location ? `${active.name} • ${active.location}` : active.name,
          clientId: active.id,
          clientPhone: active.phone || '',
          date: toDateKey(new Date())
        });
      });

      modalEl.querySelector('#crm-del-cli')?.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.delId || active?.id;
        if (!targetId) return;
        app.state.clients = getClients().filter((c) => c.id !== targetId);
        currentId = '';
        app.commit('Đã xóa khách hàng khỏi danh bạ!');
        mount();
      });

      modalEl.querySelectorAll('[data-crm-open-task]').forEach((row) => {
        row.addEventListener('click', () => {
          const t = getTasks().find((x) => x.id === row.dataset.crmOpenTask);
          if (t) openTaskModal(app, t);
        });
      });
    });
  };

  mount();
}

function openAddClientFormModal(app) {
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Thêm khách hàng vào Mini CRM</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="crm-add-form" class="modal-body">
      <div class="form-group">
        <label class="form-label">Tên khách hàng *</label>
        <input class="form-input" name="name" required placeholder="VD: Chị Lan Anh" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">SĐT / Zalo</label>
          <input class="form-input" name="phone" placeholder="09xx xxx xxx" />
        </div>
        <div class="form-group">
          <label class="form-label">Địa điểm quen thuộc</label>
          <input class="form-input" name="location" placeholder="VD: Quận 1, Thảo Điền..." />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú đặc biệt (gu thẩm mỹ, thói quen...)</label>
        <textarea class="form-textarea" name="notes" rows="3" placeholder="Ghi chú riêng cho khách này..."></textarea>
      </div>
      <div class="modal-footer">
        <span></span>
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm">Lưu khách hàng</button>
        </div>
      </div>
    </form>
  `;
  app.openModal(html, (modalEl) => {
    modalEl.querySelector('#crm-add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const name = String(fd.get('name') || '').trim();
      if (!name) return;
      const newCli = {
        id: uid('cli'),
        name,
        phone: String(fd.get('phone') || '').trim(),
        zalo: String(fd.get('phone') || '').trim(),
        location: String(fd.get('location') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        createdAt: new Date().toISOString()
      };
      app.state.clients = app.state.clients || [];
      app.state.clients.unshift(newCli);
      app.commit('Đã thêm khách hàng mới vào danh bạ!');
      openClientsCrmModal(app, newCli.id);
    });
  });
}
