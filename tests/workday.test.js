import { it, expect } from "vitest";
import { applyWorkDefaults, todayInSaoPaulo } from "../shared/workday.js";
import { emptyFields } from "../shared/fields.js";
it("usa o dia local de São Paulo em vez do dia UTC", () => {
  expect(todayInSaoPaulo(new Date("2026-10-19T02:30:00Z"))).toBe("18/10/2026");
  expect(todayInSaoPaulo(new Date("2026-10-19T03:01:00Z"))).toBe("19/10/2026");
});
it("preenche dados conhecidos sem criar valores financeiros", () => {
  const f = applyWorkDefaults(
    emptyFields(),
    undefined,
    new Date("2026-10-19T12:00:00Z"),
  );
  expect(f.date.value).toBe("19/10/2026");
  expect(f.market.value).toBe("Pingo De Ouro");
  expect(f.operator.value).toBe("Estefane");
  expect(f.cash.value).toBeNull();
  expect(f.date.status).toBe("default");
});
it("preserva a data e o estabelecimento realmente extraídos do PDF", () => {
  const f = emptyFields();
  f.date = { ...f.date, value: "17/10/2026", status: "recognized" };
  f.market = {
    ...f.market,
    value: "Mercado do documento",
    status: "recognized",
  };
  const result = applyWorkDefaults(f, "Pingo De Ouro");
  expect(result.date.value).toBe("17/10/2026");
  expect(result.market.value).toBe("Mercado do documento");
});
it("não preenche valores explicitamente removidos ou ambíguos", () => {
  const f = emptyFields();
  f.date.status = "manual";
  f.market.status = "ambiguous";
  const r = applyWorkDefaults(f);
  expect(r.date.value).toBeNull();
  expect(r.market.value).toBeNull();
});
