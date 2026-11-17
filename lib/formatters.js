export function formatDisplayValue(input) {
  return input === undefined || input === null || input === "" ? "—" : input;
}

export function numberToIndianWords(input) {
  const amount = Math.round(Number(input) || 0);
  if (!amount) return "Zero Rupees Only";
  const one = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const ten = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (value) =>
    value < 20 ? one[value] : ten[Math.floor(value / 10)] + (value % 10 ? " " + one[value % 10] : "");
  const part = (value) =>
    value > 99
      ? one[Math.floor(value / 100)] + " Hundred" + (value % 100 ? " " + two(value % 100) : "")
      : two(value);
  let remaining = amount;
  const words = [];
  for (const [unit, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
    [100, "Hundred"],
  ]) {
    if (remaining >= unit) {
      const count = Math.floor(remaining / unit);
      words.push(part(count) + " " + label);
      remaining %= unit;
    }
  }
  if (remaining) words.push(part(remaining));
  return words.join(" ") + " Rupees Only";
}

export function formatCurrencyINR(input, options = {}) {
  const { maximumFractionDigits = 0 } = options;
  return "₹" + Number(input || 0).toLocaleString("en-IN", { maximumFractionDigits });
}
