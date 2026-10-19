import { requiredMoney, allFields } from "./fields.js";
import { sumCents } from "./movements.js";
export function calculate(fields, rules = {}) {
  const v = (k) => fields[k]?.value ?? null,
    pending = (
      rules.cashBasis === "net" ? ["netCash", "counted"] : requiredMoney
    ).filter((k) => v(k) == null),
    warnings = [];
  for (const [k, f] of Object.entries(fields))
    if (typeof f.value === "number" && !Number.isSafeInteger(f.value))
      throw new Error(`Valor inválido: ${k}`);
  const negative = [
    "sales",
    "cash",
    "opening",
    "withdrawals",
    "supplies",
    "refunds",
    "cancellations",
    "reversals",
    "pix",
    "debit",
    "credit",
    "voucher",
    "other",
    "cards",
    "counted",
  ].filter((k) => v(k) < 0);
  for (const key of negative)
    warnings.push(
      `Valor negativo não permitido em ${allFields[key]}. Confirme a natureza da operação.`,
    );
  const parts = ["cash", "pix", "other"];
  const completeParts = rules.voucherIncludedInOther
    ? parts
    : [...parts, "voucher"];
  let cardTotal = v("cards");
  if (v("debit") != null && v("credit") != null) {
    cardTotal = sumCents([v("debit"), v("credit")]);
    if (v("cards") != null && cardTotal !== v("cards"))
      warnings.push("Cartões consolidados divergem de débito + crédito.");
  }
  const paymentTotal =
    completeParts.every((k) => v(k) != null) && cardTotal != null
      ? sumCents([
          ...parts.map((k) => v(k)),
          cardTotal,
          rules.voucherIncludedInOther ? 0 : (v("voucher") ?? 0),
        ])
      : null;
  const sales = v("sales") ?? paymentTotal;
  const knownCardTotal =
    cardTotal ?? sumCents(["debit", "credit"].map((k) => v(k) ?? 0));
  const knownPaymentsTotal = sumCents([
    ...completeParts.map((k) => v(k) ?? 0),
    knownCardTotal,
  ]);
  if (v("sales") != null && paymentTotal == null && knownPaymentsTotal > sales)
    warnings.push(
      "Pagamentos já identificados excedem o total de vendas, mesmo antes dos pagamentos ausentes.",
    );
  for (const [key, field] of Object.entries(fields))
    if (field.status === "invalid")
      warnings.push(`Corrija o formato inválido em ${allFields[key] || key}.`);
  if (sales == null) {
    pending.push("sales");
    if (!rules.voucherIncludedInOther && v("voucher") == null)
      pending.push("voucher");
  }
  for (const [key, field] of Object.entries(fields))
    if (field.status === "ambiguous")
      warnings.push(
        `Valores conflitantes em ${allFields[key] || key}. Resolva a ambiguidade antes de confirmar.`,
      );
  if (v("sales") != null && paymentTotal != null && sales !== paymentTotal)
    warnings.push(
      "Total de vendas diverge da soma dos pagamentos. Confira os totais e subtotais.",
    );
  if (!rules.confirmed && !rules.automatic)
    warnings.push(
      "Confirme as regras do dinheiro e o tratamento de cancelamentos e estornos.",
    );
  const deductCancellations = rules.automatic
    ? rules.cancellationTreatment === "cash_out"
    : rules.deductCancellations;
  const deductReversals = rules.automatic
    ? rules.reversalTreatment === "cash_out"
    : rules.deductReversals;
  if (rules.automatic && rules.cashBasis !== "net") {
    for (const [field, policy] of [
      ["cancellations", "cancellationTreatment"],
      ["reversals", "reversalTreatment"],
      ["refunds", "refundTreatment"],
    ])
      if (
        v(field) > 0 &&
        !["included", "cash_out", "non_cash"].includes(rules[policy])
      )
        warnings.push(
          `Esclareça ${allFields[field]}: saída física adicional, pagamento eletrônico ou valor já refletido?`,
        );
  }
  if (deductCancellations && v("cancellations") == null)
    pending.push("cancellations");
  if (deductReversals && v("reversals") == null) pending.push("reversals");
  const cashRequirements = [
    "cash",
    "opening",
    "withdrawals",
    "supplies",
    "refunds",
    ...(deductCancellations ? ["cancellations"] : []),
    ...(deductReversals ? ["reversals"] : []),
  ];
  const expected = negative.length
    ? null
    : rules.cashBasis === "net"
      ? v("netCash")
      : cashRequirements.some((k) => v(k) == null)
        ? null
        : sumCents([
            v("opening"),
            v("cash"),
            v("supplies"),
            -v("withdrawals"),
            -(rules.refundTreatment === "included" ||
            rules.refundTreatment === "non_cash"
              ? 0
              : v("refunds")),
            -(deductCancellations ? v("cancellations") : 0),
            -(deductReversals ? v("reversals") : 0),
          ]);
  const difference =
    expected != null && v("counted") != null ? v("counted") - expected : null;
  if (expected != null && expected < 0)
    warnings.push(
      "Dinheiro esperado negativo: saídas excedem as entradas. Confira as movimentações.",
    );
  const result =
    pending.length || warnings.length
      ? "pending"
      : difference < 0
        ? "short"
        : difference > 0
          ? "over"
          : "balanced";
  return {
    sales,
    cardTotal,
    paymentTotal,
    expected,
    difference,
    pending,
    warnings,
    result,
  };
}
