"use client";

import { useState } from "react";

interface Beat {
  s2_did: string;
  version: string;
  uptime_sec: number;
  fault_codes: string;
  seen_at: string;
}

interface Ticket {
  id: string;
  email: string;
  subject: string;
  description: string;
  severity: string;
  status: string;
  replies: Array<{ author: string; body: string; created_at: string }>;
}

interface Feedback {
  kind: string;
  name: string;
  email: string;
  subject: string;
  content: string;
  created_at: string;
}

export default function FleetAdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<"fleet" | "sos" | "mail" | "broadcast">("fleet");
  const [castTitle, setCastTitle] = useState("");
  const [castSeverity, setCastSeverity] = useState("INFO");
  const [castBody, setCastBody] = useState("");
  const [castNote, setCastNote] = useState("");
  const [error, setError] = useState("");
  const [emails, setEmails] = useState(0);
  const [online, setOnline] = useState(0);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [version, setVersion] = useState("6.0.0");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);

  async function login() {
    setError("");
    const response = await fetch("/api/cloud/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError("口令不正确");
      return;
    }
    setAuthed(true);
    setPassword("");
    await loadFleet();
  }

  async function loadFleet() {
    const response = await fetch("/api/cloud/admin/overview");
    if (response.status === 401) {
      setAuthed(false);
      return;
    }
    const data = (await response.json()) as { emails: number; online: number; beats: Beat[]; release: { latest_version: string; download_url: string } };
    setEmails(data.emails);
    setOnline(data.online);
    setBeats(data.beats);
    setVersion(data.release.latest_version);
    setDownloadUrl(data.release.download_url);
  }

  async function loadTickets() {
    const response = await fetch("/api/cloud/admin/tickets");
    const data = (await response.json()) as { tickets: Ticket[] };
    setTickets(data.tickets || []);
  }

  async function loadMail() {
    const response = await fetch("/api/cloud/admin/feedback");
    const data = (await response.json()) as { feedbacks: Feedback[] };
    setFeedbacks(data.feedbacks || []);
  }

  async function saveRelease() {
    const response = await fetch("/api/cloud/admin/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, downloadUrl }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) setError(data.error || "版本没有公布");
  }

  async function reply(id: string) {
    const response = await fetch("/api/cloud/admin/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, body: drafts[id] || "" }),
    });
    if (!response.ok) {
      setError("回复没有写下");
      return;
    }
    setDrafts((prev) => ({ ...prev, [id]: "" }));
    await loadTickets();
  }

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
        <h1 className="font-display text-3xl tracking-[0.12em]">母港管控</h1>
        <p className="text-sm text-slate-400">未设置 REDANCHOR_ADMIN_PASSWORD 时，本地口令是 anchor-fleet。</p>
        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="border border-slate-700 bg-transparent px-2 py-2" />
        <button type="button" onClick={() => void login()} className="min-h-11 bg-anchor text-white">
          进入
        </button>
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 p-4">
      <h1 className="font-display text-3xl tracking-[0.12em]">母港管控</h1>
      <div className="flex gap-2">
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => { setTab("fleet"); void loadFleet(); }}>
          全局阵列
        </button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => { setTab("sos"); void loadTickets(); }}>
          工单调度
        </button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => { setTab("mail"); void loadMail(); }}>
          合作信箱
        </button>
        <button type="button" className="min-h-10 border border-slate-600 px-3 text-sm" onClick={() => setTab("broadcast")}>
          广播发布
        </button>
      </div>
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {tab === "fleet" ? (
        <section className="panel space-y-3 p-4">
          <p>已激活邮箱 {emails}</p>
          <p>近 24 小时有心跳的身份 {online}</p>
          <ul className="space-y-1 font-mono text-xs text-slate-400">
            {beats.map((beat) => (
              <li key={`${beat.s2_did}-${beat.seen_at}`}>
                {beat.s2_did} · {beat.version} · {beat.uptime_sec}s · {beat.fault_codes || "无故障码"}
              </li>
            ))}
          </ul>
          <label className="block text-xs text-slate-400">
            公布版本
            <input value={version} onChange={(event) => setVersion(event.target.value)} className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100" />
          </label>
          <label className="block text-xs text-slate-400">
            下载地址
            <input value={downloadUrl} onChange={(event) => setDownloadUrl(event.target.value)} className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100" />
          </label>
          <button type="button" onClick={() => void saveRelease()} className="min-h-10 border border-slate-600 px-3 text-sm">
            公布
          </button>
        </section>
      ) : null}
      {tab === "sos" ? (
        <section className="space-y-3">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="panel space-y-2 p-4">
              <p className="font-mono text-xs text-red-300">{ticket.id}</p>
              <h2>{ticket.subject}</h2>
              <p className="text-xs text-slate-500">{ticket.email} · {ticket.severity} · {ticket.status}</p>
              <p className="text-sm">{ticket.description}</p>
              {ticket.replies.map((item, index) => (
                <p key={`${ticket.id}-${index}`} className="text-sm text-slate-300">
                  {item.author === "admin" ? "母港" : "用户"}：{item.body}
                </p>
              ))}
              <textarea value={drafts[ticket.id] || ""} onChange={(event) => setDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))} rows={3} className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
              <button type="button" onClick={() => void reply(ticket.id)} className="min-h-10 bg-anchor px-3 text-sm text-white">
                回复
              </button>
            </article>
          ))}
        </section>
      ) : null}
      {tab === "broadcast" ? (
        <section className="panel space-y-3 p-4">
          <input value={castTitle} onChange={(event) => setCastTitle(event.target.value)} placeholder="标题" className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
          <select value={castSeverity} onChange={(event) => setCastSeverity(event.target.value)} className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
            <option value="INFO">INFO 常规</option>
            <option value="WARNING">WARNING 警告</option>
            <option value="CRITICAL">CRITICAL 危急</option>
          </select>
          <textarea value={castBody} onChange={(event) => setCastBody(event.target.value)} rows={8} placeholder="Markdown 正文" className="w-full border border-slate-700 bg-transparent px-2 py-2 font-mono text-sm" />
          <button
            type="button"
            className="min-h-11 bg-anchor px-4 text-white"
            onClick={() => {
              setCastNote("");
              void fetch("/api/cloud/broadcasts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: castTitle, severity: castSeverity, content: castBody }),
              }).then(async (response) => {
                const data = (await response.json()) as { error?: string };
                if (!response.ok) {
                  setCastNote(data.error || "没有发出");
                  return;
                }
                setCastTitle("");
                setCastBody("");
                setCastNote("公告已写入母港，哨兵下次拉取时会看到。");
              });
            }}
          >
            发布
          </button>
          {castNote ? <p className={`text-sm ${castNote.startsWith("公告") ? "text-safe" : "text-amber-300"}`}>{castNote}</p> : null}
        </section>
      ) : null}
      {tab === "mail" ? (
        <section className="space-y-3">
          {feedbacks.map((item, index) => (
            <article key={`${item.created_at}-${index}`} className="panel p-4">
              <p className="text-xs text-slate-500">{item.kind === "business" ? "商业合作" : "改进建议"} · {item.name} · {item.email}</p>
              <h2 className="mt-1">{item.subject}</h2>
              <p className="mt-2 text-sm text-slate-300">{item.content}</p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
