import React from "react";
import { Calculator, FileText, Printer } from "lucide-react";
import { Link } from "react-router-dom";
import { useClosing } from "../context/ClosingContext.jsx";
import { infoFields, moneyFields } from "../../shared/fields.js";
import { calculate } from "../../shared/calculation.js";
import { formatMoney } from "../../shared/money.js";
import { statusLabels } from "../services/report.js";
import Review from "../components/fechamento/Review.jsx";
import DocumentSource from "../components/fechamento/DocumentSource.jsx";
import SimpleResult from "../components/fechamento/SimpleResult.jsx";
import AnalysisEvidence from '../components/fechamento/AnalysisEvidence.jsx';
import { useWorkspace } from "../context/workspace.js";
export default function Results() {
  const { saveClosing, saving } = useWorkspace();
  const { fields, filename, audit, confirmed, batch } = useClosing(),
    calc = audit.calculation;
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <Calculator />
        </span>
        <div>
          <div className="eyebrow">LEITURA E CÁLCULOS DO DOCUMENTO</div>
          <h1>Resultado do fechamento</h1>
          <p>
            {filename || "Conferência manual"} · Revise os dados antes de
            finalizar.
          </p>
        </div>
      </div>
      <div className="archive-toolbar">
        <button
          className="secondary"
          onClick={() => saveClosing()}
          disabled={saving}
        >
          {saving ? "Salvando…" : "Guardar no histórico"}
        </button>
        <Link className="secondary" to="/historico">
          Ver histórico e iniciar outro caixa
        </Link>
      </div>
      <div className={`result-overview ${calc.result}`}>
        <span className="result-chip">
          {calc.result === "balanced" && !confirmed
            ? "SEM DIFERENÇA · CONFERÊNCIA PENDENTE"
            : statusLabels[calc.result]}
        </span>
        <div>
          <span>Dinheiro esperado</span>
          <strong>{formatMoney(calc.expected)}</strong>
        </div>
        <div>
          <span>Dinheiro contado</span>
          <strong>{formatMoney(fields.counted.value)}</strong>
        </div>
        <div>
          <span>Diferença</span>
          <strong>{formatMoney(calc.difference)}</strong>
        </div>
      </div>
      <SimpleResult />
      <AnalysisEvidence />
      {batch && (
        <Link className="secondary back-batch" to="/lote">
          Voltar aos fechamentos do lote
        </Link>
      )}
      <section className="panel result-information">
        <h2>Informações do caixa</h2>
        <dl>
          {Object.entries(infoFields).map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{fields[key].value || "Pendente"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="results-layout">
        <Review />
        <div>
          <details className="panel payment-results">
            <summary>Ver vendas e pagamentos</summary>
            <h2>Vendas e pagamentos</h2>
            {[
              "sales",
              "cash",
              "pix",
              "debit",
              "credit",
              "cards",
              "voucher",
              "other",
            ].map((key) => (
              <div key={key}>
                <span>{moneyFields[key]}</span>
                <strong>
                  {formatMoney(
                    key === "sales"
                      ? calc.sales
                      : key === "cards"
                        ? calc.cardTotal
                        : fields[key].value,
                  )}
                </strong>
              </div>
            ))}
            <Link className="secondary" to="/imprimir">
              <Printer size={17} /> Opções de impressão
            </Link>
          </details>
          <DocumentSource />
        </div>
      </div>
    </>
  );
}
