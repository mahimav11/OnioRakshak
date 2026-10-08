import { useTranslation } from "react-i18next";

// Stand-in until each page is built in its own branch.
export default function Placeholder({ navKey }) {
  const { t } = useTranslation();
  return (
    <div className="max-w-xl">
      <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
        {t(`nav.${navKey}`)}
      </h1>
      <p className="mt-4 text-ink-soft">{t("soon")}</p>
    </div>
  );
}
