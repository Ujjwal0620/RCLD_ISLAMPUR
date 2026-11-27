import { importPaymentWorksheet } from "./import-payment-sheet";

export async function reconcileStudentFees(workbook, options = {}) {
  const result = await importPaymentWorksheet(workbook, {
    sourceName: options.sourceName || "RCLD Student + Fee Workbook"
  });
  return {
    ...result,
    matched: Number(result.acceptedRows || 0),
    saved: Number(result.imported || 0) + Number(result.updated || 0) + Number(result.duplicates || 0),
    unmatched: Number(result.unmatched || 0),
    message: result.reconciliationMatches
      ? "Fee receipts were reconciled by normalized Student Code."
      : "Fee import completed with rows requiring review or a reconciliation difference."
  };
}
