import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import RingMark from "./RingMark";
import LanguageSwitcher from "./LanguageSwitcher";
import { HomeIcon, PriceIcon, HealthIcon, ChatIcon } from "./Icons";

const ITEMS = [
  { to: "/", key: "home", Icon: HomeIcon, end: true },
  { to: "/price", key: "price", Icon: PriceIcon },
  { to: "/storage-health", key: "health", Icon: HealthIcon },
  { to: "/chat", key: "chat", Icon: ChatIcon },
];

export default function Layout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh pb-24 md:pb-0">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <NavLink to="/" className="flex items-center gap-2" aria-label="OnioRakshak">
            <RingMark size={34} strokeWidth={4} />
            <span className="font-display text-xl font-semibold tracking-tight">OnioRakshak</span>
          </NavLink>

          <nav aria-label={t("nav.menu")} className="ml-4 hidden gap-1 md:flex">
            {ITEMS.map(({ to, key, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  "rounded-md px-3 py-2 " +
                  (isActive
                    ? "font-semibold text-copper-deep underline decoration-copper decoration-2 underline-offset-8"
                    : "text-ink hover:text-copper-deep")
                }
              >
                {t(`nav.${key}`)}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:py-14">
        <Outlet />
      </main>

      <nav
        aria-label={t("nav.menu")}
        className="fixed inset-x-0 bottom-0 grid grid-cols-4 border-t border-line bg-card md:hidden"
      >
        {ITEMS.map(({ to, key, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              "flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs " +
              (isActive ? "bg-wheat font-semibold text-copper-deep" : "text-ink-soft")
            }
          >
            <Icon />
            <span className="text-center leading-tight">{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
