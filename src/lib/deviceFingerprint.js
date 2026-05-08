export async function getDeviceFingerprint() {
  const stored = localStorage.getItem('vm_device_fp');
  if (stored) return stored;

  // 기기 특성 조합
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');

  // SHA-256 해시
  const msgBuffer = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const fp = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  localStorage.setItem('vm_device_fp', fp);
  return fp;
}
