/**
 * Deliberately not a full User-Agent parsing library (e.g. ua-parser-js) —
 * this is a display convenience ("Chrome on Windows" / "Chrome" / "Windows"
 * shown on the "My Devices" screen, Module 5), not a security or analytics
 * feature. A small heuristic keeps this dependency-free; if device
 * analytics ever become a real product need, swap this one function.
 */
export interface ParsedDeviceInfo {
  /** Combined, human-friendly name — e.g. "Chrome on Windows". Null only
   * if neither browser nor OS could be detected. */
  label: string | null;
  browser: string | null;
  operatingSystem: string | null;
}

export function parseDeviceInfo(userAgent: string | undefined): ParsedDeviceInfo {
  if (!userAgent) return { label: null, browser: null, operatingSystem: null };

  const browser = detectBrowser(userAgent);
  const operatingSystem = detectOS(userAgent);

  let label: string | null;
  if (browser && operatingSystem) label = `${browser} on ${operatingSystem}`;
  else if (browser) label = browser;
  else if (operatingSystem) label = operatingSystem;
  else label = null;

  return { label, browser, operatingSystem };
}

function detectBrowser(ua: string): string | null {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\//i.test(ua) || /opera/i.test(ua)) return 'Opera';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return null;
}

function detectOS(ua: string): string | null {
  if (/windows/i.test(ua)) return 'Windows';
  if (/iphone|ipad|ios/i.test(ua)) return 'iOS';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/linux/i.test(ua)) return 'Linux';
  return null;
}
