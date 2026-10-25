import { parsePages } from "./pdfParser.js";
import { calculate } from "../../shared/calculation.js";
import { reconcile } from "./reconciliationService.js";
import fs from "node:fs/promises";
import { compareDocuments } from "../../shared/grouping.js";
import { emptyFields } from "../../shared/fields.js";
import { assessDocument } from "./documentAssessment.js";
import { splitDocumentScopes, scopePartLabel } from "./documentScopes.js";
import { splitTabularScopes } from "./tabularScopes.js";
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
      let parsed = parsePages(pages, { documentId, importProfiles });
      let contextPages = [];
      const parseScope = (scope, index, prefix = "scope") => {
        const id = `${documentId}:${prefix}-${index + 1}`;
        const result = parsePages(scope.pages, {
          documentId: id,
          importProfiles,
        });
        result.extractionIssues.push(
          ...(scope.issues || []).map((issue, issueIndex) => ({
            ...issue,
            id: `${id}:scope:${issueIndex}`,
            source: { ...issue.source, documentId: id },
          })),
        );
        const audit = reconcile(result);
        return {
          ...result,
          id,
          pages: scope.pages,
          partLabel: scope.label || scopePartLabel(scope.pages),
          format,
          calculation: audit.calculation,
          audit,
        };
      };
      // A workbook may carry independent complete closings on separate sheets.
      // Split only with explicit identity on every sheet; partial sheets remain
      // complementary observations, and conflicting records stay pending.
      let parts;
      const tabular = ["xlsx", "xls", "ods", "csv", "txt"].includes(format)
        ? splitTabularScopes(pages)
        : { scopes: [] };
      if (tabular.scopes.length > 1)
        parts = tabular.scopes.map((scope, index) =>
          parseScope(scope, index, "row"),
        );
      else if (format === "pdf") {
        const partition = splitDocumentScopes(pages);
        contextPages = partition.contextPages;
        if (partition.scopes.length > 1)
          parts = partition.scopes.map((scope, index) =>
            parseScope(scope, index),
          );
        else if (partition.scopes.length === 1 && contextPages.length) {
          // Cover, explanatory notes and inventory stay available as evidence,
          // without turning illustrative money in those pages into cash sales.
          const inventory = parsed.inventory;
          parsed = parsePages(partition.scopes[0].pages, {
            documentId,
            importProfiles,
          });
          parsed.extractionIssues.push(
            ...partition.scopes[0].issues.map((issue, index) => ({
              ...issue,
              id: `${documentId}:scope:${index}`,
              source: { ...issue.source, documentId },
            })),
          );
          parsed.inventory = inventory;
        } else if (!partition.scopes.length && contextPages.length) {
          // An explanatory page does not become a closing merely because it
          // contains a worked example of PIX, cash or an expected balance.
          parsed = {
            ...parsed,
            fields: emptyFields(),
            movements: [],
            declarations: [],
            unparsedLines: [],
            extractionIssues: [],
            transactions: [],
            identity: {},
            documentKind: parsed.inventory?.detected
              ? "inventory"
              : "informational",
          };
        }
      } else if (["xlsx", "xls", "ods"].includes(format) && pages.length > 1) {
        const candidates = pages
          .map((p) => {
            const id = `${documentId}:sheet-${p.page}`;
            const result = parsePages([p], { documentId: id, importProfiles });
            return {
              id,
              ...result,
              pages: [p],
              partLabel: scopePartLabel([p]),
              format,
              calculation: calculate(result.fields, result.rules),
              audit: reconcile(result),
            };
          })
          .filter((candidate) => {
            if (candidate.documentKind !== "inventory") return true;
            contextPages.push({
              ...candidate.pages[0],
              contextKind: "inventory",
            });
            return false;
          });
        if (
          candidates.every((c) =>
            ["market", "operator", "register", "date"].every(
              (k) => c.fields[k].value && c.fields[k].status !== "ambiguous",
            ),
          ) &&
          candidates.some((c, i) =>
            candidates.some(
              (other, j) =>
                j > i && compareDocuments(c, other) === "independent",
            ),
          )
        )
          parts = candidates;
      }
      const documentAssessment = parts?.length
        ? {
            status: "cash_bundle",
            signals: [
              ...new Set(
                parts.flatMap(
                  (part) => assessDocument(part.pages, part).signals,
                ),
              ),
            ],
            message: `${parts.length} fechamentos independentes identificados no arquivo. Cada turno será conferido separadamente.`,
          }
        : assessDocument(pages, parsed);
      if (documentAssessment.status === "unrelated") {
        const error = new Error(documentAssessment.message);
        error.name = "DocumentError";
        error.failureKind = "unrelated";
        throw error;
      }
      if (parts?.length) {
        // A file containing independent closings is a source container. Its
        // totals must never act as an additional closing or merge the shifts.
        parsed = {
          fields: emptyFields(),
          movements: [],
          declarations: [],
          unparsedLines: [],
          warnings: [],
          extractionIssues: [],
          normalizationNotes: [],
          transactions: [],
          identity: {},
          rules: {},
          inventory: parsed.inventory,
          container: true,
          documentKind: "closing_bundle",
        };
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
          contextPages,
          documentAssessment,
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
          error: {
            name: error.name,
            message: error.message,
            failureKind: error.failureKind,
          },
        },
        () => process.exit(1),
      );
    }
  },
);
