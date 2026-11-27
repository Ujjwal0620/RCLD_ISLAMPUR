import { importPaymentWorksheet } from "./import-payment-sheet";

export async function reconcileStudentFeesOnly(workbook, options = {}) {
  const result = await importPaymentWorksheet(workbook, {
    sourceName: options.sourceName || "RCLD Fee Reconciliation"
  });
  return {
    ...result,
    success: Boolean(result.reconciliationMatches),
    matchedRows: Number(result.acceptedRows || 0),
    savedRows: Number(result.imported || 0) + Number(result.updated || 0) + Number(result.duplicates || 0),
    message: result.reconciliationMatches
      ? "Every matched fee row is represented in the payment ledger; unmatched rows are listed for review."
      : "Fee reconciliation completed with differences. Review the unmatched rows and payment totals."
  };
}
