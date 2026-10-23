import React from "react";
import { formatMoney } from "../../../shared/money.js";
export default function BatchSummary({ summary }) {
  return (
    <>
      <div className="batch-summary">
        {[
          ["Vendas confirmadas", formatMoney(summary.totalSalesCents)],
          [
            "Fechamentos confirmados",
            summary.validatedCount + " / " + summary.closingCount,
          ],
          ["Total de faltas", formatMoney(summary.totalShortCents)],
          ["Total de sobras", formatMoney(summary.totalOverCents)],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p
        className={
          "batch-summary-note " + (summary.partial ? "pending" : "balanced")
        }
      >
        {summary.partial
          ? `Resumo parcial: ${summary.pendingCount} fechamento(s) pendente(s) e ${summary.failedDocumentCount} documento(s) com erro/cancelados. Os valores acima incluem somente fechamentos confirmados.`
          : `Todos os fechamentos confirmados. Saldo líquido das diferenças: ${formatMoney(summary.netDifferenceCents)}. Faltas e sobras permanecem identificadas separadamente.`}
      </p>
      {summary.validatedCount > 0 && (
        <details className="panel">
          <summary>Vendas confirmadas por operadora, dia e turno</summary>
          {[
            ["byOperator", "Operadora"],
            ["byDate", "Data"],
            ["byShift", "Turno"],
          ].map(([key, label]) => (
            <div key={key}>
              <h3>{label}</h3>
              <dl>
                {summary[key]?.map((group) => (
                  <div className="summary-breakdown" key={group.label}>
                    <dt>
                      {group.label} · {group.count} fechamento(s)
                    </dt>
                    <dd>
                      Vendas: {formatMoney(group.salesCents)} · Diferença:{" "}
                      {formatMoney(group.differenceCents)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
