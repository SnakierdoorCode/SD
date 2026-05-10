/**
 * @deprecated Import from ./shared/assetResolver.js instead
 * This file is kept for backward compatibility
 */
import { resolveIconUrl as resolveIconUrlCentralized } from "./shared/assetResolver.js";

// Re-export for backward compatibility
export { resolveIconUrl as resolveIconUrlCentralized };

// Maintain the original export name
export function resolveIconUrl(url) {
  return resolveIconUrlCentralized(url);
}
