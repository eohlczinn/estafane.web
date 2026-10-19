import { it, expect } from "vitest";
import { emptyFields } from "../shared/fields.js";
import { reportRows } from "../src/services/report.js";
import { defaultPreferences } from "../src/services/preferences.js";
import { reconstructLines } from "../server/services/textLines.js";
it("reconstrói tabela por coordenadas mesmo quando itens vêm fora de ordem", () => {
  const item = (str, x, y, width = 50) => ({
    str,
    transform: [12, 0, 0, 12, x, y],
    width,
  });
  expect(
    reconstructLines([
      item("100,00", 200, 700),
      item("PIX:", 20, 680),
      item("Dinheiro:", 20, 700),
      item("50,00", 200, 680),
    ]),
  ).toBe("Dinheiro: 100,00\nPIX: 50,00");
});
it("aplica opções sem remover a conferência financeira obrigatória", () => {
  const f = emptyFields();
  f.market.value = "Mercado";
  const calc = {
    sales: 10000,
    expected: 10000,
    difference: 0,
    result: "balanced",
    notes: "Observação de teste",
    rules: { confirmed: true },
  };
  let rows = reportRows(f, calc, {
    ...defaultPreferences,
    includeMarket: false,
    includeSummary: false,
    includeMovements: false,
  });
  expect(rows.some(([k]) => k === "Estabelecimento")).toBe(false);
  expect(rows.some(([, v]) => v === "RESUMO FINANCEIRO")).toBe(false);
  expect(rows.some(([k]) => k === "Dinheiro esperado")).toBe(true);
  expect(rows.some(([k]) => k === "Resultado")).toBe(true);
  expect(rows.some(([, v]) => v === "Observação de teste")).toBe(true);
  rows = reportRows(f, calc, { ...defaultPreferences, allowNotes: false });
  expect(rows.some(([, v]) => v === "Observação de teste")).toBe(false);
});
