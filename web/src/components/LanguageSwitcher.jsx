import { useTranslation } from "react-i18next";
import { LANGS } from "../i18n";

export default function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      className="inline-flex rounded-full border border-line bg-card p-0.5"
    >
      {LANGS.map(({ code, label }) => {
        const active = i18n.language === code;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            onClick={() => i18n.changeLanguage(code)}
            className={
              "min-h-10 rounded-full px-3 text-sm font-medium transition-colors " +
              (active ? "bg-copper-deep text-white" : "text-ink hover:bg-wheat")
            }
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
