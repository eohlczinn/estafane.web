import React, { useState } from "react";
import { useClosing } from "../../context/ClosingContext.jsx";
import { moneyFields } from "../../../shared/fields.js";
import { movementTypes } from "../../../shared/movements.js";
import { parseMoney, editMoney, formatMoney } from "../../../shared/money.js";
import { sourceLocation } from "../../../shared/source.js";
export default function UnknownLine({ issue }) {
  const { closing, classifyLine, resolveIssue } = useClosing();
  const line = closing.unparsedLines.find((l) => l.id === issue.unknownLineId);
  const [mode, setMode] = useState(""),
    [field, setField] = useState(""),
    [value, setValue] = useState(editMoney(line.value)),
    [reason, setReason] = useState(""),
    [error, setError] = useState("");
  return (
    <details className="audit-resolution">
      <summary>
        {line.text} ·{" "}
        {line.value == null ? "Valor ambíguo" : formatMoney(line.value)}
      </summary>
      <p>{line.reason}</p>
      <small>
        {
          closing.documents.find((d) => d.id === line.source.documentId)
            ?.filename
        }{" "}
        · {sourceLocation(line.source)}
      </small>
      <label>
        Como interpretar esta linha?
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value);
            setField("");
          }}
        >
          <option value="">Selecione após conferir</option>
          <option value="total">
            É um total: substituir o campo do fechamento
          </option>
          <option value="movement">
            É uma movimentação: somar aos itens identificados
          </option>
          <option value="informational">
            É uma referência informativa, sem movimentação adicional
          </option>
        </select>
      </label>
      {mode && mode!=='informational' && line.suggestions?.filter(s=>mode==='total'||Object.values(movementTypes).some(m=>m.field===s.field)).map(s=><div className="category-suggestion" key={s.field}><p>{s.reason}</p><button className="secondary" type="button" onClick={()=>setField(s.field)}>Sugerido: {moneyFields[s.field]}</button></div>)}
      {mode && mode !== "informational" && (
        <>
          <label>
            Categoria financeira
            <select value={field} onChange={(e) => setField(e.target.value)}>
              <option value="">Selecione a categoria</option>
              {Object.entries(moneyFields)
                .filter(
                  ([k]) =>
                    mode === "total" ||
                    Object.values(movementTypes).some((t) => t.field === k),
                )
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Valor conferido
            <input
              value={value}
              inputMode="decimal"
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </>
      )}
      <label>
        Motivo da classificação
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explique a conferência com o documento original"
        />
      </label>
      <button
        className="secondary"
        disabled={
          !mode ||
          reason.trim().length < 8 ||
          (mode !== "informational" && !field)
        }
        onClick={() => {
          try {
            if (mode === "informational") resolveIssue(issue.id, reason);
            else classifyLine(line.id, field, parseMoney(value), reason, mode);
            setError("");
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        Aplicar classificação e recalcular
      </button>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
