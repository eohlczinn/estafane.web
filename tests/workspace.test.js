import { it, expect } from "vitest";
import fs from "node:fs";
import { parsePages } from "../server/services/pdfParser.js";
import { mergeDocuments } from "../shared/grouping.js";
import {
  archiveSnapshot,
  restoreSnapshot,
  makeArchiveRecord,
  checkArchiveCapacity,
  decodeArchiveRecords,
} from "../src/services/archive.js";
import {
  normalizeProfile,
  socialLink,
  appendNotification,
  readProfile,
  readNotifications,
} from "../src/services/workspace.js";
import { normalizePreferences } from "../src/services/preferences.js";
import { assessDocument } from "../server/services/documentAssessment.js";
it("isola registro incompatível sem perder os outros ou confiar em cálculo salvo", () => {
  const valid = makeArchiveRecord(fixture(), "valid");
  valid.snapshot.calculation.difference = 999;
  const decoded = decodeArchiveRecords([
    valid,
    {
      id: "broken",
      version: 99,
      updatedAt: "invalid",
      bytes: 30,
      snapshot: {},
    },
  ]);
  expect(
    decoded.find((r) => r.id === "valid").snapshot.calculation.difference,
  ).toBe(665);
  expect(decoded.find((r) => r.id === "broken")).toMatchObject({
    invalid: true,
    id: "broken",
    snapshot: { confirmed: false },
  });
  expect(() =>
    checkArchiveCapacity(
      Array.from({ length: 30 }, (_, i) => ({ id: String(i), bytes: 100 })),
      { id: "0", bytes: 100 },
      10,
    ),
  ).not.toThrow();
});
const text = fs.readFileSync(
  new URL(
    "./fixtures/horizonte/relatorio_teste_caixa_estefane_02 (2).txt",
    import.meta.url,
  ),
  "utf8",
);
const pages = [{ page: 1, text }];
const fixture = () =>
  mergeDocuments(
    [
      {
        id: "ficticio",
        filename: "ficticio.txt",
        hash: "a".repeat(64),
        ...parsePages(pages, { documentId: "ficticio" }),
        pages,
      },
    ],
    "ficticio",
  );
it("arquiva uma cópia sem desfazer e reaudita ao reabrir, exigindo nova confirmação", () => {
  const c = fixture();
  c.confirmed = true;
  c.reviewed = true;
  c.undoStack = [{ huge: "old" }];
  const record = makeArchiveRecord(c, "a");
  expect(record.snapshot.undoStack).toBeUndefined();
  expect(record.snapshot.calculation.difference).toBe(665);
  const reopened = restoreSnapshot({
    ...record.snapshot,
    calculation: { expected: 1, difference: 1 },
  });
  expect(reopened.confirmed).toBe(false);
  expect(reopened.reviewed).toBe(false);
  expect(reopened.calculation).toMatchObject({
    expected: 44540,
    difference: 665,
  });
  expect(c.confirmed).toBe(true);
  const modified = {
    ...record.snapshot,
    fields: {
      ...record.snapshot.fields,
      counted: { ...record.snapshot.fields.counted, value: 44000 },
    },
  };
  expect(restoreSnapshot(modified).calculation.difference).toBe(-540);
  expect(makeArchiveRecord(c, "a", record).savedAt).toBe(record.savedAt);
});
it("recusa registros quebrados, valores fracionários e limites sem apagar os existentes", () => {
  expect(() => restoreSnapshot({})).toThrow();
  const c = fixture();
  c.fields.cash.value = 1.2;
  expect(() => archiveSnapshot(c)).toThrow();
  const big = fixture();
  big.notes = "x".repeat(2100000);
  expect(() => archiveSnapshot(big)).toThrow(/2 MB/);
  const records = Array.from({ length: 10 }, (_, i) => ({
    id: String(i),
    bytes: 100,
  }));
  expect(() =>
    checkArchiveCapacity(records, { id: "new", bytes: 100 }, 10),
  ).toThrow(/cheio/);
  expect(() =>
    checkArchiveCapacity(records, { id: "0", bytes: 100 }, 10),
  ).not.toThrow();
  expect(() =>
    checkArchiveCapacity(
      [{ id: "a", bytes: 20 * 1048576 }],
      { id: "b", bytes: 10 },
      50,
    ),
  ).toThrow();
  expect(records).toHaveLength(10);
});
it("valida redes sociais e perfil, bloqueando destinos falsos e protocolos executáveis", () => {
  expect(socialLink("instagram", "@estefane.exemplo")).toBe(
    "https://www.instagram.com/estefane.exemplo/",
  );
  expect(socialLink("whatsapp", "+55 (61) 99999-0000")).toBe(
    "https://wa.me/5561999990000",
  );
  for (const link of [
    "javascript:alert(1)",
    "https://instagram.com.evil.test/a",
    "https://evil.test",
    "https://x:senha@instagram.com",
    "https://instagram.com:8080/a",
  ])
    expect(() => socialLink("instagram", link)).toThrow();
  expect(
    normalizeProfile({ name: " Ana ", age: 21, instagram: "@ana" }),
  ).toMatchObject({ name: "Ana", age: 21 });
  expect(() => normalizeProfile({ name: "", age: 21 })).toThrow();
  expect(() => normalizeProfile({ age: NaN })).toThrow();
  expect(readProfile({ getItem: () => "{broken" }).age).toBe(21);
});
it("notificações deduplicam avisos próximos e têm tamanho limitado", () => {
  const one = appendNotification(
    [],
    "salvo",
    "history",
    "2026-10-23T12:00:00Z",
  );
  expect(
    appendNotification(one, "salvo", "history", "2026-10-23T12:00:10Z"),
  ).toBe(one);
  let items = [];
  for (let i = 0; i < 80; i++) items = appendNotification(items, String(i));
  expect(items).toHaveLength(60);
  expect(readNotifications({ getItem: () => "{" })).toEqual([]);
});
it("triagem aceita caixa completo e documentos complementares, recusando currículos e notas de compra", () => {
  expect(assessDocument(pages, parsePages(pages)).status).toBe("cash_report");
  for (const t of [
    "Relatório de sangrias\nSangria 01: R$ 20,00",
    "Dinheiro contado: 20,00",
    "Resumo de vendas\nDinheiro: 20,00\nPIX: 10,00",
  ]) {
    const p = [{ page: 1, text: t }];
    expect(assessDocument(p, parsePages(p)).status).not.toBe("unrelated");
  }
  for (const t of [
    "CURRÍCULO\nNome: Ana\nExperiência profissional: caixa\nPretensão salarial: R$ 2.000,00",
    "NOTA FISCAL\nTotal: 20,00\nForma de pagamento: PIX\nDinheiro: 20,00",
    "Manual de instruções da impressora\nConfigurar rede e alimentação.",
    "Olá, mundo!",
  ]) {
    const p = [{ page: 1, text: t }];
    expect(assessDocument(p, parsePages(p)).status, t).toBe("unrelated");
  }
});
it("novas preferências são limitadas e valores inválidos não desativam validação financeira", () => {
  const p = normalizePreferences({
    tiltStrength: 999,
    effectSpeed: -1,
    historyLimit: 999,
    autoHistory: false,
    notificationsEnabled: false,
    establishmentVersion: 2,
  });
  expect(p).toMatchObject({
    tiltStrength: 10,
    effectSpeed: 8,
    historyLimit: 100,
    autoHistory: false,
    notificationsEnabled: false,
  });
});
