import React from "react";
import { formatMoney } from "../../../shared/money.js";
import { statusLabels } from "../../services/report.js";
export default function ClosingCard({ closing, onOpen, selected, onSelect }) {
  const c = closing.audit.calculation,
    confirmed = closing.confirmed && closing.audit.status === "validated";
  return (
    <section
      className={"panel closing-card " + (confirmed ? c.result : "pending")}
    >
      <div className="closing-card-title">
        <div>
          <small>
            {closing.fields.market.value || "Estabelecimento pendente"}
          </small>
          <h2>Caixa {closing.fields.register.value || "não identificado"}</h2>
          <p>
            {closing.fields.operator.value || "Operadora pendente"} ·{" "}
            {closing.fields.date.value || "Data pendente"} ·{" "}
            {closing.fields.shift.value || "Período não informado"}
          </p>
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            disabled={!confirmed}
          />
          Selecionar
        </label>
      </div>
      <div className="closing-amounts">
        {[
          ["Vendas", c.sales],
          ["Sangrias (saída)", closing.fields.withdrawals.value],
          ["Esperado", c.expected],
          ["Contado", closing.fields.counted.value],
          ["Diferença", c.difference],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {label === "Sangrias (saída)" && value != null ? "− " : ""}
              {formatMoney(value)}
            </strong>
          </div>
        ))}
      </div>
      <span className={"result-chip " + (confirmed ? c.result : "pending")}>
        {confirmed ? statusLabels[c.result] : "PENDENTE DE CONFERÊNCIA"}
      </span>
      <small>
        {closing.documentIds.length} documento(s) ·{" "}
        {closing.audit.issues.length} pendência(s)
      </small>
      <button className="secondary" onClick={onOpen}>
        {confirmed ? "Ver detalhes / imprimir" : "Ver pendências e conferir"}
      </button>
    </section>
  );
}
