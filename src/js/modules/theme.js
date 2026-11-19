import { getDefaultTheme } from '../mock-data.js';
import { storage } from '../storage.js';

export const WALLPAPERS = [
  { id: 'dawn-silk', name: 'Lụa bình minh', preview: 'linear-gradient(135deg, #fbcfe8 0%, #ddd6fe 50%, #bae6fd 100%)' },
  { id: 'misty-pine', name: 'Rừng sương mai', preview: 'linear-gradient(135deg, #a7f3d0 0%, #e6f2ec 50%, #bae6fd 100%)' },
  { id: 'warm-sand', name: 'Cát ấm Kyoto', preview: 'linear-gradient(135deg, #fde68a 0%, #fecdd3 55%, #ece2d6 100%)' },
  { id: 'sakura-cloud', name: 'Mây anh đào', preview: 'linear-gradient(135deg, #fda4af 0%, #f5f3ff 55%, #f9a8d4 100%)' },
  { id: 'ocean-mist', name: 'Sương biển Bắc Âu', preview: 'linear-gradient(135deg, #7dd3fc 0%, #e0f2fe 55%, #c4b5fd 100%)' },
  { id: 'midnight-aurora', name: 'Cực quang đêm', preview: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #0f172a 100%)' }
];

export const ACCENT_PRESETS = [
  { name: 'Đen tối giản', color: '#18181b' },
  { name: 'Đỏ đô thanh lịch', color: '#881337' },
  { name: 'Xanh rừng sâu', color: '#14532d' },
  { name: 'Xanh đại dương', color: '#0c4a6e' },
  { name: 'Tím oải hương', color: '#5b21b6' },
  { name: 'Cam đất ấm', color: '#9a3412' }
];

export function applyThemeToDocument(theme) {
  const t = { ...getDefaultTheme(), ...(theme || {}) };
  const root = document.documentElement;
  const wpLayer = document.getElementById('wallpaper-layer');

  root.setAttribute('data-theme', t.mode === 'dark' ? 'dark' : 'light');
  root.style.setProperty('--glass-blur', `${t.blur}px`);
  root.style.setProperty('--glass-opacity', String(t.opacity));
  root.style.setProperty('--glass-strong-opacity', String(Math.min(0.96, Number(t.opacity) + 0.16)));

  const accent = t.accent || '#18181b';
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--nav-active-bg', t.mode === 'dark' && accent === '#18181b' ? '#f4f4f5' : accent);
  root.style.setProperty('--nav-active-text', t.mode === 'dark' && accent === '#18181b' ? '#18181b' : '#ffffff');

  document.body.setAttribute('data-wallpaper', t.wallpaper || 'dawn-silk');

  if (wpLayer) {
    if (t.wallpaper === 'custom' && t.customWallpaper) {
      wpLayer.style.backgroundImage = `url("${t.customWallpaper}")`;
    } else {
      wpLayer.style.backgroundImage = '';
    }
  }
}

export function renderThemeModule(container, app) {
  const theme = app.state.theme;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Màu &amp; kính (Glassmorphism)</h1>
        <p class="page-subtitle">Cá nhân hóa hình nền, độ mờ kính, độ trong suốt và tông màu không gian làm việc</p>
      </div>
      <button class="btn btn-glass btn-sm" id="theme-reset-btn">Khôi phục mặc định</button>
    </div>

    <div class="theme-grid">
      <!-- Wallpaper Picker -->
      <section class="panel glass-panel">
        <div class="panel-header">
          <div>
            <h2 class="section-title">Hình nền nghệ thuật</h2>
            <p class="page-subtitle">Chọn từ bộ sưu tập dịu mắt hoặc tải ảnh cá nhân của bạn lên</p>
          </div>
        </div>

        <div class="wallpaper-grid" style="margin-bottom:16px;">
          ${WALLPAPERS.map((wp) => `
            <button
              type="button"
              class="wp-swatch ${theme.wallpaper === wp.id ? 'active' : ''}"
              style="background:${wp.preview};"
              data-pick-wp="${wp.id}"
            >
              <span>${wp.name}</span>
            </button>
          `).join('')}
        </div>

        <div class="glass-card" style="padding:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:700; font-size:13.5px;">Tải hình nền cá nhân</div>
            <div class="muted" style="font-size:12px;">Lưu cục bộ an toàn bằng IndexedDB (JPG, PNG, WebP)</div>
          </div>
          <div style="display:flex; gap:8px;">
            <label class="btn btn-dark btn-xs" style="cursor:pointer;">
              <span>Chọn ảnh...</span>
              <input type="file" id="wp-upload-input" accept="image/*" hidden />
            </label>
            ${theme.customWallpaper ? `<button class="btn btn-glass btn-xs" id="wp-use-custom">Dùng ảnh đã tải</button>` : ''}
          </div>
        </div>
      </section>

      <!-- Glass & Accent Sliders -->
      <section class="panel glass-panel" style="display:flex; flex-direction:column; gap:18px;">
        <div>
          <h2 class="section-title" style="margin-bottom:12px;">Chế độ giao diện</h2>
          <div class="pill-group" style="width:100%; display:grid; grid-template-columns:1fr 1fr;">
            <button class="pill-btn ${theme.mode === 'light' ? 'active' : ''}" data-theme-mode="light">☀️ Chế độ Sáng</button>
            <button class="pill-btn ${theme.mode === 'dark' ? 'active' : ''}" data-theme-mode="dark">🌙 Chế độ Tối</button>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="form-label">Độ mờ kính (Backdrop Blur)</span>
            <strong id="blur-val-label">${theme.blur}px</strong>
          </div>
          <input type="range" class="range-slider" id="theme-blur-slider" min="4" max="38" step="1" value="${theme.blur}" />
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span class="form-label">Độ trong suốt nền thẻ</span>
            <strong id="opacity-val-label">${Math.round(theme.opacity * 100)}%</strong>
          </div>
          <input type="range" class="range-slider" id="theme-opacity-slider" min="35" max="94" step="1" value="${Math.round(theme.opacity * 100)}" />
        </div>

        <div>
          <div class="form-label" style="margin-bottom:10px;">Tông màu chủ đạo (Accent Color)</div>
          <div class="accent-swatches">
            ${ACCENT_PRESETS.map((a) => `
              <button
                type="button"
                class="accent-dot ${theme.accent === a.color ? 'active' : ''}"
                style="background:${a.color};"
                title="${a.name}"
                data-pick-accent="${a.color}"
              ></button>
            `).join('')}
            <label title="Chọn màu tự do" style="display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; cursor:pointer; padding:6px 10px; border-radius:99px; background:var(--accent-soft);">
              <span>Tùy chỉnh</span>
              <input type="color" id="theme-custom-accent" value="${theme.accent}" style="width:22px;height:22px;border:none;background:none;cursor:pointer;" />
            </label>
          </div>
        </div>
      </section>
    </div>
  `;

  bindThemeEvents(container, app);
}

function bindThemeEvents(container, app) {
  const t = app.state.theme;

  container.querySelectorAll('[data-pick-wp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      t.wallpaper = btn.dataset.pickWp;
      if (t.wallpaper === 'midnight-aurora') t.mode = 'dark';
      applyThemeToDocument(t);
      app.commit('Đã đổi hình nền!');
    });
  });

  container.querySelector('#wp-use-custom')?.addEventListener('click', () => {
    t.wallpaper = 'custom';
    applyThemeToDocument(t);
    app.commit('Đã áp dụng hình nền cá nhân!');
  });

  container.querySelector('#wp-upload-input')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      t.customWallpaper = dataUrl;
      t.wallpaper = 'custom';
      await storage.saveCustomWallpaper(dataUrl);
      applyThemeToDocument(t);
      app.commit('Đã tải lên hình nền cá nhân!');
    };
    reader.readAsDataURL(file);
  });

  container.querySelectorAll('[data-theme-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      t.mode = btn.dataset.themeMode;
      applyThemeToDocument(t);
      app.commit(`Đã chuyển sang chế độ ${t.mode === 'dark' ? 'Tối' : 'Sáng'}.`);
    });
  });

  const blurSlider = container.querySelector('#theme-blur-slider');
  blurSlider?.addEventListener('input', () => {
    t.blur = Number(blurSlider.value);
    const lbl = container.querySelector('#blur-val-label');
    if (lbl) lbl.textContent = `${t.blur}px`;
    applyThemeToDocument(t);
  });
  blurSlider?.addEventListener('change', () => app.commitSilent());

  const opSlider = container.querySelector('#theme-opacity-slider');
  opSlider?.addEventListener('input', () => {
    t.opacity = Number(opSlider.value) / 100;
    const lbl = container.querySelector('#opacity-val-label');
    if (lbl) lbl.textContent = `${opSlider.value}%`;
    applyThemeToDocument(t);
  });
  opSlider?.addEventListener('change', () => app.commitSilent());

  container.querySelectorAll('[data-pick-accent]').forEach((btn) => {
    btn.addEventListener('click', () => {
      t.accent = btn.dataset.pickAccent;
      applyThemeToDocument(t);
      app.commit('Đã đổi màu chủ đạo!');
    });
  });

  container.querySelector('#theme-custom-accent')?.addEventListener('input', (e) => {
    t.accent = e.target.value;
    applyThemeToDocument(t);
    app.commitSilent();
  });

  container.querySelector('#theme-reset-btn')?.addEventListener('click', async () => {
    app.state.theme = getDefaultTheme();
    await storage.saveCustomWallpaper('');
    applyThemeToDocument(app.state.theme);
    app.commit('Đã khôi phục giao diện mặc định.');
  });
}
