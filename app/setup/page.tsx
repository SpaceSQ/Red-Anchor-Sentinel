"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isValidDid, isValidU6a } from "@/lib/did";
import { CommercialNote } from "@/components/CommercialNote";
import { readActivation } from "@/lib/activation";
import { fetchHardware, probeLlm, saveVault } from "@/lib/host-client";
import { useI18n } from "@/lib/i18n";
import { didFromEntropy, formatU6a, type AddressParts, type SentinelProfile } from "@/lib/profile";

const EMPTY_ADDRESS: AddressParts = {
  country: "CN",
  city: "073",
  building: "HOME",
  floor: "01",
  room: "001",
  grid: "5",
};

export default function SetupPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [address, setAddress] = useState<AddressParts>(EMPTY_ADDRESS);
  const [hardwareError, setHardwareError] = useState("");
  const [hostClass, setHostClass] = useState<SentinelProfile["hostClass"]>("virtual");
  const [entropy, setEntropy] = useState("");
  const [limited, setLimited] = useState(false);
  const [did, setDid] = useState("");
  const [vaultDir, setVaultDir] = useState("~/RedAnchorVault");
  const [mode, setMode] = useState<"ollama" | "openai">("ollama");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:11434");
  const [model, setModel] = useState("llama3.1");
  const [apiKey, setApiKey] = useState("");
  const [probeNote, setProbeNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchHardware()
      .then((hardware) => {
        setHostClass(hardware.hostClass);
        setEntropy(hardware.entropy);
        setLimited(false);
      })
      .catch(() => {
        const fallback = crypto.getRandomValues(new Uint8Array(32));
        const hex = [...fallback].map((byte) => byte.toString(16).padStart(2, "0")).join("");
        setEntropy(hex);
        setHostClass("virtual");
        setLimited(true);
        setHardwareError("setup.noHardware");
      });
  }, []);

  const u6a = formatU6a(address);
  const addressOk = isValidU6a(u6a);
  const blocked = hostClass === "container" && !limited;

  function mint() {
    if (!entropy || !addressOk) return;
    setDid(didFromEntropy(entropy));
    setStep(2);
  }

  async function finish() {
    if (!did || !isValidDid(did)) {
      setError("setup.noDid");
      return;
    }
    setBusy(true);
    setError("");
    const profile: SentinelProfile = {
      did,
      u6a,
      callsign: "红锚哨兵",
      hostClass,
      limited: limited || hostClass !== "physical",
      vaultDir,
      entropy,
      llm: { mode, baseUrl, model, hasKey: Boolean(apiKey) },
      createdAt: new Date().toISOString(),
      email: readActivation()?.email,
      username: readActivation()?.username,
    };
    try {
      await saveVault(profile, apiKey);
      const activation = readActivation();
      if (activation?.email) {
        await fetch("/api/cloud/bind-did", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: activation.email, s2Did: did }),
        }).catch(() => undefined);
      }
      router.replace("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "setup.vaultFail");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4 md:p-8">
      <header className="panel px-4 py-4">
        <p className="font-display text-xs tracking-[0.22em] text-red-300">{t("setup.kicker")}</p>
        <h1 className="font-display text-3xl tracking-[0.12em]">{t("setup.title")}</h1>
        <p className="mt-2 text-sm text-slate-400">{t("setup.lead")}</p>
      </header>
      <ol className="grid grid-cols-3 gap-2 text-sm">
        {[t("setup.step1"), t("setup.step2"), t("setup.step3")].map((label, index) => (
          <li key={label} className={`border px-3 py-2 ${step === index + 1 ? "border-anchor text-red-200" : "border-slate-800 text-slate-500"}`}>
            0{index + 1} {label}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className="panel space-y-3 p-4">
          <h2 className="font-display tracking-[0.14em]">{t("setup.address")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {(
              [
                ["country", "setup.country"],
                ["city", "setup.city"],
                ["building", "setup.building"],
                ["floor", "setup.floor"],
                ["room", "setup.room"],
                ["grid", "setup.grid"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-xs text-slate-400">
                {t(label)}
                <input
                  value={address[key]}
                  onChange={(event) => setAddress((prev) => ({ ...prev, [key]: event.target.value.toUpperCase() }))}
                  className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm text-slate-100"
                />
              </label>
            ))}
          </div>
          <p className="font-mono text-sm text-slate-200">CD-U6A {u6a}</p>
          <p className="text-xs text-slate-500">{t("setup.host", { host: hostClass })}</p>
          {hardwareError ? <p className="text-sm text-amber-300">{t(hardwareError)}</p> : null}
          {hostClass === "container" ? (
            <p className="text-sm text-red-300">{t("setup.container")}</p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" disabled={!addressOk || !entropy || blocked} onClick={mint} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-40">
              {t("setup.mint")}
            </button>
            {hostClass === "container" ? (
              <button type="button" onClick={() => setLimited(true)} className="min-h-11 border border-slate-600 px-4">
                {t("setup.preview")}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="panel space-y-3 p-4">
          <h2 className="font-display tracking-[0.14em]">{t("setup.vault")}</h2>
          <p className="break-all font-mono text-sm text-safe">红锚基地认可智能体 · {did}</p>
          <label className="block text-xs text-slate-400">
            {t("setup.vaultPath")}
            <input value={vaultDir} onChange={(event) => setVaultDir(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm text-slate-100" />
          </label>
          <p className="text-xs text-slate-500">{t("setup.vaultNote")}</p>
          <button
            type="button"
            onClick={() => {
              void (async () => {
                const marker = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
                if (!marker) {
                  setError("setup.browserPath");
                  return;
                }
                const dialog = await import("@tauri-apps/plugin-dialog");
                const selected = await dialog.open({ directory: true, title: "选择金库目录" });
                if (typeof selected === "string") setVaultDir(selected);
              })();
            }}
            className="min-h-10 border border-slate-600 px-3"
          >
            {t("setup.pick")}
          </button>
          {error && step === 2 ? <p className="text-sm text-amber-300">{error.startsWith("setup.") ? t(error) : error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(1)} className="min-h-11 border border-slate-600 px-4">
              {t("setup.back")}
            </button>
            <button type="button" onClick={() => { setError(""); setStep(3); }} className="min-h-11 bg-anchor px-4 text-white">
              {t("setup.confirmPath")}
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="panel space-y-3 p-4">
          <h2 className="font-display tracking-[0.14em]">{t("setup.engine")}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setMode("ollama"); setBaseUrl("http://127.0.0.1:11434"); }} className={`min-h-10 border px-3 ${mode === "ollama" ? "border-anchor text-red-200" : "border-slate-700"}`}>
              {t("setup.ollama")}
            </button>
            <button type="button" onClick={() => { setMode("openai"); setBaseUrl("https://api.openai.com"); }} className={`min-h-10 border px-3 ${mode === "openai" ? "border-anchor text-red-200" : "border-slate-700"}`}>
              {t("setup.openai")}
            </button>
          </div>
          <label className="block text-xs text-slate-400">
            {t("setup.endpoint")}
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm text-slate-100" />
          </label>
          <label className="block text-xs text-slate-400">
            {t("setup.model")}
            <input value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm text-slate-100" />
          </label>
          {mode === "openai" ? (
            <label className="block text-xs text-slate-400">
              {t("setup.key")}
              <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-sm text-slate-100" />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setProbeNote("setup.probing");
              void probeLlm(mode, baseUrl, apiKey)
                .then((result) => setProbeNote(`setup.probeOk:${result.count}`))
                .catch((reason: Error) => setProbeNote(reason.message));
            }}
            className="min-h-10 border border-slate-600 px-3"
          >
            {t("setup.probe")}
          </button>
          {probeNote ? <p className="text-sm text-slate-300">{probeNote.startsWith("setup.probeOk:") ? t("setup.probeOk", { count: probeNote.split(":")[1] || "0" }) : probeNote.startsWith("setup.") ? t(probeNote) : probeNote}</p> : null}
          {error ? <p className="text-sm text-amber-300">{error.startsWith("setup.") ? t(error) : error}</p> : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep(2)} className="min-h-11 border border-slate-600 px-4">
              {t("setup.backPath")}
            </button>
            <button type="button" disabled={busy} onClick={() => void finish()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
              {busy ? t("setup.writing") : t("setup.finish")}
            </button>
          </div>
        </section>
      ) : null}
      <CommercialNote />
    </main>
  );
}
