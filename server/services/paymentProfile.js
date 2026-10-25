import { infoRules, moneyRules, normalize, layoutLine } from "./parserRules.js";
import { moneyTokens } from "./movementExtractor.js";
import { sumCents } from "../../shared/movements.js";
import {
  extractFinanceValue,
  financialAmountTokens,
  hasUncertainAmount,
} from "./financialObservations.js";
import { formatMoney } from "../../shared/money.js";

const valueTokens = (text) => {
  const explicit = moneyTokens(text);
  if (explicit.length) return explicit;
  const pattern = Object.values(moneyRules).find((rule) =>
    rule.test(normalize(layoutLine(text))),
  );
  return pattern
    ? financialAmountTokens(layoutLine(text), { labelPattern: pattern })
    : [];
};

// An explicitly enumerated payment section with its own total is a complete
// breakdown. A collection of isolated labelled amounts is not such evidence.
export function reconcilePaymentSection({
  lines,
  fields,
  assign,
  extractionIssues,
  documentId,
}) {
  if (
    lines.some(
      (line) =>
        line.section === "payments" &&
        hasUncertainAmount(line.text) &&
        /\d/.test(line.text),
    )
  )
    return;
  const unknownWholeRows = lines.filter((line) => {
    if (line.section !== "payments" || line.metadataHeader) return false;
    const text = layoutLine(line.text),
      normalized = normalize(text);
    if (
      Object.values({ ...infoRules, ...moneyRules }).some((rule) =>
        rule.test(normalized),
      )
    )
      return false;
    if (moneyTokens(text).length) return false; // The general parser audits explicit money.
    const pair = text.match(
      /^(.+?[A-Za-zÀ-ÿ])(?:\s*[:=|]\s*|\s+)(-?\s*\d[\d.,]*)\s*$/,
    );
    return !!pair && extractFinanceValue(pair[2]).length === 1;
  });
  if (unknownWholeRows.length) {
    for (const line of unknownWholeRows)
      extractionIssues.push({
        id: `${documentId}:payment-unknown:${line.id || `${line.page}:${line.line}`}`,
        source: {
          documentId,
          page: line.page,
          line: line.line,
          sheet: line.sheet,
          text: line.originalText || line.text,
          profile: "formas-pagamento",
        },
        kind: "review",
        resolvable: true,
        message:
          "Há um valor na seção de pagamentos cuja forma não foi identificada. Confira essa linha antes de usar o total como conferido.",
      });
    return;
  }
  const rows = lines.filter(
    (l) => l.section === "payments" && valueTokens(l.text).length,
  );
  const totals = rows.filter((l) =>
    moneyRules.sales.test(normalize(layoutLine(l.text))),
  );
  if (!totals.length || fields.sales.value == null) return;
  const keys = ["cash", "pix", "debit", "credit", "cards", "voucher", "other"];
  const details = rows.filter((l) => !totals.includes(l));
  const categories = details.map((l) =>
    keys.find((k) => moneyRules[k].test(normalize(l.text))),
  );
  if (
    !details.length ||
    categories.some((k) => !k) ||
    details.some((l) => valueTokens(l.text).length !== 1)
  )
    return;
  const covered = [...new Set(categories)];
  if (covered.some((k) => fields[k].value == null)) return;
  // Consolidated cards and their debit/credit breakdown describe the same money.
  const summed = covered.filter(
    (k) =>
      k !== "cards" ||
      !(covered.includes("debit") && covered.includes("credit")),
  );
  const total = sumCents(summed.map((k) => fields[k].value));
  const row = totals[0],
    source = {
      documentId,
      page: row.page,
      line: row.line,
      sheet: row.sheet,
      cell:
        row.cells
          ?.map((c) => c.cell)
          .filter(Boolean)
          .join(", ") || null,
      bounds: row.bounds || null,
      text: rows.map((l) => l.text).join("\n"),
      profile: "formas-pagamento",
      confidence: row.confidence ?? 0.95,
    };
  if (total !== fields.sales.value) {
    extractionIssues.push({
      id: `${documentId}:payment-breakdown`,
      source,
      kind: "conflict",
      resolvable: true,
      message: `A tabela de pagamentos soma ${formatMoney(total)}, mas o total líquido declara ${formatMoney(fields.sales.value)}. Confira as linhas e o documento original.`,
    });
    return;
  }
  if (fields.other.value == null) {
    assign(
      "other",
      0,
      source,
      "Zero derivado: a tabela de pagamentos confere integralmente com o total líquido.",
    );
    fields.other.status = "derived";
  }
}
