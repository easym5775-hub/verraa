/* VERRAA — landing: 3 steps + feature blocks (plain copy, real product claims only). */
import { Check } from "lucide-react";
import { useLang } from "../../i18n";
import { Reveal, SectionShell } from "./Reveal";

export function StepsSection() {
  const { t } = useLang();
  const steps = [
    { n: "1", h: t("Create your account", "اعمل حسابك"), p: t("Sign up in a minute. No card.", "سجّل في دقيقة. من غير كارت.") },
    { n: "2", h: t("Build the plan", "جهّز الخطة"), p: t("Workout and nutrition plan for each client.", "خطة تمرين وتغذية لكل عميل.") },
    { n: "3", h: t("Follow up and renew", "تابع وجدّد"), p: t("See check-ins, payments and renewals in one place.", "شوف المتابعات والمدفوعات والتجديدات في مكان واحد.") },
  ];
  return (
    <SectionShell id="how-it-works" eyebrow={t("How it works", "إزاي بيشتغل")} title={t("Start in 3 steps", "ابدأ في 3 خطوات")} labelledBy="steps-title">
      <ol className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 90} className="h-full">
            <li className="h-full list-none rounded-3xl border border-white/[0.08] bg-night-900 p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-volt-400 text-base font-extrabold text-night-950">{s.n}</span>
              <h3 className="mt-4 text-lg font-extrabold text-mist-100">{s.h}</h3>
              <p className="mt-1.5 text-sm leading-6 text-mist-400">{s.p}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </SectionShell>
  );
}

export function FeatureBlocks() {
  const { t } = useLang();
  const blocks = [
    {
      id: "features",
      h: t("Clients and plans, organized", "العملاء والخطط منظمين"),
      pts: [
        t("A full profile for every client: goal, measurements, notes", "ملف كامل لكل عميل: الهدف والقياسات والملاحظات"),
        t("Workout and meal plans per client, per day", "خطط تمرين ووجبات لكل عميل ولكل يوم"),
        t("Export plans as PDF or image to share", "صدّر الخطة PDF أو صورة وابعتها"),
        t("Arabic interface, right to left", "واجهة عربية من اليمين للشمال"),
      ],
      card: [t("Today's workout", "تمرين النهاردة"), "Bench press 4 × 8", "Squat 4 × 6", "Plank 3 × 45s"],
    },
    {
      h: t("Never miss a renewal", "متفوتش تجديد تاني"),
      pts: [
        t("Subscription start and end date for each client", "تاريخ بداية ونهاية الاشتراك لكل عميل"),
        t("See who expires this week and who owes you", "شوف مين هينتهي اشتراكه الأسبوع ده ومين عليه فلوس"),
        t("Record payments and see what is outstanding", "سجّل المدفوعات واعرف المستحق"),
      ],
      card: [t("Renewals this week", "تجديدات الأسبوع"), t("Mona · in 3 days", "منى · بعد 3 أيام"), t("Youssef · in 5 days", "يوسف · بعد 5 أيام"), t("Sara · paid", "سارة · مدفوع")],
      flip: true,
    },
  ];
  return (
    <section aria-label={t("Features", "المميزات")} className="px-5 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-14 sm:gap-20">
        {blocks.map((b, i) => (
          <Reveal key={i}>
            <div id={b.id} className={`grid scroll-mt-24 items-center gap-8 md:grid-cols-2 md:gap-14 ${b.flip ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <h2 className="text-balance text-[26px] font-extrabold leading-[1.2] text-mist-100 sm:text-[32px]">{b.h}</h2>
                <ul className="mt-5 grid gap-3">
                  {b.pts.map((p) => (
                    <li key={p} className="flex items-start gap-2.5 text-[15px] font-semibold leading-6 text-mist-300">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-volt-400/15 text-volt-400"><Check className="h-3 w-3" strokeWidth={3} /></span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-white/[0.08] bg-night-900 p-5" data-no-translate>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-mist-100">{b.card[0]}</p>
                  <span className="rounded-full bg-night-800 px-2.5 py-1 text-[11px] font-bold text-mist-400">{t("Sample data", "بيانات تجريبية")}</span>
                </div>
                <ul className="mt-3 grid gap-2">
                  {b.card.slice(1).map((r) => (
                    <li key={r} className="rounded-2xl border border-white/[0.07] bg-night-850 px-4 py-3 text-sm font-bold text-mist-200">{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
