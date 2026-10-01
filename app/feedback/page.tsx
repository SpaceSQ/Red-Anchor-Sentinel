"use client";

import { useState } from "react";
import { CloudNav } from "@/components/CloudNav";
import { readActivation } from "@/lib/activation";

export default function FeedbackPage() {
  const [kind, setKind] = useState<"suggestion" | "business">("suggestion");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    setDone(false);
    try {
      const response = await fetch("/api/cloud/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, email: email || readActivation()?.email || "", subject, content }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "没有送达");
      setDone(true);
      setSubject("");
      setContent("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有送达");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-4 p-4">
      <CloudNav />
      <header className="panel px-4 py-4">
        <p className="font-display text-xs tracking-[0.2em] text-red-300">FEEDBACK</p>
        <h1 className="font-display text-3xl tracking-[0.12em]">建议与商业合作</h1>
        <p className="mt-2 text-sm text-slate-400">这是一次送达。页面不保留往来记录。</p>
      </header>
      <div className="flex gap-2">
        <button type="button" onClick={() => setKind("suggestion")} className={`min-h-10 border px-3 text-sm ${kind === "suggestion" ? "border-anchor text-red-200" : "border-slate-700"}`}>
          软件改进建议
        </button>
        <button type="button" onClick={() => setKind("business")} className={`min-h-10 border px-3 text-sm ${kind === "business" ? "border-anchor text-red-200" : "border-slate-700"}`}>
          商业合作
        </button>
      </div>
      <section className="panel space-y-3 p-4">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="联系人姓名" className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="联系人邮箱" className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
        <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="主题" className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="具体内容" rows={6} className="w-full border border-slate-700 bg-transparent px-2 py-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => void submit()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
          送出
        </button>
        {done ? <p className="text-sm text-safe">已送达红锚基地，感谢您的反馈</p> : null}
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      </section>
    </main>
  );
}
