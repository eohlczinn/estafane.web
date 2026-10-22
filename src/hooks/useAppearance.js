import { useEffect } from "react";

export function useAppearance(prefs) {
  useEffect(() => {
    const theme = matchMedia("(prefers-color-scheme: dark)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    const apply = () => {
      root.dataset.theme =
        prefs.theme === "system"
          ? theme.matches
            ? "dark"
            : "light"
          : prefs.theme;
      root.dataset.accent = prefs.accent;
      root.dataset.motion =
        prefs.animation === "off" || prefs.reduceMotion || motion.matches
          ? "reduce"
          : "normal";
      root.dataset.animation = prefs.animation;
      for (const name of [
        "floatingPhoto",
        "ambientGlow",
        "hoverEffects",
        "pageTransitions",
      ])
        root.dataset[name] = String(prefs[name]);
    };
    apply();
    theme.addEventListener("change", apply);
    motion.addEventListener("change", apply);
    return () => {
      theme.removeEventListener("change", apply);
      motion.removeEventListener("change", apply);
    };
  }, [prefs]);
}
