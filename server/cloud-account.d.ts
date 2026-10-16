declare module "@/server/cloud-account.mjs" {
  export function cloudConfigured(): boolean;
  export function sendSignupCode(body: Record<string, unknown>): Promise<{ ok: true; delivery: string }>;
  export function confirmSignup(body: Record<string, unknown>): Promise<{ ok: true; email: string; proof: string }>;
  export function registerCloud(body: Record<string, unknown>): Promise<{ ok: true; email: string; token: string }>;
  export function loginCloud(body: Record<string, unknown>): Promise<{ ok: true; email: string; token: string }>;
}

declare module "./cloud-account.mjs" {
  export function cloudConfigured(): boolean;
  export function sendSignupCode(body: Record<string, unknown>): Promise<{ ok: true; delivery: string }>;
  export function confirmSignup(body: Record<string, unknown>): Promise<{ ok: true; email: string; proof: string }>;
  export function registerCloud(body: Record<string, unknown>): Promise<{ ok: true; email: string; token: string }>;
  export function loginCloud(body: Record<string, unknown>): Promise<{ ok: true; email: string; token: string }>;
}
