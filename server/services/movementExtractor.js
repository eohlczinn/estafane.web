import { parseMoney } from "../../shared/money.js";
import { movementTypes } from "../../shared/movements.js";
import { normalize } from "./parserRules.js";
export const movementPatterns = {
  withdrawal:
    /^(?:(?:sub)?total (?:de )?)?(?:sangrias?|retiradas?(?: de numerario)?|recolhimentos?|saida do caixa)\b/,
  supply:
    /^(?:(?:sub)?total (?:de )?)?(?:suprimentos?|entradas? de numerario|entrada)\b/,
  opening:
    /^(?:fundo(?: inicial| de troco)?|saldo inicial|troco inicial|abertura de caixa)\b/,
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
      /(?:-\s*(?:R\$\s*)?|R\$\s*-?\s*)?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)/g,
    ),
  ].map((m) => ({
    text: m[0],
    index: m.index,
    value: parseMoney(m[0].replace(/R\$/g, "").replace(/\s/g, "")),
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
    /(?:saida|devolucao|pago|pagamento) (?:fisica |em )?(?:dinheiro|especie)|nao (?:incluid|descontad)/.test(
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
    const [type] = entry,
      spec = movementTypes[type];
    section = type;
    let amounts;
    try {
      amounts = moneyTokens(line.text);
      if (!amounts.length) {
        const match = line.text.match(/[:=|]\s*(?:R\$\s*)?(-?\d+)\s*$/);
        if (match)
          amounts = [
            { text: match[1], index: match.index, value: parseMoney(match[1]) },
          ];
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
