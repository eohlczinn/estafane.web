import { normalize } from "./parserRules.js";
// Explainable dictionary matches only propose a category. They never create a
// financial observation, choose total vs movement, or authorize confirmation.
const dictionary = [
  [
    "withdrawals",
    /\b(?:saque|cofre|retencao|recolhimento|retirada|sangria)\b/,
    "saque / recolhimento",
  ],
  [
    "supplies",
    /\b(?:reposicao|reforco|suprimento|aporte)\b/,
    "reposição / reforço",
  ],
  [
    "opening",
    /\b(?:abertura|fundo inicial|troco inicial)\b/,
    "abertura / fundo inicial",
  ],
  [
    "counted",
    /\b(?:contagem|contado|apurado fisicamente)\b/,
    "contagem física",
  ],
  ["pix", /\b(?:pix|pagamento instantaneo)\b/, "pagamento instantâneo"],
  ["debit", /\bdebito\b/, "débito"],
  ["credit", /\bcredito\b/, "crédito"],
  ["expenses", /\b(?:despesa|gasto|desembolso)\b/, "despesa / gasto"],
  ["refunds", /\b(?:reembolso|devolucao)\b/, "reembolso / devolução"],
  ["cancellations", /\bcancelamento\b/, "cancelamento"],
];
export function suggestCategories(text) {
  const n = normalize(text);
  return dictionary
    .filter(([, rule]) => rule.test(n))
    .slice(0, 3)
    .map(([field, , term]) => ({
      field,
      reason: `O texto contém indicação de ${term}. Confira a natureza da linha no original.`,
      method: "dictionary",
    }));
}
