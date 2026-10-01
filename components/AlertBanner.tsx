"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Broadcast {
  id: string;
  title: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  content: string;
  created_at: string;
  publisher: string;
}

const READ_KEY = "red-anchor-broadcast-reads";
const RANK = { CRITICAL: 3, WARNING: 2, INFO: 1 } as const;

function readIds(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(READ_KEY) || "[]") as string[];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function tone(severity: Broadcast["severity"], unread: boolean): string {
  if (severity === "CRITICAL") return `border-red-600 bg-red-950/80 text-red-100${unread ? " alert-pulse" : ""}`;
  if (severity === "WARNING") return "border-amber-500 bg-amber-950/70 text-amber-100";
  return "border-cyan-600 bg-cyan-950/60 text-cyan-100";
}

export function AlertBanner() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);

  async function pull() {
    const response = await fetch("/api/cloud/broadcasts");
    if (!response.ok) return;
    const data = (await response.json()) as { broadcasts?: Broadcast[] };
    setItems(data.broadcasts || []);
  }

  useEffect(() => {
    setRead(readIds());
    void pull();
    const hour = window.setInterval(() => void pull(), 60 * 60 * 1000);
    const onPull = () => void pull();
    window.addEventListener("red-anchor-pull-broadcasts", onPull);
    return () => {
      window.clearInterval(hour);
      window.removeEventListener("red-anchor-pull-broadcasts", onPull);
    };
  }, []);

  const unread = items.filter((item) => !read.includes(item.id));
  const lead = useMemo(() => {
    const pool = unread.length > 0 ? unread : items;
    return [...pool].sort((left, right) => RANK[right.severity] - RANK[left.severity] || right.created_at.localeCompare(left.created_at))[0] || null;
  }, [items, unread]);

  function mark(id: string) {
    const next = read.includes(id) ? read : [id, ...read].slice(0, 80);
    setRead(next);
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  }

  function openOne(id: string) {
    setCurrent(id);
    setOpen(true);
    mark(id);
  }

  if (!lead) return null;
  const shown = items.find((item) => item.id === current) || null;

  return (
    <>
      <div className={`flex items-center gap-3 border px-3 py-2 ${tone(lead.severity, !read.includes(lead.id))}`}>
        <button type="button" onClick={() => openOne(lead.id)} className="min-w-0 flex-1 truncate text-left text-sm">
          {lead.severity === "CRITICAL" ? "⚠️ " : ""}
          {lead.title}
        </button>
        <button type="button" onClick={() => { setCurrent(null); setOpen(true); }} className="shrink-0 text-xs">
          查看全部公告
          {unread.length > 0 ? <span className="ml-2 inline-block min-w-5 rounded-full bg-anchor px-1 text-center text-white">{unread.length}</span> : null}
        </button>
      </div>
      {open ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-auto border-l border-slate-700 bg-slate-950 p-4 pb-14 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display tracking-[0.14em]">{shown ? "公告正文" : "全部公告"}</h2>
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 border border-slate-600 px-3 text-sm">
              关闭
            </button>
          </div>
          {shown ? (
            <article>
              <button type="button" onClick={() => setCurrent(null)} className="mb-3 text-xs text-slate-400">
                返回列表
              </button>
              <p className="text-xs text-slate-500">{shown.severity} · {shown.publisher} · {shown.created_at.slice(0, 16).replace("T", " ")}</p>
              <h3 className="mt-1 text-2xl">{shown.title}</h3>
              <div className="broadcast-md mt-4 space-y-2 text-sm leading-6 text-slate-200">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h2 className="mt-3 text-xl">{children}</h2>,
                    h2: ({ children }) => <h3 className="mt-3 text-lg">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
                    code: ({ children }) => <code className="bg-slate-900 px-1 font-mono text-xs">{children}</code>,
                    pre: ({ children }) => <pre className="overflow-auto border border-slate-800 bg-slate-900 p-3 font-mono text-xs">{children}</pre>,
                    a: ({ href, children }) =>
                      href && /^https?:\/\//.test(href) ? (
                        <a href={href} className="underline" rel="noreferrer" target="_blank">
                          {children}
                        </a>
                      ) : (
                        <span>{children}</span>
                      ),
                  }}
                >
                  {shown.content}
                </ReactMarkdown>
              </div>
            </article>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => openOne(item.id)} className="w-full border border-slate-800 px-3 py-2 text-left">
                    <span className="text-sm">{item.severity === "CRITICAL" ? "⚠️ " : ""}{item.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.severity} · {read.includes(item.id) ? "已读" : "未读"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      ) : null}
    </>
  );
}
