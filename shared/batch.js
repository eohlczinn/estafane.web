import { reconcile } from "./reconciliation.js";
import { sumCents } from "./movements.js";
export function summarizeBatch(closings, documents = []) {
  const audited = closings.map((c) => ({
    ...c,
    audit: reconcile(c, { reviewed: c.confirmed && c.reviewed }),
  }));
  const included = audited.filter(
    (c) => c.confirmed && c.audit.status === "validated",
  );
  const excluded = audited.filter((c) => !included.includes(c));
  const sum = (read) => (included.length ? sumCents(included.map(read)) : null);
  const fieldTotal = (key) =>
    included.length && included.every((c) => c.fields[key]?.value != null)
      ? sum((c) => c.fields[key].value)
      : null;
  const short = included.filter((c) => c.audit.calculation.difference < 0),
    over = included.filter((c) => c.audit.calculation.difference > 0);
  const failed = documents.filter((d) =>
    ["error", "cancelled"].includes(d.status),
  );
  const allValidated =
    closings.length > 0 &&
    included.length === closings.length &&
    !failed.length;
  return {
    closingCount: closings.length,
    validatedCount: included.length,
    pendingCount: excluded.length,
    failedDocumentCount: failed.length,
    shortCount: short.length,
    overCount: over.length,
    balancedCount: included.length - short.length - over.length,
    totalSalesCents: included.every((c) => c.audit.calculation.sales != null)
      ? sum((c) => c.audit.calculation.sales)
      : null,
    cashCents: fieldTotal("cash"),
    pixCents: fieldTotal("pix"),
    debitCents: fieldTotal("debit"),
    creditCents: fieldTotal("credit"),
    voucherCents: fieldTotal("voucher"),
    withdrawalsCents: fieldTotal("withdrawals"),
    suppliesCents: fieldTotal("supplies"),
    totalShortCents: included.length
      ? sumCents(short.map((c) => -c.audit.calculation.difference))
      : null,
    totalOverCents: included.length
      ? sumCents(over.map((c) => c.audit.calculation.difference))
      : null,
    netDifferenceCents: allValidated
      ? sum((c) => c.audit.calculation.difference)
      : null,
    partial: !allValidated,
    includedClosingIds: included.map((c) => c.id),
    excludedClosingIds: excluded.map((c) => c.id),
    excludedDocumentIds: [
      ...new Set([
        ...excluded.flatMap((c) => c.documentIds),
        ...failed.map((d) => d.id),
        ...documents.filter(d=>d.status==='duplicate').map(d=>d.id),
      ]),
    ],
  };
}
