export const formatCurrency = (value) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
}).format(value);

export const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);
