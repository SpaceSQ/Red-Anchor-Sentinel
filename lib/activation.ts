export const ACTIVATION_KEY = "red-anchor-activation";

export interface ActivationRecord {
  activated: true;
  email: string;
  username: string;
  at: string;
}

export function readActivation(): ActivationRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACTIVATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ActivationRecord;
    if (!parsed.activated || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function cacheActivation(record: ActivationRecord) {
  window.localStorage.setItem(ACTIVATION_KEY, JSON.stringify(record));
}
