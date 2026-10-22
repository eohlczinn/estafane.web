export const infoFields = {
  market: "Estabelecimento",
  operator: "Operadora",
  register: "Caixa",
  date: "Data",
  shift: "Horário / turno",
};
export const moneyFields = {
  sales: "Total de vendas",
  cash: "Dinheiro (vendas)",
  pix: "PIX",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
  voucher: "Vale-alimentação / refeição",
  cards: "Cartões consolidados",
  other: "Outros pagamentos",
  opening: "Fundo inicial",
  withdrawals: "Sangrias",
  supplies: "Suprimentos",
  expenses: "Despesas autorizadas em dinheiro",
  refunds: "Devoluções em dinheiro",
  cancellations: "Cancelamentos",
  reversals: "Estornos",
  counted: "Dinheiro contado",
  netCash: "Saldo líquido em dinheiro",
};
export const requiredMoney = [
  "cash",
  "opening",
  "withdrawals",
  "supplies",
  "refunds",
  "counted",
];
export const allFields = { ...infoFields, ...moneyFields };
export const emptyFields = () =>
  Object.fromEntries(
    Object.keys(allFields).map((k) => [
      k,
      {
        value: null,
        original: null,
        source: null,
        status: "missing",
        review: true,
      },
    ]),
  );
