/**
 * ShuShu — Single-User Private Authentication (Login-Only + Persist Session)
 *
 * - Khi có cấu hình Supabase (SUPABASE_URL + SUPABASE_ANON_KEY):
 *   Sử dụng Supabase Auth `signInWithPassword` (REST `/auth/v1/token?grant_type=password`),
 *   tự động lưu phiên (Persist Session) và gia hạn access_token khi cần.
 * - Khi chưa cấu hình Supabase (Chạy Offline-First Local):
 *   Xác thực tài khoản cá nhân duy nhất (Single-User) an toàn ở local để bảo vệ giao diện.
 */

const SESSION_KEY = 'shushu_auth_session_v3';
const LEGACY_SESSION_KEYS = ['shushu_auth_session_v2', 'shushu_auth_session_v1'];

// Tài khoản Single-User mặc định cho môi trường Local/Offline
const LOCAL_ACCOUNT = {
  username: 'tuilashushu',
  passChecksum: 'mocuachoanhdi'
};

class AuthManager {
  constructor() {
    this.session = null;
  }

  loadPersistedSession() {
    // Dọn các session key cũ nếu có
    try {
      for (const oldKey of LEGACY_SESSION_KEYS) {
        localStorage.removeItem(oldKey);
      }
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.user && parsed.mode) {
        // Nếu là phiên local nhưng không khớp tài khoản hiện tại -> hủy phiên cũ
        if (parsed.mode === 'local' && parsed.user.displayName !== LOCAL_ACCOUNT.username) {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }
        this.session = parsed;
        return this.session;
      }
    } catch {
      this.session = null;
    }
    return null;
  }

  _persist(session) {
    this.session = session;
    try {
      if (session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch {
      // Ignore storage quota issues
    }
  }

  isAuthenticated() {
    return Boolean(this.session && this.session.user);
  }

  getUser() {
    return this.session?.user || null;
  }

  getAccessToken() {
    return this.session?.accessToken || '';
  }

  getMode() {
    return this.session?.mode || 'local';
  }

  async ensureValidToken(supabaseUrl, supabaseAnonKey) {
    if (!this.session || this.session.mode !== 'supabase') return '';
    if (!supabaseUrl || !supabaseAnonKey) return '';

    const nowSec = Math.floor(Date.now() / 1000);
    if (this.session.expiresAt && this.session.expiresAt - nowSec > 120) {
      return this.session.accessToken;
    }

    if (!this.session.refreshToken) {
      return this.session.accessToken || '';
    }

    try {
      const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token: this.session.refreshToken })
      });
      if (!res.ok) {
        await this.signOut();
        return '';
      }
      const data = await res.json();
      const updated = {
        ...this.session,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || this.session.refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
        user: {
          id: data.user?.id || this.session.user.id,
          email: data.user?.email || this.session.user.email,
          displayName: this.session.user.displayName
        }
      };
      this._persist(updated);
      return updated.accessToken;
    } catch {
      return this.session.accessToken || '';
    }
  }

  /**
   * Single-User Login-Only (`signInWithPassword`).
   */
  async signIn({ identifier, password, supabaseUrl, supabaseAnonKey, singleUserDomain = 'shushu.app' }) {
    const idClean = String(identifier || '').trim();
    const passClean = String(password || '');

    if (!idClean || !passClean) {
      return { ok: false, error: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu.' };
    }

    // Mode 1: Supabase Auth (PC <-> Mobile Cloud Sync)
    if (supabaseUrl && supabaseAnonKey) {
      const email = idClean.includes('@') ? idClean : `${idClean}@${singleUserDomain}`;
      try {
        const res = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password: passClean })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
          const msg = data.error_description || data.msg || 'Sai tài khoản hoặc mật khẩu Supabase.';
          return { ok: false, error: msg };
        }

        const session = {
          mode: 'supabase',
          accessToken: data.access_token,
          refreshToken: data.refresh_token || '',
          expiresAt: Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600),
          user: {
            id: data.user?.id || '',
            email: data.user?.email || email,
            displayName: idClean.includes('@') ? idClean.split('@')[0] : idClean
          }
        };
        this._persist(session);
        return { ok: true, session };
      } catch {
        return { ok: false, error: 'Không thể kết nối máy chủ Supabase. Kiểm tra kết nối mạng của bạn.' };
      }
    }

    // Mode 2: Offline-First Local Single-User Mode
    const normalizedUser = idClean.toLowerCase();
    const expectedEmail = `${LOCAL_ACCOUNT.username}@${singleUserDomain}`.toLowerCase();
    const userMatches = normalizedUser === LOCAL_ACCOUNT.username || normalizedUser === expectedEmail;
    const passMatches = passClean === LOCAL_ACCOUNT.passChecksum;

    if (!userMatches || !passMatches) {
      return { ok: false, error: 'Tài khoản hoặc mật khẩu không chính xác.' };
    }

    const session = {
      mode: 'local',
      accessToken: '',
      refreshToken: '',
      expiresAt: null,
      user: {
        id: 'local_single_user',
        email: expectedEmail,
        displayName: LOCAL_ACCOUNT.username
      }
    };
    this._persist(session);
    return { ok: true, session };
  }

  /**
   * Đăng xuất hoàn toàn — xóa sạch toàn bộ token & thông tin phiên vừa đăng nhập.
   */
  async signOut(supabaseUrl = '', supabaseAnonKey = '') {
    if (this.session?.mode === 'supabase' && supabaseUrl && supabaseAnonKey && this.session.accessToken) {
      fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${this.session.accessToken}`
        }
      }).catch(() => {});
    }

    this._persist(null);

    try {
      for (const oldKey of LEGACY_SESSION_KEYS) {
        localStorage.removeItem(oldKey);
      }
      // Xóa mọi token auth của Supabase nếu có trong localStorage / sessionStorage
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.includes('auth')) {
          localStorage.removeItem(k);
        }
      });
      sessionStorage.clear();
    } catch {
      // Ignore storage access errors
    }
  }
}

export const auth = new AuthManager();
