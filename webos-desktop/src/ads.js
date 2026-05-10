import { desktop } from "./desktop.js";
import { isJsDelivrHostname } from "./shared/assetResolver.js";

const AD_STORAGE_KEY = "yukiOS_ads_meta";

const AD_PROVIDERS = [
  {
    id: "cpm_primary",
    type: "script",
    strict: true,
    src: "https://pl29381085.profitablecpmratenetwork.com/5f797791a9771b6940fb9385a69ce168/invoke.js",
    containerId: "container-5f797791a9771b6940fb9385a69ce168",
    weight: 80
  },
  {
    id: "internal_fallback",
    type: "html",
    weight: 20,
    render: (container) => {
      container.innerHTML = `
        <div style="font-size:14px">
          <b>Sponsored</b>
          <p>Discover new games and updates in YukiOS using Whats New App</p>
        </div>
      `;
    }
  }
];

const hostname = window.location.hostname;

const isLocal = hostname === "" || hostname === "localhost" || hostname === "127.0.0.1";
const isFile = window.location.protocol === "file:";
const isBlocked = isJsDelivrHostname(hostname) || hostname.includes("esm.sh") || hostname.includes("cdn.statically.io");

function shouldEnableAds() {
  if (isFile || isLocal || isBlocked) return false;
  return hostname.includes("yukios");
}
function loadMeta() {
  try {
    return (
      JSON.parse(localStorage.getItem(AD_STORAGE_KEY)) || {
        dailyCount: 0,
        lastReset: Date.now(),
        lastShown: 0
      }
    );
  } catch {
    return {
      dailyCount: 0,
      lastReset: Date.now(),
      lastShown: 0
    };
  }
}

function saveMeta(meta) {
  localStorage.setItem(AD_STORAGE_KEY, JSON.stringify(meta));
}

function resetDaily(meta) {
  const dayMs = 1000 * 60 * 60 * 24;
  if (Date.now() - meta.lastReset > dayMs) {
    meta.dailyCount = 0;
    meta.lastReset = Date.now();
  }
}

export class AdsManager {
  constructor(windowManager) {
    this.wm = windowManager;
    this.maxPerDay = 20;
    this.minInterval = 1000 * 60 * 3;
    this.loopRunning = false;
    setTimeout(() => {
      this.init();
    }, 50);
  }

  init() {
    if (!shouldEnableAds()) return;
    this.startLoop();
  }

  startLoop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    this.loop();
  }

  loop() {
    this.maybeSpawnAd();
    setTimeout(() => this.loop(), 1000 * 60 * 4);
  }

  maybeSpawnAd() {
    if (!shouldEnableAds()) return;

    const meta = loadMeta();
    resetDaily(meta);

    const now = Date.now();

    if (meta.dailyCount >= this.maxPerDay) return;
    if (now - meta.lastShown < this.minInterval) return;

    const spawned = this.spawnAd(meta);

    if (spawned) {
      meta.dailyCount++;
      meta.lastShown = Date.now();
      saveMeta(meta);
    }
  }

  pickProvider() {
    const total = AD_PROVIDERS.reduce((a, b) => a + b.weight, 0);
    let r = Math.random() * total;

    for (const p of AD_PROVIDERS) {
      if (r < p.weight) return p;
      r -= p.weight;
    }

    return AD_PROVIDERS[0];
  }

  spawnAd(meta) {
    if (!shouldEnableAds()) return false;

    const provider = this.pickProvider();

    const winId = "ads-yukios";
    const existing = document.getElementById(winId);

    if (existing) {
      this.wm.bringToFront(existing);
      return false;
    }

    const win = this.wm.createWindow(winId, "Sponsored", "420px", "300px");

    Object.assign(win.style, {
      right: "40px",
      bottom: "40px",
      left: "auto",
      top: "auto"
    });

    const containerId = provider.containerId || "ad-container";

    win.innerHTML = `
      <div class="window-header">
        <span>Sponsored</span>
        ${this.wm.getWindowControls()}
      </div>
      <div class="window-content" style="padding:12px;">
        <div id="${containerId}"></div>
      </div>
    `;

    desktop.appendChild(win);

    this.wm.makeDraggable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Sponsored", "fa fa-bullhorn");

    const container = win.querySelector(`#${containerId}`);
    if (!container) return false;

    if (provider.type === "script") {
      container.innerHTML = "";

      const script = document.createElement("script");
      script.async = true;
      script.dataset.cfasync = "false";
      script.src = provider.src;

      setTimeout(() => {
        container.appendChild(script);
      }, 0);
    }

    if (provider.type === "html") {
      provider.render(container);
    }

    return true;
  }
}
