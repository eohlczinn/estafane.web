export const cashKnowledge = [
  {
    term: "Dinheiro esperado",
    text: "Fundo inicial + vendas em dinheiro + suprimentos − sangrias − saídas aplicáveis. A regra depende do documento: cancelamentos já descontados não são deduzidos novamente.",
  },
  {
    term: "Falta e sobra",
    text: "Dinheiro contado menos dinheiro esperado. Resultado negativo é falta; positivo é sobra. PIX e cartões não entram na gaveta de dinheiro.",
  },
  {
    term: "Sangria",
    text: "Retirada de dinheiro físico do caixa. Itens individuais são somados e comparados com o subtotal declarado, sem somar o mesmo movimento duas vezes.",
  },
  {
    term: "Suprimento",
    text: "Dinheiro colocado no caixa durante o turno. Não é uma venda e aumenta o saldo físico esperado.",
  },
  {
    term: "OCR",
    text: "Leitura de uma imagem ou PDF digitalizado. Qualidade baixa pode trocar números e rótulos. A revisão da imagem permanece necessária antes da emissão.",
  },
  {
    term: "Aprendizado do layout",
    text: "Depois de classificar uma linha e confirmar o caixa, salve o perfil de importação. O mesmo layout pode receber sua sugestão de categoria na próxima vez. Valores financeiros não viram regras.",
  },
  {
    term: "Documento fora do contexto",
    text: "Currículos, manuais, faturas e notas de compra podem conter datas e valores sem ser relatórios de caixa. A triagem busca evidências de vendas, pagamentos e movimentação antes de criar um fechamento.",
  },
  {
    term: "Histórico",
    text: "Uma cópia local do fechamento, com valores, texto extraído e observações. Os arquivos originais não são arquivados. Ao reabrir, o cálculo é refeito e o caixa precisa de nova confirmação.",
  },
];
export const searchText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
