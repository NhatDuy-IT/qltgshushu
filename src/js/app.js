import { uid, hydrateIcons } from './utils.js';
import { storage } from './storage.js';
import { auth } from './auth.js';
import { notifications, buildAllReminders } from './notifications.js';
import { audioEngine } from './audio-engine.js';
import { openCommandPalette, closeCommandPalette, isCommandPaletteOpen } from './command-palette.js';
import { openFocusMode, closeFocusMode, isFocusModeOpen } from './focus-mode.js';
import { renderTasksModule, openTaskModal, focusCalendarDateAndItem } from './modules/tasks.js';
import { renderDashboardModule } from './modules/dashboard.js';
import { renderRemindersModule } from './modules/reminders.js';
import { renderFinanceModule } from './modules/finance.js';
import { renderNotesModule } from './modules/notes.js';
import { renderProjectsModule } from './modules/projects.js';
import { renderRelaxModule, pomodoro } from './modules/relax.js';
import { renderThemeModule, applyThemeToDocument } from './modules/theme.js';
import { renderStorageModule, renderSettingsModule } from './modules/storage-settings.js';

const ROUTES = {
  dashboard: { title: 'Dashboard', render: renderDashboardModule },
  tasks: { title: 'Công việc', render: renderTasksModule },
  reminders: { title: 'Reminder', render: renderRemindersModule },
  finance: { title: 'Finance', render: renderFinanceModule },
  notes: { title: 'Quick Note', render: renderNotesModule },
  projects: { title: 'Project', render: renderProjectsModule },
  relax: { title: 'Relax', render: renderRelaxModule },
  theme: { title: 'Màu & kính', render: renderThemeModule },
  storage: { title: 'Lưu trữ', render: renderStorageModule },
  settings: { title: 'Cài đặt', render: renderSettingsModule }
};

class ShuShuApp {
  constructor() {
    this.state = null;
    this.currentRoute = 'tasks';
    this.pinUnlocked = false;
    this._shellBound = false;
    this._pinKeyHandler = null;

    this.authScreen = document.getElementById('auth-screen');
    this.appShell = document.getElementById('app-shell');
    this.mainEl = document.getElementById('app-main');
    this.modalRoot = document.getElementById('modal-root');
    this.modalCard = document.getElementById('modal-card');
    this.cmdRoot = document.getElementById('cmd-palette-root');
    this.toastContainer = document.getElementById('toast-container');
    this.sidebar = document.getElementById('sidebar');
    this.drawerBackdrop = document.getElementById('drawer-backdrop');
  }

  async init() {
    hydrateIcons(document);
    await storage.init();

    // Restore persisted session (Single-User Persist Session)
    auth.loadPersistedSession();

    // Update login mode indicator
    const creds = storage.getSupabaseCredentials();
    const modeLabel = document.getElementById('auth-mode-label');
    if (modeLabel) {
      modeLabel.textContent = creds.configured
        ? 'Đồng bộ Supabase PC ↔ Mobile • Tự lưu phiên đăng nhập'
        : 'Chế độ cá nhân Offline-First • Tự lưu phiên đăng nhập';
    }

    this._bindAuthEvents();

    if (auth.isAuthenticated()) {
      await this._enterWorkspace();
    } else {
      this._showLoginGate();
    }
  }

  _showLoginGate() {
    storage.stopRealtimeSync();
    notifications.stopWatcher();
    audioEngine.stopAll();
    pomodoro.pause();

    if (this._pinKeyHandler) {
      document.removeEventListener('keydown', this._pinKeyHandler);
      this._pinKeyHandler = null;
    }

    this.state = null;
    this.pinUnlocked = false;
    this.mainEl.innerHTML = '';

    const sqnInput = document.getElementById('sidebar-note-input');
    if (sqnInput) sqnInput.value = '';
    const userLbl = document.getElementById('sidebar-user-label');
    if (userLbl) userLbl.textContent = 'Đăng xuất';

    // Xóa sạch toàn bộ thông tin vừa nhập trong form đăng nhập
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();
    const idInput = document.getElementById('login-identifier');
    const passInput = document.getElementById('login-password');
    const errBox = document.getElementById('login-error');
    if (idInput) idInput.value = '';
    if (passInput) {
      passInput.value = '';
      passInput.type = 'password';
    }
    if (errBox) {
      errBox.textContent = '';
      errBox.hidden = true;
    }

    // Xóa hash URL để không lộ route bên trong khi đã đăng xuất
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    document.body.classList.add('is-logged-out');
    this.appShell.hidden = true;
    this.authScreen.hidden = false;
    idInput?.focus();
  }

  async _enterWorkspace() {
    if (!auth.isAuthenticated()) {
      this._showLoginGate();
      return;
    }

    this.state = await storage.loadState();

    const savedCustomWp = await storage.loadCustomWallpaper();
    if (savedCustomWp) {
      this.state.theme.customWallpaper = savedCustomWp;
    }

    applyThemeToDocument(this.state.theme);
    this.updateSyncBadge(storage.syncStatus);

    const user = auth.getUser();
    const userLbl = document.getElementById('sidebar-user-label');
    if (userLbl && user?.displayName) {
      userLbl.textContent = `Đăng xuất (${user.displayName})`;
    }

    document.body.classList.remove('is-logged-out');
    this.authScreen.hidden = true;
    this.appShell.hidden = false;

    if (!this._shellBound) {
      this._bindShellEvents();
      this._shellBound = true;
    }

    const deepParams = this._readHashRoute();
    this.render();

    if (deepParams.date || deepParams.itemId) {
      focusCalendarDateAndItem(this, deepParams);
    }

    // Start real-time PC <-> Mobile sync if signed in via Supabase
    storage.startRealtimeSync(
      () => this.state,
      (remoteState) => {
        this.state = remoteState;
        applyThemeToDocument(this.state.theme);
        this.updateSyncBadge('cloud');
        this.render();
      }
    );

    // Register Service Worker & live reminder watcher
    await notifications.init((targetRoute, deepLink = {}) => {
      if (!auth.isAuthenticated()) return;
      this.navigate(targetRoute);
      if (targetRoute === 'tasks' && (deepLink.date || deepLink.itemId)) {
        focusCalendarDateAndItem(this, deepLink);
      }
    });

    notifications.startWatcher(
      () => this.state,
      (rem) => {
        audioEngine.playChime();
        this.toast(`⏰ Nhắc lịch: ${rem.title}`);
      }
    );
  }

  async logout() {
    // Lưu chắc chắn mọi thay đổi / xóa dữ liệu đang chờ trước khi đăng xuất
    await storage.flushPending(this.state);
    const creds = storage.getSupabaseCredentials(this.state?.settings);
    await auth.signOut(creds.url, creds.anonKey);
    closeCommandPalette();
    closeFocusMode(this);
    this.closeModal();
    this.closeMobileDrawer();
    this._showLoginGate();
    this.toast('Đã đăng xuất an toàn.');
  }

  _bindAuthEvents() {
    const form = document.getElementById('login-form');
    const errBox = document.getElementById('login-error');
    const submitBtn = document.getElementById('login-submit-btn');
    const passInput = document.getElementById('login-password');
    const eyeBtn = document.getElementById('toggle-pass-vis');

    eyeBtn?.addEventListener('click', () => {
      if (!passInput) return;
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    });

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errBox) errBox.hidden = true;
      const fd = new FormData(form);
      const identifier = String(fd.get('identifier') || '').trim();
      const password = String(fd.get('password') || '');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang xác thực...';

      const creds = storage.getSupabaseCredentials();
      const res = await auth.signIn({
        identifier,
        password,
        supabaseUrl: creds.url,
        supabaseAnonKey: creds.anonKey,
        singleUserDomain: storage.runtimeConfig.singleUserDomain || 'shushu.app'
      });

      submitBtn.disabled = false;
      submitBtn.textContent = 'Đăng nhập vào ShuShu';

      if (!res.ok) {
        if (errBox) {
          errBox.textContent = res.error || 'Đăng nhập thất bại.';
          errBox.hidden = false;
        }
        return;
      }

      form.reset();
      await this._enterWorkspace();
      this.toast(`Chào mừng trở lại, ${res.session.user.displayName}! ✨`);
    });
  }

  _readHashRoute() {
    const raw = (window.location.hash || '').replace(/^#/, '').trim();
    const [routePart, queryPart] = raw.split('?');
    if (routePart && ROUTES[routePart]) {
      this.currentRoute = routePart;
    } else {
      this.currentRoute = 'tasks';
    }
    const params = new URLSearchParams(queryPart || '');
    return {
      date: params.get('date') || '',
      itemId: params.get('item') || ''
    };
  }

  navigate(routeKey) {
    if (!auth.isAuthenticated()) {
      this._showLoginGate();
      return;
    }
    if (!ROUTES[routeKey]) return;
    this.currentRoute = routeKey;
    if (window.location.hash !== `#${routeKey}`) {
      history.replaceState(null, '', `#${routeKey}`);
    }
    this.closeMobileDrawer();
    this.render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  isRoutePinLocked(routeKey) {
    if (this.pinUnlocked) return false;
    const lock = this.state?.settings?.appLock;
    if (!lock?.enabled || !/^\d{4}$/.test(lock.pin || '')) return false;
    if (routeKey === 'finance' && lock.lockFinance !== false) return true;
    if (routeKey === 'notes' && lock.lockNotes !== false) return true;
    return false;
  }

  lockPinSession() {
    this.pinUnlocked = false;
    this.updateLockBadges();
    if (this.isRoutePinLocked(this.currentRoute)) {
      this.render();
    }
  }

  updateLockBadges() {
    const finBadge = document.getElementById('lock-badge-finance');
    const noteBadge = document.getElementById('lock-badge-notes');
    if (finBadge) finBadge.hidden = !this.isRoutePinLocked('finance');
    if (noteBadge) noteBadge.hidden = !this.isRoutePinLocked('notes');
  }

  _renderPinLockGate(routeTitle) {
    if (this._pinKeyHandler) {
      document.removeEventListener('keydown', this._pinKeyHandler);
      this._pinKeyHandler = null;
    }

    let entered = '';
    const expectedPin = this.state.settings.appLock.pin;

    this.mainEl.innerHTML = `
      <div class="pin-gate-wrap">
        <div class="pin-gate-card glass-panel-strong">
          <div style="font-size:30px;">🔐</div>
          <div>
            <h2 class="section-title" style="font-size:18px;">Mở khóa ${routeTitle}</h2>
            <p class="page-subtitle">Nhập mã PIN 4 số để truy cập nội dung riêng tư</p>
          </div>
          <div class="pin-dots" id="pin-dots">
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
            <span class="pin-dot"></span>
          </div>
          <div id="pin-err-msg" style="font-size:12px; font-weight:700; color:var(--rose); min-height:18px;"></div>
          <div class="pin-pad">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="pin-key" data-pin-num="${n}">${n}</button>`).join('')}
            <button type="button" class="pin-key" style="font-size:13px;" data-pin-action="clear">Xóa</button>
            <button type="button" class="pin-key" data-pin-num="0">0</button>
            <button type="button" class="pin-key" style="font-size:15px;" data-pin-action="back">⌫</button>
          </div>
        </div>
      </div>
    `;

    const dots = this.mainEl.querySelectorAll('.pin-dot');
    const errEl = this.mainEl.querySelector('#pin-err-msg');

    const updateDots = () => {
      dots.forEach((d, idx) => d.classList.toggle('filled', idx < entered.length));
    };

    const pushDigit = (digit) => {
      if (entered.length >= 4) return;
      entered += digit;
      errEl.textContent = '';
      updateDots();
      if (entered.length === 4) {
        if (entered === expectedPin) {
          this.pinUnlocked = true;
          if (this._pinKeyHandler) {
            document.removeEventListener('keydown', this._pinKeyHandler);
            this._pinKeyHandler = null;
          }
          this.toast(`Đã mở khóa ${routeTitle}!`);
          this.render();
        } else {
          errEl.textContent = 'Mã PIN không đúng, vui lòng thử lại.';
          entered = '';
          setTimeout(updateDots, 240);
        }
      }
    };

    this.mainEl.querySelectorAll('[data-pin-num]').forEach((btn) => {
      btn.addEventListener('click', () => pushDigit(btn.dataset.pinNum));
    });
    this.mainEl.querySelector('[data-pin-action="clear"]')?.addEventListener('click', () => {
      entered = '';
      errEl.textContent = '';
      updateDots();
    });
    this.mainEl.querySelector('[data-pin-action="back"]')?.addEventListener('click', () => {
      entered = entered.slice(0, -1);
      updateDots();
    });

    this._pinKeyHandler = (e) => {
      if (isCommandPaletteOpen() || isFocusModeOpen() || !this.modalRoot.hidden) return;
      if (/^[0-9]$/.test(e.key)) pushDigit(e.key);
      else if (e.key === 'Backspace') {
        entered = entered.slice(0, -1);
        updateDots();
      }
    };
    document.addEventListener('keydown', this._pinKeyHandler);
  }

  render() {
    if (!auth.isAuthenticated()) {
      this._showLoginGate();
      return;
    }

    if (this._pinKeyHandler) {
      document.removeEventListener('keydown', this._pinKeyHandler);
      this._pinKeyHandler = null;
    }

    const route = ROUTES[this.currentRoute] || ROUTES.tasks;

    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.classList.toggle('active', el.dataset.nav === this.currentRoute);
    });

    const mobileTitle = document.getElementById('mobile-page-title');
    if (mobileTitle) mobileTitle.textContent = route.title;

    this.updateBadges();
    this.updateRelaxIndicator();
    this.updateLockBadges();

    if (this.isRoutePinLocked(this.currentRoute)) {
      this._renderPinLockGate(route.title);
      return;
    }

    route.render(this.mainEl, this);
    hydrateIcons(this.mainEl);
  }

  async commit(toastMsg = '') {
    // Lưu đồng bộ ngay lập tức trước cả khi render để chống mất dữ liệu vừa xóa
    if (this.state) {
      this.state.revision = (Number(this.state.revision) || 0) + 1;
      this.state.updatedAt = new Date().toISOString();
      storage.saveSyncSnapshot(this.state);
    }
    this.render();
    await this.commitSilent();
    if (toastMsg) this.toast(toastMsg);
  }

  async commitSilent() {
    if (!this.state) return;
    await storage.saveState(this.state, {
      onSyncChange: (status) => this.updateSyncBadge(status)
    });
  }

  async replaceState(newState, toastMsg) {
    this.state = {
      ...this.state,
      ...newState,
      theme: { ...this.state.theme, ...(newState.theme || {}) },
      settings: { ...this.state.settings, ...(newState.settings || {}) }
    };
    applyThemeToDocument(this.state.theme);
    await this.commit(toastMsg);
  }

  updateBadges() {
    const openTasksCount = (this.state.tasks || []).filter((t) => t.status !== 'done').length;
    const taskBadge = document.getElementById('badge-tasks');
    if (taskBadge) {
      taskBadge.textContent = String(openTasksCount);
      taskBadge.hidden = openTasksCount === 0;
    }

    const upcomingRems = buildAllReminders(this.state).filter((r) => !r.completed).length;
    const remBadge = document.getElementById('badge-reminders');
    if (remBadge) {
      remBadge.textContent = String(upcomingRems);
      remBadge.hidden = upcomingRems === 0;
    }
  }

  updateRelaxIndicator() {
    const dot = document.getElementById('relax-playing-dot');
    if (!dot) return;
    dot.hidden = !(audioEngine.isAnythingPlaying() || pomodoro.running);
  }

  updateSyncBadge(status) {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;
    badge.classList.remove('cloud', 'syncing');
    const textEl = badge.querySelector('.sync-text');
    if (status === 'cloud') {
      badge.classList.add('cloud');
      if (textEl) textEl.textContent = 'Supabase Sync';
    } else if (status === 'syncing') {
      badge.classList.add('syncing');
      if (textEl) textEl.textContent = 'Đang đồng bộ...';
    } else {
      if (textEl) textEl.textContent = 'Offline-First';
    }
  }

  openModal(html, onBind) {
    this.modalCard.innerHTML = html;
    this.modalRoot.hidden = false;
    document.body.style.overflow = 'hidden';

    this.modalCard.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => this.closeModal());
    });

    if (onBind) onBind(this.modalCard);
    hydrateIcons(this.modalCard);
  }

  closeModal() {
    this.modalRoot.hidden = true;
    this.modalCard.innerHTML = '';
    if (!isCommandPaletteOpen() && !isFocusModeOpen()) {
      document.body.style.overflow = '';
    }
  }

  toast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this.toastContainer.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'opacity 200ms ease, transform 200ms ease';
      setTimeout(() => el.remove(), 220);
    }, 3200);
  }

  openMobileDrawer() {
    this.sidebar.classList.add('open');
    this.drawerBackdrop.hidden = false;
  }

  closeMobileDrawer() {
    this.sidebar.classList.remove('open');
    this.drawerBackdrop.hidden = true;
  }

  _bindShellEvents() {
    // Lưu khẩn cấp đồng bộ khi người dùng thoát trang, tải lại hoặc chuyển tab
    const persistOnExit = () => {
      if (this.state) storage.saveSyncSnapshot(this.state);
    };
    window.addEventListener('beforeunload', persistOnExit);
    window.addEventListener('pagehide', persistOnExit);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state) {
        storage.saveSyncSnapshot(this.state);
      }
    });

    window.addEventListener('hashchange', () => {
      if (!auth.isAuthenticated()) {
        this._showLoginGate();
        return;
      }
      const deep = this._readHashRoute();
      this.render();
      if (this.currentRoute === 'tasks' && (deep.date || deep.itemId)) {
        focusCalendarDateAndItem(this, deep);
      }
    });

    document.querySelectorAll('[data-nav]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigate(el.dataset.nav);
      });
    });

    // Quick Search (Ctrl+K) & Focus Mode Buttons
    document.getElementById('sidebar-search-btn')?.addEventListener('click', () => openCommandPalette(this));
    document.getElementById('mobile-search-btn')?.addEventListener('click', () => openCommandPalette(this));
    document.getElementById('sidebar-focus-btn')?.addEventListener('click', () => openFocusMode(this));
    document.getElementById('mobile-focus-btn')?.addEventListener('click', () => openFocusMode(this));
    document.getElementById('sidebar-logout-btn')?.addEventListener('click', () => this.logout());

    // Mobile Drawer & Quick Add
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => this.openMobileDrawer());
    document.getElementById('mbn-more-btn')?.addEventListener('click', () => this.openMobileDrawer());
    document.getElementById('mobile-drawer-close')?.addEventListener('click', () => this.closeMobileDrawer());
    this.drawerBackdrop?.addEventListener('click', () => this.closeMobileDrawer());
    document.getElementById('mobile-quick-add')?.addEventListener('click', () => openTaskModal(this));

    // Modal & Command Palette Backdrops
    this.modalRoot.addEventListener('click', (e) => {
      if (e.target === this.modalRoot) this.closeModal();
    });
    this.cmdRoot?.addEventListener('click', (e) => {
      if (e.target === this.cmdRoot) closeCommandPalette();
    });

    // Global Keyboard Shortcuts: Ctrl/Cmd + K (Command Palette), Escape
    document.addEventListener('keydown', (e) => {
      if (!auth.isAuthenticated()) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isCommandPaletteOpen()) closeCommandPalette();
        else openCommandPalette(this);
        return;
      }

      if (e.key === 'Escape') {
        if (isCommandPaletteOpen()) {
          closeCommandPalette();
        } else if (isFocusModeOpen()) {
          closeFocusMode(this);
        } else if (!this.modalRoot.hidden) {
          this.closeModal();
        }
      }
    });

    // Fixed Sidebar QUICK NOTE Widget
    const sqnInput = document.getElementById('sidebar-note-input');
    const sqnSave = document.getElementById('sidebar-note-save');

    const saveSidebarNote = () => {
      const content = (sqnInput.value || '').trim();
      if (!content) {
        this.toast('Hãy nhập nội dung ghi chú trước khi lưu nhé!', 'error');
        sqnInput.focus();
        return;
      }
      const firstLine = content.split('\n')[0].slice(0, 48);
      this.state.notes.unshift({
        id: uid('note'),
        title: firstLine.length < content.length ? `${firstLine}...` : 'Ghi chú nhanh',
        content,
        tags: ['Nhanh'],
        tint: 'none',
        pinned: false,
        createdAt: new Date().toISOString()
      });
      sqnInput.value = '';
      this.commit('Đã lưu vào Quick Note!');
    };

    sqnSave?.addEventListener('click', saveSidebarNote);
    sqnInput?.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveSidebarNote();
      }
    });
  }
}

const app = new ShuShuApp();
app.init();
