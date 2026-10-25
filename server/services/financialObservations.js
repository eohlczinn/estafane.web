import { parseMoney } from "../../shared/money.js";

// A whole number becomes money only after a financial label or an explicit
// monetary column has established its unit. This is not a global number lexer.
const amountSource =
  "(?:-?\\s*(?:R\\$\\s*)?|R\\$\\s*-?\\s*)(?:\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d{1,2})?";
const connectorSource =
  "(?:(?:foi(?: de)?|foram(?: de)?|deu|somou|totalizou|totalizaram|ficou(?: em)?|valor(?: de)?|no valor de|total(?: de)?|igual a)\\s*[:=]?\\s*)?";
const isolatedAmount = new RegExp(
  `^\\s*${connectorSource}(${amountSource}|\\(\\s*${amountSource}\\s*\\))(?:\\s*(?:reais|BRL))?\\s*[.;]?\\s*$`,
  "i",
);

function normalizedLabel(text) {
  let normalized = "",
    ends = [];
  for (let i = 0; i < text.length; i++) {
    const plain = text[i]
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (/\s/.test(plain)) {
      if (normalized && !normalized.endsWith(" ")) {
        normalized += " ";
        ends.push(i + 1);
      } else if (normalized) ends[ends.length - 1] = i + 1;
    } else
      for (const ch of plain) {
        normalized += ch;
        ends.push(i + 1);
      }
  }
  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    ends.pop();
  }
  return { text: normalized, ends };
}

export function extractFinanceValue(rest, { allowOperationId = false } = {}) {
  let offset = 0;
  const separator = rest.match(/^\s*[:=|;–—]\s*/);
  if (separator) {
    offset = separator[0].length;
    rest = rest.slice(offset);
  }
  if (allowOperationId) {
    const operation = rest.match(
      /^\s*(?:(?:n[ºo.]?|numero|#)\s*)?\d{1,12}\s*[:=|–—-]\s*/i,
    );
    if (operation) {
      offset += operation[0].length;
      rest = rest.slice(operation[0].length);
    }
    const direction = rest.match(
      /^\s*(?:entrada|saida)(?:\s+de)?\s*[:=|–—-]?\s*/i,
    );
    if (direction) {
      offset += direction[0].length;
      rest = rest.slice(direction[0].length);
    }
  }
  const match = rest.match(isolatedAmount);
  if (!match) return [];
  const text = match[1],
    index = offset + match.index + match[0].indexOf(text);
  try {
    const value = parseMoney(
      text
        .replace(/r\$/gi, "")
        .replace(/\s/g, "")
        .replace(/^\((.*)\)$/, "-$1"),
    );
    return [{ text, index, value }];
  } catch {
    return [];
  }
}

export function financialAmountTokens(
  text,
  { labelPattern, allowOperationId = false } = {},
) {
  if (!labelPattern) return [];
  const normalized = normalizedLabel(text),
    match = normalized.text.match(labelPattern);
  if (!match || match.index !== 0) return [];
  const end = normalized.ends[match[0].length - 1] || 0;
  return extractFinanceValue(text.slice(end), { allowOperationId }).map(
    (token) => ({ ...token, index: end + token.index }),
  );
}

const inlineLabelSource = [
  "total liquido de vendas",
  "total (?:geral )?(?:de )?vendas",
  "vendas (?:liquidas|totais|brutas)",
  "dinheiro (?:efetivamente )?contado(?: pela operadora)?",
  "valor contado",
  "total contado",
  "contagem(?: fisica| do caixa)?",
  "(?:cartao|cartoes)(?: de)? (?:credito|debito)",
  "credito",
  "debito",
  "pix",
  "dinheiro",
  "especie",
  "numerario",
  "vale(?:[- ](?:alimentacao|refeicao))?",
  "ticket alimentacao",
  "voucher",
  "outros pagamentos",
  "(?:total de )?(?:cancelamentos?|estornos?|sangrias?|suprimentos?)",
].join("|");
const inlinePair = new RegExp(
  `(?:^|[\\s;,|+–—])(${inlineLabelSource})(?:\\s*[:=]\\s*|\\s+(?:${connectorSource}))(?=\\(?\\s*(?:-\\s*(?:R\\$\\s*)?|R\\$\\s*-?\\s*)?\\d)`,
  "ig",
);

export function splitFinancialPairs(text) {
  const normalized = normalizedLabel(text),
    hits = [];
  for (const match of normalized.text.matchAll(inlinePair)) {
    const labelStart = match.index + match[0].indexOf(match[1]);
    const start = labelStart ? normalized.ends[labelStart - 1] : 0;
    hits.push(start);
  }
  if (hits.length < 2) return [{ text, start: 0, end: text.length }];
  const starts =
    hits[0] > 0 && text.slice(0, hits[0]).trim() ? [0, ...hits] : hits;
  return starts
    .map((start, i) => {
      const end = starts[i + 1] ?? text.length;
      return {
        text: text.slice(start, end).replace(/^[\s;,|+–—]+|[\s;,|+–—]+$/g, ""),
        start,
        end,
      };
    })
    .filter((segment) => segment.text);
}

export function monetaryCell(text) {
  // Explicitly selected value-column cells cannot contain IDs or quantities.
  return extractFinanceValue(String(text)).length === 1;
}
