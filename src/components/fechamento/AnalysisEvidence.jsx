import React, { useState } from "react";
import { ReceiptText, CheckCheck } from "lucide-react";
import { useClosing } from "../../context/ClosingContext.jsx";
import { formatMoney } from "../../../shared/money.js";
import { moneyFields } from "../../../shared/fields.js";
import InventorySummary from "./InventorySummary.jsx";
export default function AnalysisEvidence() {
  const { closing, audit } = useClosing(),
    [open, setOpen] = useState(false),
    transactions = closing.transactions || [];
  const duplicates = transactions.filter((t) => t.duplicateOf),
    valid = transactions.filter(
      (t) => !t.duplicateOf && t.status !== "conflict",
    );
  const paymentKeys = [
    "cash",
    "pix",
    "debit",
    "credit",
    "cards",
    "voucher",
    "other",
  ].filter(
    (k) =>
      closing.fields[k]?.value != null &&
      !(
        k === "cards" &&
        closing.fields.debit.value != null &&
        closing.fields.credit.value != null
      ),
  );
  const notes = (closing.normalizationNotes || []).filter((n) =>
    ["duplicate_receipt", "gross_net_reconciled"].includes(n.code),
  );
  return (
    <>
      {(transactions.length > 0 || paymentKeys.length > 0) && (
        <section className="panel analysis-evidence">
          <h2>
            <CheckCheck size={21} />O que o sistema conferiu
          </h2>
          {paymentKeys.length > 0 && (
            <>
              <div className="recognized-payments">
                {paymentKeys.map((k) => (
                  <span key={k}>
                    {moneyFields[k]}
                    <strong>{formatMoney(closing.fields[k].value)}</strong>
                  </span>
                ))}
              </div>
              <p>
                <strong>
                  {audit.calculation.paymentTotal == null
                    ? "Soma parcial dos pagamentos identificados: "
                    : "Soma dos pagamentos: "}
                  {formatMoney(audit.calculation.knownPaymentsTotal)}
                </strong>
                {audit.calculation.paymentTotal == null
                  ? " · Ainda há categorias não informadas. Esta soma parcial não é o saldo do dinheiro físico."
                  : ""}
              </p>
            </>
          )}
          {transactions.length > 0 && (
            <p className="receipt-count">
              <ReceiptText size={17} />
              {valid.length} cupom(ns) válido(s) · {duplicates.length}{" "}
              repetido(s), excluído(s) da soma
            </p>
          )}
          {notes.map((n, i) => (
            <p key={n.code + ":" + i} className="evidence-note">
              {n.message}
            </p>
          ))}
          {transactions.length > 0 && (
            <details onToggle={(e) => setOpen(e.currentTarget.open)}>
              <summary>Ver cupons e origem dos pagamentos</summary>
              {open && (
                <div className="transaction-list">
                  {transactions.map((t) => (
                    <div
                      key={t.id}
                      className={t.duplicateOf ? "duplicate-receipt" : ""}
                    >
                      <strong>{t.operationId}</strong>
                      <span>
                        {moneyFields[t.field]} · {formatMoney(t.amountCents)} ·
                        pág. {t.source.page}, linha {t.source.line}
                      </span>
                      <small>
                        {t.duplicateOf
                          ? "Repetido · não somado"
                          : t.status === "conflict"
                            ? "Identificador em conflito"
                            : "Incluído na conciliação"}
                      </small>
                    </div>
                  ))}
                </div>
              )}
            </details>
          )}
        </section>
      )}
      <InventorySummary inventory={closing.inventory} />
    </>
  );
}
