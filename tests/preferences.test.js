import { it, expect } from "vitest";
import {
  normalizePreferences,
  readPreferences,
  writePreferences,
  reportFilename,
  defaultPreferences,
} from "../src/services/preferences.js";
const memory = () => {
  let data = {};
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};
it("persiste e restaura apenas preferências permitidas", () => {
  const store = memory();
  writePreferences(store, {
    ...defaultPreferences,
    theme: "dark",
    market: "Pingo De Ouro",
    operator: "Estefane",
    register: "02",
    marginThermal: 3,
    notes: "DADO FINANCEIRO",
    fields: { cash: 5000 },
    password: "senha",
  });
  const text = store.getItem("estefane.preferences");
  expect(text).not.toContain("DADO FINANCEIRO");
  expect(text).not.toContain("password");
  expect(text).not.toContain("cash");
  expect(readPreferences(store).register).toBe("02");
  expect(readPreferences(store).theme).toBe("dark");
});
it("normaliza limites e opções inválidas", () => {
  const p = normalizePreferences({
    marginA4: 100,
    marginThermal: -5,
    paper: "banana",
    logo: "javascript:alert(1)",
  });
  expect(p.marginA4).toBe(25);
  expect(p.marginThermal).toBe(2);
  expect(p.paper).toBe("a4");
  expect(p.logo).toBe("");
});
it("recupera preferências corrompidas e armazenamento indisponível", () => {
  expect(readPreferences({ getItem: () => "{" })).toEqual(defaultPreferences);
  expect(
    writePreferences(
      {
        setItem: () => {
          throw Error("quota");
        },
      },
      {},
    ),
  ).toBe(false);
});
it("gera nome seguro com horário de São Paulo", () =>
  expect(
    reportFilename(
      { filename: "caixa/teste" },
      new Date("2026-10-19T02:30:00Z"),
      "58",
    ),
  ).toBe("caixa-teste-58-2026-10-18_23-30.pdf"));
it("preserva espaços durante a digitação dos nomes", () =>
  expect(
    normalizePreferences({ ...defaultPreferences, market: "Pingo " }).market,
  ).toBe("Pingo "));
