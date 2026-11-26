/* Language switch: two languages, the visitor picks, the choice is remembered. */
import { useLang } from "../i18n";

export function LangSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div
      role="group"
      aria-label={lang === "ar" ? "اللغة" : "Language"}
      data-no-translate
      className={`inline-flex h-9 shrink-0 items-center rounded-full border border-white/[0.1] bg-white/[0.04] p-0.5 text-[12px] font-bold ${className}`}
    >
      {([["ar", "عربي"], ["en", "EN"]] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setLang(id)}
          aria-pressed={lang === id}
          lang={id}
          className={`h-8 min-w-[40px] cursor-pointer rounded-full px-3 transition ${lang === id ? "bg-volt-400 text-night-950" : "text-mist-400 hover:text-mist-100"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
