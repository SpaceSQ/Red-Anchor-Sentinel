"use client";

import { useEffect, useState } from "react";
import { CloudNav } from "@/components/CloudNav";
import { LAWS } from "@/lib/did";
import { EMPTY_RULES, strengthOf, type LabProfile, type LabRules } from "@/lib/lab-rules";

export default function LabPage() {
  const [profiles, setProfiles] = useState<LabProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [editing, setEditing] = useState<LabProfile | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/lab");
    const data = (await response.json()) as { profiles: LabProfile[]; activeId: string };
    setProfiles(data.profiles || []);
    setActiveId(data.activeId || "");
  }

  useEffect(() => {
    void load().catch(() => setError("实验室档案没有读出"));
  }, []);

  async function createOne() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", customName: "未命名探测体" }),
      });
      const data = (await response.json()) as { profile?: LabProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "没有创建");
      setEditing(data.profile);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有创建");
    } finally {
      setBusy(false);
    }
  }

  async function save(profile: LabProfile): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", profile }),
      });
      const data = (await response.json()) as { profile?: LabProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || "没有保存");
      setEditing(data.profile);
      await load();
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有保存");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish(profile: LabProfile) {
    const saved = await save(profile);
    if (!saved) return;
    setBusy(true);
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id: profile.id }),
      });
      const data = (await response.json()) as { pack?: string; error?: string; profile?: LabProfile };
      if (!response.ok || !data.pack || !data.profile) throw new Error(data.error || "没有发布");
      const blob = new Blob([data.pack], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${data.profile.customName || "Custom_Agent"}.rasprofile`;
      link.click();
      URL.revokeObjectURL(link.href);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "没有发布");
      setBusy(false);
    }
  }

  async function clearSkin() {
    await fetch("/api/lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    window.location.reload();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-4">
      <CloudNav />
      <header className="panel px-4 py-4">
        <p className="font-display text-xs tracking-[0.2em] text-red-300">LAB</p>
        <h1 className="font-display text-3xl tracking-[0.12em]">红锚实验室</h1>
        <p className="mt-2 text-sm text-slate-400">衍生体是一份本机档案，用来更换标题、颜色和更严格的警告线。它不是新的可执行文件。扫描、账本和补丁仍由红锚哨兵执行。</p>
      </header>
      {error ? <p className="text-sm text-amber-300">{error}</p> : null}
      {editing ? (
        <Editor profile={editing} busy={busy} onChange={setEditing} onSave={() => void save(editing)} onPublish={() => void publish(editing)} onBack={() => setEditing(null)} />
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void createOne()} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
              + 创建新探测体
            </button>
            {activeId ? (
              <button type="button" onClick={() => void clearSkin()} className="min-h-11 border border-slate-600 px-4 text-sm">
                回到红锚哨兵
              </button>
            ) : null}
          </div>
          {profiles.length === 0 ? <p className="text-sm text-slate-500">还没有探测体。</p> : null}
          {profiles.map((profile) => (
            <article key={profile.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <h2 className="text-lg">{profile.customName}</h2>
                <p className="text-xs text-slate-500">
                  {profile.status === "published" ? "已发布" : "草稿"} · 自定义强度 {strengthOf(profile.rulesConfig)}
                  {profile.id === activeId ? " · 当前身份" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(profile)} className="min-h-10 border border-slate-600 px-3 text-sm">
                  编辑
                </button>
                <button type="button" onClick={() => void publish(profile)} className="min-h-10 border border-red-800 px-3 text-sm text-red-200">
                  发布
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

function Editor({
  profile,
  busy,
  onChange,
  onSave,
  onPublish,
  onBack,
}: {
  profile: LabProfile;
  busy: boolean;
  onChange: (profile: LabProfile) => void;
  onSave: () => void;
  onPublish: () => void;
  onBack: () => void;
}) {
  const rules = profile.rulesConfig || EMPTY_RULES;
  function patchRules(partial: Partial<LabRules>) {
    onChange({ ...profile, rulesConfig: { ...rules, ...partial } });
  }
  return (
    <section className="panel space-y-3 p-4">
      <button type="button" onClick={onBack} className="text-sm text-slate-400">
        返回列表
      </button>
      <label className="block text-xs text-slate-400">
        专属名称
        <input value={profile.customName} onChange={(event) => onChange({ ...profile, customName: event.target.value })} className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100" />
      </label>
      <label className="block text-xs text-slate-400">
        强调色
        <input type="color" value={profile.brandColor} onChange={(event) => onChange({ ...profile, brandColor: event.target.value })} className="mt-1 h-10 w-20 bg-transparent" />
      </label>
      <label className="block text-xs text-slate-400">
        标志（PNG、JPEG 或 WEBP，80KB 以内）
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-1 block text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 80_000) {
              onChange(profile);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => onChange({ ...profile, logoUrl: String(reader.result || "") });
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-12 w-12 object-contain" /> : null}
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-slate-400">
          声音警告（分贝）
          <input
            value={rules.soundDb ?? ""}
            placeholder="留空沿用原曲线"
            onChange={(event) => patchRules({ soundDb: event.target.value === "" ? null : Number(event.target.value) })}
            className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          氧气警告（% ，不低于 19.5）
          <input
            value={rules.o2Percent ?? ""}
            placeholder="留空沿用原曲线"
            onChange={(event) => patchRules({ o2Percent: event.target.value === "" ? null : Number(event.target.value) })}
            className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-400">
          温度警告（℃）
          <input
            value={rules.heatCelsius ?? ""}
            placeholder="留空沿用原曲线"
            onChange={(event) => patchRules({ heatCelsius: event.target.value === "" ? null : Number(event.target.value) })}
            className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">这些线只能把警告提前。不能把缺氧、切断维生或 5 牛顿熔断改成安全。</p>
      <label className="block text-xs text-slate-400">
        模糊推演补充提示
        <textarea
          value={rules.semanticPrompt}
          onChange={(event) => patchRules({ semanticPrompt: event.target.value.slice(0, 500) })}
          rows={5}
          placeholder="例如：分析网络掉线时，把电磁波的 magnitude 写成 high，并在 summary 里写上你的警告语。"
          className="mt-1 w-full border border-slate-700 bg-transparent px-2 py-2 text-sm text-slate-100"
        />
      </label>
      <div className="border border-slate-800 p-3 text-sm text-slate-300">
        <p className="text-xs text-slate-500">以下三条不可关闭，也不会写入档案。</p>
        <ul className="mt-2 space-y-1">
          {LAWS.map((law) => (
            <li key={law}>{law}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onSave} className="min-h-11 border border-slate-600 px-4 text-sm disabled:opacity-50">
          保存草稿
        </button>
        <button type="button" disabled={busy} onClick={onPublish} className="min-h-11 bg-anchor px-4 text-white disabled:opacity-50">
          发布并以此身份运行
        </button>
      </div>
    </section>
  );
}
