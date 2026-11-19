import { uid, escapeHtml, toDateKey, formatDateShort, formatVND, formatVNDShort, ICONS } from '../utils.js';

const uiState = {
  month: toDateKey(new Date()).slice(0, 7), // YYYY-MM
  typeFilter: 'all' // all | income | expense
};

const INCOME_CATEGORIES = ['Booking', 'Dự án ngoài', 'Lương', 'Thưởng / Khác'];
const EXPENSE_CATEGORIES = ['Đầu tư công việc', 'Ăn uống', 'Di chuyển', 'Sinh hoạt', 'Giải trí / Cá nhân'];
const CHART_COLORS = ['#18181b', '#e11d48', '#0284c7', '#059669', '#d97706', '#7c3aed'];

export function renderFinanceModule(container, app) {
  const txs = app.state.transactions || [];
  const bookings = (app.state.tasks || []).filter((t) => t.type === 'booking');

  const monthTxs = txs.filter((tx) => (tx.date || '').startsWith(uiState.month));
  const totalIncome = monthTxs.filter((tx) => tx.type === 'income').reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
  const totalExpense = monthTxs.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + (Number(tx.amount) || 0), 0);
  const balance = totalIncome - totalExpense;

  const pendingReceivable = bookings.reduce((sum, b) => {
    const price = Number(b.price) || 0;
    const paid = b.paymentStatus === 'paid' ? price : (Number(b.deposit) || 0);
    return sum + Math.max(0, price - paid);
  }, 0);

  const visibleTxs = monthTxs
    .filter((tx) => uiState.typeFilter === 'all' || tx.type === uiState.typeFilter)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Finance &amp; Doanh thu Booking</h1>
        <p class="page-subtitle">Theo dõi dòng tiền thu chi, cọc và tất toán Booking khách hàng</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <input type="month" class="form-input" id="fin-month-picker" value="${uiState.month}" style="width:auto; padding:7px 11px;" />
        <button class="btn btn-dark btn-sm" id="fin-add-tx">${ICONS.plus}<span>Ghi thu / chi</span></button>
      </div>
    </div>

    <!-- Summary KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Tổng thu tháng</span>
        <span class="kpi-value" style="color:var(--emerald);">+${formatVND(totalIncome)}</span>
        <span class="kpi-sub">${monthTxs.filter(t => t.type === 'income').length} khoản thu</span>
      </div>
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Tổng chi tháng</span>
        <span class="kpi-value" style="color:var(--rose);">-${formatVND(totalExpense)}</span>
        <span class="kpi-sub">${monthTxs.filter(t => t.type === 'expense').length} khoản chi</span>
      </div>
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Số dư thực tế</span>
        <span class="kpi-value" style="color:${balance >= 0 ? 'var(--text-primary)' : 'var(--rose)'};">${formatVND(balance)}</span>
        <span class="kpi-sub">Thu - Chi trong tháng chọn</span>
      </div>
      <div class="kpi-card glass-panel">
        <span class="kpi-label">Booking chờ thu thêm</span>
        <span class="kpi-value" style="color:var(--amber);">${formatVND(pendingReceivable)}</span>
        <span class="kpi-sub">Còn lại từ ${bookings.filter(b => b.paymentStatus !== 'paid').length} lịch chưa tất toán</span>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="finance-charts-grid">
      <section class="panel glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Biểu đồ Thu - Chi (6 tháng gần nhất)</h2>
            <p class="page-subtitle">So sánh nhanh dòng tiền theo tháng</p>
          </div>
          <div style="display:flex; gap:10px; font-size:11.5px; color:var(--text-muted);">
            <span style="display:inline-flex;align-items:center;gap:5px;"><span class="legend-dot" style="background:var(--emerald);"></span>Thu</span>
            <span style="display:inline-flex;align-items:center;gap:5px;"><span class="legend-dot" style="background:var(--rose);"></span>Chi</span>
          </div>
        </div>
        <div class="svg-chart-wrap">${renderBarChartSvg(txs, uiState.month)}</div>
      </section>

      <section class="panel glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Cơ cấu chi tiêu tháng</h2>
            <p class="page-subtitle">Phân bổ theo danh mục</p>
          </div>
        </div>
        ${renderDonutChartSvg(monthTxs.filter(t => t.type === 'expense'))}
      </section>
    </div>

    <!-- Main Ledger & Booking Payment Tracker -->
    <div class="finance-main-grid">
      <!-- Transactions Ledger -->
      <section class="panel glass-panel">
        <div class="panel-header">
          <h2 class="section-title">Sổ giao dịch (${visibleTxs.length})</h2>
          <div class="pill-group">
            <button class="pill-btn ${uiState.typeFilter === 'all' ? 'active' : ''}" data-tx-filter="all">Tất cả</button>
            <button class="pill-btn ${uiState.typeFilter === 'income' ? 'active' : ''}" data-tx-filter="income">Thu</button>
            <button class="pill-btn ${uiState.typeFilter === 'expense' ? 'active' : ''}" data-tx-filter="expense">Chi</button>
          </div>
        </div>
        <div class="tx-list">
          ${visibleTxs.length
            ? visibleTxs.map((tx) => `
              <div class="tx-item glass-card">
                <div style="min-width:0;">
                  <div style="font-weight:600; font-size:13.5px;">${escapeHtml(tx.title)}</div>
                  <div class="muted" style="font-size:11.5px;">
                    <span class="badge badge-neutral" style="margin-right:4px;">${escapeHtml(tx.category)}</span>
                    ${formatDateShort(tx.date)} ${tx.notes ? `• ${escapeHtml(tx.notes)}` : ''}
                  </div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${formatVND(tx.amount)}</span>
                  <button class="icon-btn" style="width:28px;height:28px;" data-del-tx="${tx.id}" title="Xóa">${ICONS.trash}</button>
                </div>
              </div>
            `).join('')
            : `<div class="empty-state" style="padding:26px;">Chưa có giao dịch nào trong tháng này.</div>`
          }
        </div>
      </section>

      <!-- Booking Payment Tracker -->
      <section class="panel glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Thanh toán Booking (${bookings.length})</h2>
            <p class="page-subtitle">Cập nhật cọc &amp; tất toán sẽ tự ghi nhận Thu</p>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${bookings.length
            ? bookings.map((b) => {
                const price = Number(b.price) || 0;
                const deposit = b.paymentStatus === 'paid' ? price : (Number(b.deposit) || 0);
                const remain = Math.max(0, price - deposit);
                const badgeMap = {
                  unpaid: '<span class="badge badge-rose">Chưa cọc</span>',
                  deposited: '<span class="badge badge-amber">Đã cọc</span>',
                  paid: '<span class="badge badge-emerald">Đã tất toán</span>'
                };
                return `
                  <div class="glass-card" style="padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; gap:8px; align-items:flex-start;">
                      <div>
                        <div style="font-weight:700; font-size:13.5px;">${escapeHtml(b.title)}</div>
                        <div class="muted" style="font-size:11.5px;">${escapeHtml(b.client || '')} • ${formatDateShort(b.date)}</div>
                      </div>
                      ${badgeMap[b.paymentStatus || 'unpaid']}
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-secondary);">
                      <span>Tổng: <strong>${formatVND(price)}</strong></span>
                      <span>Đã thu: <strong style="color:var(--emerald);">${formatVND(deposit)}</strong></span>
                      <span>Còn: <strong style="color:${remain > 0 ? 'var(--rose)' : 'var(--text-muted)'};">${formatVND(remain)}</strong></span>
                    </div>
                    ${b.paymentStatus !== 'paid'
                      ? `<div style="display:flex; gap:6px; justify-content:flex-end;">
                          ${b.paymentStatus === 'unpaid'
                            ? `<button class="btn btn-glass btn-xs" data-booking-pay="${b.id}" data-pay-action="deposit">Ghi nhận cọc 30%</button>`
                            : ''
                          }
                          <button class="btn btn-dark btn-xs" data-booking-pay="${b.id}" data-pay-action="settle">Tất toán 100%</button>
                        </div>`
                      : ''
                    }
                  </div>
                `;
              }).join('')
            : `<div class="empty-state" style="padding:24px;">Chưa có lịch Booking nào. Hãy tạo trong mục Công việc.</div>`
          }
        </div>
      </section>
    </div>
  `;

  bindFinanceEvents(container, app);
}

function renderBarChartSvg(txs, anchorMonth) {
  const [y, m] = anchorMonth.split('-').map(Number);
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(y, (m - 1) - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const inc = txs.filter(t => t.type === 'income' && (t.date || '').startsWith(key)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const exp = txs.filter(t => t.type === 'expense' && (t.date || '').startsWith(key)).reduce((s, t) => s + (Number(t.amount) || 0), 0);
    months.push({ label: `T${d.getMonth() + 1}`, inc, exp });
  }

  const maxVal = Math.max(1_000_000, ...months.flatMap(x => [x.inc, x.exp]));
  const w = 480;
  const h = 185;
  const padB = 28;
  const padT = 18;
  const chartH = h - padB - padT;
  const groupW = w / months.length;

  const bars = months.map((mo, idx) => {
    const cx = idx * groupW + groupW / 2;
    const hInc = Math.max(2, (mo.inc / maxVal) * chartH);
    const hExp = Math.max(2, (mo.exp / maxVal) * chartH);
    return `
      <g>
        <rect x="${cx - 18}" y="${padT + chartH - hInc}" width="15" height="${hInc}" rx="5" fill="#10b981" opacity="0.88">
          <title>Thu ${mo.label}: ${formatVND(mo.inc)}</title>
        </rect>
        <rect x="${cx + 3}" y="${padT + chartH - hExp}" width="15" height="${hExp}" rx="5" fill="#f43f5e" opacity="0.84">
          <title>Chi ${mo.label}: ${formatVND(mo.exp)}</title>
        </rect>
        ${mo.inc > 0 ? `<text x="${cx - 10}" y="${padT + chartH - hInc - 5}" text-anchor="middle" font-size="9.5" font-weight="600" fill="currentColor" opacity="0.72">${formatVNDShort(mo.inc)}</text>` : ''}
        <text x="${cx}" y="${h - 8}" text-anchor="middle" font-size="11.5" font-weight="700" fill="currentColor" opacity="0.7">${mo.label}</text>
      </g>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" style="max-height:200px; display:block; color:var(--text-primary);">
      <line x1="8" y1="${padT + chartH}" x2="${w - 8}" y2="${padT + chartH}" stroke="currentColor" stroke-opacity="0.12" />
      ${bars}
    </svg>
  `;
}

function renderDonutChartSvg(expenses) {
  if (!expenses.length) {
    return `<div class="empty-state" style="padding:28px;">Chưa có khoản chi nào trong tháng này.</div>`;
  }

  const byCat = new Map();
  let total = 0;
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    total += amt;
    byCat.set(e.category, (byCat.get(e.category) || 0) + amt);
  }

  const entries = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  const r = 54;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segments = entries.map(([cat, val], idx) => {
    const frac = total ? val / total : 0;
    const dash = frac * circ;
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    const seg = `
      <circle
        cx="72" cy="72" r="${r}"
        fill="none"
        stroke="${color}"
        stroke-width="20"
        stroke-dasharray="${dash} ${circ - dash}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 72 72)"
      >
        <title>${escapeHtml(cat)}: ${formatVND(val)}</title>
      </circle>
    `;
    offset += dash;
    return seg;
  }).join('');

  return `
    <div class="donut-layout">
      <svg viewBox="0 0 144 144" width="144" height="144" style="flex-shrink:0;">
        <circle cx="72" cy="72" r="${r}" fill="none" stroke="var(--accent-soft)" stroke-width="20"/>
        ${segments}
        <text x="72" y="69" text-anchor="middle" font-size="10.5" fill="var(--text-muted)">Tổng chi</text>
        <text x="72" y="85" text-anchor="middle" font-size="13" font-weight="800" fill="var(--text-primary)">${formatVNDShort(total)}</text>
      </svg>
      <div class="donut-legend">
        ${entries.map(([cat, val], idx) => {
          const pct = Math.round((val / total) * 100);
          return `
            <div class="legend-row">
              <div style="display:flex; align-items:center; gap:7px;">
                <span class="legend-dot" style="background:${CHART_COLORS[idx % CHART_COLORS.length]};"></span>
                <span>${escapeHtml(cat)}</span>
              </div>
              <span style="font-weight:700;">${pct}% <span class="muted" style="font-weight:500;">(${formatVNDShort(val)})</span></span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function bindFinanceEvents(container, app) {
  container.querySelector('#fin-month-picker')?.addEventListener('change', (e) => {
    if (e.target.value) {
      uiState.month = e.target.value;
      app.render();
    }
  });

  container.querySelector('#fin-add-tx')?.addEventListener('click', () => openTxModal(app));

  container.querySelectorAll('[data-tx-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.typeFilter = btn.dataset.txFilter;
      app.render();
    });
  });

  container.querySelectorAll('[data-del-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      app.state.transactions = app.state.transactions.filter((t) => t.id !== btn.dataset.delTx);
      app.commit('Đã xóa giao dịch.');
    });
  });

  container.querySelectorAll('[data-booking-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const booking = app.state.tasks.find((t) => t.id === btn.dataset.bookingPay);
      if (!booking) return;
      const action = btn.dataset.payAction;
      const price = Number(booking.price) || 0;

      if (action === 'deposit') {
        const depAmount = Math.round(price * 0.3);
        booking.deposit = depAmount;
        booking.paymentStatus = 'deposited';
        if (depAmount > 0) {
          app.state.transactions.unshift({
            id: uid('tx'),
            type: 'income',
            title: `Tiền cọc ${booking.title}`,
            category: 'Booking',
            amount: depAmount,
            date: toDateKey(new Date()),
            bookingId: booking.id,
            notes: booking.client || ''
          });
        }
        app.commit('Đã ghi nhận đặt cọc Booking & cộng vào doanh thu!');
      } else if (action === 'settle') {
        const prevDep = Number(booking.deposit) || 0;
        const remain = Math.max(0, price - prevDep);
        booking.deposit = price;
        booking.paymentStatus = 'paid';
        if (remain > 0) {
          app.state.transactions.unshift({
            id: uid('tx'),
            type: 'income',
            title: `Tất toán ${booking.title}`,
            category: 'Booking',
            amount: remain,
            date: toDateKey(new Date()),
            bookingId: booking.id,
            notes: booking.client || ''
          });
        }
        app.commit('Đã tất toán 100% Booking & cập nhật sổ thu!');
      }
    });
  });
}

function openTxModal(app) {
  const html = `
    <div class="modal-header">
      <h3 class="modal-title">Ghi nhận khoản Thu / Chi</h3>
      <button class="icon-btn" data-close-modal>✕</button>
    </div>
    <form id="tx-form" class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Loại giao dịch</label>
          <select class="form-select" name="type" id="tx-type">
            <option value="income">Khoản Thu (+)</option>
            <option value="expense">Khoản Chi (-)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Danh mục</label>
          <select class="form-select" name="category" id="tx-cat">
            ${INCOME_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Nội dung *</label>
        <input class="form-input" name="title" required placeholder="VD: Tiền cọc khách hàng, Mua thiết bị..." />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Số tiền (VNĐ) *</label>
          <input class="form-input" type="number" min="1000" step="1000" name="amount" required placeholder="500000" />
        </div>
        <div class="form-group">
          <label class="form-label">Ngày</label>
          <input class="form-input" type="date" name="date" required value="${toDateKey(new Date())}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú</label>
        <input class="form-input" name="notes" placeholder="Tài khoản nhận / chi tiết thêm..." />
      </div>
      <div class="modal-footer">
        <span></span>
        <div class="modal-footer-right">
          <button type="button" class="btn btn-glass btn-sm" data-close-modal>Hủy</button>
          <button type="submit" class="btn btn-dark btn-sm">Lưu giao dịch</button>
        </div>
      </div>
    </form>
  `;

  app.openModal(html, (modalEl) => {
    const typeEl = modalEl.querySelector('#tx-type');
    const catEl = modalEl.querySelector('#tx-cat');
    typeEl.addEventListener('change', () => {
      const list = typeEl.value === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      catEl.innerHTML = list.map(c => `<option value="${c}">${c}</option>`).join('');
    });

    modalEl.querySelector('#tx-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const title = String(fd.get('title') || '').trim();
      const amount = Number(fd.get('amount')) || 0;
      if (!title || amount <= 0) return;

      const txDate = fd.get('date') || toDateKey(new Date());
      uiState.month = txDate.slice(0, 7);

      app.state.transactions.unshift({
        id: uid('tx'),
        type: fd.get('type'),
        category: fd.get('category'),
        title,
        amount,
        date: txDate,
        notes: String(fd.get('notes') || '').trim()
      });

      app.closeModal();
      app.commit('Đã ghi nhận giao dịch mới!');
    });
  });
}
