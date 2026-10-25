import { moneyFields } from "../../shared/fields.js";
const normalized = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
// Money alone is not evidence of a cash ledger; complementary reports remain valid.
export function assessDocument(pages, parsed = {}) {
  const text = normalized(
    pages
      .map((p) => p.text || (p.lines || []).map((l) => l.text).join("\n"))
      .join("\n"),
  );
  const signals = [];
  const ledger =
    /\b(?:sangria|suprimento|fundo (?:de )?troco|dinheiro contado|saldo (?:inicial|final|do caixa)|abertura (?:de |do )?caixa|fechamento (?:de |do )?(?:caixa|operador)|movimenta\w* (?:do |de )?(?:dinheiro|caixa)|vendas (?:recebidas )?em dinheiro|total (?:em |de )?dinheiro)\b/.test(
      text,
    );
  const report =
    /\b(?:relatorio|resumo|extrato|movimento|fechamento|vendas por|formas? de pagamento)\b/.test(
      text,
    );
  const paymentWords = [
    "dinheiro",
    "pix",
    "debito",
    "credito",
    "vale-alimentacao",
  ].filter((k) => text.includes(k));
  const recognized = Object.entries(parsed.fields || {})
    .filter(([k, f]) => k in moneyFields && f.value != null && f.source)
    .map(([k]) => k);
  if (
    parsed.inventory?.detected &&
    !recognized.length &&
    !parsed.movements?.length
  )
    return {
      status: "inventory_report",
      signals: ["Estoque e quantidades identificados"],
      message: parsed.inventory.items.length
        ? "Inventário identificado. Quantidades serão conferidas separadamente do dinheiro."
        : "Seção de estoque identificada. Confira a estrutura e os campos pendentes.",
    };
  const receipt =
    /\b(?:nota fiscal|danfe|nf-e|nfc-e|cupom fiscal|pedido de compra|orcamento|fatura|boleto|curriculo|experiencia profissional|receita culinaria|manual de instrucoes)\b/.test(
      text,
    );
  if (ledger) signals.push("Movimentação ou conferência de caixa");
  if (paymentWords.length >= 2)
    signals.push("Formas de pagamento identificadas");
  if (recognized.length)
    signals.push(`${recognized.length} campo(s) financeiro(s) com origem`);
  const complementary =
    /\b(?:relatorio|extrato|total|resumo)\s+(?:de |dos? |das? )?(?:sangrias?|suprimentos?|cancelamentos?|devolucoes|estornos|pagamentos)\b/.test(
      text,
    );
  const cashSales = ["cash", "sales"].every((k) => recognized.includes(k));
  const ledgerEvidence =
    ledger && (recognized.length > 0 || parsed.movements?.length > 0);
  const paymentEvidence =
    !receipt &&
    recognized.length >= 2 &&
    paymentWords.length >= 2 &&
    (report ||
      parsed.fields?.register?.value ||
      parsed.fields?.operator?.value);
  const valid =
    ledgerEvidence ||
    (complementary && recognized.length > 0) ||
    (!receipt && cashSales) ||
    paymentEvidence ||
    (!receipt && recognized.length >= 3);
  if (valid)
    return {
      status: recognized.length >= 3 ? "cash_report" : "partial_cash_report",
      signals,
      message:
        recognized.length >= 3
          ? "Documento de caixa identificado. Os valores serão auditados."
          : "Documento complementar de caixa. Pode precisar de outros dados para fechar o caixa.",
    };
  return {
    status: "unrelated",
    signals,
    message: receipt
      ? "Este arquivo parece ser um documento de outro tipo, sem uma movimentação de caixa identificável. Envie o relatório de fechamento ou de movimentos do caixa."
      : "Não encontrei evidências suficientes de fechamento de caixa neste arquivo. Envie um relatório com vendas por pagamento, sangrias, suprimentos ou conferência do dinheiro.",
  };
}
