import { cachedHosts } from "./storage";

type Target = { host: string; port: number };
type AccountBody = { error?: string; email?: string; token?: string; proof?: string };

let target: Target | null = null;

function withTimeout(ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, done: () => clearTimeout(timer) };
}

async function reachable(host: string, port: number) {
  const timer = withTimeout(900);
  try {
    const response = await fetch(`http://${host}:${port}/account/health`, { signal: timer.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    timer.done();
  }
}

function browse(timeoutMs: number): Promise<Target | null> {
  return new Promise((resolve) => {
    void import("react-native-zeroconf")
      .then((mod) => {
        const browser = new mod.default();
        const timer = setTimeout(() => {
          browser.stop();
          resolve(null);
        }, timeoutMs);
        browser.on("resolved", (service: { host?: string; port?: number; addresses?: string[] }) => {
          const host = (service.addresses || []).find((item) => /^\d+\.\d+\.\d+\.\d+$/.test(item) && !item.startsWith("127.")) || "";
          if (!host || !service.port) return;
          clearTimeout(timer);
          browser.stop();
          resolve({ host, port: service.port });
        });
        browser.scan("ras", "tcp", "local.");
      })
      .catch(() => resolve(null));
  });
}

async function useHost(host: string, port: number) {
  if (!(await reachable(host, port))) return null;
  target = { host, port };
  return target;
}

async function resolveTarget() {
  if (target && (await reachable(target.host, target.port))) return target;
  target = null;
  // The iOS Simulator shares this Mac, so the desktop link server is localhost.
  // Check it before Bonjour: a failed LAN probe otherwise becomes "mail server did not accept".
  const local = await useHost("127.0.0.1", 8787);
  if (local) return local;
  const saved = await cachedHosts().catch(() => []);
  for (const row of saved) {
    const hit = await useHost(row.host, row.port);
    if (hit) return hit;
  }
  const found = await browse(2500);
  if (found) {
    const hit = await useHost(found.host, found.port);
    if (hit) return hit;
  }
  throw new Error("UNREACHABLE");
}

async function post(name: string, body: Record<string, unknown>) {
  const where = await resolveTarget();
  const timer = withTimeout(20000);
  let response: Response;
  try {
    response = await fetch(`http://${where.host}:${where.port}/account/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: timer.signal,
    });
  } catch {
    target = null;
    throw new Error("UNREACHABLE");
  } finally {
    timer.done();
  }
  const text = await response.text();
  let data: AccountBody = {};
  if (text) {
    try {
      data = JSON.parse(text) as AccountBody;
    } catch {
      throw new Error("UNREACHABLE");
    }
  }
  if (!response.ok) throw new Error(data.error || "UNREACHABLE");
  return data;
}

export async function sendSignupCode(email: string, extra: { privacy: boolean; locale: string }) {
  await post("send-code", { email, privacy: extra.privacy, locale: extra.locale });
}

export async function confirmSignupCode(email: string, code: string, extra: { privacy: boolean; locale: string }) {
  const data = await post("confirm", { email, code, privacy: extra.privacy, locale: extra.locale });
  if (!data.proof) throw new Error("UNREACHABLE");
  return data.proof;
}

export async function registerAccount(body: { email: string; proof: string; password: string; confirm: string; privacy: boolean; locale: string }) {
  const data = await post("register", body);
  if (!data.token) throw new Error("UNREACHABLE");
  return { email: data.email || body.email, token: data.token };
}

export async function loginWithPassword(email: string, password: string, locale: string) {
  const data = await post("login", { email, password, locale });
  if (!data.token) throw new Error("UNREACHABLE");
  return { email: data.email || email, token: data.token };
}

export async function sendResetCode(email: string, extra: { privacy: boolean; locale: string }) {
  await post("reset-code", { email, privacy: extra.privacy, locale: extra.locale });
}

export async function confirmResetCode(email: string, code: string, extra: { privacy: boolean; locale: string }) {
  const data = await post("confirm-reset", { email, code, privacy: extra.privacy, locale: extra.locale });
  if (!data.proof) throw new Error("UNREACHABLE");
  return data.proof;
}

export async function resetAccountPassword(body: { email: string; proof: string; password: string; confirm: string; privacy: boolean; locale: string }) {
  const data = await post("reset-password", body);
  if (!data.token) throw new Error("UNREACHABLE");
  return { email: data.email || body.email, token: data.token };
}
