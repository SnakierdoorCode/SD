import { desktop } from "./desktop.js";
import { SystemUtilities } from "./system.js";

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const shouldDisableClippy = isMobile || isLocalhost;

export const StorageKeys = {
  username: "yukiOS_username",
  weather: "yukiOS_weather",
  positionsKey: "yukiOS_desktop:icon-positions",
  favoritesKey: "yukiOS_Favorites",
  wallpaperKey: "yukiOS_selectedWallpaper",
  wallpaperIndexKey: "yukiOS_wallpaperIndex",
  cycleWallpaper: "yukiOS_cycleWallpaper",
  manualWallpaper: "yukiOS_manualWallpaper",
  cursorKey: "yukiOS_customCursor",
  cursorOriginalKey: "yukiOS_customCursor_original",
  cursorSizeKey: "yukiOS_customCursor_size",
  macOsControls: "yukiOS_macOsControls",
  clippy: "yukiOS_clippy",
  disableDesktopStretchScroll: "yukiOS_disable_desktop_stretch_scroll",
  calendarEvents: "yukiOS_calendar_events",
  aboutLaunchKey: "yukiOS_about_seen",
  newsSeenKey: "yukiOS_news_seen",
  newsReadSignatureKey: "yukiOS_news_read_signature",
  achievementKeys: "yukiOS_achievements",
  achievementCounters: "yukiOS_achievement_counters",
  deletedIconsKey: "yukiOS_desktop:deleted-icons",
  analyticsDisabled: "yukiOS_analytics_disabled"
};

export class SettingsApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.fs = null;

    setTimeout(() => {
      const cursorOriginalFromStorage = localStorage.getItem(StorageKeys.cursorOriginalKey) ?? "";
      const cursorFromLegacyStorage = localStorage.getItem(StorageKeys.cursorKey) ?? "";
      const cursorOriginalDataUrl = cursorOriginalFromStorage || cursorFromLegacyStorage || "";
      const parsedCursorSize = Number(localStorage.getItem(StorageKeys.cursorSizeKey));
      const cursorSize = Number.isFinite(parsedCursorSize) && parsedCursorSize > 0 ? parsedCursorSize : 32;

      this._settings = {
        username: localStorage.getItem(StorageKeys.username) ?? "",
        weather: localStorage.getItem(StorageKeys.weather) !== "false",
        cycleWallpaper: localStorage.getItem(StorageKeys.cycleWallpaper) !== "false",
        cursorDataUrl: cursorFromLegacyStorage,
        cursorOriginalDataUrl,
        cursorSize,
        macOsControls: localStorage.getItem(StorageKeys.macOsControls) === "true",
        clippy: localStorage.getItem(StorageKeys.clippy) === "true",
        disableDesktopStretchScroll: localStorage.getItem(StorageKeys.disableDesktopStretchScroll) === "true",
        achievementsDisabled: localStorage.getItem("yukiOS_achievements_disabled") === "true",
        analyticsDisabled: localStorage.getItem(StorageKeys.analyticsDisabled) === "true"
      };

      this._applyUsername(this._settings.username);
      this._applyCursor(this._settings.cursorDataUrl);
      this._applyDesktopStretchScrollDisabled(this._settings.disableDesktopStretchScroll);
      window._settings = this._settings;

      // If we only had legacy cursor saved, persist it as the "original" so size adjustments work.
      if (cursorFromLegacyStorage && !cursorOriginalFromStorage) {
        try {
          localStorage.setItem(StorageKeys.cursorOriginalKey, cursorFromLegacyStorage);
          this._settings.cursorOriginalDataUrl = cursorFromLegacyStorage;
        } catch {}
      }
    }, 0);
  }

  open() {
    const winId = "yukiOS-settings";
    const existing = document.getElementById(winId);
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow(winId, "Settings", "500px", "560px");
    Object.assign(win.style, { left: "200px", top: "100px" });
    win.innerHTML = this._buildHTML();

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Settings", "fas fa-cog");
    if (this.desktopUi !== undefined) this.desktopUI.closeAllMenus();

    this._bindControls(win);
  }

  setDesktopUI(desktopUi) {
    this.desktopUI = desktopUi;
  }

  setAppLauncher(appLauncher) {
    this._appLauncher = appLauncher;
  }

  setFileSystemManager(fileSystemManager) {
    this.fs = fileSystemManager;
  }

  _buildHTML() {
    const {
      weather,
      cycleWallpaper,
      cursorDataUrl,
      cursorSize,
      macOsControls,
      clippy,
      disableDesktopStretchScroll,
      achievementsDisabled,
      analyticsDisabled
    } = this._settings;

    return `
    <div class="window-header">
      <span>Settings</span>
      ${this.wm.getWindowControls()}
    </div>

    <div class="stt-shell">

      <div class="stt-toolbar">
        <button class="settings-button" id="settingsResetBtn">
          <i class="fas fa-undo"></i> Reset
        </button>
        <button class="settings-button" id="settingsExportBtn" title="Export settings + filesystem">
          <i class="fas fa-file-export"></i> Export
        </button>
        <button class="settings-button" id="settingsImportBtn" title="Import settings + filesystem">
          <i class="fas fa-file-import"></i> Import
        </button>
        <button class="settings-button stt-warning-btn" id="settingsResetTogglesBtn">
          <i class="fas fa-sliders-h"></i> Reset Settings
        </button>
        <button class="settings-button stt-danger-btn" id="settingsDeleteAllBtn">
          <i class="fas fa-trash"></i> Delete All Data
        </button>
        <span id="settingsStatus" class="stt-saved-badge">Saved</span>
      </div>

      <div class="stt-body">

        <div class="stt-card">
          <div class="stt-card-header">
            <i class="fas fa-user"></i>
            <span>User</span>
          </div>

          <div class="stt-row stt-row--stacked">
            <div class="stt-label-group">
              <span class="stt-label-title">Username</span>
              <span class="stt-label-desc">Displayed across the OS interface</span>
            </div>
            <input id="settingsUsername" type="text" class="stt-input" spellcheck="false"/>
          </div>
        </div>

        <div class="stt-card">
          <div class="stt-card-header">
            <i class="fas fa-cog"></i>
            <span>System</span>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Weather</span>
              <span class="stt-label-desc">Show weather in the taskbar</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsWeather" ${weather ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">macOS Window Controls</span>
              <span class="stt-label-desc">Use macOS-style traffic light buttons</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsMacControls" ${macOsControls ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Clippy</span>
              <span class="stt-label-desc">Show Clippy after boot</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsClippy" ${clippy ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Achievements</span>
              <span class="stt-label-desc">Enable or disable achievement system</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsAchievements" ${!achievementsDisabled ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Analytics</span>
              <span class="stt-label-desc">Allow usage analytics</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsAnalytics" ${!analyticsDisabled ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Disable Desktop Stretch Scroll</span>
              <span class="stt-label-desc">Prevent desktop page from expanding when windows are dragged out</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsDisableDesktopStretchScroll" ${disableDesktopStretchScroll ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

        </div>

        <div class="stt-card">
          <div class="stt-card-header">
            <i class="fas fa-image"></i>
            <span>Wallpaper</span>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Cycle Wallpapers on Start</span>
            </div>
            <label class="stt-toggle">
              <input type="checkbox" id="settingsCycleWallpaper" ${cycleWallpaper ? "checked" : ""}/>
              <span class="stt-track"><span class="stt-thumb"></span></span>
            </label>
          </div>

        </div>

        <div class="stt-card">
          <div class="stt-card-header">
            <i class="fas fa-mouse-pointer"></i>
            <span>Cursor</span>
          </div>

          <div class="stt-row stt-row--stacked">
            <div class="stt-label-group">
              <span class="stt-label-title">Custom Cursor</span>
              <span class="stt-label-desc">Upload a PNG/JPG/GIF/WEBP cursor image for the OS</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <button class="settings-button" id="settingsCursorUploadBtn">
                <i class="fas fa-upload"></i> Upload
              </button>
              <button class="settings-button stt-warning-btn" id="settingsCursorClearBtn" ${
                cursorDataUrl ? "" : "disabled"
              }>
                <i class="fas fa-times"></i> Clear
              </button>
              <span id="settingsCursorStatus" style="font-size:12px; color:#a1a1aa;">
                ${cursorDataUrl ? "Custom cursor enabled" : "Default cursor"}
              </span>
            </div>
          </div>

          <div class="stt-row">
            <div class="stt-label-group">
              <span class="stt-label-title">Cursor Size</span>
              <span class="stt-label-desc">Scale the uploaded cursor image</span>
            </div>
            <div style="display:flex; gap:10px; align-items:center;">
              <input id="settingsCursorSize" type="range" min="16" max="128" step="1" value="${cursorSize}" ${
                cursorDataUrl ? "" : "disabled"
              }/>
              <span id="settingsCursorSizeValue" style="min-width:44px; text-align:right; font-variant-numeric: tabular-nums;">${cursorSize}px</span>
            </div>
          </div>
        </div>

      </div>
    </div>
    `;
  }

  _bindControls(win) {
    const usernameInput = win.querySelector("#settingsUsername");
    const weatherToggle = win.querySelector("#settingsWeather");
    const cycleWallpaperToggle = win.querySelector("#settingsCycleWallpaper");
    const macControlsToggle = win.querySelector("#settingsMacControls");
    const clippyToggle = win.querySelector("#settingsClippy");
    const achievementsToggle = win.querySelector("#settingsAchievements");
    const analyticsToggle = win.querySelector("#settingsAnalytics");
    const disableDesktopStretchScrollToggle = win.querySelector("#settingsDisableDesktopStretchScroll");
    const cursorUploadBtn = win.querySelector("#settingsCursorUploadBtn");
    const cursorClearBtn = win.querySelector("#settingsCursorClearBtn");
    const cursorStatus = win.querySelector("#settingsCursorStatus");
    const cursorSizeInput = win.querySelector("#settingsCursorSize");
    const cursorSizeValue = win.querySelector("#settingsCursorSizeValue");
    const resetBtn = win.querySelector("#settingsResetBtn");
    const exportBtn = win.querySelector("#settingsExportBtn");
    const importBtn = win.querySelector("#settingsImportBtn");
    const resetTogglesBtn = win.querySelector("#settingsResetTogglesBtn");
    const deleteAllBtn = win.querySelector("#settingsDeleteAllBtn");
    const status = win.querySelector("#settingsStatus");

    usernameInput.value = this._settings.username;

    const showStatus = (msg = "Saved") => {
      status.textContent = msg;
      status.style.opacity = "1";
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => {
        status.style.opacity = "0";
      }, 2200);
    };

    const save = () => {
      const username = usernameInput.value.trim();
      const weather = weatherToggle.checked;
      const cycleWallpaper = cycleWallpaperToggle.checked;
      const macOsControls = macControlsToggle.checked;
      const clippy = clippyToggle.checked;
      const achievementsDisabled = !achievementsToggle.checked;
      const analyticsDisabled = !analyticsToggle.checked;
      const disableDesktopStretchScroll = !!disableDesktopStretchScrollToggle?.checked;

      localStorage.setItem(StorageKeys.username, username);
      localStorage.setItem(StorageKeys.weather, String(weather));
      localStorage.setItem(StorageKeys.cycleWallpaper, String(cycleWallpaper));
      localStorage.setItem(StorageKeys.macOsControls, String(macOsControls));
      localStorage.setItem(StorageKeys.clippy, String(clippy));
      localStorage.setItem(StorageKeys.disableDesktopStretchScroll, String(disableDesktopStretchScroll));
      localStorage.setItem("yukiOS_achievements_disabled", String(achievementsDisabled));
      localStorage.setItem(StorageKeys.analyticsDisabled, String(analyticsDisabled));

      Object.assign(this._settings, {
        username,
        weather,
        cycleWallpaper,
        macOsControls,
        clippy,
        disableDesktopStretchScroll,
        achievementsDisabled,
        analyticsDisabled
      });

      Object.assign(window._settings, this._settings);

      this._applyUsername(username);
      this._applyDesktopStretchScrollDisabled(disableDesktopStretchScroll);
      showStatus("Saved");
    };

    const setCursor = (dataUrl, originalDataUrl = null) => {
      const cursorDataUrl = typeof dataUrl === "string" ? dataUrl : "";
      const cursorOriginalDataUrl =
        originalDataUrl === null
          ? this._settings.cursorOriginalDataUrl
          : typeof originalDataUrl === "string"
            ? originalDataUrl
            : "";

      if (cursorDataUrl) localStorage.setItem(StorageKeys.cursorKey, cursorDataUrl);
      else localStorage.removeItem(StorageKeys.cursorKey);

      if (cursorOriginalDataUrl) localStorage.setItem(StorageKeys.cursorOriginalKey, cursorOriginalDataUrl);
      else localStorage.removeItem(StorageKeys.cursorOriginalKey);

      this._settings.cursorDataUrl = cursorDataUrl;
      this._settings.cursorOriginalDataUrl = cursorOriginalDataUrl;
      Object.assign(window._settings, this._settings);

      this._applyCursor(cursorDataUrl);

      if (cursorClearBtn) cursorClearBtn.disabled = !cursorDataUrl;
      if (cursorStatus) cursorStatus.textContent = cursorDataUrl ? "Custom cursor enabled" : "Default cursor";
      if (cursorSizeInput) cursorSizeInput.disabled = !cursorDataUrl;
      showStatus("Saved");
    };

    const setCursorSize = async (size) => {
      const cursorSize = Number(size);
      if (!Number.isFinite(cursorSize) || cursorSize < 16 || cursorSize > 128) return;
      this._settings.cursorSize = cursorSize;
      try {
        localStorage.setItem(StorageKeys.cursorSizeKey, String(cursorSize));
      } catch {}
      if (cursorSizeValue) cursorSizeValue.textContent = `${cursorSize}px`;
      Object.assign(window._settings, this._settings);

      const original = this._settings.cursorOriginalDataUrl;
      if (!original) return;
      try {
        const normalized = await this._normalizeCursorDataUrl(original, { maxSize: cursorSize });
        setCursor(normalized, original);
      } catch (e) {
        console.error("Failed to resize cursor:", e);
      }
    };

    const uploadCursor = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg";
      input.style.display = "none";
      document.body.appendChild(input);

      const cleanup = () => input.remove();

      input.addEventListener("change", async () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) return;

        try {
          if (file.size > 2 * 1024 * 1024) {
            alert("Cursor image too large. Please use a file under 2MB.");
            return;
          }

          const dataUrl = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ""));
            r.onerror = () => reject(new Error("Failed to read file"));
            r.readAsDataURL(file);
          });

          if (!dataUrl.startsWith("data:")) throw new Error("Invalid cursor file.");

          // Browsers are picky about cursor formats and size; normalize to a small PNG.
          const normalized = await this._normalizeCursorDataUrl(dataUrl, { maxSize: this._settings.cursorSize || 32 });
          setCursor(normalized, dataUrl);
        } catch (e) {
          console.error("Cursor upload failed:", e);
          alert("Failed to set cursor. Check console for details.");
        }
      });

      input.click();
    };

    const reset = () => {
      usernameInput.value = this._settings.username;
      weatherToggle.checked = this._settings.weather;
      cycleWallpaperToggle.checked = this._settings.cycleWallpaper;
      macControlsToggle.checked = this._settings.macOsControls;
      clippyToggle.checked = this._settings.clippy;
      achievementsToggle.checked = !this._settings.achievementsDisabled;
      analyticsToggle.checked = !this._settings.analyticsDisabled;
      if (disableDesktopStretchScrollToggle)
        disableDesktopStretchScrollToggle.checked = !!this._settings.disableDesktopStretchScroll;
      showStatus("Reset to saved values");
    };

    const resetToggles = () => {
      const confirmed = confirm("Reset toggles?");
      if (!confirmed) return;

      weatherToggle.checked = true;
      cycleWallpaperToggle.checked = true;
      macControlsToggle.checked = false;
      clippyToggle.checked = false;
      achievementsToggle.checked = true;
      analyticsToggle.checked = true;
      if (disableDesktopStretchScrollToggle) disableDesktopStretchScrollToggle.checked = false;

      save();
      showStatus("Toggles reset");
    };

    resetBtn.addEventListener("click", reset);
    resetTogglesBtn.addEventListener("click", resetToggles);
    deleteAllBtn.addEventListener("click", this.deleteAllData);
    if (exportBtn) exportBtn.addEventListener("click", () => this.exportData(showStatus));
    if (importBtn) importBtn.addEventListener("click", () => this.importData(showStatus));
    if (cursorUploadBtn) cursorUploadBtn.addEventListener("click", uploadCursor);
    if (cursorClearBtn)
      cursorClearBtn.addEventListener("click", () => {
        try {
          localStorage.removeItem(StorageKeys.cursorSizeKey);
        } catch {}
        if (cursorSizeInput) cursorSizeInput.value = "32";
        if (cursorSizeValue) cursorSizeValue.textContent = "32px";
        this._settings.cursorSize = 32;
        setCursor("", "");
      });
    if (cursorSizeInput) {
      cursorSizeInput.value = String(this._settings.cursorSize || 32);
      cursorSizeInput.addEventListener("input", () => {
        if (cursorSizeValue) cursorSizeValue.textContent = `${cursorSizeInput.value}px`;
      });
      cursorSizeInput.addEventListener("change", () => setCursorSize(cursorSizeInput.value));
    }

    usernameInput.addEventListener("blur", save);
    weatherToggle.addEventListener("change", save);
    cycleWallpaperToggle.addEventListener("change", save);
    macControlsToggle.addEventListener("change", save);
    clippyToggle.addEventListener("change", save);
    achievementsToggle.addEventListener("change", save);
    analyticsToggle.addEventListener("change", save);
    if (disableDesktopStretchScrollToggle) disableDesktopStretchScrollToggle.addEventListener("change", save);
  }

  _applyDesktopStretchScrollDisabled(disabled) {
    if (!desktop) return;
    // Keep desktop scroll behavior unchanged; only prevent windows from affecting scroll size
    // by switching windows between absolute (desktop-relative) and fixed (viewport-relative).
    desktop.style.overflow = "auto";

    const desktopRect = desktop.getBoundingClientRect();
    const windows = document.querySelectorAll(".window");
    windows.forEach((win) => {
      if (!(win instanceof HTMLElement)) return;
      const isFullscreen = win.dataset.fullscreen === "true";
      if (isFullscreen) return;

      const rect = win.getBoundingClientRect();
      const currentPos = getComputedStyle(win).position;

      if (disabled) {
        if (currentPos === "fixed") return;
        win.style.left = `${rect.left}px`;
        win.style.top = `${rect.top}px`;
        win.style.position = "fixed";
      } else {
        if (currentPos !== "fixed") return;
        const left = rect.left - desktopRect.left + desktop.scrollLeft;
        const top = rect.top - desktopRect.top + desktop.scrollTop;
        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
        win.style.position = "absolute";
      }
    });
  }

  _applyCursor(dataUrl) {
    const styleId = "yukios-custom-cursor";
    const existing = document.getElementById(styleId);
    if (!dataUrl) {
      existing?.remove();
      return;
    }

    const safeUrl = String(dataUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const css = `
      html, body, body * { cursor: url("${safeUrl}") 0 0, auto !important; }
      input, textarea { cursor: text !important; }
    `;

    const el = existing || document.createElement("style");
    el.id = styleId;
    el.textContent = css;
    if (!existing) document.head.appendChild(el);
    else document.head.appendChild(el);
  }

  async _normalizeCursorDataUrl(dataUrl, { maxSize = 128 } = {}) {
    const MAX = Math.max(16, Math.min(128, Number(maxSize) || 128));
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Failed to decode image"));
        i.src = dataUrl;
      });

      const srcW = img.naturalWidth || img.width || 0;
      const srcH = img.naturalHeight || img.height || 0;
      if (!srcW || !srcH) return dataUrl;

      const scale = Math.min(1, MAX / Math.max(srcW, srcH));
      const w = Math.max(1, Math.round(srcW * scale));
      const h = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return dataUrl;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const png = canvas.toDataURL("image/png");
      return typeof png === "string" && png.startsWith("data:image/png") ? png : dataUrl;
    } catch {
      return dataUrl;
    }
  }

  _dumpStorage(storage) {
    const out = {};
    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        out[key] = storage.getItem(key);
      }
    } catch {}
    return out;
  }

  _restoreStorage(storage, data) {
    if (!data || typeof data !== "object") return;
    try {
      for (const [k, v] of Object.entries(data)) {
        if (typeof k !== "string") continue;
        storage.setItem(k, v);
      }
    } catch {}
  }

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async exportData(showStatus = () => {}) {
    if (!this.fs) {
      alert("Filesystem manager not available; cannot export filesystem data.");
      return;
    }
    try {
      showStatus("Exporting…");
      const fsSnapshot = await this.fs.exportSnapshot();
      const payload = {
        version: 1,
        createdAt: Date.now(),
        localStorage: this._dumpStorage(localStorage),
        sessionStorage: this._dumpStorage(sessionStorage),
        fs: fsSnapshot
      };
      const json = JSON.stringify(payload);
      const blob = new Blob([json], { type: "application/json" });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      this._downloadBlob(blob, `yukiOS-backup-${stamp}.json`);
      showStatus("Exported");
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed. Check console for details.");
      showStatus("Export failed");
    }
  }

  async importData(showStatus = () => {}) {
    if (!this.fs) {
      alert("Filesystem manager not available; cannot import filesystem data.");
      return;
    }
    const confirmed = confirm(
      "Import Data?\n\nThis will overwrite your current settings and filesystem contents.\nThis action cannot be undone."
    );
    if (!confirmed) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);

    const cleanup = () => {
      input.remove();
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) return;

      try {
        showStatus("Importing…");
        const text = await file.text();
        const payload = JSON.parse(text);
        if (!payload || payload.version !== 1 || !payload.fs) throw new Error("Invalid backup file.");

        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {}
        this._restoreStorage(localStorage, payload.localStorage);
        this._restoreStorage(sessionStorage, payload.sessionStorage);
        await this.fs.importSnapshot(payload.fs, { wipe: true });

        showStatus("Imported (reloading)...");
        setTimeout(() => location.reload(), 400);
      } catch (e) {
        console.error("Import failed:", e);
        alert("Import failed. The file may be invalid or corrupted. Check console for details.");
        showStatus("Import failed");
      }
    });

    input.click();
  }

  deleteAllData = async () => {
    const confirmed = confirm(
      "⚠️ WARNING: Delete All Data\n\n" +
        "This will permanently delete:\n" +
        "• All game progresses,saved files, settings, and preferences\n\n" +
        "This action CANNOT be undone!\n\n" +
        "Are you sure you want to continue?"
    );
    if (!confirmed) return;

    try {
      const localStorageKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) localStorageKeys.push(key);
      }

      localStorageKeys.forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove localStorage key: ${key}`, e);
        }
      });

      const sessionStorageKeys = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) sessionStorageKeys.push(key);
      }

      sessionStorageKeys.forEach((key) => {
        try {
          sessionStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove sessionStorage key: ${key}`, e);
        }
      });

      await this._deleteAllIndexedDBDatabases();

      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        } catch (e) {
          console.warn("Failed to clear caches:", e);
        }
      }

      location.reload();
    } catch (error) {
      console.error("Error deleting all data:", error);
      alert("An error occurred while deleting data. Some data may remain. The page will now reload.");
      location.reload();
    }
  };

  _deleteAllIndexedDBDatabases = async () => {
    if (typeof indexedDB.databases === "function") {
      try {
        const databases = await indexedDB.databases();
        const deletePromises = databases.map((dbInfo) => {
          return new Promise((resolve) => {
            if (!dbInfo.name) {
              resolve();
              return;
            }
            const request = indexedDB.deleteDatabase(dbInfo.name);
            request.onsuccess = () => {
              console.log(`Deleted IndexedDB: ${dbInfo.name}`);
              resolve();
            };
            request.onerror = (e) => {
              console.warn(`Failed to delete IndexedDB: ${dbInfo.name}`, e);
              resolve();
            };
            request.onblocked = () => {
              console.warn(`IndexedDB deletion blocked: ${dbInfo.name}`);
              resolve();
            };
          });
        });
        await Promise.all(deletePromises);
        return;
      } catch (e) {
        console.warn("indexedDB.databases() failed, falling back to known names:", e);
      }
    }

    const knownDatabaseNames = this._generateDatabaseNameVariations();

    const deletePromises = knownDatabaseNames.map((dbName) => {
      return new Promise((resolve) => {
        try {
          const request = indexedDB.deleteDatabase(dbName);
          request.onsuccess = () => {
            console.log(`Deleted IndexedDB: ${dbName}`);
            resolve();
          };
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        } catch (e) {
          resolve();
        }
      });
    });

    await Promise.all(deletePromises);
  };
  _generateDatabaseNameVariations = () => {
    const prefixes = ["yuki", "yukiOS", "app", "data", "cache", "store"];
    const suffixes = ["db", "DB", "database", "Database", "store", "Store", "cache", "Cache", "data", "Data"];
    const variations = [];

    prefixes.forEach((prefix) => {
      suffixes.forEach((suffix) => {
        variations.push(`${prefix}-${suffix}`);
        variations.push(`${prefix}_${suffix}`);
        variations.push(`${prefix}${suffix}`);
      });
    });

    return variations;
  };

  resetModuleData = () => {
    const confirmed = confirm("This will reset OS settings defined by the module and reload. Continue?");
    if (!confirmed) return;

    Object.values(StorageKeys).forEach((key) => localStorage.removeItem(key));
    location.reload();
  };

  _applyUsername(username) {
    const start = document.querySelector(".start-user");
    const startSpan = start?.querySelector("span");
    if (startSpan) startSpan.textContent = username;
  }

  updateUsername(username) {
    this._applyUsername(username);
  }

  get(key) {
    return this._settings[key];
  }
}
