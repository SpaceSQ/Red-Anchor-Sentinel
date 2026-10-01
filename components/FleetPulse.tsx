"use client";

import { useEffect, useState } from "react";
import { readActivation } from "@/lib/activation";
import { APP_VERSION } from "@/lib/release";

const PRIVACY_KEY = "red-anchor-privacy";
const RUNTIME_KEY = "red-anchor-runtime";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readRuntime(): number {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RUNTIME_KEY) || "{}") as { day?: string; seconds?: number };
    if (parsed.day !== todayKey()) return 0;
    return Math.max(0, Number(parsed.seconds) || 0);
  } catch {
    return 0;
  }
}

function writeRuntime(seconds: number) {
  window.localStorage.setItem(RUNTIME_KEY, JSON.stringify({ day: todayKey(), seconds }));
}

export function FleetPulse({ did }: { did: string }) {
  const [ready, setReady] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [update, setUpdate] = useState<{ version: string; url: string } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    setAccepted(window.localStorage.getItem(PRIVACY_KEY) === "1");
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !accepted || !did) return;
    let seconds = readRuntime();
    const started = Date.now();
    let fault = "";
    const beat = async () => {
      const elapsed = seconds + Math.floor((Date.now() - started) / 1000);
      writeRuntime(elapsed);
      const activation = readActivation();
      if (activation?.email) {
        await fetch("/api/cloud/bind-did", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: activation.email, s2Did: did }),
        });
      }
      const response = await fetch("/api/cloud/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s2Did: did,
          version: APP_VERSION,
          uptimeSec: elapsed,
          faultCodes: fault ? [fault] : [],
        }),
      });
      if (!response.ok) {
        fault = "CLOUD_UNREACHABLE";
        return;
      }
      fault = "";
      const data = (await response.json()) as { update?: boolean; latest_version?: string; download_url?: string };
      if (data.update && data.latest_version) setUpdate({ version: data.latest_version, url: data.download_url || "" });
      else setUpdate(null);
      window.dispatchEvent(new Event("red-anchor-pull-broadcasts"));
    };
    void beat().catch(() => undefined);
    const hour = window.setInterval(() => {
      void beat().catch(() => undefined);
    }, 60 * 60 * 1000);
    const minute = window.setInterval(() => writeRuntime(seconds + Math.floor((Date.now() - started) / 1000)), 60 * 1000);
    return () => {
      window.clearInterval(hour);
      window.clearInterval(minute);
    };
  }, [accepted, did, ready]);

  async function consent() {
    const activation = readActivation();
    if (!activation?.email) {
      setNote("请先完成邮箱核验。");
      return;
    }
    const response = await fetch("/api/cloud/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: activation.email, username: activation.username, privacy: true }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNote(data.error || "协议没有记下");
      return;
    }
    window.localStorage.setItem(PRIVACY_KEY, "1");
    setAccepted(true);
    setNote("");
  }

  if (!ready) return null;
  if (!accepted) {
    return (
      <section className="mx-3 mt-3 border border-amber-700 bg-slate-950 px-3 py-3 text-sm">
        <p className="text-amber-100">遥测还没开始。勾选下面这句话之后，哨兵才会向本机母港发送心跳。</p>
        <label className="mt-2 flex items-start gap-2 text-slate-300">
          <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} className="mt-1" />
          <span>We only collect your email, uptime, and tickets. Zero local LAN or 14-dimensional scan data will ever be uploaded.</span>
        </label>
        <button type="button" disabled={!privacy} onClick={() => void consent()} className="mt-2 min-h-10 bg-anchor px-3 text-white disabled:opacity-40">
          同意并登记
        </button>
        {note ? <p className="mt-2 text-amber-300">{note}</p> : null}
      </section>
    );
  }

  if (!update) return null;
  return (
    <p className="mx-3 mt-3 border border-red-700 bg-slate-950 px-3 py-2 text-sm text-red-100">
      发现哨兵新协议（更新） {update.version}
      {update.url ? (
        <a className="ml-2 underline" href={update.url}>
          下载
        </a>
      ) : null}
    </p>
  );
}
