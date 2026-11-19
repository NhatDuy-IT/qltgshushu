import { uid, escapeHtml, formatDateShort, toDateKey, ICONS } from '../utils.js';

const uiState = {
  search: '',
  activeTag: 'all'
};

const TINTS = [
  { id: 'none', label: 'Kính mờ', preview: 'rgba(255,255,255,0.7)' },
  { id: 'cream', label: 'Kem ấm', preview: '#fef3c7' },
  { id: 'rose', label: 'Hồng phấn', preview: '#ffe4e6' },
  { id: 'sky', label: 'Xanh trời', preview: '#e0f2fe' },
  { id: 'mint', label: 'Bạc hà', preview: '#d1fae5' },
  { id: 'lilac', label: 'Tím dịu', preview: '#ede9fe' }
];

export function renderNotesModule(container, app) {
  const notes = app.state.notes || [];
  const allTags = [...new Set(notes.flatMap((n) => n.tags || []))];

  const q = uiState.search.trim().toLowerCase();
  const filtered = notes
    .filter((n) => {
      if (uiState.activeTag !== 'all' && !(n.tags || []).includes(uiState.activeTag)) return false;
      if (!q) return true;
      return (
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Quick Note</h1>
        <p class="page-subtitle">Kho ý tưởng, thông tin khách hàng &amp; ghi chú nhanh (đồng bộ từ thanh bên)</p>
      </div>
      <button class="btn btn-dark btn-sm" id="btn-new-note">
        ${ICONS.plus}
        <span>Tạo ghi chú</span>
      </button>
    </div>

    <div class="panel glass-panel">
      <div class="notes-toolbar">
        <input
          type="search"
          class="form-input notes-search"
          id="notes-search-input"
          placeholder="Tìm theo tiêu đề, nội dung hoặc tag..."
          value="${escapeHtml(uiState.search)}"
        />
        <div class="pill-group" style="overflow-x:auto; max-width:100%;">
          <button class="pill-btn ${uiState.activeTag === 'all' ? 'active' : ''}" data-note-tag="all">Tất cả (${notes.length})</button>
          ${allTags.map((tag) => `
            <button class="pill-btn ${uiState.activeTag === tag ? 'active' : ''}" data-note-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>
          `).join('')}
        </div>
      </div>

      ${filtered.length
        ? `<div class="notes-grid">${filtered.map(renderNoteCard).join('')}</div>`
        : `<div class="empty-state"><div class="empty-state-icon">📝</div>Chưa tìm thấy ghi chú nào. Bạn có thể gõ nhanh ở ô QUICK NOTE góc dưới bên trái!</div>`
      }
    </div>
  `;

  bindNotesEvents(container, app);
}

function renderNoteCard(n) {
  const tintCls = n.tint && n.tint !== 'none' ? `tint-${n.tint}` : '';
  const dateStr = n.createdAt ? formatDateShort(toDateKey(new Date(n.createdAt))) : '';

  return `
    <article class="note-card glass-card ${tintCls}" data-edit-note="${n.id}" style="cursor:pointer;">
      <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
        <h3 style="font-size:14.5px; font-weight:700; line-height:1.35;">${escapeHtml(n.title || 'Ghi chú nhanh')}</h3>
        <div style="display:flex; gap:2px; flex-shrink:0;">
          <button class="icon-btn" style="width:28px;height:28px; color:${n.pinned ? 'var(--rose)' : 'var(--text-muted)'};" data-pin-note="${n.id}" title="${n.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}">
            ${ICONS.pin}
          </button>
          <button class="icon-btn" style="width:28px;height:28px;" data-del-note="${n.id}" title="Xóa">
            ${ICONS.trash}
          </button>
        </div>
      </div>

      <div class="note-content">${escapeHtml(n.content)}</div>

      <div class="note-footer">
        <div style="display:flex; gap:4px; flex-wrap:wrap;">
          ${(n.tags || []).map((t) => `<span class="badge badge-neutral">#${escapeHtml(t)}</span>`).join('')}
        </div>
        <span>${n.pinned ? '📌 ' : ''}${dateStr}</span>
      </div>
    </article>
  `;
}

function bindNotesEvents(container, app) {
  container.querySelector('#btn-new-note')?.addEventListener('click', () => openNoteModal(app));

  const searchInput = container.querySelector('#notes-search-input');
  searchInput?.addEventListener('input', (e) => {
    uiState.search = e.target.value;
    const pos = e.target.selectionStart;
    app.render();
    const reFocus = container.querySelector('#notes-search-input');
    if (reFocus) {
      reFocus.focus();
      reFocus.setSelectionRange(pos, pos);
    }
  });

  container.querySelectorAll('[data-note-tag]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.activeTag = btn.dataset.noteTag;
      app.render();
    });
  });

  container.querySelectorAll('[data-pin-note]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const note = app.state.notes.find((n) => n.id === btn.dataset.pinNote);
      if (!note) return;
      note.pinned = !note.pinned;
      app.commit(note.pinned ? 'Đã ghim ghi chú lên đầu!' : 'Đã bỏ ghim ghi chú.');
    });
  });

  container.querySelectorAll('[data-del-note]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      app.state.notes = app.state.notes.filter((n) => n.id !== btn.dataset.delNote);
      app.commit('Đã xóa ghi chú.');
    });
  });

  container.querySelectorAll('[data-edit-note]').forEach((card) => {
    card.addEventListener('click', () => {
      const note = app.state.notes.find((n) => n.id === card.dataset.editNote);
      if (note) openNoteModal(app, note);
    });
  });
}

function openNoteModal(app, existing = null) {
  const item = existing || {
    title: '',
    content: '',
    tags: [],
    tint: 'none',
    pinned: false
  };

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${existing ? 'Chỉnh sửa ghi chú' : 'Tạo ghi chú mới'}</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="note-form" class="modal-body">
      <div class="form-group">
        <label class="form-label">Tiêu đề</label>
        <input class="form-input" name="title" placeholder="VD: Thông tin khách hàng, Ý tưởng bài viết..." value="${escapeHtml(item.title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Nội dung *</label>
        <textarea class="form-textarea" name="content" rows="5" required placeholder="Viết nội dung ở đây...">${escapeHtml(item.content)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Thẻ phân loại (cách nhau bằng dấu phẩy)</label>
        <input class="form-input" name="tags" placeholder="Booking, Khách hàng, Ý tưởng" value="${escapeHtml((item.tags || []).join(', '))}" />
      </div>
      <div class="form-group">
        <label class="form-label">Màu nền thẻ</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${TINTS.map((t) => `
            <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer; padding:5px 10px; border-radius:99px; border:1px solid var(--glass-border-subtle); background:${t.preview}; color:#18181b; font-size:12px; font-weight:600;">
              <input type="radio" name="tint" value="${t.id}" ${(item.tint || 'none') === t.id ? 'checked' : ''} />
              <span>${t.label}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; cursor:pointer;">
        <input type="checkbox" name="pinned" ${item.pinned ? 'checked' : ''} style="width:16px;height:16px;" />
        <span>Ghim ghi chú này lên đầu danh sách</span>
      </label>
      <div class="modal-footer">
        <span></span>
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm">${existing ? 'Lưu thay đổi' : 'Lưu ghi chú'}</button>
        </div>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    modalEl.querySelector('#note-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const content = String(fd.get('content') || '').trim();
      if (!content) return;
      const tags = String(fd.get('tags') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const data = {
        title: String(fd.get('title') || '').trim() || 'Ghi chú nhanh',
        content,
        tags,
        tint: fd.get('tint') || 'none',
        pinned: fd.get('pinned') === 'on'
      };

      if (existing) {
        Object.assign(existing, data);
      } else {
        app.state.notes.unshift({
          id: uid('note'),
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      app.closeModal();
      app.commit(existing ? 'Đã cập nhật ghi chú!' : 'Đã lưu ghi chú mới!');
    });
  });
}
