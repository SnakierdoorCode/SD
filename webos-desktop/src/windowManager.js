import { desktop } from "./desktop.js";
import { StorageKeys } from "./settings.js";
import { showStartStyleMenu } from "./shared/contextMenu.js";
import { isImageFile } from "./utils.js";
import { audioMixer } from "./audioMixer.js";
import { resolveIconUrl } from "./assetUrl.js";
import { toggleStartMenu } from "./startMenu.js";

export class WorkspaceManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this.workspaces = [{ id: 0, name: "Main", windows: new Set() }];
    this.activeId = 0;
    this._barEl = null;
    this._overviewEl = null;
    this._overviewOpen = false;
    this._dragState = null;
    this._render();
  }

  get active() {
    return this.workspaces.find((w) => w.id === this.activeId);
  }

  _nextId() {
    return this.workspaces.reduce((max, w) => Math.max(max, w.id), -1) + 1;
  }

  _render() {
    if (!this._barEl) {
      this._barEl = document.createElement("div");
      this._barEl.id = "workspace-bar";
      const taskbar = document.getElementById("taskbar");
      taskbar.insertBefore(this._barEl, document.getElementById("system-tray"));
    }

    this._barEl.innerHTML = "";

    const overviewBtn = document.createElement("button");
    overviewBtn.className = "workspace-btn workspace-overview-btn" + (this._overviewOpen ? " active" : "");
    overviewBtn.title = "Workspace Overview";
    overviewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="0" y="0" width="6" height="6" rx="1"/><rect x="8" y="0" width="6" height="6" rx="1"/>
      <rect x="0" y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/>
    </svg>`;
    overviewBtn.addEventListener("click", () => this.toggleOverview());
    this._barEl.appendChild(overviewBtn);

    const sep = document.createElement("div");
    sep.className = "workspace-sep";
    this._barEl.appendChild(sep);

    this.workspaces.forEach((ws) => {
      const btn = document.createElement("button");
      btn.className = "workspace-btn" + (ws.id === this.activeId ? " active" : "");
      btn.textContent = ws.name;
      btn.title = `Switch to ${ws.name} (dblclick to rename)`;

      btn.addEventListener("click", (e) => {
        if (e.target === btn) this.switchTo(ws.id);
      });

      btn.addEventListener("dblclick", () => {
        const newName = prompt("Rename workspace:", ws.name);
        if (newName && newName.trim()) {
          ws.name = newName.trim();
          this._render();
          if (this._overviewOpen) this._renderOverview();
        }
      });

      if (this.workspaces.length > 1) {
        const del = document.createElement("span");
        del.className = "workspace-close";
        del.textContent = "×";
        del.title = "Remove workspace";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          this.removeWorkspace(ws.id);
        });
        btn.appendChild(del);
      }

      this._barEl.appendChild(btn);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "workspace-btn workspace-add";
    addBtn.textContent = "+";
    addBtn.title = "New workspace";
    addBtn.addEventListener("click", () => this.addWorkspace());
    this._barEl.appendChild(addBtn);
  }

  addWorkspace(name) {
    const id = this._nextId();
    this.workspaces.push({ id, name: name || `WS ${id + 1}`, windows: new Set() });
    this._render();
    this.switchTo(id);
    if (this._overviewOpen) this._renderOverview();
  }

  removeWorkspace(id) {
    if (this.workspaces.length <= 1) return;
    const ws = this.workspaces.find((w) => w.id === id);
    if (!ws) return;

    ws.windows.forEach((winId) => {
      const win = document.getElementById(winId);
      if (win) {
        this.wm._silenceWindow(win);
        this.wm.removeFromTaskbar(winId);
        win.remove();
      }
    });

    this.workspaces = this.workspaces.filter((w) => w.id !== id);

    if (this.activeId === id) {
      this.activeId = this.workspaces[this.workspaces.length - 1].id;
    }

    this._render();
    this._applyVisibility();
    if (this._overviewOpen) this._renderOverview();
  }

  registerWindow(winId) {
    this.active?.windows.add(winId);
  }

  unregisterWindow(winId) {
    this.workspaces.forEach((ws) => ws.windows.delete(winId));
  }

  switchTo(id) {
    this.activeId = id;
    this._applyVisibility();
    this._render();
    if (this._overviewOpen) this.closeOverview();
  }

  _applyVisibility() {
    this.workspaces.forEach((ws) => {
      const isActive = ws.id === this.activeId;
      ws.windows.forEach((winId) => {
        const win = document.getElementById(winId);
        const taskItem = document.getElementById(`taskbar-${winId}`);
        if (win) win.style.visibility = isActive ? "" : "hidden";
        if (win) win.style.pointerEvents = isActive ? "" : "none";
        if (taskItem) taskItem.style.display = isActive ? "" : "none";
      });
    });
  }

  moveWindowTo(winId, targetWorkspaceId) {
    this.unregisterWindow(winId);
    const target = this.workspaces.find((w) => w.id === targetWorkspaceId);
    if (target) target.windows.add(winId);
    this._applyVisibility();
    if (this._overviewOpen) this._renderOverview();
  }

  toggleOverview() {
    if (this._overviewOpen) {
      this.closeOverview();
    } else {
      this.openOverview();
    }
  }

  openOverview() {
    this._overviewOpen = true;
    this._render();

    if (!this._overviewEl) {
      this._overviewEl = document.createElement("div");
      this._overviewEl.id = "workspace-overview";
      document.body.appendChild(this._overviewEl);
    }

    this._overviewEl.style.display = "flex";
    this._renderOverview();

    this._escHandler = (e) => {
      if (e.key === "Escape") this.closeOverview();
    };
    document.addEventListener("keydown", this._escHandler);
  }

  closeOverview() {
    this._overviewOpen = false;
    if (this._overviewEl) this._overviewEl.style.display = "none";
    document.removeEventListener("keydown", this._escHandler);
    this._render();
  }

  _renderOverview() {
    const el = this._overviewEl;
    el.innerHTML = "";

    const desktop = document.getElementById("desktop");
    const dw = desktop.offsetWidth;
    const dh = desktop.offsetHeight;
    const taskbarH = document.getElementById("taskbar")?.offsetHeight ?? 20;
    const vpW = window.innerWidth;
    const vpH = window.innerHeight - taskbarH;

    const count = this.workspaces.length;
    const panelGap = 24;
    const panelMaxW = Math.min(Math.floor((vpW - panelGap * (count + 1)) / count), 420);
    const panelH = Math.round(panelMaxW * (vpH / vpW));
    const scaleX = panelMaxW / dw;
    const scaleY = panelH / dh;
    const scale = Math.min(scaleX, scaleY);

    this.workspaces.forEach((ws) => {
      const panel = document.createElement("div");
      panel.className = "ov-panel" + (ws.id === this.activeId ? " ov-active" : "");
      panel.dataset.wsId = ws.id;
      panel.style.width = panelMaxW + "px";
      panel.style.height = panelH + "px";

      const label = document.createElement("div");
      label.className = "ov-label";
      label.textContent = ws.name;
      panel.appendChild(label);

      const canvas = document.createElement("div");
      canvas.className = "ov-canvas";
      canvas.style.width = dw + "px";
      canvas.style.height = dh + "px";
      canvas.style.transform = `scale(${scale})`;
      canvas.style.transformOrigin = "top left";
      panel.appendChild(canvas);

      ws.windows.forEach((winId) => {
        const realWin = document.getElementById(winId);
        if (!realWin) return;

        const entry = this.wm.openWindows.get(winId);
        const title = entry?.title ?? winId;

        const thumb = document.createElement("div");
        thumb.className = "ov-window";
        thumb.dataset.winId = winId;
        thumb.style.left = realWin.style.left;
        thumb.style.top = realWin.style.top;
        thumb.style.width = realWin.style.width;
        thumb.style.height = realWin.style.height;
        thumb.style.zIndex = realWin.style.zIndex;

        const thumbHeader = document.createElement("div");
        thumbHeader.className = "ov-window-header";
        thumbHeader.textContent = title;
        thumb.appendChild(thumbHeader);

        const thumbBody = document.createElement("div");
        thumbBody.className = "ov-window-body";
        thumb.appendChild(thumbBody);

        this._makeThumbDraggable(thumb, winId, ws.id, panel, scale);

        canvas.appendChild(thumb);
      });

      panel.addEventListener("click", (e) => {
        if (e.target === panel || e.target === canvas || e.target === label) {
          this.switchTo(ws.id);
        }
      });

      panel.addEventListener("dragover", (e) => {
        e.preventDefault();
        panel.classList.add("ov-drop-target");
      });

      panel.addEventListener("dragleave", () => {
        panel.classList.remove("ov-drop-target");
      });

      panel.addEventListener("drop", (e) => {
        e.preventDefault();
        panel.classList.remove("ov-drop-target");
        const winId = e.dataTransfer.getData("text/plain");
        if (winId) this.moveWindowTo(winId, ws.id);
      });

      el.appendChild(panel);
    });

    const addPanelBtn = document.createElement("button");
    addPanelBtn.className = "ov-add-ws";
    addPanelBtn.textContent = "+ New Workspace";
    addPanelBtn.addEventListener("click", () => this.addWorkspace());
    el.appendChild(addPanelBtn);
  }

  _makeThumbDraggable(thumb, winId, fromWsId, fromPanel, scale) {
    thumb.draggable = true;

    thumb.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", winId);
      e.dataTransfer.effectAllowed = "move";
      thumb.classList.add("ov-dragging");
    });

    thumb.addEventListener("dragend", () => {
      thumb.classList.remove("ov-dragging");
      document.querySelectorAll(".ov-drop-target").forEach((p) => p.classList.remove("ov-drop-target"));
    });

    thumb.addEventListener("click", (e) => {
      e.stopPropagation();
      this.moveWindowTo(winId, this.activeId);
      this.switchTo(fromWsId);
    });
  }
}

const styleEl = document.getElementById("window-style");
let styleParent = styleEl.parentNode;

function hideTransparency() {
  if (styleEl.parentNode) styleParent.removeChild(styleEl);
}

function restoreTransparency() {
  if (!styleEl.parentNode) styleParent.appendChild(styleEl);
}

export class WindowManager {
  constructor(notificationCenter = null) {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
    this.isDraggingWindow = false;
    this.notificationCenter = notificationCenter;
    this.initialTitle = document.title || "YukiOS";
    const faviconLink = document.querySelector("link[rel~='icon']");
    this.initialFavicon = faviconLink ? faviconLink.href : "";
    this._snapGhost = null;
    this._activeSnapZone = null;
    this._snapThreshold = 60;
    this._taskbarPreview = null;
    this._taskbarPreviewWinId = null;
    this._taskbarPreviewHideTimer = null;
    this._taskbarPreviewShowTimer = null;
    this._taskbarPreviewHovering = false;
    this._initSnapGhost();
    this._initVisibilityTracking();
    this.workspaceManager = new WorkspaceManager(this);
    this._lastFocusZone = "desktop";
    this._initStartMenuKeybinds();
    setTimeout(() => {
      audioMixer.init();
    }, 0);
    document.addEventListener("keydown", (e) => {
      if (
        e.key.toLowerCase() === "d" &&
        e.metaKey === false &&
        e.ctrlKey === false &&
        e.altKey === false &&
        e.shiftKey === false &&
        e.getModifierState("Meta") === false &&
        e.getModifierState("Control") === false &&
        e.getModifierState("Alt") === false &&
        e.getModifierState("Shift") === false &&
        e.getModifierState("OS")
      )
        return;
      if (e.key.toLowerCase() === "d" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();

        const allWindows = Array.from(this.openWindows.keys())
          .map((id) => document.getElementById(id))
          .filter(Boolean);

        const anyVisible = allWindows.some((w) => w.style.display !== "none");

        if (anyVisible) {
          allWindows.forEach((win) => this.minimizeWindow(win));
        } else {
          allWindows.forEach((win) => {
            win.style.display = "block";
            const taskbarItem = document.getElementById(`taskbar-${win.id}`);
            if (taskbarItem) taskbarItem.classList.remove("minimized");
          });
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      if (!e.metaKey && !e.ctrlKey) return;
      const focused = Array.from(this.openWindows.keys())
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .sort((a, b) => parseInt(b.style.zIndex) - parseInt(a.style.zIndex))[0];
      if (!focused) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        this._applySnap(focused, "left");
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        this._applySnap(focused, "right");
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        this._applySnap(focused, "maximize");
      }
    });
  }

  _initStartMenuKeybinds() {
    document.addEventListener(
      "pointerdown",
      (e) => {
        const target = e.target;
        if (target?.closest?.(".window")) this._lastFocusZone = "window";
        else if (target?.closest?.("#start-menu")) this._lastFocusZone = "start-menu";
        else this._lastFocusZone = "desktop";

        if (this._lastFocusZone === "desktop") {
          this.openWindows.forEach(({ taskbarItem }) => taskbarItem?.classList?.remove("active"));
        }
      },
      { capture: true }
    );

    document.addEventListener("keydown", (e) => {
      if (!this._shouldOpenStartMenuFromKeyEvent(e)) return;
      e.preventDefault();
      toggleStartMenu({ focusSearch: true, openDefaultPage: true });
    });
  }

  _shouldOpenStartMenuFromKeyEvent(e) {
    const key = e.key;
    const isTrigger = key === "Control" || key === "Tab" || key === " " || key === "Spacebar";
    if (!isTrigger) return false;

    const otherMods = e.altKey || e.metaKey || e.shiftKey;
    if (otherMods) return false;

    if (key !== "Control" && e.ctrlKey) return false;

    const active = document.activeElement;
    if (active) {
      const tag = active.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable === true;
      if (isEditable) return false;
      if (tag === "IFRAME") return false;
      if (active.closest?.(".window")) return false;
      if (active.closest?.("#start-menu")) return false;
    }

    if (this._lastFocusZone !== "desktop") return false;

    const anyWindowActive = Array.from(this.openWindows.values()).some((v) =>
      v.taskbarItem?.classList?.contains("active")
    );
    if (anyWindowActive) return false;

    return true;
  }

  applyWindowLayout(win) {
    const root = win.querySelector(".browser-root");
    if (!root) return;

    const header = win.querySelector(".window-header");
    const tabbar = root.querySelector(".browser-tabbar");

    if (!header || !tabbar) return;

    const controls = header.querySelector(".window-controls");
    if (!controls) return;

    tabbar.appendChild(controls);

    header.style.display = "none";

    controls.style.marginLeft = "auto";
    controls.style.display = "flex";
    controls.style.alignItems = "center";
    controls.style.height = "100%";
  }

  setNotificationCenter(notificationCenter) {
    this.notificationCenter = notificationCenter;
  }

  notify(title, message, type = "info", duration = 5000, icon = null) {
    if (this.notificationCenter) {
      this.notificationCenter.addNotification(title, message, type, duration, icon);
    } else {
      console.warn("Notification Center not initialized");
      this.sendNotify(message);
    }
  }

  updateTransparency() {
    if (this.gameWindowCount > 0 || !window._settings.transparency) {
      hideTransparency();
    } else {
      restoreTransparency();
    }
  }

  _resolveIconType(iconValue) {
    const isDataUrl = typeof iconValue === "string" && iconValue.startsWith("data:");
    const isHttpUrl = typeof iconValue === "string" && /^https?:\/\//.test(iconValue);
    return {
      isImage: isImageFile(iconValue) || isHttpUrl,
      isDataUrl
    };
  }

  _getFaviconLink() {
    let link = document.querySelector("link[rel~='icon']");
    return link;
  }

  _animateAndRemove(win) {
    win.style.animation = "popUp 0.5s ease forwards";
    setTimeout(() => win.remove(), 500);
  }
  _buildPropertiesWindow(winId) {
    const win = document.getElementById(winId);
    if (!win) return;

    const appInfo = this.openWindows.get(winId);
    if (!appInfo) return;

    const content = win.querySelector(".window-content");
    if (!content) return;

    const existingOverlay = win.querySelector(":scope > .window-props-overlay");
    if (existingOverlay) {
      try {
        existingOverlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    }

    const dataset = win.dataset;
    const rect = win.getBoundingClientRect();

    const info = {
      identity: [
        ["Window ID", winId],
        ["Title", appInfo.title],
        ["Type", dataset.appType || "—"],
        ["App ID", dataset.appId || "—"],
        ["URL", dataset.externalUrl || "—"]
      ],
      geometry: [
        ["Width", `${Math.round(rect.width)}px`],
        ["Height", `${Math.round(rect.height)}px`],
        ["Left", `${Math.round(rect.left)}px`],
        ["Top", `${Math.round(rect.top)}px`]
      ],
      system: [
        ["Z-Index", win.style.zIndex || "—"],
        ["Fullscreen", dataset.fullscreen === "true" ? "Yes" : "No"],
        ["SWF", dataset.swf || "—"],
        ["ROM", dataset.rom || "—"],
        ["Core", dataset.core || "—"]
      ]
    };

    const buildSection = (title, rows) => `
    <div class="props-section">
      <div class="props-section-title">${title}</div>
      ${rows
        .map(
          ([k, v]) => `
        <div class="props-row">
          <div class="props-key">${k}</div>
          <div class="props-val">${v}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

    const overlayHtml = `
    <style>
      .window-props-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: rgba(12, 12, 16, 0.96);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 9999;
      }

      .window-props-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        user-select: none;
      }

      .window-props-title {
        font-size: 13px;
        color: rgba(255,255,255,0.9);
        font-weight: 600;
      }

      .window-props-close {
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.9);
        padding: 6px 10px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
      }

      .window-props-close:hover {
        background: rgba(255,255,255,0.1);
      }

      .props-content {
        padding: 12px;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        color: #e6e6e6;
        display: flex;
        flex-direction: column;
        gap: 12px;
        overflow: auto;
      }

      .props-section {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 10px;
        padding: 10px;
      }

      .props-section-title {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.6);
        margin-bottom: 8px;
      }

      .props-row {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        padding: 4px 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }

      .props-row:last-child {
        border-bottom: none;
      }

      .props-key {
        color: rgba(255,255,255,0.6);
      }

      .props-val {
        color: #fff;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        text-align: right;
        max-width: 60%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    </style>

    <div class="window-props-header">
      <div class="window-props-title">Properties</div>
      <button type="button" class="window-props-close">Close</button>
    </div>
    <div class="props-content">
      ${buildSection("Identity", info.identity)}
      ${buildSection("Geometry", info.geometry)}
      ${buildSection("System", info.system)}
    </div>
  `;

    const overlay = document.createElement("div");
    overlay.className = "window-props-overlay";
    overlay.innerHTML = overlayHtml;

    if (!content.dataset.prevDisplay) content.dataset.prevDisplay = content.style.display || "";
    content.style.display = "none";

    win.appendChild(overlay);
    overlay.querySelector(".window-props-close")?.addEventListener("click", () => {
      try {
        overlay.remove();
      } finally {
        content.style.display = content.dataset.prevDisplay || "";
        delete content.dataset.prevDisplay;
      }
    });
  }
  _buildContextMenuItems(addMenuItem, addSeparator, win) {
    const winId = win.id;
    const isMinimized = win.style.display === "none";
    const isFullscreen = win.dataset.fullscreen === "true";

    addMenuItem(
      isMinimized ? "Restore" : "Minimize",
      () => {
        if (isMinimized) win.style.display = "block";
        else this.minimizeWindow(win);
        this.bringToFront(win);
      },
      isMinimized ? "fa-window-restore" : "fa-window-minimize"
    );

    addMenuItem(
      isFullscreen ? "Restore Size" : "Maximize",
      () => {
        this.toggleFullscreen(win);
        this.bringToFront(win);
      },
      isFullscreen ? "fa-compress" : "fa-window-maximize"
    );

    addMenuItem("Bring to Front", () => this.bringToFront(win), "fa-layer-group");

    addSeparator();

    addMenuItem("Snap Left", () => this._applySnap(win, "left"), "fa-columns");
    addMenuItem("Snap Right", () => this._applySnap(win, "right"), "fa-columns");
    addMenuItem("Snap Maximize", () => this._applySnap(win, "maximize"), "fa-expand-arrows-alt");

    addSeparator();

    if (this.workspaceManager && this.workspaceManager.workspaces.length > 1) {
      this.workspaceManager.workspaces.forEach((ws) => {
        if (ws.id !== this.workspaceManager.activeId) {
          addMenuItem(
            `Move to ${ws.name}`,
            () => {
              this.workspaceManager.moveWindowTo(winId, ws.id);
            },
            "fa-exchange-alt"
          );
        }
      });
      addSeparator();
    }

    addMenuItem("Properties", () => this._buildPropertiesWindow(winId), "fa-info-circle");

    addSeparator();

    addMenuItem(
      "Close Window",
      () => {
        const winToClose = document.getElementById(winId);
        if (winToClose) {
          this._silenceWindow(winToClose);
          this.removeFromTaskbar(winId);
          this._animateAndRemove(winToClose);
        }
      },
      "fa-times-circle"
    );
  }

  getOpenWindowCount() {
    return this.openWindows.size;
  }

  createWindow(id, title, width = "80vw", height = "80vh", isGame = false) {
    window.achievements.incrementWindowOpen();
    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";

    const widthStr = width != null ? String(width) : "80vw";
    const heightStr = height != null ? String(height) : "80vh";

    const vw = widthStr.includes("vw") ? (window.innerWidth * parseFloat(widthStr)) / 100 : parseInt(widthStr);
    const vh = heightStr.includes("vh") ? (window.innerHeight * parseFloat(heightStr)) / 100 : parseInt(heightStr);

    let disableDesktopStretchScroll = false;
    try {
      disableDesktopStretchScroll = localStorage.getItem(StorageKeys.disableDesktopStretchScroll) === "true";
    } catch {}

    Object.assign(win.style, {
      width: `${vw}px`,
      height: `${vh}px`,
      left: "25vw",
      top: "5vh",
      position: disableDesktopStretchScroll ? "fixed" : "absolute",
      zIndex: this.zIndexCounter++
    });

    if (isGame) this.gameWindowCount++;
    this.updateTransparency();
    if (win.id === "yukiOS-settings") {
      setTimeout(() => {
        win.click();
      }, 0);
    }
    win.addEventListener("mousedown", () => this.bringToFront(win));

    return win;
  }

  mountWindow(win, winId, title, iconValue, color = null) {
    window.achievements.incrementWindowOpen();
    this.makeDraggable(win);
    this.makeResizable(win);
    this.setupWindowControls(win);
    this.addToTaskbar(winId, title, iconValue, color);
    this.bringToFront(win);
  }

  getWindowIconHtml(iconValue, color = null) {
    if (!iconValue) return "";
    iconValue = resolveIconUrl(iconValue);
    const size = 30;
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      return `<img src="${iconValue}" style="width:${size}px;height:${size}px;margin-right:6px;vertical-align:middle;object-fit:contain;" />`;
    } else if (typeof iconValue === "string" && iconValue.length > 0) {
      const cls = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      const clr = color ?? "white";
      return `<i class="${cls}" style="color:${clr};margin-right:6px;font-size:${size}px;vertical-align:middle;"></i>`;
    }
    return "";
  }

  _buildTaskbarIcon(iconValue, title, color) {
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);

    if (isImage || isDataUrl) {
      const icon = document.createElement("img");
      icon.src = iconValue;
      icon.onerror = () => {
        const fallback = document.createElement("i");
        fallback.className = "fas fa-window-maximize";
        fallback.style.color = color ?? "white";
        icon.replaceWith(fallback);
      };
      return icon;
    }

    const icon = document.createElement("i");
    icon.alt = title;

    if (typeof iconValue === "string" && iconValue.length > 0) {
      icon.className = iconValue.startsWith("fa") ? iconValue : `fa ${iconValue}`;
      icon.style.color = color ?? "white";
    } else {
      icon.className = "fas fa-window-maximize";
      icon.style.color = "white";
    }

    return icon;
  }

  addToTaskbar(winId, title, iconValue, color = null) {
    if (document.getElementById(`taskbar-${winId}`)) return;
    if (iconValue === "fas fa-video") color = "6677dd";

    iconValue = resolveIconUrl(iconValue);

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";
    taskbarItem.appendChild(this._buildTaskbarIcon(iconValue, title, color));

    taskbarItem.onclick = () => {
      const win = document.getElementById(winId);
      if (!win) return;
      if (win.style.display === "none") {
        win.style.display = "block";
        taskbarItem.classList.remove("minimized");
      }
      this.bringToFront(win);
    };

    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      const win = document.getElementById(winId);
      showStartStyleMenu(e, (addMenuItem, addSeparator) => this._buildContextMenuItems(addMenuItem, addSeparator, win));
    };

    const taskbarWindows = document.getElementById("taskbar-windows");
    taskbarWindows.appendChild(taskbarItem);
    this.openWindows.set(winId, { taskbarItem, title, iconValue, color });
    this.workspaceManager?.registerWindow(winId);

    audioMixer.registerWindow(winId, title, audioMixer.getIconHtmlForTaskbar(null, iconValue));

    const win = document.getElementById(winId);
    if (win) {
      const headerSpan = win.querySelector(".window-header > span");
      if (headerSpan) {
        const iconHtml = this.getWindowIconHtml(iconValue, color);
        if (iconHtml) {
          const temp = document.createElement("div");
          temp.innerHTML = iconHtml;
          const iconEl = temp.firstElementChild;
          if (iconEl) headerSpan.insertBefore(iconEl, headerSpan.firstChild);
        }
      }
    }

    taskbarItem.addEventListener("mouseenter", () => {
      if (this._taskbarPreviewShowTimer) clearTimeout(this._taskbarPreviewShowTimer);
      this._taskbarPreviewShowTimer = setTimeout(() => {
        this._showTaskbarPreview(winId, taskbarItem);
      }, 220);
    });

    taskbarItem.addEventListener("mouseleave", () => {
      if (this._taskbarPreviewShowTimer) clearTimeout(this._taskbarPreviewShowTimer);
      this._scheduleHideTaskbarPreview();
    });
  }

  _scheduleHideTaskbarPreview() {
    if (this._taskbarPreviewHideTimer) clearTimeout(this._taskbarPreviewHideTimer);
    this._taskbarPreviewHideTimer = setTimeout(() => {
      if (!this._taskbarPreviewHovering) this._hideTaskbarPreview();
    }, 160);
  }

  _hideTaskbarPreview() {
    if (!this._taskbarPreview) return;
    this._taskbarPreview.remove();
    this._taskbarPreview = null;
    this._taskbarPreviewWinId = null;
    this._taskbarPreviewHovering = false;
  }

  _showTaskbarPreview(winId, anchorEl) {
    const win = document.getElementById(winId);
    if (!win || !anchorEl) return;

    if (this._taskbarPreviewWinId !== winId) this._hideTaskbarPreview();

    const meta = this.openWindows.get(winId);
    const title = meta?.title || winId;

    const preview = document.createElement("div");
    preview.className = "taskbar-preview";
    preview.dataset.winId = winId;
    preview.innerHTML = `
      <div class="taskbar-preview__title"></div>
      <div class="taskbar-preview__thumb"></div>
    `;
    preview.querySelector(".taskbar-preview__title").textContent = title;

    const thumb = preview.querySelector(".taskbar-preview__thumb");
    const clone = win.cloneNode(true);
    clone.removeAttribute("id");
    clone.classList.add("taskbar-preview__winclone");
    clone.style.position = "relative";
    clone.style.left = "0";
    clone.style.top = "0";
    clone.style.right = "auto";
    clone.style.bottom = "auto";
    clone.style.margin = "0";
    clone.style.maxWidth = "none";
    clone.style.maxHeight = "none";
    clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
    clone.querySelectorAll(".window-controls").forEach((n) => n.remove());
    clone.querySelectorAll("input,textarea,button,select").forEach((n) => n.setAttribute("disabled", "disabled"));
    thumb.appendChild(clone);

    document.body.appendChild(preview);
    this._taskbarPreview = preview;
    this._taskbarPreviewWinId = winId;

    const rect = anchorEl.getBoundingClientRect();
    const pRect = preview.getBoundingClientRect();

    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - pRect.width / 2, window.innerWidth - pRect.width - 8)
    );
    const top = Math.max(8, rect.top - pRect.height - 10);

    preview.style.left = `${left}px`;
    preview.style.top = `${top}px`;

    const winRect = win.getBoundingClientRect();
    const innerW = 360 - 20;
    const innerH = 210 - 20;
    const scaleX = innerW / Math.max(1, winRect.width);
    const scaleY = innerH / Math.max(1, winRect.height);
    const scale = Math.min(scaleX, scaleY, 0.32);
    clone.style.transformOrigin = "top left";
    clone.style.transform = `scale(${scale})`;

    preview.addEventListener("mouseenter", () => {
      this._taskbarPreviewHovering = true;
      if (this._taskbarPreviewHideTimer) clearTimeout(this._taskbarPreviewHideTimer);
    });
    preview.addEventListener("mouseleave", () => {
      this._taskbarPreviewHovering = false;
      this._scheduleHideTaskbarPreview();
    });

    preview.addEventListener("mousedown", (e) => e.preventDefault());
    preview.addEventListener("click", () => {
      const w = document.getElementById(winId);
      if (!w) return;
      if (w.style.display === "none") {
        w.style.display = "block";
        const taskbarItem = document.getElementById(`taskbar-${winId}`);
        if (taskbarItem) taskbarItem.classList.remove("minimized");
      }
      this.bringToFront(w);
      this._hideTaskbarPreview();
    });
  }

  registerCloseWindow(closeButton, winId) {
    closeButton.addEventListener("click", () => {
      const win = document.getElementById(winId);
      if (!win) return;
      this._animateAndRemove(win);
      this.removeFromTaskbar(winId);
    });
  }

  updatePageFavicon(iconValue, title) {
    document.title = title || this.initialTitle;
    const link = this._getFaviconLink();
    iconValue = resolveIconUrl(iconValue);
    const { isImage, isDataUrl } = this._resolveIconType(iconValue);
    if (isImage || isDataUrl) {
      link.href = iconValue;
    } else {
      link.href = this.initialFavicon || "";
    }
  }

  resetToDefaultState() {
    document.title = this.initialTitle;
    const link = this._getFaviconLink();
    link.href = this.initialFavicon || "";
  }

  _initVisibilityTracking() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        document.title = this.initialTitle;
        this._getFaviconLink().href = this.initialFavicon || "";
      } else {
        if (this.openWindows.size === 0) {
          this.resetToDefaultState();
        } else {
          const activeEntry =
            Array.from(this.openWindows.values()).findLast((entry) =>
              entry.taskbarItem?.classList.contains("active")
            ) ?? Array.from(this.openWindows.values()).pop();
          if (activeEntry) this.updatePageFavicon(activeEntry.iconValue, activeEntry.title);
        }
      }
    });
  }

  bringToFront(win) {
    if (!win) return;

    this.openWindows.forEach(({ taskbarItem }) => taskbarItem.classList.remove("active"));

    const entry = this.openWindows.get(win.id);
    if (entry?.taskbarItem) {
      entry.taskbarItem.classList.add("active");
      entry.taskbarItem.classList.remove("minimized");
      this.updatePageFavicon(entry.iconValue, entry.title);
      document.title = entry.title || "YukiOS";
    }

    win.style.zIndex = this.zIndexCounter++;
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    this.openWindows.delete(winId);
    this.workspaceManager?.unregisterWindow(winId);
    audioMixer.unregisterWindow(winId);

    if (this.openWindows.size === 0) {
      this.resetToDefaultState();
    } else {
      const lastWin = Array.from(this.openWindows.values()).pop();
      if (lastWin) this.updatePageFavicon(lastWin.iconValue, lastWin.title);
    }
  }

  minimizeWindow(win) {
    win.style.display = "none";
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) {
      taskbarItem.classList.remove("active");
      taskbarItem.classList.add("minimized");
    }
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";
    const header = win.querySelector(".window-header");

    if (wasFullscreen) {
      if (document.fullscreenElement === win) document.exitFullscreen();

      Object.assign(win.style, {
        width: win.dataset.prevWidth,
        height: win.dataset.prevHeight,
        left: win.dataset.prevLeft,
        top: win.dataset.prevTop
      });

      if (header) header.style.display = "";
      win.dataset.fullscreen = "false";
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top
      });

      const makeFullscreen = () => {
        Object.assign(win.style, { width: "100vw", height: "100vh", left: "0", top: "0" });
        if (header) header.style.display = "none";
      };

      if (win.requestFullscreen) {
        win.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
      } else {
        makeFullscreen();
      }

      win.dataset.fullscreen = "true";

      const onFullscreenChange = () => {
        if (!document.fullscreenElement) {
          if (header) header.style.display = "";
          win.dataset.fullscreen = "false";
          document.removeEventListener("fullscreenchange", onFullscreenChange);
        }
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
  }

  setupWindowControls(win) {
    win.querySelector(".close-btn").onclick = () => {
      this._silenceWindow(win);
      this.removeFromTaskbar(win.id);
      if (win.dataset.isGame === "true") {
        this.gameWindowCount = Math.max(0, this.gameWindowCount - 1);
      }
      this.updateTransparency();
      this._animateAndRemove(win);
    };
    win.querySelector(".minimize-btn").onclick = () => this.minimizeWindow(win);
    win.querySelector(".maximize-btn").onclick = () => this.toggleFullscreen(win);
    const downloadBtn = win.querySelector(".download-btn");
    if (downloadBtn) downloadBtn.onclick = () => this._downloadWindowContent(win);
  }

  _silenceWindow(win) {
    const iframes = win.querySelectorAll("iframe");
    iframes.forEach((iframe) => {
      try {
        iframe.src = "about:blank";
        iframe.remove();
      } catch (e) {
        iframe.src = "about:blank";
      }
    });

    const media = win.querySelectorAll("video, audio");
    media.forEach((m) => {
      m.pause();
      m.src = "";
      m.load();
      m.remove();
    });
  }

  _showWindowContextMenu(e, win) {
    showStartStyleMenu(e, (addMenuItem, addSeparator) => this._buildContextMenuItems(addMenuItem, addSeparator, win));
  }

  _initSnapGhost() {
    const ghost = document.createElement("div");
    ghost.id = "snap-ghost";
    document.getElementById("desktop").appendChild(ghost);
    this._snapGhost = ghost;
  }

  _getSnapZone(x, y) {
    const t = this._snapThreshold;
    const dw = window.innerWidth;
    const taskbarH = document.getElementById("taskbar")?.offsetHeight ?? 10;
    const dh = window.innerHeight - taskbarH;
    const atLeft = x < t;
    const atRight = x > dw - t;
    const atTop = y < t;
    const atBottom = y > dh - t;
    if (atTop && atLeft) return "top-left";
    if (atTop && atRight) return "top-right";
    if (atBottom && atLeft) return "bottom-left";
    if (atBottom && atRight) return "bottom-right";
    if (atTop) return "maximize";
    if (atLeft) return "left";
    if (atRight) return "right";
    return null;
  }

  _getSnapRect(zone) {
    const taskbarH = document.getElementById("taskbar")?.offsetHeight ?? 10;
    const dw = window.innerWidth;
    const dh = window.innerHeight - taskbarH;
    const half = { width: dw / 2, height: dh };
    const quarter = { width: dw / 2, height: dh / 2 };
    const map = {
      left: { left: 0, top: 0, width: dw / 2, height: dh },
      right: { left: dw / 2, top: 0, width: dw / 2, height: dh },
      maximize: { left: 0, top: 0, width: dw, height: dh },
      "top-left": { left: 0, top: 0, ...quarter },
      "top-right": { left: dw / 2, top: 0, ...quarter },
      "bottom-left": { left: 0, top: dh / 2, ...quarter },
      "bottom-right": { left: dw / 2, top: dh / 2, ...quarter }
    };
    return map[zone] ?? null;
  }

  _showSnapGhost(zone) {
    const rect = this._getSnapRect(zone);
    if (!rect) {
      this._hideSnapGhost();
      return;
    }
    Object.assign(this._snapGhost.style, {
      display: "block",
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px"
    });
  }

  _hideSnapGhost() {
    if (this._snapGhost) this._snapGhost.style.display = "none";
  }

  _applySnap(win, zone) {
    const rect = this._getSnapRect(zone);
    if (!rect) return;
    if (win.dataset.snapZone !== zone) {
      win.dataset.preSnapLeft = win.style.left;
      win.dataset.preSnapTop = win.style.top;
      win.dataset.preSnapWidth = win.style.width;
      win.dataset.preSnapHeight = win.style.height;
    }
    Object.assign(win.style, {
      left: rect.left + "px",
      top: rect.top + "px",
      width: rect.width + "px",
      height: rect.height + "px"
    });
    win.dataset.snapZone = zone;
    win.dataset.fullscreen = zone === "maximize" ? "true" : "false";
  }

  _unsnap(win) {
    if (!win.dataset.snapZone) return;
    if (win.dataset.preSnapWidth) win.style.width = win.dataset.preSnapWidth;
    if (win.dataset.preSnapHeight) win.style.height = win.dataset.preSnapHeight;
    delete win.dataset.snapZone;
    delete win.dataset.preSnapLeft;
    delete win.dataset.preSnapTop;
    delete win.dataset.preSnapWidth;
    delete win.dataset.preSnapHeight;
    win.dataset.fullscreen = "false";
  }

  makeDraggable(win) {
    const headers = win.querySelectorAll(".window-header");
    const tabbar = win.querySelector(".browser-tabbar");

    const isInteractive = (target) => {
      return !!target.closest(
        "button, input, select, textarea, .browser-tab, .tab-close, .tab-new-btn, .steam-menu-item, .steam-user-profile, .steam-notifications"
      );
    };

    const isDesktopStretchScrollDisabled = () => {
      try {
        return localStorage.getItem(StorageKeys.disableDesktopStretchScroll) === "true";
      } catch {
        return false;
      }
    };

    const startDrag = (e, handle) => {
      if (e.button !== 0) return;
      if (isInteractive(e.target)) return;

      this.bringToFront(win);
      e.preventDefault();
      e.stopPropagation();

      this.isDraggingWindow = true;
      document.body.classList.add("is-dragging");

      const wasSnapped = !!win.dataset.snapZone;
      const disableStretch = isDesktopStretchScrollDisabled();

      if (disableStretch) {
        // Fixed windows don't affect desktop scroll size.
        if (getComputedStyle(win).position !== "fixed") {
          const rect = win.getBoundingClientRect();
          win.style.left = `${rect.left}px`;
          win.style.top = `${rect.top}px`;
          win.style.position = "fixed";
        }
      } else if (getComputedStyle(win).position === "fixed") {
        // Convert back to desktop-relative positioning.
        const rect = win.getBoundingClientRect();
        const desktopRect = desktop.getBoundingClientRect();
        const left = rect.left - desktopRect.left + desktop.scrollLeft;
        const top = rect.top - desktopRect.top + desktop.scrollTop;
        win.style.left = `${left}px`;
        win.style.top = `${top}px`;
        win.style.position = "absolute";
      }

      const winRect = win.getBoundingClientRect();
      const ox = e.clientX - winRect.left;
      const oy = e.clientY - winRect.top;

      if (wasSnapped) this._unsnap(win);

      document.onmousemove = (e) => {
        win.style.left = `${e.clientX - ox}px`;
        win.style.top = `${e.clientY - oy}px`;

        const zone = this._getSnapZone(e.clientX, e.clientY);
        this._activeSnapZone = zone;

        if (zone) this._showSnapGhost(zone);
        else this._hideSnapGhost();
      };

      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;

        this.isDraggingWindow = false;
        document.body.classList.remove("is-dragging");
        this._hideSnapGhost();

        if (this._activeSnapZone) {
          this._applySnap(win, this._activeSnapZone);
          this._activeSnapZone = null;
        }
      };
    };

    const attachHandle = (el) => {
      if (!el) return;

      el.addEventListener("mousedown", (e) => startDrag(e, el));

      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this._showWindowContextMenu(e, win);
      });
    };

    headers.forEach((h) => attachHandle(h));
    attachHandle(tabbar);

    document.addEventListener("mousedown", (e) => {
      if (!win.contains(e.target)) return;
      if (e.target.tagName === "BUTTON") return;
      this.bringToFront(win);
    });

    const attachIframeListeners = () => {
      const iframes = win.querySelectorAll("iframe");

      iframes.forEach((iframe) => {
        const onLoad = () => {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.addEventListener("mousedown", () => {
              this.bringToFront(win);
            });
          } catch (e) {}

          audioMixer.patchIframeAudioContext(win.id, iframe);
        };

        if (iframe.contentDocument?.readyState === "complete") {
          onLoad();
        } else {
          iframe.addEventListener("load", onLoad);
        }
      });
    };

    attachIframeListeners();
  }

  makeResizable(win, setHeightUnsetElement = null) {
    const margin = 10;

    const getDirection = (e) => {
      const rect = win.getBoundingClientRect();
      let dir = "";
      if (e.clientY - rect.top < margin) dir += "n";
      else if (rect.bottom - e.clientY < margin) dir += "s";
      if (e.clientX - rect.left < margin) dir += "w";
      else if (rect.right - e.clientX < margin) dir += "e";
      return dir;
    };

    const cursorMap = {
      n: "n-resize",
      s: "s-resize",
      w: "w-resize",
      e: "e-resize",
      nw: "nw-resize",
      ne: "ne-resize",
      sw: "sw-resize",
      se: "se-resize",
      "": "default"
    };

    win.addEventListener("mousemove", (e) => {
      win.style.cursor = cursorMap[getDirection(e)] || "default";
    });

    win.addEventListener("mousedown", (e) => {
      const direction = getDirection(e);
      if (!direction) return;

      this.bringToFront(win);
      document.body.classList.add("is-resizing");
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const rect = win.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const startLeft = rect.left;
      const startTop = rect.top;
      const MIN_SIZE = 300;

      const doDrag = (e) => {
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        if (direction.includes("e")) newWidth = startWidth + (e.clientX - startX);
        if (direction.includes("s")) newHeight = startHeight + (e.clientY - startY);
        if (direction.includes("w")) {
          newWidth = startWidth - (e.clientX - startX);
          newLeft = startLeft + (e.clientX - startX);
        }
        if (direction.includes("n")) {
          newHeight = startHeight - (e.clientY - startY);
          newTop = startTop + (e.clientY - startY);
        }

        if (newWidth > MIN_SIZE) {
          win.style.width = `${newWidth}px`;
          win.style.left = `${newLeft}px`;
        }
        if (newHeight > MIN_SIZE) {
          win.style.height = `${newHeight}px`;
          win.style.top = `${newTop}px`;
        }
        if (setHeightUnsetElement?.style) setHeightUnsetElement.style.height = "unset";
      };

      const stopDrag = () => {
        document.body.classList.remove("is-resizing");
        document.removeEventListener("mousemove", doDrag);
        document.removeEventListener("mouseup", stopDrag);
      };

      document.addEventListener("mousemove", doDrag);
      document.addEventListener("mouseup", stopDrag);
    });
  }

  _downloadWindowContent(win) {
    const filename =
      (win.querySelector(".window-header span")?.textContent?.trim() || win.id).replace(/[^\w\s-]/g, "").trim() ||
      "window";

    const iframe = win.querySelector("iframe");
    if (iframe) {
      const src = iframe.src || "";

      if (!src || src === "about:blank" || src === "") {
        return;
      }

      if (src.startsWith("blob:")) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            const html = iframeDoc.documentElement?.outerHTML ?? "";
            const blob = new Blob([html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename + ".html";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
        } catch (e) {}
        return;
      }

      if (src.startsWith("data:")) {
        const a = document.createElement("a");
        a.href = src;
        a.download = filename + ".html";
        a.click();
        return;
      }

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const html = iframeDoc.documentElement?.outerHTML ?? "";
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename + ".html";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          return;
        }
      } catch (e) {}

      const a = document.createElement("a");
      a.href = src;
      a.download = filename + ".html";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
      return;
    }

    const content = win.querySelector(".window-content");
    const html = content ? content.innerHTML : win.outerHTML;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename + ".html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  getWindowControls(externalUrl) {
    const externalBtn = externalUrl ? `<button class="external-btn" title="Open in External">↗</button>` : "";

    const downloadBtn = `<button class="download-btn" title="Download">
      <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 7L1.5 3.5h2V0h3v3.5h2L5 7zM0 9h10v1H0z"/>
      </svg>
    </button>`;

    if (window._settings?.macOsControls) {
      return `<div class="window-controls mac-controls">
        <button class="close-btn mac-btn mac-close" title="Close"></button>
        ${externalBtn}
        <button class="minimize-btn mac-btn mac-minimize" title="Minimize"></button>
        ${downloadBtn}
        <button class="maximize-btn mac-btn mac-maximize" title="Maximize"></button>
      </div>`;
    }

    return `<div class="window-controls">
      <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
      ${externalBtn}
      ${downloadBtn}
      <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
      <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
    </div>`;
  }

  sendNotify(text) {
    const popup = document.createElement("div");
    this.notificationCenter.addNotification(text, "");
    popup.innerHTML = `
      <div style="display:flex; align-items:flex-start;">
        <div style="flex-shrink:0; width:24px; height:24px; margin-right:8px; background:#0078d7; color:#fff; font-weight:bold; font-family:sans-serif; display:flex; justify-content:center; align-items:center; border-radius:50%;">i</div>
        <div style="flex:1;">
          <div style="color:#0078d7; font-weight:bold; font-size:13px; line-height:1.2;">Notification</div>
          <div style="margin-top:2px; font-weight:normal; font-size:12px; color:#000;">${text}</div>
        </div>
        <div style="flex-shrink:0; margin-left:8px; font-weight:bold; cursor:pointer; color:#666;">×</div>
      </div>
      <div style="position:absolute; bottom:-8px; right:16px; width:0; height:0; border-left:8px solid transparent; border-right:8px solid transparent; border-top:8px solid #fff;"></div>
    `;
    popup.className = "tray-notify";

    const dismiss = () => {
      popup.style.bottom = "-100px";
      popup.style.opacity = "0";
      setTimeout(() => popup.remove(), 500);
    };

    popup.querySelector("div:last-child").addEventListener("click", (e) => {
      e.stopPropagation();
      popup.style.bottom = "50px";
      popup.style.opacity = "0";
      setTimeout(() => popup.remove(), 500);
    });

    popup.addEventListener("click", dismiss);
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.style.bottom = "50px";
      popup.style.opacity = "1";
    }, 10);
    setTimeout(dismiss, 5000);
  }
}
