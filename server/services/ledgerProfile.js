import { normalize } from "./parserRules.js";
import { moneyTokens } from "./movementExtractor.js";

// Bounded cash ledgers enumerate physical movements. Missing categories outside
// this profile remain unknown; a generic PDF must never silently default to zero.
export function reconcileLedgerProfile({ lines, fields, declarations, unparsedLines,
  rules, notes, assign, documentId }) {
  const source = (line) => ({ documentId, page: line.page, line: line.line,
    bounds: line.bounds || null, text: line.text, profile: "extrato-movimentacao" });
  const included = lines.find((l) =>
    /^vendas liquidas\b.*cancelamentos ja descontados/.test(normalize(l.text)));
  if (included && fields.sales.value != null && !rules.cancellationTreatment) {
    const amounts = moneyTokens(included.text);
    if (amounts.length === 1 && amounts[0].value === fields.sales.value)
      rules.cancellationTreatment = "included";
  }
  // Gross sales are a reconciliation reference, not an additional receipt.
  for (let i = unparsedLines.length - 1; i >= 0; i--) {
    const row = unparsedLines[i];
    if (!/^vendas brutas\b/.test(normalize(row.text))) continue;
    const amounts = moneyTokens(row.text);
    if (rules.cancellationTreatment === "included" && amounts.length === 1 &&
      fields.cancellations.value != null && fields.sales.value != null &&
      amounts[0].value - fields.cancellations.value === fields.sales.value) {
      declarations.push({ field: "grossSales", value: amounts[0].value,
        source: row.source, role: "reconciled_reference" });
      notes.push({ code: "gross_net_reconciled", severity: "info",
        message: "Vendas brutas menos cancelamentos conferem com as vendas líquidas. Cancelamentos já descontados não saem novamente do caixa.", source: row.source });
      unparsedLines.splice(i, 1);
    }
  }
  const start = lines.findIndex((l) => /^(?:\d+\s*\|\s*)?movimentacoes do dinheiro fisico$/.test(normalize(l.text)));
  const end = lines.findIndex((l, i) => i > start && /^(?:\d+\s*\|\s*)?conferencia informada pela operadora$/.test(normalize(l.text)));
  if (start < 0 || end <= start || !lines.some((l) => /^extrato de movimentacao do caixa$/.test(normalize(l.text)))) return;
  const rows = lines.slice(start + 1, end).filter((l) => /R\$|\d,\d{2}\b/.test(l.text));
  const known = /^(?:fundo de troco inicial|vendas recebidas em dinheiro|suprimentos?|sangrias?|retiradas?|devolucoes?|devolucao|estornos?|cancelamentos?)\b/;
  if (!rows.length || rows.some((l) => !known.test(normalize(l.text)) ||
    moneyTokens(l.text).length !== 1 || !/\b(?:entrada|saida)\b/.test(normalize(l.text))) ||
    ["opening", "cash", "supplies", "withdrawals"].some((k) => fields[k].value == null)) return;
  if (fields.refunds.value == null && !rows.some((l) => /devolu|estorn|cancel/.test(normalize(l.text)))) {
    const evidence = { ...source(lines[start]), text: lines.slice(start, end).map((l) => l.text).join("\n") };
    const explanation = "Extrato de movimentações físicas delimitado: nenhuma devolução registrada nesta seção. Zero derivado da lista de movimentos; confira o extrato completo.";
    assign("refunds", 0, evidence, explanation);
    fields.refunds.status = "derived";
    notes.push({ code: "ledger_no_refunds", severity: "info", message: explanation, source: evidence });
  }
}
