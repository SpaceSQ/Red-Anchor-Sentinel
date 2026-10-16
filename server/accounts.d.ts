declare module "@/server/activation-mail.mjs" {
  export function activationSendWait(sentAt: number, now?: number): number;
  export function reserveActivationSend(email: string, locale?: unknown): void;
  export function sendResetCode(body: Record<string, unknown>): Promise<{ ok: true; delivery: string }>;
}

declare module "./activation-mail.mjs" {
  export function activationSendWait(sentAt: number, now?: number): number;
  export function reserveActivationSend(email: string, locale?: unknown): void;
  export function sendResetCode(body: Record<string, unknown>): Promise<{ ok: true; delivery: string }>;
}

declare module "@/server/accounts.mjs" {
  export function storeSignupCode(email: string, code: string): void;
  export function confirmEmail(body: Record<string, unknown>): { ok: true; email: string; proof: string };
  export function registerAccount(body: Record<string, unknown>): { ok: true; email: string; token: string };
  export function loginAccount(body: Record<string, unknown>): { ok: true; email: string; token: string };
  export function accountExists(email: string): boolean;
  export function storeResetCode(email: string, code: string): void;
  export function confirmReset(body: Record<string, unknown>): { ok: true; email: string; proof: string };
  export function resetPassword(body: Record<string, unknown>): { ok: true; email: string; token: string };
}

declare module "./accounts.mjs" {
  export function storeSignupCode(email: string, code: string): void;
  export function confirmEmail(body: Record<string, unknown>): { ok: true; email: string; proof: string };
  export function registerAccount(body: Record<string, unknown>): { ok: true; email: string; token: string };
  export function loginAccount(body: Record<string, unknown>): { ok: true; email: string; token: string };
  export function accountExists(email: string): boolean;
  export function storeResetCode(email: string, code: string): void;
  export function confirmReset(body: Record<string, unknown>): { ok: true; email: string; proof: string };
  export function resetPassword(body: Record<string, unknown>): { ok: true; email: string; token: string };
}
