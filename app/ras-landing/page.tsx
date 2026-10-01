"use client";

import { useI18n } from "@/lib/i18n";

const RELEASES = "https://github.com/SpaceSQ/Red-Anchor-Sentinel/releases/latest";

export default function RasLandingPage() {
  const { t } = useI18n();
  const downloads = [
    { title: t("land.win"), note: t("land.win.note") },
    { title: t("land.mac"), note: t("land.mac.note") },
    { title: t("land.linux"), note: t("land.linux.note") },
  ];
  const features = [
    { title: t("land.f1.title"), body: t("land.f1.body") },
    { title: t("land.f2.title"), body: t("land.f2.body") },
    { title: t("land.f3.title"), body: t("land.f3.body") },
    { title: t("land.f4.title"), body: t("land.f4.body") },
  ];

  return (
    <main className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8 md:px-8">
      <section className="grid items-center gap-6 border border-red-900/70 bg-slate-950/80 p-5 md:grid-cols-2">
        <div>
          <p className="font-display text-xs tracking-[0.28em] text-red-400">{t("land.kicker")}</p>
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-[0.06em] text-slate-50 md:text-4xl">{t("land.slogan")}</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">{t("land.lead")}</p>
        </div>
        <div className="relative mx-auto h-64 w-64" aria-label={t("land.schematic")}>
          <div className="absolute inset-0 rounded-full border border-red-700/80" />
          <div className="absolute inset-8 rounded-full border border-amber-500/70" />
          <div className="absolute inset-16 rounded-full border border-safe/80" />
          <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-anchor shadow-lamp" />
          <p className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] text-slate-400">{t("land.schematic")}</p>
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl tracking-[0.16em] text-safe">{t("land.features")}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {features.map((feature) => (
            <article key={feature.title} className="border border-slate-800 bg-slate-950/70 p-4">
              <h3 className="font-display tracking-[0.12em] text-red-200">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-300">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl tracking-[0.16em] text-safe">{t("land.download")}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {downloads.map((item) => (
            <a key={item.title} href={RELEASES} className="flex min-h-24 flex-col justify-center border border-anchor bg-red-950/40 px-4 py-4 text-center hover:bg-red-900/50">
              <span className="font-display text-2xl tracking-[0.12em] text-white">{item.title}</span>
              <span className="mt-1 font-mono text-xs text-slate-300">{item.note}</span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">{t("land.download.note")}</p>
      </section>

      <footer className="border-t border-slate-800 pt-4 text-xs text-slate-500">
        <p>{t("land.free")}</p>
        <p>
          {t("land.mail")}：<a className="text-slate-300" href="mailto:smarthomemiles@gmail.com">smarthomemiles@gmail.com</a>
        </p>
      </footer>
    </main>
  );
}
