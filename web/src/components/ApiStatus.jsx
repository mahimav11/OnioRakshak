import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getJson } from "../lib/api";

export default function ApiStatus() {
  const { t } = useTranslation();
  const [state, setState] = useState({ phase: "checking", chatbot: false });

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const data = await getJson("/health");
        if (alive) setState({ phase: "online", chatbot: Boolean(data.chatbot) });
      } catch {
        if (alive) setState({ phase: "offline", chatbot: false });
      }
    };
    check();
    const id = setInterval(check, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const dot = {
    checking: "bg-amber",
    online: "bg-crop",
    offline: "bg-alert",
  }[state.phase];

  return (
    <div aria-live="polite" className="text-sm text-ink-soft">
      <p className="flex items-center gap-2">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
        {t(`status.${state.phase}`)}
        {state.phase === "online" && (
          <span>{state.chatbot ? ` · ${t("status.chatReady")}` : ` · ${t("status.chatOff")}`}</span>
        )}
      </p>
      {state.phase === "offline" && (
        <p className="mt-1 font-mono text-xs">{t("status.offlineHelp")}</p>
      )}
    </div>
  );
}
