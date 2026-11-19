import { uid, escapeHtml, toDateKey, formatDateShort, formatCountdownVi, ICONS } from '../utils.js';
import { buildAllReminders } from '../notifications.js';
import { openTaskModal } from './tasks.js';

const uiState = {
  filter: 'all' // all | auto | manual | done
};

const PRIORITY_MAP = {
  high: { label: 'Ưu tiên cao', cls: 'badge-rose' },
  medium: { label: 'Trung bình', cls: 'badge-amber' },
  low: { label: 'Thấp', cls: 'badge-sky' }
};

const REPEAT_MAP = {
  none: 'Không lặp',
  daily: 'Hằng ngày',
  weekly: 'Hằng tuần',
  monthly: 'Hằng tháng'
};

export function renderRemindersModule(container, app) {
  const all = buildAllReminders(app.state);

  const filtered = all.filter((r) => {
    if (uiState.filter === 'done') return r.completed;
    if (r.completed) return false;
    if (uiState.filter === 'auto') return r.source !== 'manual';
    if (uiState.filter === 'manual') return r.source === 'manual';
    return true;
  });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Reminder &amp; Lịch nhắc</h1>
        <p class="page-subtitle">Tự động tổng hợp nhắc việc từ Booking &amp; Deadline cùng các lịch nhắc định kỳ của bạn</p>
      </div>
      <button class="btn btn-dark btn-sm" id="rem-add-btn">
        ${ICONS.plus}
        <span>Tạo nhắc lịch</span>
      </button>
    </div>

    <section class="panel glass-panel">
      <div class="panel-header">
        <div class="pill-group scrollable-pills">
          <button class="pill-btn ${uiState.filter === 'all' ? 'active' : ''}" data-rem-filter="all">Tất cả (${all.filter(r => !r.completed).length})</button>
          <button class="pill-btn ${uiState.filter === 'auto' ? 'active' : ''}" data-rem-filter="auto">Tự động từ lịch (${all.filter(r => !r.completed && r.source !== 'manual').length})</button>
          <button class="pill-btn ${uiState.filter === 'manual' ? 'active' : ''}" data-rem-filter="manual">Thủ công (${all.filter(r => !r.completed && r.source === 'manual').length})</button>
          <button class="pill-btn ${uiState.filter === 'done' ? 'active' : ''}" data-rem-filter="done">Đã xong (${all.filter(r => r.completed).length})</button>
        </div>
      </div>

      ${filtered.length
        ? `<div class="reminder-list">${filtered.map(renderReminderCard).join('')}</div>`
        : `<div class="empty-state"><div class="empty-state-icon">🔔</div>Không có nhắc lịch nào trong mục này.</div>`
      }
    </section>
  `;

  bindReminderEvents(container, app);
}

function renderReminderCard(r) {
  const isPast = r.triggerAt && r.triggerAt.getTime() < Date.now() && !r.completed;
  const p = PRIORITY_MAP[r.priority || 'medium'];
  const sourceBadge = r.source === 'booking'
    ? '<span class="badge badge-violet">Tự động từ Booking</span>'
    : r.source === 'deadline'
      ? '<span class="badge badge-rose">Tự động từ Deadline</span>'
      : r.source === 'task'
        ? '<span class="badge badge-neutral">Tự động từ Lịch</span>'
        : `<span class="badge badge-neutral">${REPEAT_MAP[r.repeat || 'none']}</span>`;

  return `
    <article class="reminder-card glass-card ${isPast ? 'is-past' : ''}">
      <div class="reminder-card-top">
        <div>
          <div class="reminder-time-lg">${escapeHtml(r.time || '09:00')} <span style="font-size:12.5px;font-weight:600;color:var(--text-muted);">• ${formatDateShort(r.date)}</span></div>
          <div style="font-weight:700; font-size:14px; margin-top:4px; ${r.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">
            ${escapeHtml(r.title)}
          </div>
        </div>
        ${r.triggerAt && !r.completed
          ? `<span class="badge ${isPast ? 'badge-rose' : 'badge-sky'}">${formatCountdownVi(r.triggerAt)}</span>`
          : '<span class="badge badge-emerald">Đã xong</span>'
        }
      </div>

      ${r.notes ? `<div class="muted" style="font-size:12.5px;">${escapeHtml(r.notes)}</div>` : ''}

      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:auto; padding-top:6px;">
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <span class="badge ${p.cls}">${p.label}</span>
          ${sourceBadge}
        </div>
        <div style="display:flex; gap:4px;">
          ${r.source === 'manual'
            ? `
              <button class="btn btn-glass btn-xs" data-toggle-rem="${r.id}">${r.completed ? 'Mở lại' : 'Xong'}</button>
              <button class="icon-btn" style="width:28px;height:28px;" data-edit-rem="${r.id}" title="Sửa">✎</button>
              <button class="icon-btn" style="width:28px;height:28px;" data-del-rem="${r.id}" title="Xóa">${ICONS.trash}</button>
            `
            : `<button class="btn btn-glass btn-xs" data-open-linked="${r.linkedTaskId}">Mở lịch gốc</button>`
          }
        </div>
      </div>
    </article>
  `;
}

function bindReminderEvents(container, app) {
  container.querySelector('#rem-add-btn')?.addEventListener('click', () => openReminderModal(app));

  container.querySelectorAll('[data-rem-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.filter = btn.dataset.remFilter;
      app.render();
    });
  });

  container.querySelectorAll('[data-toggle-rem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = app.state.reminders.find((x) => x.id === btn.dataset.toggleRem);
      if (!r) return;
      r.completed = !r.completed;
      app.commit(r.completed ? 'Đã hoàn thành nhắc lịch!' : 'Đã mở lại nhắc lịch.');
    });
  });

  container.querySelectorAll('[data-edit-rem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = app.state.reminders.find((x) => x.id === btn.dataset.editRem);
      if (r) openReminderModal(app, r);
    });
  });

  container.querySelectorAll('[data-del-rem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.state.reminders = app.state.reminders.filter((x) => x.id !== btn.dataset.delRem);
      app.commit('Đã xóa nhắc lịch.');
    });
  });

  container.querySelectorAll('[data-open-linked]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const task = app.state.tasks.find((t) => t.id === btn.dataset.openLinked);
      if (task) openTaskModal(app, task);
    });
  });
}

function openReminderModal(app, existing = null) {
  const item = existing || {
    title: '',
    notes: '',
    date: toDateKey(new Date()),
    time: '09:00',
    priority: 'medium',
    repeat: 'none'
  };

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${existing ? 'Chỉnh sửa nhắc lịch' : 'Tạo nhắc lịch mới'}</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="rem-form" class="modal-body">
      <div class="form-group">
        <label class="form-label">Tiêu đề nhắc nhở *</label>
        <input class="form-input" name="title" required placeholder="VD: Gọi xác nhận lịch hẹn khách hàng..." value="${escapeHtml(item.title)}" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Ngày</label>
          <input class="form-input" type="date" name="date" required value="${escapeHtml(item.date)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Giờ nhắc</label>
          <input class="form-input" type="time" name="time" required value="${escapeHtml(item.time)}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Mức độ ưu tiên</label>
          <select class="form-select" name="priority">
            <option value="high" ${item.priority === 'high' ? 'selected' : ''}>Cao</option>
            <option value="medium" ${item.priority === 'medium' ? 'selected' : ''}>Trung bình</option>
            <option value="low" ${item.priority === 'low' ? 'selected' : ''}>Thấp</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tần suất lặp lại</label>
          <select class="form-select" name="repeat">
            <option value="none" ${item.repeat === 'none' ? 'selected' : ''}>Không lặp</option>
            <option value="daily" ${item.repeat === 'daily' ? 'selected' : ''}>Hằng ngày</option>
            <option value="weekly" ${item.repeat === 'weekly' ? 'selected' : ''}>Hằng tuần</option>
            <option value="monthly" ${item.repeat === 'monthly' ? 'selected' : ''}>Hằng tháng</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú</label>
        <textarea class="form-textarea" name="notes" placeholder="Chi tiết nội dung cần nhớ...">${escapeHtml(item.notes)}</textarea>
      </div>
      <div class="modal-footer">
        <span></span>
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm">${existing ? 'Lưu thay đổi' : 'Lưu nhắc lịch'}</button>
        </div>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    modalEl.querySelector('#rem-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const data = {
        title: String(fd.get('title') || '').trim(),
        notes: String(fd.get('notes') || '').trim(),
        date: fd.get('date'),
        time: fd.get('time'),
        priority: fd.get('priority'),
        repeat: fd.get('repeat')
      };
      if (!data.title) return;
      if (existing) {
        Object.assign(existing, data);
      } else {
        app.state.reminders.unshift({
          id: uid('rem'),
          ...data,
          completed: false
        });
      }
      app.closeModal();
      app.commit(existing ? 'Đã cập nhật nhắc lịch!' : 'Đã tạo nhắc lịch mới!');
    });
  });
}
