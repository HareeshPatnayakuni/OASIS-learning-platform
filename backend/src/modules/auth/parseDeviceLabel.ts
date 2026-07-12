/**
 * Deliberately not a full User-Agent parsing library (e.g. ua-parser-js) —
 * DeviceSession.deviceLabel is a display convenience ("Chrome on Windows"
 * shown in a future "manage your devices" screen), not a security or
 * analytics feature. A small heuristic keeps this dependency-free; if
 * device analytics ever become a real product need, swap this one function.
 */
export function parseDeviceLabel(userAgent: string | undefined): string | null {
  if (!userAgent) return null;

  const browser = detectBrowser(userAgent);
  const os = detectOS(userAgent);

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  return null;
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
