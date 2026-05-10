export const PROXIES = [
  { label: "YukiProxy", prefix: "https://proxy.yukios-os.workers.dev/?quest=" },
  { label: "Codetabs", prefix: "https://api.codetabs.com/v1/proxy?quest=" },
  { label: "WhateverOrigin", prefix: "https://whateverorigin.org/get?url=" },
  { label: "proxy.2677929.xyz", prefix: "https://proxy.2677929.xyz/" }
];

export function clampProxyIndex(index, proxies = PROXIES) {
  const n = Array.isArray(proxies) ? proxies.length : 0;
  if (!n) return 0;
  const i = Number(index);
  if (!Number.isFinite(i)) return 0;
  if (Math.trunc(i) === -1) return -1;
  return Math.max(0, Math.min(n - 1, Math.trunc(i)));
}

export function buildProxyUrl(url, proxyIndex = 0, proxies = PROXIES) {
  const i = clampProxyIndex(proxyIndex, proxies);
  if (i === -1) return url;
  const proxy = proxies[i];
  return proxy.prefix + encodeURIComponent(url);
}

export class ProxyRegistry {
  constructor({ proxies = PROXIES } = {}) {
    this.proxies = Array.isArray(proxies) && proxies.length ? proxies : PROXIES;
  }

  list() {
    return this.proxies;
  }

  build(url, proxyIndex = 0) {
    return buildProxyUrl(url, proxyIndex, this.proxies);
  }
}
