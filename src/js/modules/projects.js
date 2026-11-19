import { uid, escapeHtml, formatDateShort, toDateKey, ICONS } from '../utils.js';

const COLUMNS = [
  { id: 'idea', label: 'Ý tưởng', dotClass: 'pending' },
  { id: 'doing', label: 'Đang triển khai', dotClass: 'active' },
  { id: 'done', label: 'Hoàn thành', dotClass: 'done' }
];

export function renderProjectsModule(container, app) {
  const projects = app.state.projects || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Project Kanban</h1>
        <p class="page-subtitle">Quản lý dự án dài hạn theo tiến độ &amp; danh sách đầu việc con (kéo thả để chuyển cột)</p>
      </div>
      <button class="btn btn-dark btn-sm" id="btn-add-project">
        ${ICONS.plus}
        <span>Dự án mới</span>
      </button>
    </div>

    <div class="kanban-board">
      ${COLUMNS.map((col) => {
        const items = projects.filter((p) => p.status === col.id);
        return `
          <section class="kanban-col glass-panel" data-kanban-col="${col.id}">
            <div class="kanban-col-head">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="status-dot ${col.dotClass}"></span>
                <h2 class="section-title">${col.label}</h2>
              </div>
              <span class="status-group-count">${items.length}</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              ${items.length
                ? items.map((p) => renderProjectCard(p)).join('')
                : `<div class="empty-state" style="padding:24px 8px; font-size:12px;">Kéo thẻ vào đây hoặc bấm "+ Dự án mới"</div>`
              }
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;

  bindProjectsEvents(container, app);
}

function renderProjectCard(p) {
  const subs = p.subtasks || [];
  const doneCount = subs.filter((s) => s.done).length;
  const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : (p.status === 'done' ? 100 : 0);

  return `
    <article class="project-card glass-card" draggable="true" data-project-id="${p.id}">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
        <h3 style="font-size:14.5px; font-weight:700; line-height:1.35;">${escapeHtml(p.title)}</h3>
        <div style="display:flex; gap:2px;">
          <button class="icon-btn" style="width:26px;height:26px;" data-edit-proj="${p.id}" title="Chỉnh sửa">✎</button>
          <button class="icon-btn" style="width:26px;height:26px;" data-del-proj="${p.id}" title="Xóa">${ICONS.trash}</button>
        </div>
      </div>

      ${p.description ? `<p class="muted" style="font-size:12.5px;">${escapeHtml(p.description)}</p>` : ''}

      <div>
        <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; margin-bottom:5px;">
          <span>Tiến độ (${doneCount}/${subs.length})</span>
          <span>${pct}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>

      <!-- Subtasks Checklist -->
      <div class="subtask-list">
        ${subs.map((st) => `
          <label class="subtask-row ${st.done ? 'done' : ''}" style="cursor:pointer;">
            <input type="checkbox" data-toggle-sub="${p.id}|${st.id}" ${st.done ? 'checked' : ''} />
            <span style="flex:1;">${escapeHtml(st.text)}</span>
          </label>
        `).join('')}
      </div>

      <!-- Quick add subtask -->
      <form class="add-sub-form" data-add-sub="${p.id}" style="display:flex; gap:6px;">
        <input class="form-input" name="subtext" placeholder="+ Thêm đầu việc con..." style="padding:5px 9px; font-size:12px;" />
      </form>

      <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding-top:6px; border-top:1px solid var(--glass-border-subtle); font-size:11.5px;">
        <span class="muted">${p.deadline ? `Hạn: ${formatDateShort(p.deadline)}` : 'Linh hoạt'}</span>
        <div style="display:flex; gap:4px;">
          ${p.status !== 'idea' ? `<button class="btn btn-glass btn-xs" style="padding:3px 8px;" data-move-proj="${p.id}" data-dir="-1">←</button>` : ''}
          ${p.status !== 'done' ? `<button class="btn btn-glass btn-xs" style="padding:3px 8px;" data-move-proj="${p.id}" data-dir="1">→</button>` : ''}
        </div>
      </div>
    </article>
  `;
}

function bindProjectsEvents(container, app) {
  container.querySelector('#btn-add-project')?.addEventListener('click', () => openProjectModal(app));

  container.querySelectorAll('[data-edit-proj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const proj = app.state.projects.find((p) => p.id === btn.dataset.editProj);
      if (proj) openProjectModal(app, proj);
    });
  });

  container.querySelectorAll('[data-del-proj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.state.projects = app.state.projects.filter((p) => p.id !== btn.dataset.delProj);
      app.commit('Đã xóa dự án.');
    });
  });

  container.querySelectorAll('[data-toggle-sub]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const [projId, subId] = cb.dataset.toggleSub.split('|');
      const proj = app.state.projects.find((p) => p.id === projId);
      const sub = proj?.subtasks?.find((s) => s.id === subId);
      if (!sub) return;
      sub.done = cb.checked;
      app.commit();
    });
  });

  container.querySelectorAll('[data-add-sub]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input[name="subtext"]');
      const text = (input.value || '').trim();
      if (!text) return;
      const proj = app.state.projects.find((p) => p.id === form.dataset.addSub);
      if (!proj) return;
      proj.subtasks = proj.subtasks || [];
      proj.subtasks.push({ id: uid('st'), text, done: false });
      app.commit('Đã thêm đầu việc con.');
    });
  });

  container.querySelectorAll('[data-move-proj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const proj = app.state.projects.find((p) => p.id === btn.dataset.moveProj);
      if (!proj) return;
      const order = ['idea', 'doing', 'done'];
      const nextIdx = Math.max(0, Math.min(2, order.indexOf(proj.status) + Number(btn.dataset.dir)));
      proj.status = order[nextIdx];
      app.commit('Đã chuyển trạng thái dự án!');
    });
  });

  // Drag & Drop between Kanban columns
  let draggedId = null;
  container.querySelectorAll('.project-card').forEach((card) => {
    card.addEventListener('dragstart', () => {
      draggedId = card.dataset.projectId;
      card.style.opacity = '0.5';
    });
    card.addEventListener('dragend', () => {
      card.style.opacity = '1';
      draggedId = null;
    });
  });

  container.querySelectorAll('[data-kanban-col]').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (!draggedId) return;
      const proj = app.state.projects.find((p) => p.id === draggedId);
      if (proj && proj.status !== col.dataset.kanbanCol) {
        proj.status = col.dataset.kanbanCol;
        app.commit('Đã chuyển cột dự án!');
      }
    });
  });
}

function openProjectModal(app, existing = null) {
  const item = existing || {
    title: '',
    description: '',
    status: 'idea',
    deadline: toDateKey(new Date()),
    subtasks: []
  };

  const html = `
    <div class="modal-header">
      <h3 class="modal-title">${existing ? 'Chỉnh sửa dự án' : 'Tạo dự án dài hạn mới'}</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="proj-form" class="modal-body">
      <div class="form-group">
        <label class="form-label">Tên dự án *</label>
        <input class="form-input" name="title" required placeholder="VD: Xây dựng thương hiệu cá nhân..." value="${escapeHtml(item.title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Mô tả ngắn</label>
        <textarea class="form-textarea" name="description" rows="3" placeholder="Mục tiêu và kết quả mong muốn...">${escapeHtml(item.description)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cột Kanban</label>
          <select class="form-select" name="status">
            <option value="idea" ${item.status === 'idea' ? 'selected' : ''}>Ý tưởng</option>
            <option value="doing" ${item.status === 'doing' ? 'selected' : ''}>Đang triển khai</option>
            <option value="done" ${item.status === 'done' ? 'selected' : ''}>Hoàn thành</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Mục tiêu hoàn thành</label>
          <input class="form-input" type="date" name="deadline" value="${escapeHtml(item.deadline)}" />
        </div>
      </div>
      ${!existing ? `
        <div class="form-group">
          <label class="form-label">Đầu việc con ban đầu (mỗi dòng 1 mục)</label>
          <textarea class="form-textarea" name="subtasksText" rows="3" placeholder="Nghiên cứu ý tưởng&#10;Lên kế hoạch chi tiết&#10;Triển khai thử nghiệm"></textarea>
        </div>
      ` : ''}
      <div class="modal-footer">
        <span></span>
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm">${existing ? 'Lưu thay đổi' : 'Tạo dự án'}</button>
        </div>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    modalEl.querySelector('#proj-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim();
      if (!title) return;

      if (existing) {
        existing.title = title;
        existing.description = String(fd.get('description') || '').trim();
        existing.status = fd.get('status') || 'idea';
        existing.deadline = fd.get('deadline') || '';
      } else {
        const subs = String(fd.get('subtasksText') || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((text) => ({ id: uid('st'), text, done: false }));

        app.state.projects.unshift({
          id: uid('proj'),
          title,
          description: String(fd.get('description') || '').trim(),
          status: fd.get('status') || 'idea',
          deadline: fd.get('deadline') || '',
          subtasks: subs
        });
      }

      app.closeModal();
      app.commit(existing ? 'Đã cập nhật dự án!' : 'Đã thêm dự án mới!');
    });
  });
}
