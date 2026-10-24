import React, { useRef, useEffect } from "react";
export default function DepthCard({ children, className = "" }) {
  const frame = useRef(0),
    element = useRef(null);
  const reset = () => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    element.current?.style.removeProperty("--tilt-x");
    element.current?.style.removeProperty("--tilt-y");
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  function move(event) {
    const root = document.documentElement;
    if (
      event.pointerType !== "mouse" ||
      root.dataset.motion === "reduce" ||
      root.dataset.tilt3d !== "true" ||
      root.dataset.hoverEffects === "false" ||
      root.dataset.inactive === "true"
    )
      return reset();
    const { clientX, clientY } = event;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const el = element.current;
      if (!el) return;
      const rect = el.getBoundingClientRect(),
        strength = Number(root.dataset.tiltStrength) || 5;
      el.style.setProperty(
        "--tilt-x",
        `${Math.max(-1, Math.min(1, (clientY - rect.top) / rect.height - 0.5)) * -strength}deg`,
      );
      el.style.setProperty(
        "--tilt-y",
        `${Math.max(-1, Math.min(1, (clientX - rect.left) / rect.width - 0.5)) * strength}deg`,
      );
    });
  }
  return (
    <div
      ref={element}
      className={"depth-card " + className}
      onPointerMove={move}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      {children}
    </div>
  );
}
