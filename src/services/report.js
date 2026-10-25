import { infoFields, moneyFields } from "../../shared/fields.js";
import { formatMoney } from "../../shared/money.js";
import { summarizeBatch } from "../../shared/batch.js";
import { reconcile } from "../../shared/reconciliation.js";
import { sourceLocation } from "../../shared/source.js";
export const statusLabels = {
  pending: "DADOS PENDENTES",
  short: "FALTA",
  over: "SOBRA",
  balanced: "CAIXA CONFERIDO",
};
export function reportRows(fields, calc, prefs = {}) {
  const rows = Object.entries(infoFields)
    .filter(([key]) => key !== "market" || prefs.includeMarket !== false)
    .map(([key, label]) => [
      label,
      fields[key]?.value ||
        (key === "market" ? prefs.market : "") ||
        "Não informado",
    ]);
  if (prefs.includeSummary !== false)
    rows.push(
      ["", "RESUMO FINANCEIRO"],
      ...[
        "sales",
        "cash",
        "pix",
        "debit",
        "credit",
        "cards",
        "voucher",
        "other",
      ]
        .filter(
          (key) =>
            key !== "cards" ||
            fields.debit?.value == null ||
            fields.credit?.value == null,
        )
        .map((key) => [
          moneyFields[key],
          formatMoney(
            key === "sales"
              ? calc.sales
              : key === "cards"
                ? calc.cardTotal
                : fields[key]?.value,
          ),
        ]),
    );
  if (prefs.includeMovements !== false)
    rows.push(
      ["", "MOVIMENTAÇÕES DE CAIXA"],
      ...[
        "opening",
        "withdrawals",
        "supplies",
        "expenses",
        "refunds",
        "cancellations",
        "reversals",
      ].map((key) => [
        moneyFields[key],
        (["withdrawals", "refunds"].includes(key) && fields[key]?.value != null
          ? "− "
          : "") + formatMoney(fields[key]?.value),
      ]),
    );
  const treatment = (field, policy, deduct) =>
    fields[field]?.value == null
      ? "Não informado; sem desconto adicional"
      : fields[field].value === 0
        ? "Valor declarado zero"
        : calc.rules?.cashBasis === "net"
          ? "Saldo líquido utilizado; sem novo desconto"
          : deduct || policy === "cash_out"
            ? "Saída física adicional descontada"
            : policy === "non_cash"
              ? "Pagamento eletrônico; não afeta dinheiro"
              : policy === "included"
                ? "Já refletido nos valores informados"
                : calc.rules?.automatic
                  ? "Efeito pendente de esclarecimento"
                  : "Já refletidos / não afetam dinheiro";
  rows.push(
    ["", "CONFERÊNCIA"],
    ["Dinheiro esperado", formatMoney(calc.expected)],
    ["Dinheiro contado", formatMoney(fields.counted?.value)],
    ["Diferença", formatMoney(calc.difference)],
    [
      "Resultado",
      ["short", "over"].includes(calc.result)
        ? `${statusLabels[calc.result]} DE ${formatMoney(Math.abs(calc.difference))}`
        : statusLabels[calc.result],
    ],
    ["", "REGRAS APLICADAS"],
    [
      "Cancelamentos",
      treatment(
        "cancellations",
        calc.rules?.cancellationTreatment,
        calc.rules?.deductCancellations,
      ),
    ],
    [
      "Estornos",
      treatment(
        "reversals",
        calc.rules?.reversalTreatment,
        calc.rules?.deductReversals,
      ),
    ],
  );
  if (fields.voucher?.value != null)
    rows.push([
      "Vale-alimentação",
      calc.rules?.voucherIncludedInOther
        ? "Incluído em Outros pagamentos"
        : "Pagamento separado de Outros",
    ]);
  if (prefs.allowNotes !== false && calc.notes?.trim())
    rows.push(["", "OBSERVAÇÕES"], ["Observações", calc.notes.trim()]);
  const corrected = Object.entries(fields)
    .filter(([, v]) => v.status === "manual")
    .map(([key]) => moneyFields[key] || infoFields[key]);
  if (corrected.length)
    rows.push(
      ["", "CONFERÊNCIA MANUAL"],
      ["Campos informados / corrigidos", corrected.join(", ")],
    );
  for (const [key, f] of Object.entries(fields))
    if (f.history?.length) {
      const money = key in moneyFields;
      rows.push([
        `Correção: ${allFieldLabel(key)}`,
        `Anterior: ${money ? formatMoney(f.history[0].previous) : (f.history[0].previous ?? "não informado")}; atual: ${money ? formatMoney(f.value) : (f.value ?? "não informado")}`,
      ]);
    }
  if (prefs.includeMovementDetails && calc.movements?.length) {
    rows.push(["", "ITENS DE MOVIMENTAÇÃO (DETALHAMENTO)"]);
    for (const m of calc.movements)
      rows.push([
        m.description,
        `${m.status === "excluded" || m.duplicateOf ? "EXCLUÍDO" : m.direction === "out" ? "SAÍDA −" : "ENTRADA +"} ${formatMoney(m.amountCents)} · ${sourceLocation(m.source)}`,
      ]);
  }
  if (calc.documents?.length)
    rows.push(
      ["", "DOCUMENTOS DE ORIGEM"],
      ...calc.documents.map((d) => [
        d.filename,
        `SHA-256 ${d.hash?.slice(0, 16) || "não disponível"} · ${d.id}`,
      ]),
    );
  if (calc.transactions?.length) {
    const unique = calc.transactions.filter(
      (t) => !t.duplicateOf && t.status !== "conflict",
    );
    const repeated = calc.transactions.filter((t) => t.duplicateOf);
    rows.push(
      ["", "CONCILIAÇÃO DOS CUPONS"],
      [
        "Cupons",
        `${unique.length} válidos; ${repeated.length} repetidos excluídos da soma`,
      ],
    );
    for (const t of repeated)
      rows.push([
        `Cupom repetido: ${t.operationId}`,
        `${formatMoney(t.amountCents)} · ${sourceLocation(t.source)} · contado uma única vez`,
      ]);
  }
  for (const note of calc.normalizationNotes || [])
    if (note.code === "gross_net_reconciled")
      rows.push(["Conciliação de vendas", note.message]);
  const history = (calc.history || []).filter((h) =>
    [
      "resolution",
      "manual_grouping",
      "movement",
      "classification",
      "undo",
    ].includes(h.kind),
  );
  if (history.length)
    rows.push(
      ["", "HISTÓRICO DE CONFERÊNCIA"],
      ...history.map((h) => [
        {
          resolution: "Esclarecimento",
          manual_grouping: "Associação de documentos",
          movement: "Correção de movimentação",
          classification: "Classificação manual",
          undo: "Alteração desfeita",
        }[h.kind] || "Conferência",
        h.reason || h.id || h.documentIds?.join(","),
      ]),
    );
  return rows;
}
const allFieldLabel = (key) => moneyFields[key] || infoFields[key] || key;

export function closingReport(closing, prefs) {
  const audit = reconcile(closing, {
      reviewed: closing.confirmed && closing.reviewed,
    }),
    calc = {
      ...audit.calculation,
      rules: closing.rules,
      notes: closing.notes,
      movements: closing.movements,
      documents: closing.documents,
      history: closing.history,
      transactions: closing.transactions,
      normalizationNotes: closing.normalizationNotes,
    };
  const final = closing.confirmed && audit.status === "validated";
  return {
    fields: closing.fields,
    calc,
    rows: [
      ...reportRows(closing.fields, calc, prefs),
      ...(audit.issues.length
        ? [
            ["", "PENDÊNCIAS DO FECHAMENTO"],
            ...audit.issues.map((i) => [
              i.field ? allFieldLabel(i.field) : "Conferência",
              i.message,
            ]),
          ]
        : []),
    ],
    title: "RELATÓRIO DE FECHAMENTO DE CAIXA",
    market: closing.fields.market.value || prefs.market,
    final,
    partial: !final,
    id: closing.id,
  };
}
export function consolidatedReport(batch, prefs) {
  const summary = summarizeBatch(batch.closings, batch.documents),
    rows = [
      [
        "Situação",
        summary.partial
          ? "CONSOLIDADO PARCIAL · HÁ PENDÊNCIAS"
          : "TODOS OS FECHAMENTOS CONFIRMADOS",
      ],
      [
        "Fechamentos",
        `${summary.validatedCount} confirmados de ${summary.closingCount}`,
      ],
      [
        "Período",
        [
          ...new Set(
            batch.closings.map((c) => c.fields.date.value || "Data pendente"),
          ),
        ].join(" / "),
      ],
      ["", "TOTAIS DOS FECHAMENTOS CONFIRMADOS"],
    ];
  for (const [label, key] of [
    ["Vendas", "totalSalesCents"],
    ["Dinheiro", "cashCents"],
    ["PIX", "pixCents"],
    ["Débito", "debitCents"],
    ["Crédito", "creditCents"],
    ["Vale-alimentação", "voucherCents"],
    ["Sangrias (saída)", "withdrawalsCents"],
    ["Suprimentos", "suppliesCents"],
    ["Total de faltas", "totalShortCents"],
    ["Total de sobras", "totalOverCents"],
  ])
    rows.push([label, formatMoney(summary[key])]);
  if (!summary.partial)
    rows.push([
      "Saldo líquido das diferenças",
      formatMoney(summary.netDifferenceCents),
    ]);
  for (const [key, title] of [
    ["byOperator", "POR OPERADORA"],
    ["byDate", "POR DIA"],
    ["byShift", "POR TURNO"],
  ])
    if (summary[key]?.length)
      rows.push(
        ["", title + " · SOMENTE CONFIRMADOS"],
        ...summary[key].map((g) => [
          g.label,
          `${g.count} fechamento(s) · vendas ${formatMoney(g.salesCents)} · diferença ${formatMoney(g.differenceCents)}`,
        ]),
      );
  rows.push(["", "RESULTADO INDIVIDUAL DE CADA CAIXA"]);
  for (const c of batch.closings) {
    const included = summary.includedClosingIds.includes(c.id),
      audit = reconcile(c);
    rows.push([
      `Caixa ${c.fields.register.value || "?"} · ${c.fields.operator.value || "?"} · ${c.fields.date.value || "?"}`,
      included
        ? `${statusLabels[audit.calculation.result]} · diferença ${formatMoney(audit.calculation.difference)}`
        : "PENDENTE · EXCLUÍDO DOS TOTAIS CONFIRMADOS",
    ]);
    if (c.notes && prefs.allowNotes) rows.push(["Observações", c.notes]);
    if (!included)
      rows.push([
        "Pendências",
        audit.issues.map((i) => i.message).join(" / ") ||
          "Aguardando conferência e confirmação individual",
      ]);
  }
  rows.push(["", "DOCUMENTOS UTILIZADOS E EXCLUÍDOS"]);
  for (const d of batch.documents)
    rows.push([
      d.filename,
      `${d.status === "duplicate" ? "DUPLICADO · NÃO SOMADO" : summary.excludedDocumentIds.includes(d.id) ? "EXCLUÍDO DOS TOTAIS CONFIRMADOS" : "INCLUÍDO"} · ${d.error || d.hash.slice(0, 16)}`,
    ]);
  const markets = [
    ...new Set(
      batch.closings.map((c) => c.fields.market.value).filter(Boolean),
    ),
  ];
  return {
    id: batch.id,
    title: "RELATÓRIO CONSOLIDADO DE FECHAMENTOS",
    market: markets.join(" / ") || prefs.market,
    fields: batch.closings[0]?.fields || {},
    rows,
    calc: {
      result: summary.partial ? "pending" : "consolidated",
      rows,
      reportTitle: "RELATÓRIO CONSOLIDADO DE FECHAMENTOS",
      partial: summary.partial,
    },
    final: !summary.partial,
    partial: summary.partial,
    summary,
  };
}
