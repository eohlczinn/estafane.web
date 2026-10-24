import React, { useState } from "react";
import {
  ChartNoAxesColumnIncreasing,
  ShoppingCart,
  Banknote,
  WalletCards,
  ArrowRight,
  FileCheck2,
  ScanLine,
  ShieldCheck,
  FolderOpen,
  CalendarDays,
  UserRound,
  Store,
  Printer,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useClosing } from "../context/ClosingContext.jsx";
import { calculate } from "../../shared/calculation.js";
import { formatMoney } from "../../shared/money.js";
import Upload from "../components/upload/Upload.jsx";
import Review from "../components/fechamento/Review.jsx";
import DocumentSource from "../components/fechamento/DocumentSource.jsx";
import Encouragement from "../components/profile/Encouragement.jsx";
import Recommendations from "../components/profile/Recommendations.jsx";
import DepthCard from "../components/profile/DepthCard.jsx";
export default function Home({ reader = false }) {
  const { fields, rules, filename, pages, prefs } = useClosing(),
    calc = calculate(fields, rules);
  const [manual, setManual] = useState(() =>
    new URLSearchParams(window.location.search).has("conferir"),
  );
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <ChartNoAxesColumnIncreasing size={31} />
        </span>
        <div>
          <div className="eyebrow">SIMPLES, SEGURO E ORGANIZADO</div>
          <h1>{reader ? "Importar documentos" : "Fechamento de Caixa"}</h1>
          <p>
            Envie relatórios e planilhas do mercado para calcular os valores e
            gerar seu fechamento de caixa.
          </p>
        </div>
        <span className="heading-badge">
          <ShieldCheck size={15} /> Sem APIs externas
        </span>
      </div>
      <div className="dashboard-quick-actions">
        <div className="workday-info">
          <span>
            <Store size={16} />
            <strong>{fields.market.value}</strong>
          </span>
          <span>
            <CalendarDays size={16} />
            {fields.date.value}{" "}
            <small>
              {fields.date.status === "default"
                ? "Hoje · São Paulo"
                : "Data do fechamento"}
            </small>
          </span>
        </div>
        <Link className="primary" to="/imprimir">
          <Printer size={18} /> Imprimir fechamento
        </Link>
      </div>
      {!reader && <Encouragement prefs={prefs} compact />}
      {!reader && <Recommendations />}
      <div className="stats-grid">
        {[
          [
            ShoppingCart,
            "Total de vendas",
            calc.sales,
            "green",
            fields.sales.value == null
              ? "Total calculado dos pagamentos"
              : "Vendas do documento",
          ],
          [
            Banknote,
            "Dinheiro",
            fields.cash.value,
            "blue",
            "Recebido em espécie",
          ],
          [
            ScanLine,
            "PIX",
            fields.pix.value,
            "purple",
            "Pagamentos instantâneos",
          ],
          [WalletCards, "Cartões", calc.cardTotal, "pink", "Débito + crédito"],
        ].map(([Icon, label, value, color, sub]) => (
          <DepthCard className="stat-card" key={label}>
            <span className={`tile ${color}`}>
              <Icon size={26} />
            </span>
            <div>
              <p>{label}</p>
              <strong>{value == null ? "—" : formatMoney(value)}</strong>
            </div>
            <small>{value == null ? "Aguardando leitura" : sub}</small>
          </DepthCard>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="main-column">
          <Upload />
          {filename || manual ? (
            <Review />
          ) : (
            <button className="secondary" onClick={() => setManual(true)}>
              Preencher fechamento manualmente
            </button>
          )}
        </div>
        <div className="side-column">
          <section className="panel info-panel">
            <div className="panel-heading">
              <span className="tile blue">
                <FolderOpen size={21} />
              </span>
              <h2>Informações do caixa</h2>
              <span className={`mini-status ${filename ? "loaded" : ""}`}>
                {filename ? "Documento lido" : "Aguardando arquivo"}
              </span>
            </div>
            <dl>
              {[
                [UserRound, "Operadora", fields.operator.value],
                [Store, "Estabelecimento", fields.market.value],
                [Printer, "Caixa", fields.register.value],
                [CalendarDays, "Data", fields.date.value],
              ].map(([Icon, label, value]) => (
                <div key={label}>
                  <dt>
                    <Icon size={17} />
                    {label}
                  </dt>
                  <dd>{value || "Não informado"}</dd>
                </div>
              ))}
            </dl>
            <div className="section-divider" />
            <div className="panel-heading">
              <span className="tile purple">
                <ChartNoAxesColumnIncreasing size={21} />
              </span>
              <h2>Totais do documento</h2>
            </div>
            <dl>
              {[
                ["Total de vendas", calc.sales],
                ["Dinheiro", fields.cash.value],
                ["PIX", fields.pix.value],
                ["Débito", fields.debit.value],
                ["Crédito", fields.credit.value],
                ["Outros pagamentos", fields.other.value],
              ].map(([label, value], i) => (
                <div key={label}>
                  <dt>
                    <span className={`tiny-dot dot-${i}`} />
                    {label}
                  </dt>
                  <dd>{value == null ? "—" : formatMoney(value)}</dd>
                </div>
              ))}
            </dl>
            {!filename && (
              <div className="empty-hint">
                <FileCheck2 size={25} />
                <p>
                  Os dados do seu documento
                  <br />
                  aparecerão aqui após a análise.
                </p>
              </div>
            )}
            {filename && (
              <p className="document-name">
                <FileCheck2 size={15} />
                {filename} · {pages.length} página(s)
              </p>
            )}
          </section>
          <section className="workflow-card">
            <div className="eyebrow">DO DOCUMENTO AO RESULTADO</div>
            <h2>
              Mais tranquilidade
              <br />
              no fim do expediente.
            </h2>
            {[
              [
                "01",
                "Envie seus documentos",
                "O servidor lê cada documento do lote.",
              ],
              [
                "02",
                "Confira os valores",
                "Revise os dados e informe o dinheiro contado.",
              ],
              [
                "03",
                "Salve ou imprima",
                "Seu relatório em A4, 80 mm ou 58 mm.",
              ],
            ].map(([n, title, sub]) => (
              <div className="workflow-step" key={n}>
                <span>{n}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{sub}</p>
                </div>
              </div>
            ))}
            <Link to="/suporte">
              Precisa de ajuda? <ArrowRight size={16} />
            </Link>
          </section>
        </div>
      </div>
      <DocumentSource />
    </>
  );
}
