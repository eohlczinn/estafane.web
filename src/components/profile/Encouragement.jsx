import React, { useEffect, useState } from "react";
import { Heart, Sparkles, Pause, Play, ArrowRight } from "lucide-react";
import { resolvePerformance } from "../../services/preferences.js";
import { useExperience } from "../../context/experience.js";

import { messages } from "../../services/quotes.js";

export default function Encouragement({ prefs, compact = false }) {
  const experience = useExperience();
  const [liked, setLiked] = useState("");
  const [index, setIndex] = useState(0),
    [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const selected = messages.filter(
    ([category]) =>
      prefs.quoteCategory === "mixed" || category === prefs.quoteCategory,
  );
  const position = index % selected.length;
  const canRotate =
    prefs.autoRotateQuotes &&
    prefs.animation !== "off" &&
    !prefs.reduceMotion &&
    resolvePerformance(prefs, navigator) !== "eco" &&
    !reduced;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setVisible(!document.hidden);
    const motion = () => setReduced(media.matches);
    document.addEventListener("visibilitychange", update);
    media.addEventListener("change", motion);
    return () => {
      document.removeEventListener("visibilitychange", update);
      media.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (!prefs.showQuotes || !canRotate || paused || !visible) return;
    const timer = setInterval(
      () => setIndex((i) => i + 1),
      prefs.quoteInterval * 1000,
    );
    return () => clearInterval(timer);
  }, [
    prefs.showQuotes,
    canRotate,
    paused,
    visible,
    prefs.quoteInterval,
    prefs.quoteCategory,
  ]);
  if (!prefs.showQuotes) return null;
  return (
    <section
      className={`encouragement ${compact ? "compact" : ""}`}
      aria-label="Mensagens de inspiração"
    >
      <div className="encouragement-label">
        <Sparkles size={16} /> UMA PAUSA PARA INSPIRAR
      </div>
      <div
        className="encouragement-copy"
        key={`${prefs.quoteCategory}-${position}`}
      >
        <Heart size={22} aria-hidden="true" />
        <p>{selected[position][1]}</p>
      </div>
      <div className="encouragement-controls">
        <span>
          {selected[position][0] === "faith"
            ? "Fé & gratidão"
            : "Carinho & motivação"}{" "}
          · {position + 1}/{selected.length}
        </span>
        <div>
          <button
            type="button"
            aria-pressed={liked === `${prefs.quoteCategory}-${position}`}
            aria-label="Gostei deste estilo de frase"
            onClick={() => {
              setLiked(`${prefs.quoteCategory}-${position}`);
              experience?.record("quotes", selected[position][0]);
            }}
          >
            <Heart size={15} />
          </button>
          {canRotate && (
            <button
              type="button"
              onClick={() => setPaused(!paused)}
              aria-label={paused ? "Retomar frases" : "Pausar frases"}
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIndex((i) => i + 1)}
            aria-label="Próxima frase"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </section>
  );
}
