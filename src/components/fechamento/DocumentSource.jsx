import React, {useMemo, useState} from "react";
import { useClosing } from "../../context/ClosingContext.jsx";
import {documentOverview} from '../../../shared/closingInsights.js';
export default function DocumentSource() {
  const { pages, extractionWarnings, prefs, closing } = useClosing();
  const [query,setQuery]=useState('');
  const [opened,setOpened]=useState(()=>new Set());
  const pageKey=p=>(p.documentId||'single')+':'+p.page;
  const toggle=(key,isOpen)=>setOpened(old=>{
    if(old.has(key)===isOpen)return old;
    const next=new Set(old);if(isOpen)next.add(key);else next.delete(key);return next;
  });
  const overview=useMemo(()=>documentOverview(closing),[closing]);
  const normalized=query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const visible=overview.filter(p=>!normalized||p.searchable.includes(normalized));
  if (!pages.length || !prefs.showExtraction) return null;
  return (
    <section className="panel source-panel">
      <h2>Entenda o documento inteiro</h2>
      <p className="muted">
        Confira cada página com o documento original. Os campos editados mantêm
        a origem extraída.
      </p>
      <div className="document-map-stats"><span><strong>{pages.length}</strong> páginas / abas lidas</span><span><strong>{overview.reduce((n,p)=>n+p.financial,0)}</strong> linhas com valores</span><span><strong>{overview.reduce((n,p)=>n+p.unknown,0)}</strong> linhas para esclarecer</span></div>
      <label className="document-search">Buscar no texto de todas as páginas<input type="search" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: sangria, PIX, cancelamento"/></label>
      {normalized&&<p className="muted" role="status">{visible.length} página(s) / aba(s) com esse texto.</p>}
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
      {pages.filter((p,i)=>visible.includes(overview[i])).map((p) => (
        <details key={pageKey(p)} open={opened.has(pageKey(p))} onToggle={e=>toggle(pageKey(p),e.currentTarget.open)}>
          <summary>
            {p.filename || "Documento"} ·{" "}
            {p.sheet ? `Aba ${p.sheet}` : `Página ${p.page}`}
            {p.ocr ? " · OCR local" : ""}
          </summary>
          {opened.has(pageKey(p)) && <>
          <div className="document-section-list">{overview.find(o=>o.page===p.page&&o.documentId===p.documentId)?.sections.map(s=><span key={s.line}>{s.title}</span>)}</div>
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
                  {Math.round(l.bounds.y)} · {p.ocr ? 'imagem em pixels' : 'PDF em pontos'}
                </small>
                <span>{l.text}</span>
              </div>
            ))}
          </>}
        </details>
      ))}
    </section>
  );
}
