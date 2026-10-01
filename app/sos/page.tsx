"use client";

import { useEffect, useState } from "react";
import { CloudNav } from "@/components/CloudNav";
import { readActivation } from "@/lib/activation";
import { readCachedProfile } from "@/lib/host-client";

interface Reply {
  author: string;
  body: string;
  created_at: string;
}

interface Ticket {
  id: string;
  subject: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  replies: Reply[];
}

const SEVERITY: Record<string, string> = { critical: "危急", high: "高", medium: "中" };

export default function SosPage() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("critical");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const email = typeof window === "undefined" ? "" : readActivation()?.email || "";

  async function load() {
    const current = readActivation()?.email || "";
    if (!current) return;
    const response = await fetch(`/api/cloud/tickets?email=${encodeURIComponent(current)}`);
    const data = (await response.json()) as { tickets?: Ticket[]; error?: string };
    if (!response.ok) throw new Error(data.error || "工单没有取回");
    setTickets(data.tickets || []);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
  }, []);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const current = readActivation();
      if (!current?.email) throw new Error("请先完成邮箱核验");
      const response = await fetch("/api/cloud/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: current.email,
          s2Did: readCachedProfile()?.did || "",
          subject,
          description,
          severity,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "工单没有送出");
      setSubject("");
      setDescription("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "工单没有送出");
    } finally {
      setBusy(false);
    }
  }

  async function reply(id: string) {
    const body = drafts[id] || "";
    const current = readActivation();
    if (!current?.email) return;
    const response = await fetch("/api/cloud/tickets/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email: current.email, body }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "回复没有送出");
      return;
    }
    setDrafts((prev) => ({ ...prev, [id]: "" }));
    await load();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
      <CloudNav />
      <header className="panel border border-red-900 px-4 py-4">
        <p className="font-display text-xs tracking-[0.2em] text-red-300">SOS</p>
        <h1 className="font-display text-3xl tracking-[0.12em]">紧急安全事件上报</h1>
        <p className="mt-2 text-sm text-slate-400">工单只保存你写下的标题、等级和描述，以及邮箱 {email || "（尚未核验）"}。不要在描述里粘贴局域网地址或十四维读数。</p>
      </header>
      <section className="panel space-y-3 p-4">
        <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="事件标题" className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="w-full border border-slate-700 bg-slate-950 px-2 py-2 text-sm">
          <option value="critical">危急</option>
          <option value="high">高</option>
          <option value="medium">中</option>
        </select>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="发生了什么" rows={5} className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
          紧急安全事件上报
        </button>
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      </section>
      <section className="space-y-3">
        {tickets.length === 0 ? <p className="text-sm text-slate-500">还没有工单。</p> : null}
        {tickets.map((ticket) => (
          <article key={ticket.id} className="panel space-y-2 p-4">
            <p className="font-mono text-xs text-red-300">{ticket.id}</p>
            <h2 className="text-lg">{ticket.subject}</h2>
            <p className="text-xs text-slate-500">{SEVERITY[ticket.severity] || ticket.severity} · {ticket.status === "answered" ? "已回复" : "待处理"}</p>
            <p className="text-sm text-slate-300">{ticket.description}</p>
            <ul className="space-y-2">
              {ticket.replies.map((item, index) => (
                <li key={`${ticket.id}-${index}`} className="border border-slate-800 px-2 py-2 text-sm">
                  <span className="text-xs text-slate-500">{item.author === "admin" ? "母港" : "你"}</span>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
            <textarea value={drafts[ticket.id] || ""} onChange={(event) => setDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))} placeholder="继续补充" rows={3} className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
            <button type="button" onClick={() => void reply(ticket.id)} className="min-h-10 border border-slate-600 px-3 text-sm">
              追加反馈
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
