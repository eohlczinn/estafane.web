import { emptyFields, allFields } from "../../shared/fields.js";
import { parseMoney } from "../../shared/money.js";
import { movementTotals, movementTypes } from "../../shared/movements.js";
import { normalize, moneyRules, infoRules, layoutLine } from "./parserRules.js";
import { reconcileLedgerProfile } from "./ledgerProfile.js";
import {
  extractMovements,
  moneyTokens,
  classifyEffect,
} from "./movementExtractor.js";

export function parsePages(pages, { documentId = "document" } = {}) {
  const fields = emptyFields(),
    warnings = [],
    declarations = [],
    unparsedLines = [];
  const lines = pages.flatMap((p) =>
    (
      p.lines || p.text.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }))
    ).flatMap((l) => {
      const cells = l.text.split(/\t+(?=\s*[A-Za-zÀ-ÿ][^\t]*[:=])/);
      return cells.map((text, cell) => ({
        ...l,
        text: text.trim(),
        page: p.page,
        id: `${p.page}:${l.line}:${cell}`,
      }));
    }),
  );
  const extracted = extractMovements(lines, documentId);
  declarations.push(...extracted.declarations);
  function assign(key, value, source, original = source.text) {
    const candidate = {
      value,
      original,
      source,
      status: "recognized",
      review: true,
    };
    if (fields[key].status === "ambiguous") {
      fields[key].candidates.push(candidate);
      return;
    }
    if (fields[key].value != null) {
      if (fields[key].value !== value) {
        fields[key] = {
          ...candidate,
          value: null,
          status: "ambiguous",
          candidates: [fields[key], candidate],
        };
        warnings.push(
          `Valores diferentes para ${allFields[key]}; confira o documento.`,
        );
      } else
        fields[key].sources = [
          ...(fields[key].sources || [fields[key].source]),
          source,
        ];
    } else fields[key] = candidate;
  }
  const identity = { closingReference: null, reportType: null };
  const explicitMarket = lines.some((l) => /^estabelecimento\s/.test(normalize(l.text)));
  for (const line of lines) {
    const original = line.text,
      clean = layoutLine(original),
      n = normalize(clean);
    const source = {
      documentId,
      page: line.page,
      line: line.line,
      text: original,
      bounds: line.bounds || null,
      profile: clean === original ? "rotulos" : "tabela-numerada",
    };
    const reference = clean.match(
      /^(?:ID do fechamento|Fechamento (?:ID|n[ºo.]|numero)|Identificador do fechamento)\s*[:=#]?\s*([\w-]+)/i,
    );
    if (reference) {
      identity.closingReference = reference[1];
      continue;
    }
    if (/^(?:relatorio|tipo do relatorio)\s*[:=]/.test(n)) {
      identity.reportType = clean.split(/[:=]/).slice(1).join(":").trim();
      continue;
    }
    if (extracted.consumed.has(line.id) || !clean) continue;
    // Metadata columns may be separated by coordinates/tabs without colons.
    const header = Object.values(infoRules).some((rule) => rule.test(n)) ? clean.split(
      /\s+(?=(?:Caixa|PDV|Data(?: do movimento| de fechamento)?|Turno|Hor[aá]rio|Operadora?|Estabelecimento|Documento)(?:\s*[:=]\s*|\s+)\S)/i,
    ) : [clean];
    let info = false;
    for (const cell of header) {
      const normalized = normalize(cell);
      for (const [key, rule] of Object.entries(infoRules)) {
        // Ignore an unlabelled market banner when a labelled establishment
        // exists; retain conflicting explicit metadata for the audit.
        if (key === "market" && explicitMarket &&
          /^(?:mercado|supermercado)\s+[^:=]*\//.test(normalized)) continue;
        const match = normalized.match(rule);
        if (!match) continue;
        const prefix = normalized.slice(0, normalized.length - match[1].length);
        let value = /[:=|]/.test(prefix)
          ? cell.slice(cell.search(/[:=|]/) + 1).trim()
          : cell
              .split(/\s+/)
              .slice(prefix.trim().split(/\s+/).length)
              .join(" ");
        if (key === "date") {
          const d = value.match(/\b(\d{2})[/-](\d{2})[/-](\d{4})\b/),
            iso = value.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
          if (d) value = `${d[1]}/${d[2]}/${d[3]}`;
          else if (iso) value = `${iso[3]}/${iso[2]}/${iso[1]}`;
          else {
            warnings.push(
              `Data não reconhecida: página ${line.page}, linha ${line.line}.`,
            );
            info = true;
            break;
          }
          const [day, month, year] = value.split("/").map(Number),
            date = new Date(Date.UTC(year, month - 1, day));
          if (
            year < 1900 ||
            year > 2200 ||
            date.getUTCDate() !== day ||
            date.getUTCMonth() !== month - 1
          ) {
            warnings.push("Data inválida no documento.");
            info = true;
            break;
          }
          const time = cell.match(/\b(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?\b/);
          if (time) assign("shift", time[0], source);
        }
        assign(key, value, source);
        info = true;
        break;
      }
    }
    if (info) continue;
    let recognized = false;
    for (const [key, rule] of Object.entries(moneyRules)) {
      if (
        !rule.test(n) ||
        (key === "cash" && /contado/.test(n)) ||
        (key === "cash" &&
          /liquid|disponivel|restante|apos.*(?:sangri|retirad|movimenta)/.test(
            n,
          )) ||
        (key === "cards" && /debito|credito/.test(n))
      )
        continue;
      let amounts = [];
      try {
        amounts = moneyTokens(clean);
      } catch {}
      if (!amounts.length) {
        const tail = clean
          .slice(n.match(rule)[0].length)
          .trim()
          .replace(/^[:=|]\s*/, "");
        if (/^(?:R\$\s*)?-?\d+$/.test(tail))
          amounts = [{ value: parseMoney(tail) }];
      }
      if (amounts.length === 1) {
        assign(key, amounts[0].value, source);
        declarations.push({
          field: key,
          value: amounts[0].value,
          source,
          role: "declared_total",
          effect: classifyEffect(clean),
        });
        recognized = true;
      }
      break;
    }
    if (!recognized && /(?:R\$|\d,\d{2}\b)/.test(clean)) {
      unparsedLines.push({
        id: `${documentId}:${line.id}:unknown`,
        source,
        text: original,
      });
      warnings.push(
        `Linha financeira não interpretada: página ${line.page}, linha ${line.line}.`,
      );
    }
  }
  const totals = movementTotals(extracted.movements);
  for (const key of new Set([
    ...Object.keys(totals),
    ...extracted.declarations.map((d) => d.field),
  ])) {
    const declared = extracted.declarations.filter((d) => d.field === key);
    if (totals[key] != null) {
      const items = extracted.movements.filter(
        (m) => movementTypes[m.type]?.field === key,
      );
      assign(
        key,
        totals[key],
        {
          ...items[0].source,
          profile: "soma-movimentacoes",
          movementIds: items.map((m) => m.id),
        },
        items.map((m) => m.source.text).join(" | "),
      );
    } else for (const d of declared) assign(key, d.value, d.source);
  }
  const effectFor = (key) => {
    const effects = [
      ...extracted.movements.filter(
        (m) => movementTypes[m.type]?.field === key,
      ),
      ...declarations.filter((d) => d.field === key),
    ]
      .filter((d) => (d.amountCents ?? d.value) > 0)
      .map((d) => d.effect);
    return effects.length && effects.every((e) => e && e === effects[0])
      ? effects[0]
      : null;
  };
  const rules = {
    automatic: true,
    confirmed: true,
    cashBasis: fields.netCash.value != null ? "net" : "gross",
    cancellationTreatment: effectFor("cancellations"),
    reversalTreatment: effectFor("reversals"),
    refundTreatment: effectFor("refunds"),
    voucherIncludedInOther: /vale.*incluido.*outros/.test(
      normalize(pages.map((p) => p.text).join("\n")),
    ),
  };
  reconcileLedgerProfile({ lines, fields, declarations, unparsedLines, rules,
    notes: extracted.issues, assign, documentId });
  // Profile-recognized lines no longer need a generic extraction warning.
  const unknownSources = new Set(unparsedLines.map((l) => `${l.source.page}:${l.source.line}`));
  const retainedWarnings = warnings.filter((w) => {
    const match = w.match(/^Linha financeira não interpretada: página (\d+), linha (\d+)\./);
    return !match || unknownSources.has(`${match[1]}:${match[2]}`);
  });
  return {
    fields,
    movements: extracted.movements,
    declarations,
    unparsedLines,
    warnings: retainedWarnings,
    normalizationNotes: extracted.issues,
    rules,
    identity,
  };
}
