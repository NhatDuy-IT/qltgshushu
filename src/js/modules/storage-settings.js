import { escapeHtml, toDateKey } from '../utils.js';
import { storage } from '../storage.js';
import { auth } from '../auth.js';
import { createMockState } from '../mock-data.js';
import { applyThemeToDocument } from './theme.js';

export function renderStorageModule(container, app) {
  const { state } = app;
  const sizeKB = storage.estimateSizeKB(state);
  const creds = storage.getSupabaseCredentials(state.settings);
  const isCloud = creds.configured && auth.getMode() === 'supabase';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Lưu trữ &amp; Sao lưu dữ liệu</h1>
        <p class="page-subtitle">Dữ liệu ưu tiên lưu Offline-First (IndexedDB + LocalStorage), hỗ trợ đồng bộ Supabase &amp; Export/Import JSON</p>
      </div>
    </div>

    <div class="settings-grid">
      <section class="panel glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Thống kê không gian dữ liệu</h2>
            <p class="page-subtitle">Dung lượng ước tính: <strong>${sizeKB} KB</strong> • Chế độ: <strong>${isCloud ? 'Supabase Cloud + IndexedDB' : 'IndexedDB / LocalStorage'}</strong></p>
          </div>
        </div>

        <div class="stat-mini-grid">
          <div class="stat-mini">
            <div class="stat-mini-val">${(state.tasks || []).length}</div>
            <div class="stat-mini-lbl">Lịch &amp; Booking</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-val">${(state.clients || []).length}</div>
            <div class="stat-mini-lbl">Khách (CRM)</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-val">${(state.reminders || []).length}</div>
            <div class="stat-mini-lbl">Nhắc lịch</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-val">${(state.transactions || []).length}</div>
            <div class="stat-mini-lbl">Giao dịch</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-val">${(state.notes || []).length}</div>
            <div class="stat-mini-lbl">Quick Notes</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-val">${(state.projects || []).length}</div>
            <div class="stat-mini-lbl">Dự án</div>
          </div>
        </div>
      </section>

      <section class="panel glass-panel" style="display:flex; flex-direction:column; gap:14px;">
        <div>
          <h2 class="section-title">Sao lưu &amp; Khôi phục (.JSON)</h2>
          <p class="page-subtitle">Tải toàn bộ dữ liệu ShuShu về máy hoặc nhập lại trên thiết bị mới</p>
        </div>

        <div class="glass-card" style="padding:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:700; font-size:13.5px;">Xuất dữ liệu (Export JSON)</div>
            <div class="muted" style="font-size:12px;">Bao gồm Booking, Khách hàng, Tài chính, Ghi chú, Dự án &amp; Giao diện</div>
          </div>
          <button class="btn btn-dark btn-sm" id="btn-export-json">Tải file .json</button>
        </div>

        <div class="glass-card" style="padding:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:700; font-size:13.5px;">Nhập dữ liệu (Import JSON)</div>
            <div class="muted" style="font-size:12px;">Khôi phục toàn bộ từ file backup ShuShu trước đó</div>
          </div>
          <label class="btn btn-glass btn-sm" style="cursor:pointer;">
            <span>Chọn file...</span>
            <input type="file" id="input-import-json" accept="application/json,.json" hidden />
          </label>
        </div>

        <div class="glass-card" style="padding:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--rose);">Xóa sạch toàn bộ dữ liệu</div>
            <div class="muted" style="font-size:12px;">Đặt lại không gian làm việc trống hoàn toàn</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-wipe-all">Xóa toàn bộ</button>
        </div>
      </section>
    </div>
  `;

  container.querySelector('#btn-export-json')?.addEventListener('click', () => {
    const exportPayload = {
      ...app.state,
      exportedAt: new Date().toISOString(),
      app: 'ShuShu Workspace'
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shushu-backup-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    app.toast('Đã tải xuống file sao lưu JSON!');
  });

  container.querySelector('#input-import-json')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!Array.isArray(parsed.tasks) && !Array.isArray(parsed.notes)) {
          app.toast('File JSON không đúng định dạng sao lưu của ShuShu.', 'error');
          return;
        }
        app.replaceState(parsed, 'Đã khôi phục dữ liệu từ file JSON thành công!');
      } catch {
        app.toast('Không thể đọc file JSON. Vui lòng kiểm tra lại file.', 'error');
      }
    };
    reader.readAsText(file);
  });

  container.querySelector('#btn-wipe-all')?.addEventListener('click', () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu hiện tại? Hãy Export JSON sao lưu trước nếu cần.')) return;
    app.state.tasks = [];
    app.state.habits = [];
    app.state.reminders = [];
    app.state.transactions = [];
    app.state.notes = [];
    app.state.projects = [];
    app.state.clients = [];
    app.commit('Đã làm trống toàn bộ không gian làm việc.');
  });
}

export function renderSettingsModule(container, app) {
  const settings = app.state.settings;
  const sb = settings.supabase || {};
  const lock = settings.appLock || { enabled: false, pin: '', lockFinance: true, lockNotes: true };
  const hasMock = hasAnyMockData(app.state);
  const creds = storage.getSupabaseCredentials(settings);
  const user = auth.getUser();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Cài đặt hệ thống &amp; Bảo mật</h1>
        <p class="page-subtitle">Tài khoản riêng tư Single-User, khóa PIN 4 số &amp; đồng bộ Laptop ↔ iPad ↔ Điện thoại</p>
      </div>
    </div>

    <div class="settings-grid">
      <!-- 1. App Lock (4-Digit PIN) + Mock Data -->
      <div style="display:flex; flex-direction:column; gap:16px;">
        <section class="panel glass-panel" style="display:flex; flex-direction:column; gap:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div>
              <h2 class="section-title">🔐 Khóa mã PIN 4 số (App Lock)</h2>
              <p class="page-subtitle">Bảo vệ riêng tư cho tab Tài chính (Finance) và Ghi chú (Quick Note)</p>
            </div>
            <span class="badge ${lock.enabled && lock.pin ? 'badge-emerald' : 'badge-neutral'}">
              ${lock.enabled && lock.pin ? 'Đang bật PIN' : 'Đang tắt'}
            </span>
          </div>

          <form id="pin-settings-form" style="display:flex; flex-direction:column; gap:11px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <span style="font-weight:600; font-size:13px;">Kích hoạt khóa mã PIN 4 số</span>
              <label class="switch">
                <input type="checkbox" name="pinEnabled" ${lock.enabled ? 'checked' : ''} />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div class="form-group">
              <label class="form-label">Mã PIN 4 chữ số ${lock.pin ? '(đã thiết lập — nhập 4 số mới để đổi)' : '(bắt buộc 4 chữ số)'}</label>
              <input
                class="form-input"
                type="password"
                inputmode="numeric"
                maxlength="4"
                pattern="[0-9]{4}"
                name="pinCode"
                placeholder="VD: 1234"
                value="${escapeHtml(lock.pin || '')}"
              />
            </div>

            <div style="display:flex; gap:16px; flex-wrap:wrap; font-size:13px;">
              <label style="display:flex; align-items:center; gap:7px; cursor:pointer; font-weight:600;">
                <input type="checkbox" name="lockFinance" ${lock.lockFinance !== false ? 'checked' : ''} style="width:15px;height:15px;" />
                <span>Khóa tab Finance</span>
              </label>
              <label style="display:flex; align-items:center; gap:7px; cursor:pointer; font-weight:600;">
                <input type="checkbox" name="lockNotes" ${lock.lockNotes !== false ? 'checked' : ''} style="width:15px;height:15px;" />
                <span>Khóa tab Quick Note</span>
              </label>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="submit" class="btn btn-dark btn-xs">Lưu cài đặt PIN</button>
              ${lock.enabled && lock.pin ? `<button type="button" class="btn btn-glass btn-xs" id="btn-lock-now">🔒 Khóa lại ngay</button>` : ''}
            </div>
          </form>
        </section>

        <section class="panel glass-panel" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <h2 class="section-title">Dữ liệu mẫu (Mock Data)</h2>
            <p class="page-subtitle">Bấm nút bên dưới để xóa gọn chỉ các mục dữ liệu mẫu, giữ lại toàn bộ Booking &amp; ghi chú bạn đã tự tạo.</p>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button class="btn btn-danger btn-sm" id="btn-clear-mock" ${!hasMock ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
              Xóa dữ liệu mẫu
            </button>
            <button class="btn btn-glass btn-sm" id="btn-restore-mock">
              Khôi phục dữ liệu mẫu
            </button>
          </div>
        </section>
      </div>

      <!-- 2. Account + Supabase Real-Time Sync -->
      <section class="panel glass-panel" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <div>
            <h2 class="section-title">Tài khoản Single-User &amp; Đồng bộ Cloud</h2>
            <p class="page-subtitle">
              Đang đăng nhập: <strong>${escapeHtml(user?.displayName || user?.email || 'ShuShu')}</strong>
              (${auth.getMode() === 'supabase' ? 'Supabase Cloud Auth' : 'Offline-First Local Auth'})
            </p>
          </div>
          <button class="btn btn-danger btn-xs" id="set-logout-btn">Đăng xuất</button>
        </div>

        <form id="supabase-form" style="display:flex; flex-direction:column; gap:10px; padding-top:8px; border-top:1px solid var(--glass-border-subtle);">
          <div style="font-size:12px; color:var(--text-muted);">
            ${creds.configured
              ? 'Đã cấu hình Supabase. Đăng nhập bằng tài khoản Supabase để đồng bộ real-time 2 chiều giữa Laptop, iPad và Điện thoại.'
              : 'Chưa cấu hình Supabase (.env hoặc bên dưới) — App đang lưu an toàn trên IndexedDB/LocalStorage.'}
          </div>
          <div class="form-group">
            <label class="form-label">Supabase Project URL (hoặc biến môi trường Vercel)</label>
            <input class="form-input" name="sbUrl" placeholder="https://xxxx.supabase.co" value="${escapeHtml(sb.url || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Supabase Anon Key</label>
            <input class="form-input" type="password" name="sbKey" placeholder="eyJhbGciOi..." value="${escapeHtml(sb.anonKey || '')}" />
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button type="submit" class="btn btn-dark btn-xs">Lưu cấu hình Supabase</button>
            <button type="button" class="btn btn-glass btn-xs" id="btn-sync-now">Đồng bộ 2 chiều ngay</button>
          </div>
        </form>
      </section>
    </div>
  `;

  // Bind PIN Lock Settings
  container.querySelector('#pin-settings-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const enabled = fd.get('pinEnabled') === 'on';
    const pin = String(fd.get('pinCode') || '').trim();

    if (enabled && !/^\d{4}$/.test(pin)) {
      app.toast('Mã PIN phải gồm đúng 4 chữ số (VD: 2026).', 'error');
      return;
    }

    app.state.settings.appLock = {
      enabled,
      pin: enabled ? pin : '',
      lockFinance: fd.get('lockFinance') === 'on',
      lockNotes: fd.get('lockNotes') === 'on'
    };

    if (enabled) app.lockPinSession();
    app.commit(enabled ? 'Đã bật khóa mã PIN 4 số!' : 'Đã tắt khóa mã PIN.');
  });

  container.querySelector('#btn-lock-now')?.addEventListener('click', () => {
    app.lockPinSession();
    app.toast('Đã khóa lại Finance & Quick Note bằng mã PIN!');
  });

  // Logout & Supabase
  container.querySelector('#set-logout-btn')?.addEventListener('click', () => app.logout());

  container.querySelector('#supabase-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    app.state.settings.supabase = {
      url: String(fd.get('sbUrl') || '').trim(),
      anonKey: String(fd.get('sbKey') || '').trim()
    };
    await app.commit('Đã lưu cấu hình Supabase!');
  });

  container.querySelector('#btn-sync-now')?.addEventListener('click', async () => {
    const c = storage.getSupabaseCredentials(app.state.settings);
    if (!c.configured) {
      app.toast('Vui lòng cấu hình SUPABASE_URL & SUPABASE_ANON_KEY trước.', 'error');
      return;
    }
    if (auth.getMode() !== 'supabase') {
      app.toast('Hãy đăng xuất và đăng nhập lại bằng tài khoản Supabase để kích hoạt đồng bộ Cloud.', 'error');
      return;
    }
    const ok = await storage.pushAllToSupabase(app.state);
    app.updateSyncBadge(ok ? 'cloud' : 'local');
    app.toast(ok ? 'Đã đồng bộ dữ liệu lên Supabase thành công!' : 'Không thể đồng bộ Supabase. Kiểm tra lại bảng SQL / RLS.', ok ? 'success' : 'error');
  });

  // Mock Data
  container.querySelector('#btn-clear-mock')?.addEventListener('click', () => {
    app.state.tasks = (app.state.tasks || []).filter((x) => !x.isMock);
    app.state.habits = (app.state.habits || []).filter((x) => !x.isMock);
    app.state.reminders = (app.state.reminders || []).filter((x) => !x.isMock);
    app.state.transactions = (app.state.transactions || []).filter((x) => !x.isMock);
    app.state.notes = (app.state.notes || []).filter((x) => !x.isMock);
    app.state.projects = (app.state.projects || []).filter((x) => !x.isMock);
    app.state.clients = (app.state.clients || []).filter((x) => !x.isMock);
    app.commit('Đã xóa toàn bộ dữ liệu mẫu! Dữ liệu cá nhân của bạn vẫn được giữ nguyên.');
  });

  container.querySelector('#btn-restore-mock')?.addEventListener('click', () => {
    const fresh = createMockState();
    fresh.theme = app.state.theme;
    fresh.settings = app.state.settings;
    app.state = fresh;
    applyThemeToDocument(app.state.theme);
    app.commit('Đã khôi phục bộ dữ liệu mẫu ShuShu!');
  });
}

function hasAnyMockData(state) {
  const lists = [state.tasks, state.habits, state.reminders, state.transactions, state.notes, state.projects, state.clients];
  return lists.some((arr) => Array.isArray(arr) && arr.some((item) => item.isMock));
}
