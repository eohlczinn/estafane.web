import React, { useState, useEffect } from "react";
import {
  Calculator,
  Check,
  Printer,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useClosing } from "../../context/ClosingContext.jsx";
import { allFields, infoFields, moneyFields } from "../../../shared/fields.js";
import { parseMoney, editMoney, formatMoney } from "../../../shared/money.js";
import { statusLabels } from "../../services/report.js";
import MovementDetails from "./MovementDetails.jsx";
import CalculationDetails from "./CalculationDetails.jsx";
import UnknownLine from "./UnknownLine.jsx";
import { sourceLocation } from "../../../shared/source.js";
function Field({ fieldKey }) {
  const { fields, update, closing } = useClosing(),
    f = fields[fieldKey],
    [draft, setDraft] = useState(undefined),
    [error, setError] = useState("");
  const money = fieldKey in moneyFields;
  return (
    <label
      className={"review-field " + (f.status === "manual" ? "edited" : "")}
    >
      <span>
        {allFields[fieldKey]}{" "}
        {f.status === "manual" && <small>corrigido</small>}
        {f.status === "default" && <small>padrão</small>}
      </span>
      <input
        value={draft ?? (money ? editMoney(f.value) : (f.value ?? ""))}
        inputMode={money ? "decimal" : undefined}
        placeholder="Não informado"
        maxLength={money ? 24 : 180}
        aria-invalid={!!error}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          try {
            update(
              fieldKey,
              text.trim() === "" ? null : money ? parseMoney(text) : text,
            );
            setError("");
          } catch (e) {
            update(fieldKey, null, "invalid");
            setError(e.message);
          }
        }}
        onBlur={() => {
          if (!error) setDraft(undefined);
        }}
      />
      <small className={error ? "field-error" : ""}>
        {error ||
          (f.source
            ? `${closing.documents.find((d) => d.id === f.source.documentId)?.filename || "Documento"} · ${sourceLocation(f.source)} · ${f.original}`
            : f.status === "default"
              ? f.defaultReason
              : f.status === "manual"
                ? "Informado manualmente"
                : "Pendente de informação")}
      </small>
      {f.history?.length > 0 && (
        <small>
          Anterior:{" "}
          {money
            ? formatMoney(f.history[0].previous)
            : f.history[0].previous || "não informado"}
          . Histórico preservado nesta sessão.
        </small>
      )}
      {f.candidates?.length > 0 && (
        <small>
          Valores encontrados:{" "}
          {f.candidates
            .map((c) => (money ? formatMoney(c.value) : c.value))
            .join(" / ")}
        </small>
      )}
    </label>
  );
}
function Resolution({ issue }) {
  const { resolveIssue } = useClosing(),
    [reason, setReason] = useState("");
  return (
    <div className="audit-resolution">
      <p>{issue.message}</p>
      {issue.source && <small>{sourceLocation(issue.source)}</small>}
      <label>
        Justificativa da conferência
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Explique como conferiu ou corrigiu esta informação"
        />
      </label>
      <button
        className="secondary"
        disabled={reason.trim().length < 8}
        onClick={() => resolveIssue(issue.id, reason)}
      >
        Registrar esclarecimento
      </button>
    </div>
  );
}
function QuickCorrections() {
  const { audit, closing } = useClosing();
  const needed = [
    ...new Set(
      audit.issues
        .map((i) => i.field)
        .filter((k) => k && k !== "counted" && k in allFields),
    ),
  ].join(",");
  const [keys, setKeys] = useState(() => needed.split(",").filter(Boolean));
  useEffect(() => {
    setKeys((old) => [
      ...new Set([...old, ...needed.split(",").filter(Boolean)]),
    ]);
  }, [needed]);
  if (!keys.length) return null;
  return (
    <details className="correction-details" open>
      <summary>Correções rápidas deste caixa</summary>
      <p className="muted">
        Campos apontados pela auditoria. Informe apenas valores conferidos no
        original. Eles continuam aqui durante a digitação.
      </p>
      <div className="field-grid">
        {keys.map((key) => (
          <Field fieldKey={key} key={closing.id + key} />
        ))}
      </div>
    </details>
  );
}
export default function Review() {
  const {
      fields,
      rules,
      setRules,
      closing,
      audit,
      prefs,
      notes,
      setNotes,
      confirmed,
      confirmReviewed,
      setNotice,
      undo,
      saveImportProfile,
    } = useClosing(),
    navigate = useNavigate(),
    calc = audit.calculation;
  const financialText =
    calc.result === "balanced" && !confirmed
      ? "SEM DIFERENÇA · CONFERÊNCIA PENDENTE"
      : statusLabels[calc.result];
  return (
    <section className="panel review-panel" id="conferencia">
      <div className="panel-heading">
        <span className="tile purple">
          <Calculator size={22} />
        </span>
        <div>
          <h2>Conferência do caixa</h2>
          <p>Resultado automático, com origem e auditoria.</p>
        </div>
      </div>
      <div className="review-main">
        <Field key={closing.id + "counted"} fieldKey="counted" />
        <div className="difference">
          <span>Dinheiro esperado</span>
          <strong>{formatMoney(calc.expected)}</strong>
          <small>Diferença: {formatMoney(calc.difference)}</small>
        </div>
        <span className={"result-chip " + calc.result}>{financialText}</span>
      </div>
      {prefs.showCalculation && <CalculationDetails />}
      <MovementDetails />
      <QuickCorrections key={closing.id} />
      {prefs.requireUnrecognized &&
        ["pix", "debit", "credit", "voucher", "other", "shift"].some(
          (k) => fields[k].value == null,
        ) && (
          <details className="correction-details">
            <summary>Informações opcionais não reconhecidas</summary>
            <p className="muted">
              {["pix", "debit", "credit", "voucher", "other", "shift"]
                .filter((k) => fields[k].value == null)
                .map((k) => allFields[k])
                .join(", ")}
              . Não são presumidas como zero; continuam identificadas como não
              informadas.
            </p>
          </details>
        )}
      <details className="correction-details">
        <summary>Corrigir informação ou ver pagamentos</summary>
        <p className="muted">
          Ausência não significa zero. Corrija somente após comparar com o
          documento. Totais manuais substituem o agregado e ficam registrados no
          histórico.
        </p>
        <h3>Identificação</h3>
        <div className="field-grid">
          {Object.keys(infoFields).map((key) => (
            <Field key={closing.id + key} fieldKey={key} />
          ))}
        </div>
        <h3>Pagamentos e totais</h3>
        <div className="field-grid">
          {Object.keys(moneyFields)
            .filter((k) => k !== "counted")
            .map((key) => (
              <Field key={closing.id + key} fieldKey={key} />
            ))}
        </div>
      </details>
      {rules.cashBasis !== "net" &&
        [
          ["cancellations", "cancellationTreatment"],
          ["reversals", "reversalTreatment"],
          ["refunds", "refundTreatment"],
        ].map(
          ([field, policy]) =>
            fields[field].value > 0 &&
            (!rules[policy] || rules.policySource?.[policy]) && (
              <div className="specific-question" key={field}>
                <strong>
                  {allFields[field]}: esclarecimento do efeito financeiro.
                </strong>
                <p>
                  Confira o original e informe somente a natureza desta
                  operação.
                </p>
                <label>
                  Tratamento de {allFields[field]}
                  <select
                    value={rules[policy] || ""}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        [policy]: e.target.value,
                        policySource: {
                          ...rules.policySource,
                          [policy]: {
                            reason:
                              "Confirmado manualmente após conferência do documento",
                            at: new Date().toISOString(),
                          },
                        },
                      })
                    }
                  >
                    <option value="">Selecionar após conferir</option>
                    <option value="included">
                      Já refletido nos valores informados
                    </option>
                    <option value="cash_out">
                      Saída física adicional em dinheiro
                    </option>
                    <option value="non_cash">
                      Operação em pagamento eletrônico
                    </option>
                  </select>
                </label>
              </div>
            ),
        )}
      {audit.issues.length > 0 && (
        <div className="audit-issues" role="status">
          <h3>
            <AlertTriangle size={18} /> Pendências da auditoria
          </h3>
          <ul>
            {audit.issues
              .filter((i) => !i.resolvable)
              .map((i) => (
                <li key={i.id}>{i.message}</li>
              ))}
          </ul>
          {audit.issues
            .filter((i) => i.resolvable)
            .map((i) =>
              i.unknownLineId ? (
                <UnknownLine key={i.id} issue={i} />
              ) : (
                <Resolution key={i.id} issue={i} />
              ),
            )}
        </div>
      )}
      {!audit.issues.length && (
        <p className={"result-banner " + calc.result}>
          {confirmed
            ? "Fechamento confirmado."
            : calc.result === "balanced"
              ? "Cálculo sem diferença. Confira os dados para finalizar."
              : `Diferença identificada: ${formatMoney(calc.difference)}. Confira antes de finalizar.`}
        </p>
      )}
      {prefs.allowNotes && (
        <label className="closing-notes">
          Observações do fechamento
          <textarea
            rows={3}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ocorrências relevantes"
          />
        </label>
      )}
      <div className="automatic-check panel">
        <h3>Conferência automática</h3>
        <p>
          {audit.canConfirm
            ? "Identificação, dados essenciais, pagamentos e movimentações passaram pelas verificações disponíveis."
            : audit.issues.length +
              " pendência(s) precisam de atenção. A lista acima mostra o que corrigir."}
        </p>
        <p>
          {audit.canConfirm
            ? "Confira o resultado e finalize em um toque. Falta ou sobra continua registrada no relatório."
            : "Nenhum valor ausente é tratado como zero sem evidência."}
        </p>
      </div>
      <div className="review-actions">
        <span>
          {confirmed
            ? "Fechamento confirmado"
            : "Confirmação individual obrigatória"}
        </span>
        <button
          className="primary"
          disabled={!audit.canConfirm || confirmed}
          onClick={() => {
            if (confirmReviewed()) {
              setNotice("Fechamento confirmado. Você pode salvar ou imprimir.");
              navigate("/relatorio");
            }
          }}
        >
          <Check size={17} />
          {prefs.confirmBeforeFinish
            ? "Conferi os dados · confirmar fechamento"
            : "Confirmar fechamento"}
        </button>
      </div>
      <div className="closing-export-actions">
        <button
          className="secondary"
          disabled={!closing.undoStack?.length}
          onClick={undo}
        >
          Desfazer última alteração
        </button>
        {confirmed && closing.profileCorrections?.length > 0 && (
          <button className="secondary" onClick={saveImportProfile}>
            Salvar classificações como perfil deste layout
          </button>
        )}
        <button className="secondary" onClick={() => navigate("/imprimir")}>
          <Printer size={18} />
          Imprimir
        </button>
        <button className="secondary" onClick={() => navigate("/relatorio")}>
          <Download size={18} />
          Salvar PDF / ver relatório
        </button>
      </div>
    </section>
  );
}
