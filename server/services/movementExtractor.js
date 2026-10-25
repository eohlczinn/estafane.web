import { parseMoney } from "../../shared/money.js";
import { movementTypes } from "../../shared/movements.js";
import { normalize } from "./parserRules.js";
import { financialAmountTokens } from "./financialObservations.js";
export const movementPatterns = {
  withdrawal:
    /^(?:(?:sub)?total (?:de )?)?(?:sangrias?|retiradas?(?: de numerario)?|recolhimentos?|saida do caixa)\b/,
  supply:
    /^(?:(?:sub)?total (?:de )?)?(?:suprimentos?|reforcos? de caixa|entradas? de numerario|entrada(?=\s*[:=|]|\s+[r\d-]))\b/,
  expense:
    /^(?:(?:sub)?total (?:de )?)?despesas? autorizadas?(?: em dinheiro)?\b/,
  opening:
    /^(?:fundo(?: inicial| de troco(?: inicial)?)?|saldo inicial|troco inicial|abertura de caixa)\b/,
  cash_sale:
    /^(?:venda|recebimento) (?:em dinheiro|em especie)\s+(?:n[ºo.]?\s*)?\d+\b/,
  refund:
    /^(?:(?:sub)?total (?:de )?)?(?:devolucoes?(?: em dinheiro)?|devolucao(?: em dinheiro)?)\b/,
  cancellation: /^(?:(?:sub)?total (?:de )?)?cancelamentos?\b/,
  reversal: /^(?:(?:sub)?total (?:de )?)?estornos?\b/,
};
export function moneyTokens(text) {
  return [
    ...text.matchAll(
      /(?:\(\s*)?(?:-\s*(?:R\$\s*)?|R\$\s*-?\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)(?:\s*\)|-)?/g,
    ),
  ].map((m) => ({
    text: m[0],
    index: m.index,
    value: parseMoney(
      m[0]
        .replace(/R\$/g, "")
        .replace(/\s/g, "")
        .replace(/^\((.*)\)$/, "-$1")
        .replace(/^(.*)-$/, "-$1"),
    ),
  }));
}
export function classifyEffect(text) {
  const n = normalize(text);
  if (
    /ja (?:descontad|incluid|refletid)|incluid[oa]s? (?:no|nos|na|nas)|total liquido|sem efeito no caixa/.test(
      n,
    )
  )
    return "included";
  if (/pix|credito|debito|cartao|vale[- ]/.test(n)) return "non_cash";
  if (
    /(?:saida|devolucao|devolucoes|pago|pagamento) (?:fisica |em )?(?:dinheiro|especie)|nao (?:incluid|descontad)/.test(
      n,
    )
  )
    return "cash_out";
  return null;
}
export function extractMovements(lines, documentId) {
  const movements = [],
    declarations = [],
    consumed = new Set(),
    issues = [];
  let section = null;
  for (const line of lines) {
    const n = normalize(line.text);
    let entry = Object.entries(movementPatterns).find(([, pattern]) =>
      pattern.test(n),
    );
    if (!entry && section && /^(?:sub)?total\s*[:=|]/.test(n))
      entry = [section];
    if (!entry) {
      if (/^[a-z].*[:=]/.test(n) && !/^(?:id|nsu|documento)/.test(n))
        section = null;
      continue;
    }
    const [type, pattern] = entry,
      spec = movementTypes[type];
    section = type;
    let amounts;
    try {
      amounts = moneyTokens(line.text);
      if (!amounts.length) {
        amounts = financialAmountTokens(line.text, {
          labelPattern: pattern || /^(?:sub)?total\b/,
          allowOperationId: true,
        });
      }
    } catch {
      amounts = [];
    }
    if (amounts.length !== 1) continue;
    consumed.add(line.id);
    const amountCents = Math.abs(amounts[0].value),
      prefix = line.text
        .slice(0, amounts[0].index)
        .replace(/[\s:|=–-]+$/, "")
        .trim();
    const operation = normalize(prefix).match(
      /(?:sangria|retirada|suprimento|recolhimento|devolucao|cancelamento|estorno|dinheiro|especie)\s*(?:n[ºo.]?\s*)?(\d+)\b/,
    );
    const transaction = line.text.match(
      /\b(?:NSU|transa[cç][aã]o|opera[cç][aã]o|ID)\s*[:#=]?\s*([\w-]+)/i,
    );
    const source = {
      documentId,
      page: line.page,
      line: line.line,
      text: line.text,
      bounds: line.bounds || null,
      profile: "movimentacao",
      sheet: line.sheet,
      cell:
        line.cells
          ?.filter((c) => c.text || c.unsafe)
          .map((c) => c.cell)
          .filter(Boolean)
          .join(", ") || null,
      original: line.originalText || line.text,
      hidden: !!line.hidden,
      confidence: line.ocr ? (line.confidence ?? 0.5) : 0.95,
    };
    const subtotal =
      /^(?:sub)?total\b/.test(n) ||
      (!operation &&
        /^(?:sangrias|retiradas|suprimentos|devolucoes|cancelamentos|estornos)\b/.test(
          n,
        ));
    const record = {
      id: `${documentId}:${line.id}:${type}`,
      type,
      amountCents,
      direction: spec.direction,
      description: prefix || spec.label,
      documentId,
      source,
      status: "recognized",
      operationId: transaction?.[1] || operation?.[1] || null,
      effect: classifyEffect(line.text),
    };
    const previous =
      record.operationId &&
      movements.find(
        (m) => m.type === record.type && m.operationId === record.operationId,
      );
    if (previous) {
      if (previous.amountCents === record.amountCents) {
        record.duplicateOf = previous.id;
        record.status = "excluded";
      } else {
        record.status = "conflict";
        previous.status = "conflict";
      }
    }
    if (subtotal || type === "opening")
      declarations.push({
        ...record,
        field: spec.field,
        role: type === "opening" ? "snapshot" : "subtotal",
        value: amountCents,
      });
    else movements.push(record);
    if (amounts[0].value < 0)
      issues.push({
        code: "normalized_sign",
        severity: "info",
        message: `Sinal de ${spec.label.toLowerCase()} normalizado para magnitude positiva e direção ${spec.direction === "out" ? "saída" : "entrada"}.`,
        source,
      });
  }
  return { movements, declarations, consumed, issues };
}
