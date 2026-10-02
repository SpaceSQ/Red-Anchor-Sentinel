"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CommercialNote } from "@/components/CommercialNote";
import { useI18n } from "@/lib/i18n";
import { cacheActivation } from "@/lib/activation";
import { hardNavigate, inDesktopShell } from "@/lib/desktop-nav";
import { fetchHardware, postCloud, readCachedProfile, saveActivationRecord } from "@/lib/host-client";

export default function ActivationPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [delivery, setDelivery] = useState("");
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  async function sendCode() {
    setBusy(true);
    setError("");
    try {
      const data = await postCloud<{ delivery?: string }>("sendCode", { email, privacy });
      setDelivery(data.delivery || "terminal");
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "发码失败");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError("");
    try {
      await postCloud("verifyCode", { email, username, code: digits.join(""), privacy });
      const record = {
        activated: true as const,
        email: email.trim().toLowerCase(),
        username: username.trim().slice(0, 40) || "用户",
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "核验失败");
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
      </header>
      <section className="panel space-y-3 p-4">
        <label className="block text-xs text-slate-400">
          {t("activation.user")}
          <input value={username} onChange={(event) => setUsername(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
        </label>
        <label className="block text-xs text-slate-400">
          {t("activation.email")}
          <input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-100" />
        </label>
        <label className="flex items-start gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className="mt-1" />
          <span>We only collect your email, uptime, and tickets. Zero local LAN or 14-dimensional scan data will ever be uploaded.</span>
        </label>
        <button type="button" disabled={busy || !email.trim() || !privacy} onClick={() => void sendCode()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
          {t("activation.send")}
        </button>
        {sent ? (
          <p className="text-sm text-slate-300">
            {delivery === "smtp" ? t("activation.sentMail") : t("activation.sentTerm")}
          </p>
        ) : null}
        <div className="flex gap-2" aria-label="六位核验码">
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
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
        <button type="button" disabled={busy || digits.join("").length < 6 || !privacy} onClick={() => void verify()} className="min-h-11 border border-anchor px-4 text-red-200 disabled:opacity-40">
          {busy ? t("activation.working") : t("activation.verify")}
        </button>
      </section>
      <CommercialNote />
    </main>
  );
}
