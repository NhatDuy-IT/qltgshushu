import { createMockState, getDefaultSettings, getDefaultTheme } from './mock-data.js';
import { auth } from './auth.js';

const DB_NAME = 'ShuShuWorkspaceDB';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const STATE_KEY = 'shushu_state_v2';
const WALLPAPER_KEY = 'shushu_custom_wallpaper';
const LS_FALLBACK_KEY = 'shushu_workspace_backup_v2';
const INIT_FLAG_KEY = 'shushu_workspace_initialized_v2';

class StorageAdapter {
  constructor() {
    this.db = null;
    this.runtimeConfig = {
      supabaseUrl: '',
      supabaseAnonKey: '',
      singleUserDomain: 'shushu.app'
    };
    this.syncStatus = 'local'; // local | cloud | syncing
    this._syncTimer = null;
    this._pollTimer = null;
    this._pendingIdbPromise = Promise.resolve();
    this._hasPendingCloudPush = false;
  }

  async init() {
    await this._openIDB();
    await this._loadRuntimeConfig();
  }

  async _openIDB() {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        req.onsuccess = () => {
          this.db = req.result;
          resolve(this.db);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async _idbGet(key) {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async _idbSet(key, value) {
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  async _loadRuntimeConfig() {
    try {
      const res = await fetch('/api/config', { cache: 'no-store' });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          this.runtimeConfig = { ...this.runtimeConfig, ...data };
        }
      }
    } catch {
      // Static local server without /api/config -> stays offline-first cleanly
    }
  }

  getSupabaseCredentials(stateSettings = null) {
    const url = (stateSettings?.supabase?.url || this.runtimeConfig.supabaseUrl || '').trim();
    const anonKey = (stateSettings?.supabase?.anonKey || this.runtimeConfig.supabaseAnonKey || '').trim();
    return { url, anonKey, configured: Boolean(url && anonKey) };
  }

  _readLocalStorageState() {
    try {
      const raw = localStorage.getItem(LS_FALLBACK_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  _writeLocalStorageSync(state) {
    if (!state || typeof state !== 'object') return;
    try {
      const lightCopy = {
        ...state,
        theme: { ...(state.theme || {}), customWallpaper: '' }
      };
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(lightCopy));
      localStorage.setItem(INIT_FLAG_KEY, '1');
    } catch {
      // LocalStorage quota exceeded -> IndexedDB handles full copy
    }
  }

  _pickNewerState(a, b) {
    if (a && !b) return a;
    if (!a && b) return b;
    if (!a && !b) return null;

    const revA = Number(a.revision) || 0;
    const revB = Number(b.revision) || 0;
    if (revA !== revB) return revA > revB ? a : b;

    const timeA = Date.parse(a.updatedAt || '') || 0;
    const timeB = Date.parse(b.updatedAt || '') || 0;
    return timeB > timeA ? b : a;
  }

  _createEmptyState() {
    return {
      version: 2,
      revision: 1,
      tasks: [],
      habits: [],
      reminders: [],
      transactions: [],
      notes: [],
      projects: [],
      clients: [],
      theme: getDefaultTheme(),
      settings: getDefaultSettings(),
      updatedAt: new Date().toISOString()
    };
  }

  async loadState() {
    // Đọc cả IndexedDB và LocalStorage rồi luôn chọn bản mới hơn để không bao giờ bị hồi sinh data đã xóa
    const [idbState, lsState] = await Promise.all([
      this._idbGet(STATE_KEY),
      Promise.resolve(this._readLocalStorageState())
    ]);

    let state = this._pickNewerState(idbState, lsState);

    if (!state) {
      // Chỉ tạo dữ liệu mẫu ĐÚNG 1 LẦN DUY NHẤT khi người dùng mới mở app lần đầu tiên
      const alreadyInitialized = localStorage.getItem(INIT_FLAG_KEY) === '1';
      state = alreadyInitialized ? this._createEmptyState() : createMockState();
      state.revision = Number(state.revision) || 1;
      await this._saveLocalOnly(state);
    } else {
      state = this._normalizeState(state);
      // Đồng bộ lại cả 2 lớp lưu trữ để IDB và LocalStorage luôn khớp 100%
      await this._saveLocalOnly(state);
    }

    // Nếu đang đăng nhập Supabase -> kéo dữ liệu cloud mới nhất
    const creds = this.getSupabaseCredentials(state.settings);
    if (creds.configured && auth.getMode() === 'supabase' && auth.isAuthenticated()) {
      this.syncStatus = 'cloud';
      try {
        const remote = await this.pullAllFromSupabase(state);
        if (remote) {
          state = this._normalizeState(remote);
          state.revision = Math.max(Number(state.revision) || 0, Number(lsState?.revision) || 0) + 1;
          await this._saveLocalOnly(state);
        }
      } catch {
        // Offline -> giữ nguyên bản local mới nhất
      }
    } else {
      this.syncStatus = 'local';
    }

    return state;
  }

  _normalizeState(raw) {
    const defTheme = getDefaultTheme();
    const defSettings = getDefaultSettings();
    return {
      version: 2,
      revision: Number(raw.revision) || 1,
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      habits: Array.isArray(raw.habits) ? raw.habits : [],
      reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
      transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
      notes: Array.isArray(raw.notes) ? raw.notes : [],
      projects: Array.isArray(raw.projects) ? raw.projects : [],
      clients: Array.isArray(raw.clients) ? raw.clients : [],
      theme: { ...defTheme, ...(raw.theme || {}) },
      settings: {
        ...defSettings,
        ...(raw.settings || {}),
        supabase: { ...defSettings.supabase, ...(raw.settings?.supabase || {}) },
        appLock: { ...defSettings.appLock, ...(raw.settings?.appLock || {}) }
      },
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  async _saveLocalOnly(state) {
    if (!state || typeof state !== 'object') return;
    // 1. Ghi ĐỒNG BỘ vào LocalStorage NGAY LẬP TỨC (chống mất data khi đóng tab hoặc đăng xuất liền tay)
    this._writeLocalStorageSync(state);

    // 2. Tạo bản sao độc lập (tránh bị mutate thành null khi đăng xuất) rồi lưu vào IndexedDB
    const snapshot = JSON.parse(JSON.stringify(state));
    const writePromise = this._idbSet(STATE_KEY, snapshot);
    this._pendingIdbPromise = writePromise;
    await writePromise;
  }

  /**
   * Ghi đồng bộ khẩn cấp (dùng cho sự kiện beforeunload / pagehide).
   */
  saveSyncSnapshot(state) {
    if (!state || typeof state !== 'object') return;
    this._writeLocalStorageSync(state);
  }

  async saveState(state, opts = {}) {
    if (!state || typeof state !== 'object') return;
    state.revision = (Number(state.revision) || 0) + 1;
    state.updatedAt = new Date().toISOString();

    await this._saveLocalOnly(state);

    if (!opts.skipCloud) {
      const creds = this.getSupabaseCredentials(state.settings);
      if (creds.configured && auth.getMode() === 'supabase' && auth.isAuthenticated()) {
        this._scheduleCloudPush(state, opts.onSyncChange);
      } else {
        this.syncStatus = 'local';
        opts.onSyncChange?.('local');
      }
    }
  }

  /**
   * Đẩy toàn bộ thay đổi đang chờ (IDB + Supabase) trước khi đăng xuất để không mất các mục vừa xóa.
   */
  async flushPending(state) {
    if (state && typeof state === 'object') {
      this._writeLocalStorageSync(state);
      const snapshot = JSON.parse(JSON.stringify(state));
      await this._idbSet(STATE_KEY, snapshot);
    } else {
      await this._pendingIdbPromise.catch(() => {});
    }

    if (this._syncTimer) {
      clearTimeout(this._syncTimer);
      this._syncTimer = null;
    }

    if (this._hasPendingCloudPush && state) {
      this._hasPendingCloudPush = false;
      await this.pushAllToSupabase(state).catch(() => {});
    }
  }

  _scheduleCloudPush(state, onSyncChange) {
    clearTimeout(this._syncTimer);
    this._hasPendingCloudPush = true;
    this.syncStatus = 'syncing';
    onSyncChange?.('syncing');
    const snapshot = JSON.parse(JSON.stringify(state));
    this._syncTimer = setTimeout(async () => {
      this._syncTimer = null;
      this._hasPendingCloudPush = false;
      const ok = await this.pushAllToSupabase(snapshot);
      this.syncStatus = ok ? 'cloud' : 'local';
      onSyncChange?.(this.syncStatus);
    }, 500);
  }

  async _sbFetch(creds, token, path, options = {}) {
    const url = `${creds.url.replace(/\/$/, '')}/rest/v1/${path}`;
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        apikey: creds.anonKey,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: options.prefer || 'return=minimal',
        ...(options.headers || {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    if (options.expectJson) {
      const data = await res.json().catch(() => null);
      return { ok: true, status: res.status, data };
    }
    return { ok: true, status: res.status, data: null };
  }

  async pullAllFromSupabase(currentState) {
    const creds = this.getSupabaseCredentials(currentState?.settings);
    if (!creds.configured || auth.getMode() !== 'supabase') return null;

    const token = await auth.ensureValidToken(creds.url, creds.anonKey);
    const user = auth.getUser();
    if (!token || !user?.id) return null;

    const [tasksR, remR, finR, notesR, projR, habR, cliR, setR] = await Promise.all([
      this._sbFetch(creds, token, 'tasks_bookings?select=*&order=created_at.desc', { expectJson: true }),
      this._sbFetch(creds, token, 'reminders?select=*&order=created_at.desc', { expectJson: true }),
      this._sbFetch(creds, token, 'finances?select=*&order=date.desc', { expectJson: true }),
      this._sbFetch(creds, token, 'notes?select=*&order=created_at.desc', { expectJson: true }),
      this._sbFetch(creds, token, 'projects?select=*&order=created_at.desc', { expectJson: true }),
      this._sbFetch(creds, token, 'habits?select=*&order=created_at.asc', { expectJson: true }),
      this._sbFetch(creds, token, 'clients?select=*&order=name.asc', { expectJson: true }),
      this._sbFetch(creds, token, 'user_settings?select=*&limit=1', { expectJson: true })
    ]);

    if (!tasksR.ok) return null;

    const remoteInitialized =
      (setR.data?.length || 0) > 0 ||
      (tasksR.data?.length || 0) > 0 ||
      (remR.data?.length || 0) > 0 ||
      (finR.data?.length || 0) > 0 ||
      (notesR.data?.length || 0) > 0 ||
      (projR.data?.length || 0) > 0 ||
      (habR.data?.length || 0) > 0 ||
      (cliR.data?.length || 0) > 0;

    // Lần đầu tiên đăng nhập lên Supabase hoàn toàn trống -> đẩy trạng thái local lên
    if (!remoteInitialized && currentState) {
      await this.pushAllToSupabase(currentState);
      return currentState;
    }

    const uRow = Array.isArray(setR.data) ? setR.data[0] : null;
    const remoteUpdatedAt = uRow?.updated_at || new Date().toISOString();

    return {
      version: 2,
      tasks: (tasksR.data || []).map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        client: r.client || '',
        clientId: r.client_id || '',
        clientPhone: r.client_phone || '',
        date: r.date || '',
        time: r.time || '',
        duration: Number(r.duration) || 60,
        status: r.status || 'pending',
        isDeadline: Boolean(r.is_deadline),
        price: Number(r.price) || 0,
        deposit: Number(r.deposit) || 0,
        paymentStatus: r.payment_status || 'unpaid',
        remindBefore: Number(r.remind_before ?? 30),
        reminderSent: Boolean(r.reminder_sent),
        notes: r.notes || '',
        isMock: Boolean(r.is_mock),
        createdAt: r.created_at
      })),
      reminders: (remR.data || []).map((r) => ({
        id: r.id,
        title: r.title,
        notes: r.notes || '',
        date: r.date,
        time: r.time || '09:00',
        priority: r.priority || 'medium',
        repeat: r.repeat || 'none',
        completed: Boolean(r.completed),
        sent: Boolean(r.sent),
        isMock: Boolean(r.is_mock)
      })),
      transactions: (finR.data || []).map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        category: r.category,
        amount: Number(r.amount) || 0,
        date: r.date,
        bookingId: r.booking_id || '',
        notes: r.notes || '',
        isMock: Boolean(r.is_mock)
      })),
      notes: (notesR.data || []).map((r) => ({
        id: r.id,
        title: r.title || 'Ghi chú nhanh',
        content: r.content || '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        tint: r.tint || 'none',
        pinned: Boolean(r.pinned),
        isMock: Boolean(r.is_mock),
        createdAt: r.created_at
      })),
      projects: (projR.data || []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description || '',
        status: r.status || 'idea',
        deadline: r.deadline || '',
        subtasks: Array.isArray(r.subtasks) ? r.subtasks : [],
        isMock: Boolean(r.is_mock)
      })),
      habits: (habR.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        icon: r.icon || '✨',
        completedDates: Array.isArray(r.completed_dates) ? r.completed_dates : [],
        isMock: Boolean(r.is_mock)
      })),
      clients: (cliR.data || []).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        zalo: r.zalo || '',
        location: r.location || '',
        notes: r.notes || '',
        isMock: Boolean(r.is_mock),
        createdAt: r.created_at
      })),
      theme: {
        ...getDefaultTheme(),
        ...(uRow?.theme || {}),
        customWallpaper: currentState?.theme?.customWallpaper || ''
      },
      settings: {
        ...getDefaultSettings(),
        ...(uRow?.settings || {}),
        supabase: currentState?.settings?.supabase || { url: '', anonKey: '' }
      },
      updatedAt: remoteUpdatedAt
    };
  }

  async pushAllToSupabase(state) {
    const creds = this.getSupabaseCredentials(state?.settings);
    if (!creds.configured || auth.getMode() !== 'supabase') return false;

    const token = await auth.ensureValidToken(creds.url, creds.anonKey);
    const user = auth.getUser();
    if (!token || !user?.id) return false;

    const uid = user.id;
    const nowIso = new Date().toISOString();

    const syncTable = async (tableName, rows) => {
      const existing = await this._sbFetch(creds, token, `${tableName}?select=id`, { expectJson: true });
      if (!existing.ok) return false;
      const keepIds = new Set(rows.map((r) => r.id));
      const toDelete = (existing.data || []).map((r) => r.id).filter((id) => !keepIds.has(id));

      if (toDelete.length) {
        // PostgREST syntax chuẩn: encode từng ID, giữ nguyên dấu phẩy phân tách
        const encodedIds = toDelete.map((id) => encodeURIComponent(String(id))).join(',');
        await this._sbFetch(creds, token, `${tableName}?id=in.(${encodedIds})`, { method: 'DELETE' });
      }
      if (rows.length) {
        const up = await this._sbFetch(creds, token, `${tableName}?on_conflict=id`, {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: rows
        });
        return up.ok;
      }
      return true;
    };

    try {
      const results = await Promise.all([
        syncTable('tasks_bookings', (state.tasks || []).map((t) => ({
          id: t.id,
          user_id: uid,
          type: t.type || 'task',
          title: t.title,
          client: t.client || '',
          client_id: t.clientId || '',
          client_phone: t.clientPhone || '',
          date: t.date || '',
          time: t.time || '',
          duration: Number(t.duration) || 60,
          status: t.status || 'pending',
          is_deadline: Boolean(t.isDeadline),
          price: Number(t.price) || 0,
          deposit: Number(t.deposit) || 0,
          payment_status: t.paymentStatus || 'unpaid',
          remind_before: Number(t.remindBefore ?? 30),
          reminder_sent: Boolean(t.reminderSent),
          notes: t.notes || '',
          is_mock: Boolean(t.isMock),
          updated_at: nowIso
        }))),
        syncTable('reminders', (state.reminders || []).map((r) => ({
          id: r.id,
          user_id: uid,
          title: r.title,
          notes: r.notes || '',
          date: r.date,
          time: r.time || '09:00',
          priority: r.priority || 'medium',
          repeat: r.repeat || 'none',
          completed: Boolean(r.completed),
          sent: Boolean(r.sent),
          is_mock: Boolean(r.isMock),
          updated_at: nowIso
        }))),
        syncTable('finances', (state.transactions || []).map((tx) => ({
          id: tx.id,
          user_id: uid,
          type: tx.type,
          title: tx.title,
          category: tx.category || 'Khác',
          amount: Number(tx.amount) || 0,
          date: tx.date,
          booking_id: tx.bookingId || '',
          notes: tx.notes || '',
          is_mock: Boolean(tx.isMock),
          updated_at: nowIso
        }))),
        syncTable('notes', (state.notes || []).map((n) => ({
          id: n.id,
          user_id: uid,
          title: n.title || 'Ghi chú nhanh',
          content: n.content || '',
          tags: Array.isArray(n.tags) ? n.tags : [],
          tint: n.tint || 'none',
          pinned: Boolean(n.pinned),
          is_mock: Boolean(n.isMock),
          updated_at: nowIso
        }))),
        syncTable('projects', (state.projects || []).map((p) => ({
          id: p.id,
          user_id: uid,
          title: p.title,
          description: p.description || '',
          status: p.status || 'idea',
          deadline: p.deadline || '',
          subtasks: Array.isArray(p.subtasks) ? p.subtasks : [],
          is_mock: Boolean(p.isMock),
          updated_at: nowIso
        }))),
        syncTable('habits', (state.habits || []).map((h) => ({
          id: h.id,
          user_id: uid,
          name: h.name,
          icon: h.icon || '✨',
          completed_dates: Array.isArray(h.completedDates) ? h.completedDates : [],
          is_mock: Boolean(h.isMock),
          updated_at: nowIso
        }))),
        syncTable('clients', (state.clients || []).map((c) => ({
          id: c.id,
          user_id: uid,
          name: c.name,
          phone: c.phone || '',
          zalo: c.zalo || '',
          location: c.location || '',
          notes: c.notes || '',
          is_mock: Boolean(c.isMock),
          updated_at: nowIso
        }))),
        this._sbFetch(creds, token, 'user_settings?on_conflict=user_id', {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: {
            user_id: uid,
            theme: { ...state.theme, customWallpaper: '' },
            settings: {
              appLock: state.settings?.appLock || { enabled: false, pin: '', lockFinance: true, lockNotes: true }
            },
            updated_at: nowIso
          }
        }).then((r) => r.ok)
      ]);

      return results.every(Boolean);
    } catch {
      return false;
    }
  }

  startRealtimeSync(getState, onRemoteState) {
    this.stopRealtimeSync();
    const runPull = async () => {
      if (document.hidden || this.syncStatus === 'syncing' || this._hasPendingCloudPush) return;
      const cur = getState();
      const creds = this.getSupabaseCredentials(cur?.settings);
      if (!creds.configured || auth.getMode() !== 'supabase' || !auth.isAuthenticated()) return;
      const remote = await this.pullAllFromSupabase(cur);
      if (remote && remote.updatedAt && cur?.updatedAt && remote.updatedAt > cur.updatedAt) {
        remote.revision = (Number(cur.revision) || 0) + 1;
        await this._saveLocalOnly(remote);
        onRemoteState(remote);
      }
    };
    this._pollTimer = setInterval(runPull, 25_000);
    window.addEventListener('focus', runPull);
    this._focusHandler = runPull;
  }

  stopRealtimeSync() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._focusHandler) window.removeEventListener('focus', this._focusHandler);
    this._pollTimer = null;
    this._focusHandler = null;
  }

  async saveCustomWallpaper(dataUrl) {
    await this._idbSet(WALLPAPER_KEY, dataUrl || '');
  }

  async loadCustomWallpaper() {
    return (await this._idbGet(WALLPAPER_KEY)) || '';
  }

  estimateSizeKB(state) {
    try {
      const bytes = new Blob([JSON.stringify(state)]).size;
      return (bytes / 1024).toFixed(1);
    } catch {
      return '0.0';
    }
  }
}

export const storage = new StorageAdapter();
