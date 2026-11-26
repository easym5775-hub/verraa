/* VERRAA — final conversion block (dark green, one promise, one button). */
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useLang } from "../../i18n";
import { Reveal } from "./Reveal";

export function FinalCTA() {
  const { t } = useLang();
  return (
    <section aria-labelledby="final-cta-title" className="px-5 pb-16 pt-4 sm:px-6 sm:pb-20 lg:pb-24">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="rounded-[28px] bg-[#143626] px-6 py-12 text-center sm:px-10 sm:py-16" style={{ color: "#f6f4ee" }}>
          <h2 id="final-cta-title" className="text-balance mx-auto max-w-xl text-[30px] font-extrabold leading-[1.2] sm:text-[40px]" style={{ color: "#f6f4ee" }}>
            {t("Ready to put your clients in one place?", "جاهز تجمع عملاءك في مكان واحد؟")}
          </h2>
          <p className="text-balance mx-auto mt-4 max-w-lg text-[15px] leading-7" style={{ color: "#cfdcd3" }}>
            {t("Sign up free. Want a 14-day trial of everything? We activate it for you.", "سجّل مجانًا. وعايز تجربة 14 يوم لكل المميزات؟ إحنا بنفعّلها ليك.")}
          </p>
          <div className="mt-7 flex justify-center">
            <Link to="/signup" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f6f4ee] px-8 text-[15px] font-bold text-[#143626] transition hover:bg-white">
              {t("Create free account", "سجّل مجانًا")} <ArrowRight className="h-5 w-5 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
