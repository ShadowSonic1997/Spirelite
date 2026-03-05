export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const rint = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const $ = (id) => document.getElementById(id);

export function safeJsonParse(raw, fallback = null) {
  try { return JSON.parse(raw); } catch { return fallback; }
}
