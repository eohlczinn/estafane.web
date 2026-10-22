import { parsePages } from "./pdfParser.js";
import { calculate } from "../../shared/calculation.js";
import { reconcile } from "./reconciliationService.js";
import fs from "node:fs/promises";
import { compareDocuments } from "../../shared/grouping.js";
const progress = (info) =>
  process.send?.({ type: "closing-analysis-progress", ...info });
process.once(
  "message",
  async ({
    data,
    filePath,
    documentId,
    format = "pdf",
    importProfiles = [],
  }) => {
    try {
      progress({ stage: "reading" });
      let pages;
      if (format === "pdf") {
        const { readPDF } = await import("./pdfReader.js");
        pages = await readPDF(
          filePath ? await fs.readFile(filePath) : Buffer.from(data, "base64"),
          progress,
        );
      } else if (["png", "jpeg"].includes(format)) {
        const { readImage } = await import("./imageReader.js");
        pages = await readImage(await fs.readFile(filePath), format);
      } else {
        const { readTabular } = await import("./tabularReader.js");
        pages = await readTabular(filePath, format);
      }
      progress({ stage: "interpreting" });
      const parsed = parsePages(pages, { documentId, importProfiles });
      // A workbook may carry independent complete closings on separate sheets.
      // Split only with explicit identity on every sheet; partial sheets remain
      // complementary observations, and conflicting records stay pending.
      let parts;
      if (["xlsx","xls","ods"].includes(format) && pages.length > 1) {
        const candidates = pages.map(p => {
          const id = `${documentId}:sheet-${p.page}`;
          const result = parsePages([p], {documentId:id,importProfiles});
          return {id,...result,pages:[p],format,calculation:calculate(result.fields,result.rules),audit:reconcile(result)};
        });
        if (candidates.every(c => ["market","operator","register","date"].every(k => c.fields[k].value && c.fields[k].status !== "ambiguous")) &&
          candidates.some((c,i) => candidates.some((other,j) => j > i && compareDocuments(c,other) === "independent")))
          parts = candidates;
      }
      progress({ stage: "calculating" });
      const calculation = calculate(parsed.fields, parsed.rules);
      progress({ stage: "validating" });
      process.send(
        {
          type: "closing-analysis-result",
          ok: true,
          pages,
          format,
          parts,
          ...parsed,
          calculation,
          audit: reconcile(parsed),
        },
        () => process.exit(0),
      );
    } catch (error) {
      process.send(
        {
          type: "closing-analysis-result",
          ok: false,
          error: { name: error.name, message: error.message, failureKind:error.failureKind },
        },
        () => process.exit(1),
      );
    }
  },
);
