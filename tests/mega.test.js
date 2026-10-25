import { it, expect } from "vitest";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { analyzePDF } from "../server/services/analyzeService.js";
import { groupDocuments } from "../shared/grouping.js";
const expected = JSON.parse(
  await fs.readFile(
    new URL("./fixtures/mega/expected.json", import.meta.url),
    "utf8",
  ),
).closings;
it("lê o PDF original de 19 páginas: 17 turnos, 357 cupons únicos, 1 duplicata, 2 contagens ausentes e OCR real", async () => {
  const bytes = await fs.readFile(
    new URL("./fixtures/mega/mega-19-pages.pdf", import.meta.url),
  );
  const data = await analyzePDF(bytes, { documentId: "mega-original" });
  expect(data.pages).toHaveLength(19);
  expect(data.pages.filter((p) => p.ocr).map((p) => p.page)).toEqual([18]);
  expect(data.parts).toHaveLength(17);
  expect(data.contextPages.map((p) => p.page)).toEqual([1, 19]);
  let duplicates = 0,
    receipts = 0,
    calculable = 0,
    missingCount = 0;
  for (const e of expected) {
    const part = data.parts.find((p) =>
      p.pages.some((page) => page.page === e.page),
    );
    expect(part, "página " + e.page).toBeTruthy();
    for (const [key, value] of Object.entries(e.fields))
      expect(part.fields[key].value, e.reference + ":" + key).toBe(value);
    expect(part.fields.operator.value).toBe(e.operator);
    expect(part.fields.register.value).toBe(e.register);
    expect(part.fields.date.value).toBe(e.date);
    expect(part.identity.closingReference.toUpperCase()).toBe(e.reference);
    expect(part.rules.cancellationTreatment).toBe("included");
    expect(part.calculation.expected).toBe(e.expected);
    expect(part.calculation.difference).toBe(e.difference);
    expect(part.fields.other.value).toBe(0);
    expect(part.fields.refunds.value).toBe(0);
    expect(part.unparsedLines, e.reference).toEqual([]);
    expect(part.transactions).toHaveLength(e.receipts);
    expect(part.transactions.filter((t) => t.duplicateOf)).toHaveLength(
      e.duplicates,
    );
    expect(part.transactions.every((t) => t.source.page === e.page)).toBe(true);
    expect(part.audit.issues.map((i) => i.id)).toEqual(
      e.fields.counted == null
        ? ["missing:counted"]
        : e.ocr
          ? [`${part.id}:ocr:18`]
          : [],
    );
    receipts += part.transactions.filter((t) => !t.duplicateOf).length;
    duplicates += e.duplicates;
    if (part.calculation.difference != null) calculable++;
    else missingCount++;
  }
  expect({ duplicates, receipts, calculable, missingCount }).toEqual({
    duplicates: 1,
    receipts: 357,
    calculable: 15,
    missingCount: 2,
  });
  const hash = createHash("sha256").update(bytes).digest("hex");
  const docs = data.parts.map((part) => ({
    ...part,
    hash,
    filename: "mega.pdf · " + part.pages[0].page,
    partOf: "mega-original",
    status: part.audit.canConfirm ? "completed" : "review_required",
  }));
  const grouped = groupDocuments(docs);
  expect(grouped.closings).toHaveLength(17);
  expect(grouped.suggestions).toEqual([]);
  expect(
    grouped.closings.reduce(
      (n, c) => n + c.transactions.filter((t) => !t.duplicateOf).length,
      0,
    ),
  ).toBe(357);
  expect(data.audit.canConfirm).toBe(false);
}, 120000);
