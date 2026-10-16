"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CommercialNote } from "@/components/CommercialNote";
import { CopyrightNote } from "@/components/CopyrightNote";
import { useI18n } from "@/lib/i18n";
import { cacheActivation } from "@/lib/activation";
import { hardNavigate, inDesktopShell } from "@/lib/desktop-nav";
import { fetchHardware, postCloud, readCachedProfile, saveActivationRecord } from "@/lib/host-client";

export default function ActivationPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<"register" | "login" | "reset">("register");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [proof, setProof] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [delivery, setDelivery] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => (value <= 1 ? 0 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown > 0]);

  async function finish(accountEmail: string) {
    const record = {
      activated: true as const,
      email: accountEmail.trim().toLowerCase(),
      username: accountEmail.trim().toLowerCase().split("@")[0]?.slice(0, 40) || "user",
      at: new Date().toISOString(),
    };
    let entropy = "";
    try {
      entropy = (await fetchHardware()).entropy;
    } catch {
      entropy = "";
    }
    if (entropy) {
      await saveActivationRecord({ dir: "~/RedAnchorVault", entropy, ...record });
    }
    cacheActivation(record);
    window.localStorage.setItem("red-anchor-privacy", "1");
    const next = readCachedProfile() ? "/" : "/setup";
    if (inDesktopShell()) hardNavigate(next);
    else router.replace(next);
  }

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ delivery?: string }>("sendCode", { email, privacy, locale: lang });
      setDelivery(data.delivery || "terminal");
      setSent(true);
      setCooldown(60);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("activation.sendFail");
      const wait = Number(message.match(/\d+/)?.[0] || 0);
      if (wait > 0 && wait <= 60) setCooldown(wait);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmEmail() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ proof: string }>("confirmEmail", { email, code: digits.join(""), privacy, locale: lang });
      setProof(data.proof);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("activation.fail"));
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ email: string; token: string }>("registerAccount", {
        email,
        proof,
        password,
        confirm,
        privacy,
        locale: lang,
      });
      window.localStorage.setItem("red-anchor-session", data.token);
      await finish(data.email);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("activation.fail"));
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: "register" | "login" | "reset") {
    setMode(next);
    setError("");
    setProof("");
    setSent(false);
  }

  async function sendReset() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ delivery?: string }>("resetCode", { email, privacy, locale: lang });
      setDelivery(data.delivery || "smtp");
      setSent(true);
      setCooldown(60);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t("activation.sendFail");
      const wait = Number(message.match(/\d+/)?.[0] || 0);
      if (wait > 0 && wait <= 60) setCooldown(wait);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmReset() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ proof: string }>("confirmReset", { email, code: digits.join(""), privacy, locale: lang });
      setProof(data.proof);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("activation.fail"));
    } finally {
      setBusy(false);
    }
  }

  async function saveReset() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ email: string; token: string }>("resetPassword", {
        email,
        proof,
        password,
        confirm,
        privacy,
        locale: lang,
      });
      window.localStorage.setItem("red-anchor-session", data.token);
      await finish(data.email);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("activation.fail"));
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ email: string; token: string }>("loginAccount", { email, password, locale: lang });
      window.localStorage.setItem("red-anchor-session", data.token);
      await finish(data.email);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("activation.fail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 p-4 md:p-8">
      <header className="panel px-4 py-4">
        <p className="font-display text-xs tracking-[0.22em] text-red-300">{t("activation.kicker")}</p>
        <h1 className="font-display text-3xl tracking-[0.12em]">{t("activation.title")}</h1>
        <p className="mt-2 text-sm text-slate-400">{t("activation.lead")}</p>
        <p className="mt-2 text-xs text-slate-500">{t("geo.note")}</p>
        <CopyrightNote className="mt-3" />
      </header>
      <div className="flex gap-2">
        <button type="button" onClick={() => switchMode("register")} className={`min-h-10 px-3 ${mode === "register" ? "bg-anchor text-white" : "border border-slate-600"}`}>
          {t("activation.modeRegister")}
        </button>
        <button type="button" onClick={() => switchMode("login")} className={`min-h-10 px-3 ${mode === "login" ? "bg-anchor text-white" : "border border-slate-600"}`}>
          {t("activation.modeLogin")}
        </button>
        <button type="button" onClick={() => switchMode("reset")} className={`min-h-10 px-3 ${mode === "reset" ? "bg-anchor text-white" : "border border-slate-600"}`}>
          {t("activation.modeReset")}
        </button>
      </div>
      <section className="panel space-y-3 p-4">
        <label className="block text-xs text-slate-400">
          {t("activation.email")}
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
        </label>
        {mode === "login" ? (
          <>
            <label className="block text-xs text-slate-400">
              {t("activation.password")}
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
            </label>
            {error ? <p className="text-sm text-amber-300">{error}</p> : null}
            <button type="button" disabled={busy || !email.trim() || password.length < 8} onClick={() => void login()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
              {busy ? t("activation.working") : t("activation.login")}
            </button>
          </>
        ) : mode === "reset" ? (
          <>
            <p className="text-sm text-slate-400">{t("activation.resetLead")}</p>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className="mt-1" />
              <span>We only collect your email, uptime, and tickets. Zero local LAN or 14-dimensional scan data will ever be uploaded.</span>
            </label>
            <button type="button" disabled={busy || cooldown > 0 || !email.trim() || !privacy} onClick={() => void sendReset()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
              {busy ? t("activation.working") : cooldown > 0 ? t("activation.wait", { seconds: cooldown }) : t("activation.resetSend")}
            </button>
            {sent ? <p className="text-sm text-emerald-300">{t("activation.sentMail")}</p> : null}
            <div className="flex gap-2" aria-label="reset code">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    boxes.current[index] = node;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  aria-label={t("activation.digit", { n: index + 1 })}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, "").slice(-1);
                    setDigits((prev) => prev.map((item, itemIndex) => (itemIndex === index ? next : item)));
                    if (next) boxes.current[index + 1]?.focus();
                  }}
                  className="h-12 w-10 border border-slate-600 bg-slate-950 text-center font-mono text-lg text-slate-100"
                />
              ))}
            </div>
            {!proof ? (
              <button type="button" disabled={busy || digits.join("").length < 6 || !privacy} onClick={() => void confirmReset()} className="min-h-11 border border-anchor px-4 text-red-200 disabled:opacity-40">
                {busy ? t("activation.working") : t("activation.verify")}
              </button>
            ) : (
              <>
                <p className="text-sm text-slate-300">{t("activation.resetConfirmed")}</p>
                <label className="block text-xs text-slate-400">
                  {t("activation.password")}
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
                </label>
                <label className="block text-xs text-slate-400">
                  {t("activation.confirm")}
                  <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
                </label>
                <button type="button" disabled={busy || password.length < 8 || confirm.length < 8} onClick={() => void saveReset()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
                  {busy ? t("activation.working") : t("activation.resetApply")}
                </button>
              </>
            )}
            {error ? <p className="text-sm text-amber-300">{error}</p> : null}
          </>
        ) : (
          <>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className="mt-1" />
              <span>We only collect your email, uptime, and tickets. Zero local LAN or 14-dimensional scan data will ever be uploaded.</span>
            </label>
            <button type="button" disabled={busy || cooldown > 0 || !email.trim() || !privacy} onClick={() => void sendCode()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
              {busy ? t("activation.working") : cooldown > 0 ? t("activation.wait", { seconds: cooldown }) : t("activation.send")}
            </button>
            {sent ? <p className="text-sm text-emerald-300">{delivery === "smtp" || delivery === "cloud" ? t("activation.sentMail") : t("activation.sentTerm")}</p> : null}
            <div className="flex gap-2" aria-label="code">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(node) => {
                    boxes.current[index] = node;
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  aria-label={t("activation.digit", { n: index + 1 })}
                  onChange={(event) => {
                    const next = event.target.value.replace(/\D/g, "").slice(-1);
                    setDigits((prev) => prev.map((item, itemIndex) => (itemIndex === index ? next : item)));
                    if (next) boxes.current[index + 1]?.focus();
                  }}
                  className="h-12 w-10 border border-slate-600 bg-slate-950 text-center font-mono text-lg text-slate-100"
                />
              ))}
            </div>
            {!proof ? (
              <button type="button" disabled={busy || digits.join("").length < 6 || !privacy} onClick={() => void confirmEmail()} className="min-h-11 border border-anchor px-4 text-red-200 disabled:opacity-40">
                {busy ? t("activation.working") : t("activation.verify")}
              </button>
            ) : (
              <>
                <p className="text-sm text-slate-300">{t("activation.confirmed")}</p>
                <label className="block text-xs text-slate-400">
                  {t("activation.password")}
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
                </label>
                <label className="block text-xs text-slate-400">
                  {t("activation.confirm")}
                  <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
                </label>
                <button type="button" disabled={busy || password.length < 8 || confirm.length < 8} onClick={() => void register()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
                  {busy ? t("activation.working") : t("activation.apply")}
                </button>
              </>
            )}
            {error ? <p className="text-sm text-amber-300">{error}</p> : null}
          </>
        )}
      </section>
      <CommercialNote />
    </main>
  );
}
