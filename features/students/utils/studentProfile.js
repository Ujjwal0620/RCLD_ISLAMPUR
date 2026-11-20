export function isIcardEligible(student = {}) {
  // Official template cards can render incomplete records; missing values remain blank.
  return Boolean(student && typeof student === "object");
}
