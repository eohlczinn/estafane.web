import React from "react";
import { useClosing } from "../../context/ClosingContext.jsx";
import { formatMoney } from "../../../shared/money.js";
export default function CalculationDetails() {
  const { fields, rules, audit } = useClosing();
  const rows =
    rules.cashBasis === "net"
      ? [
          [
            "Saldo líquido declarado (já inclui movimentações)",
            fields.netCash.value,
          ],
        ]
      : [
          ["+ Fundo inicial", fields.opening.value],
          ["+ Vendas em dinheiro", fields.cash.value],
          ["+ Suprimentos", fields.supplies.value],
          ["− Sangrias", fields.withdrawals.value],
          ...(fields.expenses?.value != null
            ? [["− Despesas autorizadas", fields.expenses.value]]
            : []),
          [
            "− Devoluções aplicáveis",
            rules.refundTreatment === "included" ||
            rules.refundTreatment === "non_cash"
              ? 0
              : fields.refunds.value,
          ],
          ...((
            rules.automatic
              ? rules.cancellationTreatment === "cash_out"
              : rules.deductCancellations
          )
            ? [
                [
                  "− Cancelamentos em dinheiro adicionais",
                  fields.cancellations.value,
                ],
              ]
            : []),
          ...((
            rules.automatic
              ? rules.reversalTreatment === "cash_out"
              : rules.deductReversals
          )
            ? [["− Estornos em dinheiro adicionais", fields.reversals.value]]
            : []),
        ];
  return (
    <details className="calculation-details">
      <summary>Ver memória de cálculo</summary>
      <dl>
        {[
          ...rows,
          ["= Dinheiro esperado", audit.calculation.expected],
          ["Dinheiro contado", fields.counted.value],
          ["Contado − esperado", audit.calculation.difference],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{formatMoney(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="muted">
        PIX, cartões e vale não entram no dinheiro físico. Totais declarados
        conferem a soma; não são somados novamente.
      </p>
      {rules.cancellationTreatment === "included" &&
        (rules.automatic || !rules.deductCancellations) && (
          <p>
            Os cancelamentos já estão descontados nas vendas líquidas e não são
            subtraídos novamente.
          </p>
        )}
      {fields.refunds.status === "derived" && <p>{fields.refunds.original}</p>}
      {rules.cashBasis === "net" && (
        <p>
          O saldo líquido substitui a fórmula bruta. Sangrias não são
          descontadas novamente.
        </p>
      )}
    </details>
  );
}
