/**
 * @deprecated Import from ./assetResolver.js instead
 * This file is kept for backward compatibility
 */
import {
  looksLikeHtml,
  isJsDelivrGhUrl,
  resolveUrl as resolveUrlCentralized,
  fetchHtmlAsBlobUrl as fetchHtmlAsBlobUrlCentralized,
  CDN_BASES
} from "./assetResolver.js";

// Re-export for backward compatibility
export { looksLikeHtml, isJsDelivrGhUrl, fetchHtmlAsBlobUrl as fetchHtmlAsBlobUrlCentralized };

// Legacy constants for backward compatibility
export const JSDELIVR_BASE = CDN_BASES.GAMES;
export const YUKIOS_JSDELIVR_BASE = CDN_BASES.MAIN;

// Maintain the original export name
export async function resolveUrl(url, isJsDelivrGh = false) {
  return resolveUrlCentralized(url, isJsDelivrGh);
}
