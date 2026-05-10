import { isImageFile } from "./utils.js";

export class NotificationCenter {
  constructor() {
    this.notifications = [];
    this.isOpen = false;
    this.maxNotifications = 50;
    this.notificationId = 0;
    this.createNotificationCenterUI();
    this.setupTaskbarButton();
  }

  createNotificationCenterUI() {
    const centerContainer = document.createElement("div");
    centerContainer.id = "ntf-panel";
    centerContainer.className = "ntf-panel";
    centerContainer.style.display = "none";

    centerContainer.innerHTML = `
      <div class="ntf-panel__head">
        <span>Notifications</span>
        <button class="ntf-panel__dismiss" title="Close">×</button>
      </div>
      <div class="ntf-panel__feed"></div>
      <div class="ntf-panel__foot">
        <button class="ntf-purge-btn">Clear All</button>
      </div>
    `;

    document.body.appendChild(centerContainer);

    centerContainer.querySelector(".ntf-panel__dismiss").addEventListener("click", () => {
      this.closeCenter();
    });

    centerContainer.querySelector(".ntf-purge-btn").addEventListener("click", () => {
      this.clearAllNotifications();
    });
  }

  setupTaskbarButton() {
    const systemTray = document.getElementById("system-tray");
    if (!systemTray) return;

    const notificationBtn = document.createElement("div");
    notificationBtn.id = "ntf-tray-btn";
    notificationBtn.className = "ntf-tray-btn";
    notificationBtn.title = "Notification Center";
    notificationBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
      </svg>
      <span class="ntf-count" style="display: none;">0</span>
    `;

    notificationBtn.addEventListener("click", () => {
      this.toggleCenter();
    });

    systemTray.insertBefore(notificationBtn, systemTray.lastChild);
  }

  addNotification(title, message, type = "info", duration = 5000, icon = null) {
    const notification = {
      id: this.notificationId++,
      title,
      message,
      type,
      timestamp: new Date(),
      icon
    };

    this.notifications.unshift(notification);

    if (this.notifications.length > this.maxNotifications) {
      this.notifications.pop();
    }

    this.updateNotificationCenter();
    this.updateBadge();

    return notification.id;
  }

  removeNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.updateNotificationCenter();
    this.updateBadge();
  }

  clearAllNotifications() {
    this.notifications = [];
    this.updateNotificationCenter();
    this.updateBadge();
  }

  updateNotificationCenter() {
    const list = document.querySelector(".ntf-panel__feed");
    if (!list) return;

    list.innerHTML = "";

    if (this.notifications.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ntf-panel__blank";
      empty.textContent = "No notifications";
      list.appendChild(empty);
      return;
    }

    this.notifications.forEach((notif) => {
      const item = document.createElement("div");
      const typeMap = {
        info: "ntf-card--info",
        success: "ntf-card--ok",
        warning: "ntf-card--warn",
        error: "ntf-card--fail"
      };
      item.className = `ntf-card ${typeMap[notif.type] || "ntf-card--info"}`;
      item.dataset.id = notif.id;

      const timestamp = this.formatTime(notif.timestamp);

      let iconHtml = "";
      if (notif.icon) {
        const isImagePath = isImageFile(notif.icon);
        const isDataUrl = typeof notif.icon === "string" && notif.icon.startsWith("data:");

        if (isImagePath || isDataUrl) {
          iconHtml = `<img src="${notif.icon}" class="ntf-card__glyph" />`;
        } else if (typeof notif.icon === "string" && notif.icon.trim().length > 0) {
          const cls = notif.icon.startsWith("fa") ? notif.icon : `fa ${notif.icon}`;
          iconHtml = `<i class="${cls} ntf-card__glyph"></i>`;
        }
      } else {
        const iconMap = {
          info: "fas fa-info-circle",
          success: "fas fa-check-circle",
          warning: "fas fa-exclamation-circle",
          error: "fas fa-times-circle"
        };
        iconHtml = `<i class="${iconMap[notif.type]} ntf-card__glyph"></i>`;
      }

      item.innerHTML = `
        <div class="ntf-card__glyph-wrap">
          ${iconHtml}
        </div>
        <div class="ntf-card__body">
          <div class="ntf-card__heading">${notif.title}</div>
          <div class="ntf-card__text">${notif.message ?? ""}</div>
          <div class="ntf-card__stamp">${timestamp}</div>
        </div>
        <button class="ntf-card__remove" title="Remove">×</button>
      `;

      item.querySelector(".ntf-card__remove").addEventListener("click", () => {
        this.removeNotification(notif.id);
      });

      list.appendChild(item);
    });
  }

  updateBadge() {
    const badge = document.querySelector(".ntf-count");
    if (!badge) return;

    const count = this.notifications.length;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "flex";
    } else {
      badge.style.display = "none";
    }
  }

  toggleCenter() {
    if (this.isOpen) {
      this.closeCenter();
    } else {
      this.openCenter();
    }
  }

  openCenter() {
    const center = document.getElementById("ntf-panel");
    if (!center) return;

    center.style.display = "block";
    this.isOpen = true;

    const btn = document.getElementById("ntf-tray-btn");
    if (btn) btn.classList.add("active");
  }

  closeCenter() {
    const center = document.getElementById("ntf-panel");
    if (!center) return;

    center.style.display = "none";
    this.isOpen = false;

    const btn = document.getElementById("ntf-tray-btn");
    if (btn) btn.classList.remove("active");
  }

  formatTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  getNotifications() {
    return [...this.notifications];
  }

  getNotificationCount() {
    return this.notifications.length;
  }
}
