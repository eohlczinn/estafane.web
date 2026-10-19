import React from "react";
import { Check } from "lucide-react";
export const paperFormats = [
  ["a4", "A4", "210 × 297 mm", "Relatório completo"],
  ["80", "Térmica 80 mm", "80 mm de largura", "Térmica convencional"],
  ["58", "Térmica 58 mm", "58 mm de largura", "Térmica compacta"],
];
export default function PaperFormats({ value, onChange, compact = false }) {
  return (
    <div
      className={`paper-options ${compact ? "compact-formats" : ""}`}
      role="group"
      aria-label="Formatos de impressão"
    >
      {paperFormats.map(([key, title, dim, sub]) => (
        <button
          type="button"
          key={key}
          className={`paper-option ${value === key ? "selected" : ""}`}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {value === key && <Check className="paper-check" size={18} />}
          <img
            className="paper-photo"
            src={`/illustrations/paper-${key}.png`}
            alt={
              key === "a4"
                ? "Folha A4 para relatório completo"
                : `Bobina de papel térmico ${key} mm`
            }
          />
          <strong>{title}</strong>
          <span>{dim}</span>
          <small>{sub}</small>
        </button>
      ))}
    </div>
  );
}
