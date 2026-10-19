import { emptyFields } from "./fields.js";
export const establishment = "Pingo De Ouro";
export function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);
}
export function applyWorkDefaults(
  fields = emptyFields(),
  market = establishment,
  now = new Date(),
  profile = {},
) {
  const next = { ...fields };
  for (const [key, value, reason] of [
    ["market", market || establishment, "Estabelecimento configurado"],
    ["operator", profile.operator || "Estefane", "Operadora configurada"],
    ["register", profile.register || null, "Caixa padrão configurado"],
    ["date", todayInSaoPaulo(now), "Data de hoje · horário de São Paulo"],
  ]) {
    if (value == null) continue;
    if (next[key].value == null && next[key].status === "missing")
      next[key] = {
        ...next[key],
        value,
        status: "default",
        defaultReason: reason,
        review: true,
      };
  }
  return next;
}
