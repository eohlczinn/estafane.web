import { moneyRules, normalize } from "./parserRules.js";
import { sumCents } from "../../shared/movements.js";
import { sectionKind } from "./documentStructure.js";
import { extractFinanceValue } from "./financialObservations.js";
import { moneyFields } from "../../shared/fields.js";
import { formatMoney } from "../../shared/money.js";

const paymentKeys = ["cash", "pix", "debit", "credit", "voucher", "other"];
const paymentFor = (text) => {
  const normalized = normalize(text);
  // A receipt row must name one payment category. A combined label cannot be
  // assigned in full to whichever alias happens to be checked first.
  const matches = paymentKeys.filter((key) =>
    new RegExp(`(?:^|[\\s/+,|;-])${moneyRules[key].source.slice(1)}`).test(
      normalized,
    ),
  );
  return matches.length === 1 ? matches[0] : null;
};
const isHeader = (text) =>
  /\b(?:operacao|cupom|transacao|identificador|id)\b/.test(text) &&
  /\b(?:forma|pagamento|modalidade)\b/.test(text) &&
  /\bvalor\b/.test(text);
const sourceOf = (line, documentId) => ({
  documentId,
  page: line.page,
  line: line.line,
  sheet: line.sheet,
  bounds: line.bounds || null,
  cell:
    line.cells
      ?.map((c) => c.cell)
      .filter(Boolean)
      .join(", ") || null,
  text: line.originalText || line.text,
  profile: "cupons-de-venda",
  confidence: line.confidence ?? (line.ocr ? 0.5 : 0.95),
});

// Individual payments and their summary are two observations of the same sales.
// Only explicit transaction tables enter this profile. Item/product tables do not.
export function extractPaymentTransactions(lines, documentId) {
  let active = false,
    header = null,
    complete = true;
  const transactions = [],
    consumed = new Set(),
    issues = [],
    notes = [],
    seen = new Map();
  for (const line of lines) {
    const text = line.originalText || line.text,
      n = normalize(text),
      kind = sectionKind(text);
    if (isHeader(n)) {
      active = true;
      consumed.add(line.id);
      const cells = text.split(/\t+/).map(normalize);
      header =
        cells.length >= 3
          ? {
              id: cells.findIndex((c) =>
                /^(?:operacao|cupom|transacao|identificador|id)$/.test(c),
              ),
              payment: cells.findIndex((c) =>
                /^(?:forma(?: de pagamento)?|pagamento|modalidade)$/.test(c),
              ),
              value: cells.findIndex((c) =>
                /^valor(?: recebido| liquido| total)?$/.test(c),
              ),
              time: cells.findIndex((c) => /^(?:hora|horario)$/.test(c)),
            }
          : null;
      if (header && (header.id < 0 || header.payment < 0 || header.value < 0))
        header = null;
      continue;
    }
    if (kind && kind !== "transactions") {
      active = false;
      header = null;
      continue;
    }
    if (!active || !text.trim()) continue;
    if (
      /^(?:pagina|ficticio|mercado|supermercado|data\s*:|turno\s*:|documento\s*:)/.test(
        n,
      )
    )
      continue;
    const cells = text.split(/\t+/).map((s) => s.trim());
    let operationId, payment, amountText, time;
    if (
      header &&
      cells.length > Math.max(header.id, header.payment, header.value)
    ) {
      operationId = cells[header.id];
      payment = cells[header.payment];
      amountText = cells[header.value];
      time = header.time >= 0 ? cells[header.time] : null;
    } else {
      const row = text.match(
        /^\s*(?:(\d{1,2}:\d{2}(?::\d{2})?)\s+)?([A-Za-z0-9][\w./-]*)\s+(.+?)\s+((?:-\s*)?(?:R\$\s*)?[\d.,]+)\s*$/i,
      );
      if (row) {
        [, time, operationId, payment, amountText] = row;
      }
    }
    const field = payment && paymentFor(payment),
      tokens = amountText ? extractFinanceValue(amountText) : [];
    if (
      !operationId ||
      !/^[A-Za-z0-9][\w./-]*$/.test(operationId) ||
      !field ||
      tokens.length !== 1 ||
      tokens[0].value < 0
    ) {
      if (
        ((operationId && amountText) || /\d|R\$/.test(text)) &&
        !/^[*#]|reimpress|reenvio|operacao reaparece/.test(n)
      ) {
        complete = false;
        consumed.add(line.id);
        issues.push({
          id: `${documentId}:${line.id}:transaction-unknown`,
          source: sourceOf(line, documentId),
          kind: "review",
          resolvable: true,
          message:
            "Não foi possível identificar com segurança o cupom, a forma de pagamento ou o valor desta venda.",
        });
      }
      continue;
    }
    const source = sourceOf(line, documentId),
      amountCents = tokens[0].value;
    const item = {
      id: `${documentId}:sale:${line.id}`,
      operationId,
      time: time || null,
      field,
      amountCents,
      source,
      status: "recognized",
    };
    const key = operationId.toLocaleUpperCase("pt-BR"),
      previous = seen.get(key);
    if (previous) {
      if (previous.field === field && previous.amountCents === amountCents) {
        item.duplicateOf = previous.id;
        item.status = "excluded";
        notes.push({
          code: "duplicate_receipt",
          severity: "info",
          message: `Cupom ${operationId} repetido com a mesma forma e valor; contado uma única vez.`,
          source,
          originalSource: previous.source,
        });
      } else {
        item.status = previous.status = "conflict";
        complete = false;
        issues.push({
          id: `${documentId}:${line.id}:transaction-conflict`,
          source,
          kind: "conflict",
          resolvable: false,
          message: `O cupom ${operationId} aparece com valores ou formas de pagamento diferentes. Corrija essa operação no arquivo e importe novamente antes de confirmar.`,
        });
      }
    } else seen.set(key, item);
    consumed.add(line.id);
    transactions.push(item);
  }
  return {
    transactions,
    consumed,
    issues,
    notes,
    complete: complete && transactions.length > 0,
  };
}

export function reconcilePaymentTransactions({
  result,
  fields,
  assign,
  extractionIssues,
  documentId,
}) {
  extractionIssues.push(...result.issues);
  if (!result.transactions.length) return;
  const valid = result.transactions.filter(
    (t) => !t.duplicateOf && t.status !== "conflict",
  );
  for (const field of new Set(valid.map((t) => t.field))) {
    const items = valid.filter((t) => t.field === field),
      total = sumCents(items.map((t) => t.amountCents));
    const source = {
      ...items[0].source,
      profile: "soma-cupons-validos",
      transactionIds: items.map((t) => t.id),
    };
    if (
      result.complete &&
      fields[field].value != null &&
      fields[field].value !== total
    ) {
      extractionIssues.push({
        id: `${documentId}:transaction-total:${field}`,
        source,
        kind: "conflict",
        resolvable: true,
        field,
        message: `Os cupons válidos de ${moneyFields[field]} somam ${formatMoney(total)}, mas o resumo declara ${formatMoney(fields[field].value)}. Confira a origem da diferença.`,
      });
    } else if (
      fields[field].value == null &&
      fields[field].status !== "ambiguous" &&
      result.complete
    )
      assign(
        field,
        total,
        source,
        "Soma dos cupons válidos por forma de pagamento.",
      );
  }
  if (result.complete) {
    const total = sumCents(valid.map((t) => t.amountCents)),
      source = {
        ...valid[0].source,
        profile: "soma-cupons-validos",
        transactionIds: valid.map((t) => t.id),
      };
    if (fields.sales.value == null && fields.sales.status !== "ambiguous")
      assign("sales", total, source, "Total derivado dos cupons válidos.");
    else if (fields.sales.value !== total)
      extractionIssues.push({
        id: `${documentId}:transaction-sales`,
        source,
        kind: "conflict",
        resolvable: true,
        field: "sales",
        message: `Os cupons válidos somam ${formatMoney(total)}; as vendas líquidas declaram ${formatMoney(fields.sales.value)}.`,
      });
    if (
      fields.sales.value === total &&
      fields.other.value == null &&
      fields.other.status !== "ambiguous" &&
      !valid.some((t) => t.field === "other")
    ) {
      assign(
        "other",
        0,
        source,
        "Zero derivado: todos os cupons válidos conferem com as vendas líquidas e suas formas de pagamento.",
      );
      fields.other.status = "derived";
    }
  }
}
