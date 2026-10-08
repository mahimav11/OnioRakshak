import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import RingMark from "../components/RingMark";
import ApiStatus from "../components/ApiStatus";

const ENTRIES = [
  { to: "/price", key: "price" },
  { to: "/storage-health", key: "health" },
  { to: "/chat", key: "chat" },
];

export default function Home() {
  const { t } = useTranslation();

  return (
    <div className="grid items-center gap-10 md:grid-cols-[1fr_auto]">
      <div className="max-w-xl">
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {t("home.title")}
        </h1>
        <p className="mt-5 text-lg text-ink-soft">{t("home.intro")}</p>

        <ul className="mt-8 divide-y divide-line border-y border-line">
          {ENTRIES.map(({ to, key }) => (
            <li key={to}>
              <Link to={to} className="block px-1 py-4 hover:bg-card">
                <span className="block font-display text-xl font-semibold text-copper-deep">
                  {t(`nav.${key}`)}
                </span>
                <span className="mt-1 block text-ink-soft">{t(`home.${key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <ApiStatus />
        </div>
      </div>

      <RingMark animate size={280} strokeWidth={2.2} className="mx-auto w-48 md:w-72" />
    </div>
  );
}
