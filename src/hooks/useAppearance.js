import { useEffect } from "react";
import { resolvePerformance } from '../services/preferences.js';

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
      const performance=resolvePerformance(prefs,navigator);
      root.dataset.performance=performance;
      root.dataset.surface=prefs.surface;
      root.dataset.density=prefs.density;
      root.dataset.colorDepth=prefs.colorDepth;
      root.dataset.inactive=String(prefs.pauseWhenHidden && document.hidden);
      root.style.setProperty('--font-scale',prefs.fontScale/100);
      root.style.fontSize=`${14*prefs.fontScale/100}px`;
      root.dataset.motion =
        prefs.animation === "off" || prefs.reduceMotion || motion.matches || performance === 'eco'
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
    document.addEventListener('visibilitychange',apply);
    navigator.connection?.addEventListener('change',apply);
    return () => {
      theme.removeEventListener("change", apply);
      motion.removeEventListener("change", apply);
      document.removeEventListener('visibilitychange',apply);
      navigator.connection?.removeEventListener('change',apply);
    };
  }, [prefs]);
}
