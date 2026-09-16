export function readLocal<T>(key: string, fallback: T, validate?: (value: unknown) => boolean): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`stockfinder:v1:${key}`) ?? 'null');
    return value !== null && (!validate || validate(value)) ? value as T : fallback;
  } catch { return fallback; }
}
export function writeLocal(key: string, value: unknown): void {
  try { localStorage.setItem(`stockfinder:v1:${key}`, JSON.stringify(value)); } catch { /* Private browsing/storage limits should not disable a scan. */ }
}
