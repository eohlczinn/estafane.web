import React from "react";
import { useClosing } from "../../context/ClosingContext.jsx";
export default function DocumentSource() {
  const { pages, extractionWarnings, prefs } = useClosing();
  if (!pages.length || !prefs.showExtraction) return null;
  return (
    <section className="panel source-panel">
      <h2>Texto e origem dos dados</h2>
      <p className="muted">
        Confira cada página com o documento original. Os campos editados mantêm
        a origem extraída.
      </p>
      {extractionWarnings.length > 0 && (
        <div className="extraction-warnings">
          <strong>A leitura exige atenção</strong>
          <ul>
            {extractionWarnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      {pages.map((p) => (
        <details key={(p.documentId || "single") + ":" + p.page}>
          <summary>
            {p.filename || "Documento"} · {p.sheet ? `Aba ${p.sheet}` : `Página ${p.page}`}
            {p.ocr ? " · OCR local" : ""}
          </summary>
          <pre>
            {p.text ||
              "Nenhum texto reconhecido. Preencha os campos manualmente."}
          </pre>
          {p.lines
            ?.filter((l) => l.bounds)
            .map((l) => (
              <div className="source-coordinate" key={l.line}>
                <small>
                  Linha {l.line} · x {Math.round(l.bounds.x)}, y{" "}
                  {Math.round(l.bounds.y)} · PDF em pontos
                </small>
                <span>{l.text}</span>
              </div>
            ))}
        </details>
      ))}
    </section>
  );
}
