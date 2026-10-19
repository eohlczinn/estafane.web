export function parseMoney(input) {
  if (typeof input !== "string")
    throw new Error("Informe um valor monetário em reais.");
  const text = input
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text))
    throw new Error(
      "Use o formato brasileiro: 1.234,56 (até duas casas decimais).",
    );
  const negative = text.startsWith("-"),
    [whole, fraction = ""] = text
      .replace("-", "")
      .replace(/\./g, "")
      .split(",");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 1e12)
    throw new Error("Valor fora do limite permitido.");
  return negative ? -cents : cents;
}
export const formatMoney = (value) =>
  value == null
    ? "Não informado"
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value / 100);
export const editMoney = (value) =>
  value == null
    ? ""
    : `${value < 0 ? "-" : ""}${Math.floor(Math.abs(value) / 100)},${String(Math.abs(value) % 100).padStart(2, "0")}`;
