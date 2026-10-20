import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileCheck2,
  Printer,
  Download,
  ArrowLeft,
  X,
  Check,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useClosing } from "../context/ClosingContext.jsx";
import { calculate } from "../../shared/calculation.js";
import {
  closingReport,
  consolidatedReport,
  statusLabels,
} from "../services/report.js";
import PaperFormats from "../components/printing/PaperFormats.jsx";
import { reportFilename } from "../services/preferences.js";
export default function Report({ printPage = false }) {
  const { closing, batch, prefs, setNotice } = useClosing(),
    [modal, setModal] = useState(printPage),
    [paper, setPaper] = useState(prefs.paper),
    [zoom, setZoom] = useState(100),
    [modalZoom, setModalZoom] = useState("fit"),
    [fitZoom, setFitZoom] = useState(1),
    [generated] = useState(() => new Date());
  const [params] = useSearchParams(),
    scope = params.get("scope") || "individual";
  const requested = (params.get("ids") || "").split(",").filter(Boolean),
    selected = (batch?.closings || []).filter((c) => requested.includes(c.id));
  const models =
    scope === "consolidated" && batch
      ? [consolidatedReport(batch, prefs)]
      : scope === "selected"
        ? selected.map((c) => closingReport(c, prefs))
        : [closingReport(closing, prefs)];
  const confirmed =
    scope === "consolidated"
      ? !!batch
      : models.length > 0 &&
        models.every((m) => m.final) &&
        (scope !== "selected" || selected.length === requested.length);
  const partial = models.some((m) => m.partial),
    calc = models[0]?.calc || { result: "pending" };
  const modalPreview = useRef(null);
  useEffect(() => {
    const element = modalPreview.current;
    if (!modal || !prefs.preview || !element) return;
    function fit() {
      const style = getComputedStyle(element),
        available =
          element.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
      setFitZoom(
        Math.min(
          1,
          available / (((paper === "a4" ? 210 : Number(paper)) * 96) / 25.4),
        ),
      );
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [modal, paper, prefs.preview]);
  useEffect(() => {
    setModal(printPage);
  }, [printPage]);
  useEffect(() => {
    if (!modal) return;
    const dialog = document.querySelector(".print-modal"),
      previous = document.activeElement;
    const controls = () =>
      [...dialog.querySelectorAll("button,select,input")].filter(
        (el) => !el.disabled,
      );
    controls()[0]?.focus();
    function keydown(event) {
      if (event.key === "Escape") setModal(false);
      if (event.key === "Tab") {
        const list = controls(),
          first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [modal, confirmed]);
  async function save() {
    if (!confirmed) return;
    try {
      const { reportPDF, individualFilename, saveIndividualReports } =
        await import("../services/pdfGenerator.js");
      if (scope === "selected")
        await saveIndividualReports(selected, { ...prefs, paper });
      else
        reportPDF(models[0], prefs, paper, generated).save(
          scope === "consolidated"
            ? reportFilename(
                {
                  ...prefs,
                  filename:
                    prefs.filename +
                    "-consolidado-" +
                    (partial ? "parcial-" : "") +
                    batch.id.slice(0, 8),
                },
                generated,
                paper,
              )
            : individualFilename(closing, prefs, paper, generated),
        );
      setNotice("PDF gerado e enviado para download no navegador.");
    } catch {
      setNotice(
        "Não foi possível gerar o relatório. Confira o formato e o logotipo configurados.",
      );
    }
  }
  function print() {
    if (!confirmed) return;
    document.getElementById("paper-size")?.remove();
    const style = document.createElement("style");
    style.id = "paper-size";
    const articles = [
      // The print portal is hidden on screen: measure the visible preview.
      ...document.querySelectorAll(".preview-stage .report-paper"),
    ];
    style.textContent = articles
      .map(
        (article, i) =>
          `@page closing${i} { size: ${paper === "a4" ? "A4" : paper + "mm " + Math.ceil((article.scrollHeight * 25.4) / 96 + prefs.marginThermal * 2) + "mm"}; margin: ${paper === "a4" ? prefs.marginA4 : prefs.marginThermal}mm; } #print-root .report-paper[data-print-index="${i}"] { page: closing${i}; }`,
      )
      .join("\n");
    document.head.append(style);
    window.addEventListener("afterprint", () => style.remove(), { once: true });
    window.print();
    setNotice(
      "Solicitação de impressão enviada ao navegador. Confirme a impressora no diálogo; a impressão física não pode ser verificada pelo sistema.",
    );
  }
  const preview = models.map((model, index) => (
    <article
      key={model.id}
      data-print-index={index}
      className={`report-paper paper-${paper}`}
      style={{
        padding: `${paper === "a4" ? prefs.marginA4 : prefs.marginThermal}mm`,
      }}
    >
      {!model.final && (
        <div className="draft-stamp">
          {scope === "consolidated"
            ? "CONSOLIDADO PARCIAL · HÁ PENDÊNCIAS"
            : "PRÉVIA · AGUARDANDO CONFERÊNCIA"}
        </div>
      )}
      <header>
        {prefs.includeMarket && prefs.logo && (
          <img
            className="report-logo"
            src={prefs.logo}
            alt="Logotipo do estabelecimento"
          />
        )}
        {prefs.includeMarket && <small>{model.market}</small>}
        <h2>{model.title}</h2>
      </header>
      {model.rows.map(([a, b], i) =>
        a ? (
          <div
            className={`report-row ${a === "Resultado" ? "report-result" : ""}`}
            key={i}
          >
            <span>{a}</span>
            <strong>{b}</strong>
          </div>
        ) : (
          <h3 key={i}>{b}</h3>
        ),
      )}
      {prefs.signature && (
        <div className="signature">Assinatura da responsável</div>
      )}
      <footer>
        {prefs.includeGenerationTime && (
          <span>
            Gerado em{" "}
            {generated.toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
            })}
          </span>
        )}
        <span>
          estefane-web ·{" "}
          {model.final
            ? "Conferido manualmente"
            : scope === "consolidated"
              ? "PARCIAL · Não totalmente validado"
              : "Prévia não confirmada"}
        </span>
      </footer>
    </article>
  ));
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <FileCheck2 />
        </span>
        <div>
          <div className="eyebrow">
            {confirmed
              ? "FECHAMENTO CONFIRMADO"
              : "FORMATOS E PRÉVIA DO RELATÓRIO"}
          </div>
          <h1>
            {scope === "consolidated"
              ? "Relatório consolidado"
              : scope === "selected"
                ? "Relatórios selecionados"
                : printPage
                  ? "Imprimir fechamento"
                  : confirmed
                    ? "Seu relatório está pronto"
                    : "Relatório de fechamento"}
          </h1>
          <p>
            Revise a prévia e escolha o formato ideal para salvar ou imprimir.
          </p>
        </div>
      </div>
      {!confirmed && (
        <div className="print-pending-notice">
          <div>
            <strong>Escolha o formato de impressão abaixo.</strong>
            <p>
              Você pode visualizar os três formatos agora. Para salvar ou
              imprimir o relatório final, confira os valores e confirme o
              fechamento.
            </p>
          </div>
          <Link
            className="primary"
            to={scope === "individual" ? "/resultado" : "/lote"}
          >
            <ArrowLeft size={17} /> Conferir fechamento
          </Link>
        </div>
      )}
      <div className="report-toolbar panel">
        <span className={`result-chip ${scope==='individual'?calc.result:partial?'pending':'consolidated'}`}>
          {scope === "consolidated"
            ? partial
              ? "CONSOLIDADO PARCIAL"
              : "CONSOLIDADO VALIDADO"
            : !confirmed
              ? "CONFERÊNCIA PENDENTE"
              : scope==='selected'
                ? `${models.length} FECHAMENTOS CONFIRMADOS`
              : statusLabels[calc.result]}
        </span>
        <button className="secondary" onClick={() => setModal(true)}>
          <Printer size={18} /> Imprimir
        </button>
        <button className="primary" onClick={save} disabled={!confirmed}>
          <Download size={18} />{" "}
          {scope === "selected" ? "Salvar PDFs (ZIP)" : "Salvar PDF"}
        </button>
      </div>
      <label className="zoom-control">
        Zoom da prévia{" "}
        <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
          {[50, 75, 100, 125, 150].map((n) => (
            <option key={n} value={n}>
              {n}%
            </option>
          ))}
        </select>
      </label>
      <div className="preview-stage">
        <div style={{ zoom: zoom / 100 }}>{preview}</div>
      </div>
      {modal &&
        createPortal(
          <div className="modal-backdrop">
            <section
              className="print-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="print-title"
            >
              <div className="modal-title">
                <div>
                  <div className="eyebrow">SEU RELATÓRIO, DO SEU JEITO</div>
                  <h2 id="print-title">Escolha o formato de impressão</h2>
                </div>
                <button
                  className="icon-btn"
                  aria-label="Fechar"
                  onClick={() => setModal(false)}
                >
                  <X />
                </button>
              </div>
              <PaperFormats value={paper} onChange={setPaper} />
              {prefs.preview && (
                <>
                  <label className="zoom-control modal-zoom">
                    Zoom da prévia de impressão
                    <select
                      value={modalZoom}
                      onChange={(e) => setModalZoom(e.target.value)}
                    >
                      <option value="fit">Ajustar à tela</option>
                      {[50, 75, 100, 125].map((n) => (
                        <option key={n} value={n}>
                          {n}%
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="modal-preview" ref={modalPreview}>
                    <div
                      style={{
                        zoom:
                          modalZoom === "fit"
                            ? fitZoom
                            : Number(modalZoom) / 100,
                      }}
                    >
                      {preview}
                    </div>
                  </div>
                </>
              )}
              <p className="print-help">
                {!confirmed && (
                  <strong>
                    Confirme o fechamento para habilitar Salvar PDF e
                    Imprimir.{" "}
                  </strong>
                )}
                A impressão abre o diálogo do navegador. Selecione a impressora
                e ajuste o papel para o formato escolhido. A detecção e
                configuração dependem do dispositivo.
              </p>
              <div className="modal-actions">
                <button className="secondary" onClick={() => setModal(false)}>
                  Cancelar
                </button>
                <button
                  className="secondary"
                  onClick={save}
                  disabled={!confirmed}
                >
                  <Download size={17} /> Salvar PDF
                </button>
                <button
                  className="primary"
                  onClick={print}
                  disabled={!confirmed}
                >
                  <Printer size={17} /> Imprimir
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )}
      {confirmed &&
        createPortal(<div id="print-root">{preview}</div>, document.body)}
    </>
  );
}
