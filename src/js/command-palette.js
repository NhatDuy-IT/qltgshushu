import { escapeHtml, formatDateShort, ICONS } from './utils.js';
import { openTaskModal, openClientsCrmModal } from './modules/tasks.js';
import { openFocusMode } from './focus-mode.js';

let isOpen = false;
let query = '';
let selectedIndex = 0;
let flatItems = [];

export function openCommandPalette(app) {
  const root = document.getElementById('cmd-palette-root');
  if (!root) return;
  isOpen = true;
  query = '';
  selectedIndex = 0;
  root.hidden = false;
  document.body.style.overflow = 'hidden';
  renderPalette(app);

  const input = root.querySelector('#cmd-search-input');
  if (input) {
    input.focus();
  }
}

export function closeCommandPalette() {
  const root = document.getElementById('cmd-palette-root');
  if (!root) return;
  isOpen = false;
  root.hidden = true;
  document.body.style.overflow = '';
}

export function isCommandPaletteOpen() {
  return isOpen;
}

function buildResults(app, qStr) {
  const q = qStr.trim().toLowerCase();
  const state = app.state;
  const groups = [];

  // 1. Quick Actions
  const actions = [
    {
      id: 'act-add-booking',
      title: 'Thêm Booking khách hàng mới',
      sub: 'Tạo lịch hẹn có giá, tiền cọc & nhắc giờ tự động',
      badge: 'Lệnh nhanh',
      run: () => openTaskModal(app, null, { type: 'booking' })
    },
    {
      id: 'act-add-task',
      title: 'Thêm Công việc / Deadline mới',
      sub: 'Tạo đầu việc trong lịch tổng hợp',
      badge: 'Lệnh nhanh',
      run: () => openTaskModal(app, null, { type: 'task' })
    },
    {
      id: 'act-focus',
      title: 'Bật Chế độ Tập trung (Focus Mode)',
      sub: 'Ẩn sidebar, giữ 1 việc + Pomodoro + tiếng ồn trắng',
      badge: 'Focus',
      run: () => openFocusMode(app)
    },
    {
      id: 'act-crm',
      title: 'Mở Danh bạ khách hàng (Mini CRM)',
      sub: 'Xem danh sách khách, SĐT/Zalo & lịch sử Booking',
      badge: 'CRM',
      run: () => openClientsCrmModal(app)
    }
  ];

  const navActions = [
    { id: 'nav-dashboard', title: 'Chuyển tới Dashboard', sub: 'Tổng quan & Habit Tracker', badge: 'Tab', run: () => app.navigate('dashboard') },
    { id: 'nav-tasks', title: 'Chuyển tới Công việc & Lịch', sub: 'Quản lý Booking & Master Calendar', badge: 'Tab', run: () => app.navigate('tasks') },
    { id: 'nav-reminders', title: 'Chuyển tới Reminder', sub: 'Lịch nhắc & tự động đồng bộ Booking', badge: 'Tab', run: () => app.navigate('reminders') },
    { id: 'nav-finance', title: 'Chuyển tới Finance', sub: 'Thu chi & Doanh thu Booking', badge: 'Tab', run: () => app.navigate('finance') },
    { id: 'nav-notes', title: 'Chuyển tới Quick Note', sub: 'Kho ghi chú nhanh', badge: 'Tab', run: () => app.navigate('notes') },
    { id: 'nav-projects', title: 'Chuyển tới Project Kanban', sub: 'Dự án dài hạn', badge: 'Tab', run: () => app.navigate('projects') },
    { id: 'nav-relax', title: 'Chuyển tới Relax', sub: 'Tiếng ồn trắng & Pomodoro', badge: 'Tab', run: () => app.navigate('relax') },
    { id: 'nav-theme', title: 'Chuyển tới Màu & kính', sub: 'Hình nền, độ mờ kính & Dark mode', badge: 'Tab', run: () => app.navigate('theme') },
    { id: 'nav-settings', title: 'Chuyển tới Cài đặt', sub: 'Khóa PIN 4 số, tài khoản & Supabase', badge: 'Tab', run: () => app.navigate('settings') }
  ];

  const matchedActions = [...actions, ...navActions].filter((a) =>
    !q || a.title.toLowerCase().includes(q) || a.sub.toLowerCase().includes(q)
  );

  // 2. Tasks & Bookings
  const matchedTasks = (state.tasks || [])
    .filter((t) =>
      !q ||
      (t.title || '').toLowerCase().includes(q) ||
      (t.client || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q)
    )
    .slice(0, q ? 8 : 4)
    .map((t) => ({
      id: `t-${t.id}`,
      title: t.title,
      sub: `${t.client ? t.client + ' • ' : ''}${t.time ? t.time + ' ' : ''}${formatDateShort(t.date)}`,
      badge: t.type === 'booking' ? 'Booking' : t.isDeadline ? '! Deadline' : 'Công việc',
      run: () => {
        app.navigate('tasks');
        openTaskModal(app, t);
      }
    }));

  // 3. Clients (Mini CRM)
  const matchedClients = (state.clients || [])
    .filter((c) =>
      !q ||
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    )
    .slice(0, q ? 6 : 2)
    .map((c) => ({
      id: `c-${c.id}`,
      title: `👤 ${c.name}`,
      sub: `${c.phone || 'Chưa có SĐT'}${c.location ? ' • ' + c.location : ''}`,
      badge: 'Khách hàng',
      run: () => openClientsCrmModal(app, c.id)
    }));

  // 4. Notes
  const matchedNotes = (state.notes || [])
    .filter((n) =>
      !q ||
      (n.title || '').toLowerCase().includes(q) ||
      (n.content || '').toLowerCase().includes(q) ||
      (n.tags || []).some((tg) => tg.toLowerCase().includes(q))
    )
    .slice(0, q ? 6 : 2)
    .map((n) => ({
      id: `n-${n.id}`,
      title: n.title || 'Ghi chú nhanh',
      sub: (n.content || '').slice(0, 70),
      badge: 'Quick Note',
      run: () => app.navigate('notes')
    }));

  // 5. Projects
  const matchedProjects = (state.projects || [])
    .filter((p) => !q || (p.title || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
    .slice(0, 4)
    .map((p) => ({
      id: `p-${p.id}`,
      title: p.title,
      sub: p.description || 'Dự án Kanban',
      badge: 'Project',
      run: () => app.navigate('projects')
    }));

  if (q) {
    if (matchedTasks.length) groups.push({ label: 'Booking & Công việc', items: matchedTasks });
    if (matchedClients.length) groups.push({ label: 'Khách hàng (Mini CRM)', items: matchedClients });
    if (matchedNotes.length) groups.push({ label: 'Quick Note', items: matchedNotes });
    if (matchedProjects.length) groups.push({ label: 'Dự án', items: matchedProjects });
    if (matchedActions.length) groups.push({ label: 'Lệnh nhanh & Điều hướng', items: matchedActions.slice(0, 6) });
  } else {
    groups.push({ label: 'Lệnh nhanh', items: actions });
    if (matchedTasks.length) groups.push({ label: 'Lịch trình gần nhất', items: matchedTasks });
    if (matchedClients.length) groups.push({ label: 'Khách hàng quen', items: matchedClients });
    groups.push({ label: 'Chuyển nhanh màn hình', items: navActions.slice(0, 5) });
  }

  return groups;
}

function renderPalette(app) {
  const card = document.getElementById('cmd-card');
  if (!card) return;

  const groups = buildResults(app, query);
  flatItems = groups.flatMap((g) => g.items);
  if (selectedIndex >= flatItems.length) selectedIndex = 0;

  let idxCounter = 0;
  const listHtml = groups.length
    ? groups.map((g) => `
        <div class="cmd-group-title">${g.label}</div>
        ${g.items.map((item) => {
      const idx = idxCounter++;
      return `
            <button type="button" class="cmd-item ${idx === selectedIndex ? 'selected' : ''}" data-cmd-idx="${idx}">
              <div style="min-width:0;">
                <div style="font-weight:700; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.title)}</div>
                <div class="muted" style="font-size:11.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.sub)}</div>
              </div>
              <span class="badge badge-neutral" style="flex-shrink:0;">${escapeHtml(item.badge)}</span>
            </button>
          `;
    }).join('')}
      `).join('')
    : `<div class="empty-state" style="padding:28px;">Không tìm thấy kết quả nào cho "<strong>${escapeHtml(query)}</strong>"</div>`;

  // Preserve input if already rendered to avoid losing focus/IME
  const existingInput = card.querySelector('#cmd-search-input');
  if (existingInput) {
    const resEl = card.querySelector('#cmd-results-box');
    if (resEl) resEl.innerHTML = listHtml;
    bindItemClicks(card, app);
    return;
  }

  card.innerHTML = `
    <div class="cmd-input-row">
      <span style="display:inline-flex;width:18px;height:18px;color:var(--text-muted);">${ICONS.search}</span>
      <input
        id="cmd-search-input"
        class="cmd-input"
        type="text"
        placeholder="Tìm Booking, khách hàng, ghi chú hoặc gõ lệnh..."
        value="${escapeHtml(query)}"
        autocomplete="off"
      />
      <button type="button" class="btn btn-glass btn-xs" id="cmd-close-btn">ESC</button>
    </div>
    <div id="cmd-results-box" class="cmd-results">${listHtml}</div>
    <div class="cmd-footer">
      <span>↑↓ Di chuyển • ↵ Chọn • ESC Đóng</span>
      <span>ShuShu Quick Search</span>
    </div>
  `;

  const input = card.querySelector('#cmd-search-input');
  input.addEventListener('input', (e) => {
    query = e.target.value;
    selectedIndex = 0;
    renderPalette(app);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (flatItems.length) {
        selectedIndex = (selectedIndex + 1) % flatItems.length;
        renderPalette(app);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (flatItems.length) {
        selectedIndex = (selectedIndex - 1 + flatItems.length) % flatItems.length;
        renderPalette(app);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatItems[selectedIndex];
      if (target) {
        closeCommandPalette();
        target.run();
      }
    }
  });

  card.querySelector('#cmd-close-btn')?.addEventListener('click', closeCommandPalette);
  bindItemClicks(card, app);
}

function bindItemClicks(card, app) {
  card.querySelectorAll('[data-cmd-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = flatItems[Number(btn.dataset.cmdIdx)];
      if (target) {
        closeCommandPalette();
        target.run();
      }
    });
  });
}
