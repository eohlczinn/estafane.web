import { it, expect } from "vitest";
import { validateBatch, validateDocument } from "../shared/contracts.js";
import { zipFiles } from "../src/services/zip.js";
import {
  normalizePreferences,
  defaultPreferences,
} from "../src/services/preferences.js";
it("recusa contratos sem versão e campos monetários não inteiros", () => {
  expect(() =>
    validateBatch({ documents: [], closings: [], id: "1" }),
  ).toThrow();
  expect(() =>
    validateDocument({
      id: "1",
      filename: "x.pdf",
      hash: "a".repeat(64),
      status: "completed",
      fields: { cash: { value: 1.5, status: "recognized" } },
    }),
  ).toThrow();
});
it("recusa movimento negativo ou origem ausente", () => {
  const d = {
    id: "1",
    filename: "x.pdf",
    hash: "a".repeat(64),
    status: "completed",
  };
  expect(() =>
    validateDocument({
      ...d,
      movements: [
        { amountCents: -1, direction: "out", source: { documentId: "1" } },
      ],
    }),
  ).toThrow();
  expect(() =>
    validateDocument({
      ...d,
      movements: [{ amountCents: 1, direction: "out" }],
    }),
  ).toThrow();
});
it("ZIP usa CRC-32 conhecido e aponta ao diretório e arquivo corretos", () => {
  const data = new TextEncoder().encode("123456789"),
    bytes = zipFiles([{ name: "teste.txt", bytes: data }]),
    view = new DataView(bytes.buffer);
  expect(view.getUint32(14, true)).toBe(0xcbf43926);
  expect(view.getUint32(18, true)).toBe(9);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const directory = view.getUint32(end + 16, true);
  expect(view.getUint32(directory, true)).toBe(0x02014b50);
  expect(view.getUint32(directory + 42, true)).toBe(0);
});
it("configurações de lote respeitam limites e não persistem documentos", () => {
  const p = normalizePreferences({
    ...defaultPreferences,
    maxBatchFiles: 99,
    documents: [{ hash: "segredo" }],
    movements: [{ amountCents: 900 }],
    autoGroup: false,
    warnDuplicates: false,
  });
  expect(p.maxBatchFiles).toBe(10);
  expect(p.autoGroup).toBe(false);
  expect(p.warnDuplicates).toBe(false);
  expect(p.documents).toBeUndefined();
  expect(p.movements).toBeUndefined();
});
