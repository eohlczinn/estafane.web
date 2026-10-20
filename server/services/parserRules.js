// Perfis por rótulos: adicionar aliases do mercado aqui, sem alterar o motor financeiro.
export const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
export const moneyRules = {
  sales:
    /^(?:total (?:geral )?(?:de )?vendas|vendas liquidas|vendas totais|total liquido|total vendido)\b/,
  cash: /^(?:(?:total|vendas(?: recebidas)?|recebimentos)(?: em| de)?)?\s*(?:dinheiro|especie)(?:\s*\(vendas\))?\b/,
  pix: /^(?:(?:total|vendas)(?: em| de)?)?\s*pix\b/,
  debit:
    /^(?:(?:total|vendas)(?: em| de)?\s+)?(?:(?:cartao|cartoes) (?:de )?)?debito\b/,
  credit:
    /^(?:(?:total|vendas)(?: em| de)?\s+)?(?:(?:cartao|cartoes) (?:de )?)?credito\b/,
  cards: /^(?:total (?:de )?)?cartoes\b/,
  voucher:
    /^(?:(?:total|vendas)(?: em| de)?\s+)?(?:vale[- ]?(?:alimentacao|refeicao)|ticket alimentacao|voucher)\b/,
  other: /^(?:outras formas de pagamento|outros pagamentos|outros)\b/,
  opening:
    /^(?:fundo (?:inicial|de troco)|saldo inicial|troco inicial|abertura de caixa)\b/,
  withdrawals: /^(?:total (?:de )?)?(?:sangrias?|retiradas?)\b/,
  supplies: /^(?:total (?:de )?)?(?:suprimentos?|entradas?)\b/,
  refunds: /^(?:devolucoes? em dinheiro|devolucao em dinheiro)\b/,
  cancellations: /^(?:total (?:de )?)?cancelamentos?\b/,
  reversals: /^(?:total (?:de )?)?estornos?\b/,
  counted:
    /^(?:dinheiro (?:efetivamente )?contado|valor contado|total contado)\b/,
  netCash:
    /^(?:saldo (?:final )?liquido (?:em |de )?(?:dinheiro|especie)|saldo esperado (?:em |de )?(?:dinheiro|especie))\b/,
};
const separator = "(?:\\s*[:=|]\\s*|\\s+-\\s+|\\s+)";
export const infoRules = Object.fromEntries(
  Object.entries({
    market:
      "(?:nome do (?:mercado|supermercado|estabelecimento)|mercado|supermercado|estabelecimento|empresa|razao social)",
    operator:
      "(?:nome (?:do operador|da operadora)|operador[a]?|funcionario[a]?)",
    register: "(?:numero do caixa|pdv|caixa)",
    date: "(?:data(?: de fechamento| do movimento)?|fechamento)",
    shift: "(?:horario|turno|hora)",
  }).map(([key, label]) => [key, new RegExp(`^${label}${separator}(.+)$`)]),
);
export function layoutLine(line) {
  return line
    .replace(/^\s*\d{1,4}\s*[-.)]\s*(?=[A-Za-zÀ-ÿ])/, "")
    .replace(/^\s*\d{1,4}\s+(?=[A-Za-zÀ-ÿ])/, "")
    .trim();
}
