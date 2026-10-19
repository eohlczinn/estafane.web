import { readPDF } from "./pdfReader.js";
import { parsePages } from "./pdfParser.js";
import { calculate } from "../../shared/calculation.js";
import { reconcile } from "./reconciliationService.js";
import fs from "node:fs/promises";
const progress = (info) =>
  process.send?.({ type: "closing-analysis-progress", ...info });
process.once("message", async ({ data, filePath, documentId }) => {
  try {
    progress({ stage: "reading" });
    const pages = await readPDF(
      filePath ? await fs.readFile(filePath) : Buffer.from(data, "base64"),
      progress,
    );
    progress({ stage: "interpreting" });
    const parsed = parsePages(pages, { documentId });
    progress({ stage: "calculating" });
    const calculation = calculate(parsed.fields, parsed.rules);
    progress({ stage: "validating" });
    process.send(
      {
        type: "closing-analysis-result",
        ok: true,
        pages,
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
        error: { name: error.name, message: error.message },
      },
      () => process.exit(1),
    );
  }
});
