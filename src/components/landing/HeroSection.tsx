/* ================================================================
   VERRAA — landing hero: one promise, two buttons, a labelled
   product card. The card uses sample data and says so.
   ================================================================ */

import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { btnPrimary, btnSecondary } from "../ui";
import { useLang } from "../../i18n";
import { Reveal } from "./Reveal";

export function SampleClientsCard() {
  const { t } = useLang();
  const rows = [
    { n: t("Mona K.", "منى خالد"), s: t("Renews in 3 days", "يتجدد بعد 3 أيام"), tone: "warn" },
    { n: t("Omar H.", "عمر حسن"), s: t("Check-in received", "وصلت متابعة"), tone: "ok" },
    { n: t("Sara A.", "سارة عادل"), s: t("Plan active", "الخطة شغالة"), tone: "ok" },
    { n: t("Youssef N.", "يوسف نبيل"), s: t("Payment due", "دفعة مستحقة"), tone: "warn" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md" data-no-translate>
      <div className="rounded-3xl border border-white/[0.1] bg-night-900 p-4 shadow-md sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-mist-100">{t("My clients", "عملائي")}</p>
          <span className="rounded-full bg-night-800 px-2.5 py-1 text-[11px] font-bold text-mist-400">{t("Sample data", "بيانات تجريبية")}</span>
        </div>
        <ul className="mt-3 grid gap-2">
          {rows.map((r) => (
            <li key={r.n} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-night-850 px-3 py-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-night-700 text-[13px] font-extrabold text-mist-100">{r.n.trim()[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-mist-100">{r.n}</span>
                <span className="block truncate text-xs font-semibold text-mist-500">{r.s}</span>
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.tone === "ok" ? "bg-moss-400" : "bg-warn-400"}`} />
            </li>
          ))}
        </ul>
      </div>
      <p className="absolute -top-3 end-3 rounded-full bg-volt-400 px-3 py-1 text-[11px] font-extrabold text-night-950 shadow-sm">
        {t("All your clients here", "كل عملائك هنا")}
      </p>
      <p className="absolute -bottom-3 start-3 rounded-full border border-white/[0.12] bg-night-900 px-3 py-1 text-[11px] font-bold text-mist-300 shadow-sm">
        {t("Renewals show up by themselves", "التجديدات بتظهر لوحدها")}
      </p>
    </div>
  );
}

export function HeroSection() {
  const { t } = useLang();
  return (
    <section aria-labelledby="landing-hero-title" className="relative overflow-x-clip px-5 pb-16 pt-12 sm:px-6 sm:pt-16 lg:pb-24 lg:pt-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div className="min-w-0 text-center lg:text-start">
          <Reveal>
            <p className="text-[13px] font-bold text-volt-400">{t("For online coaches", "لكوتشات الأونلاين")}</p>
          </Reveal>
          <Reveal delay={80}>
            <h1 id="landing-hero-title" className="text-balance mt-4 text-[36px] font-extrabold leading-[1.15] text-mist-100 sm:text-[48px] lg:text-[54px]">
              {t("All your coaching clients", "كل عملائك")}{" "}
              <span className="underline decoration-volt-400/60 decoration-4 underline-offset-[10px]">{t("in one place", "في مكان واحد")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-balance mx-auto mt-6 max-w-xl text-[15px] leading-7 text-mist-400 sm:text-base sm:leading-8 lg:mx-0">
              {t(
                "Clients, workout and nutrition plans, renewals and payments. No more spreadsheets and lost WhatsApp messages.",
                "العملاء وخطط التمرين والتغذية والتجديدات والمدفوعات. من غير شيتات ومن غير رسايل واتساب ضايعة.",
              )}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <Link to="/signup" className={`${btnPrimary} h-12 px-7 text-[15px]`}>
                {t("Create free account", "سجّل مجانًا")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
              </Link>
              <Link to="/coach-mode" className={`${btnSecondary} h-12 px-7 text-[15px]`}>
                {t("See how it works", "شوف إزاي بيشتغل")}
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[13px] font-semibold text-mist-500 lg:justify-start">
              {[t("No card needed", "من غير كارت"), t("Ready in minutes", "جاهز في دقائق"), t("Full Arabic", "عربي بالكامل")].map((x) => (
                <li key={x} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-volt-400" strokeWidth={3} /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] font-semibold text-mist-500">
              {t("Want to try everything? Sign up and we activate a 14-day trial for you.", "عايز تجرب كل المميزات؟ سجّل وإحنا نفعّلك تجربة 14 يوم.")}
            </p>
          </Reveal>
        </div>
        <Reveal delay={200} className="min-w-0 py-4">
          <SampleClientsCard />
        </Reveal>
      </div>
    </section>
  );
}
