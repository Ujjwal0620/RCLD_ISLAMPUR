export function addMonthsUTC(date, months) {
  if (!date) return null;
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function buildInstallments({ courseCode, admissionDate, feeConfig, semesterLabel }) {
  const code = String(courseCode || "").toUpperCase();
  const start = admissionDate || new Date();
  const rows = [];
  const add = (index, label, feeType, dueDate, amountDue) => rows.push({
    index, label, feeType, dueDate, amountDue: Math.max(0, Number(amountDue || 0)),
    amountPaid: 0, status: Number(amountDue || 0) === 0 ? "WAIVED" : "PENDING", receiptRefs: []
  });

  if (code === "ROBOTICS") {
    add(0, "Year Admission Fee", "ADMISSION", start, 1000);
    for (let month = 1; month <= 12; month++) add(month, `Month ${month}`, "MONTHLY", addMonthsUTC(start, month), 1000);
  } else if (/^SM-(I|II|III|IV|V|VI)$/.test(code)) {
    const admission = /^(SM-I|SM-II)$/.test(code) ? 500 : /^(SM-III|SM-IV)$/.test(code) ? 600 : 700;
    add(0, "Semester Admission Fee", "ADMISSION", start, admission);
    for (let month = 1; month <= 6; month++) add(month, `Month ${month}`, "MONTHLY", addMonthsUTC(start, month), 500);
  } else if (code === "SC-I") {
    add(0, "Semester Admission Fee", "ADMISSION", start, feeConfig.admissionFee || 500);
    for (let month = 1; month <= Number(feeConfig.durationMonths || 6); month++) add(month, `Month ${month}`, "MONTHLY", addMonthsUTC(start, month), feeConfig.monthlyInstallment || 500);
  } else if (/^DOM[-_]?(III|V|VI|VII|VIII|IX)$/.test(code)) {
    for (let month = 1; month <= 15; month++) add(month, `Month ${month}`, "MONTHLY", addMonthsUTC(start, month), 600);
  } else {
    const duration = Math.max(0, Number(feeConfig.durationMonths || 0));
    if (!feeConfig.admissionIncluded && Number(feeConfig.admissionFee || 0) > 0) add(0, "Admission Fee", "ADMISSION", start, feeConfig.admissionFee);
    const monthly = Number(feeConfig.monthlyInstallment || (duration ? Math.ceil(Number(feeConfig.grossFee || 0) / duration) : 0));
    for (let month = 1; month <= duration; month++) add(rows.length, `Month ${month}`, "MONTHLY", addMonthsUTC(start, month), monthly);
  }

  const gross = Number(feeConfig.grossFee || rows.reduce((sum, row) => sum + row.amountDue, 0));
  const discount = Math.min(gross, Math.max(0, Number(feeConfig.discountAmount || 0)));
  let remainingDiscount = discount;
  for (let index = rows.length - 1; index >= 0 && remainingDiscount > 0; index--) {
    const reduction = Math.min(rows[index].amountDue, remainingDiscount);
    rows[index].amountDue -= reduction;
    remainingDiscount -= reduction;
    if (rows[index].amountDue === 0) rows[index].status = "WAIVED";
  }
  return rows;
}

export function allocatePaymentsFIFO(installments, payments) {
  const rows = installments.map(item => ({ ...item, receiptRefs: [...(item.receiptRefs || [])] }));
  const sorted = [...payments].sort((a, b) => new Date(a.paymentDate) - new Date(b.paymentDate) || String(a.mrNo).localeCompare(String(b.mrNo)));
  const results = [];
  for (const payment of sorted) {
    let remaining = Number(payment.amountPaid || 0);
    const allocations = [];
    for (const installment of rows) {
      if (remaining <= 0) break;
      const outstanding = Math.max(0, Number(installment.amountDue || 0) - Number(installment.amountPaid || 0));
      if (!outstanding) continue;
      const allocatedAmount = Math.min(outstanding, remaining);
      installment.amountPaid += allocatedAmount;
      installment.receiptRefs.push({ mrNo: payment.mrNo, amount: allocatedAmount, paymentDate: payment.paymentDate });
      remaining -= allocatedAmount;
      allocations.push({ installmentIndex: installment.index, label: installment.label, allocatedAmount });
    }
    for (const installment of rows) {
      installment.status = installment.amountDue === 0 ? "WAIVED"
        : installment.amountPaid >= installment.amountDue ? "PAID"
        : installment.amountPaid > 0 ? "PARTIAL" : "PENDING";
    }
    results.push({ ...payment, allocations, unallocatedAmount: remaining });
  }
  return { installments: rows, payments: results };
}
