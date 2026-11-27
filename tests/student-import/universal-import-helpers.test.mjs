import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeStudentCode,
  parseImportDate,
  normalizePhoneNumbers,
  normalizeImportAddress,
  detectRepeatingPaymentGroups,
  resolveCurrentStudentCode,
  paymentCompositeKey,
  matchStudentByIdentity
} from "../../lib/student-import/universal-import-helpers.mjs";

test("student code sanitizer rejects control characters instead of concatenating digits", () => {
  assert.equal(sanitizeStudentCode("6\n500"), "");
  assert.equal(sanitizeStudentCode(" 6500.0 "), "6500");
  assert.equal(sanitizeStudentCode("RCLD-101"), "RCLD-101");
});

test("date parser handles Excel serials, ISO dates and DD/MM/YYYY without local timezone shifts", () => {
  assert.equal(parseImportDate("17/11/2026").toISOString().slice(0, 10), "2026-11-17");
  assert.equal(parseImportDate("2026-11-17T23:30:00+05:30").toISOString().slice(0, 10), "2026-11-17");
  assert.equal(parseImportDate(46000).toISOString().slice(0, 10), "2025-12-09");
  assert.equal(parseImportDate("31/02/2026"), null);
});

test("phones and multiline addresses are normalized without dropping secondary values", () => {
  assert.deepEqual(normalizePhoneNumbers("9332161009, 9831445608"), {
    primaryPhone: "9332161009", alternatePhones: ["9831445608"]
  });
  assert.equal(normalizeImportAddress("VILL- DANGIPARA\nP.O - JHARBARI\nP.S - GOALPOKHER\nPIN - 733210"), "VILL- DANGIPARA, P.O - JHARBARI, P.S - GOALPOKHER, PIN - 733210");
});

test("wide payment slots are discovered by numbered header pattern", () => {
  const slots = detectRepeatingPaymentGroups([
    "Primary St_Code", "Payment 1 - Source Code", "Payment 1 - Amount",
    "Payment 1 - MR No", "Payment 1 - Date", "Payment 33 - Source Code",
    "Payment 33 - Amount", "Payment 33 - MR No", "Payment 33 - Date"
  ]);
  assert.deepEqual(slots.map(slot => slot.slot), [1, 33]);
  assert.equal(slots[1].date, 8);
});

test("latest dated code wins and existing DB timeline is retained", () => {
  const resolved = resolveCurrentStudentCode({
    existingCurrentCode: "19167",
    existingCodes: ["18768", "19167"],
    incomingPrimaryCode: "20796",
    allRegistrationCodes: ["18768", "19167", "19808", "20796", "21681"],
    paymentRecords: [{ sourceCode: "20796", paymentDate: "2026-04-01" }],
    existingTimeline: [{ code: "19167", date: "2026-05-01" }]
  });
  assert.equal(resolved.currentCode, "19167");
  assert.equal(resolved.source, "existing-database");
  assert.ok(resolved.previousCodes.includes("20796"));
});

test("payment identity includes normalized receipt, date, amount and source code", () => {
  assert.equal(
    paymentCompositeKey({ sourceCode: "18696.0", mrNo: " 12 88 ", paymentDate: "2025-05-10", amountPaid: 600 }),
    "1288|2025-05-10|600.00|18696"
  );
  assert.equal(
    paymentCompositeKey({ sourceCode: "18696", mrNo: "", paymentDate: "2025-05-10", amountPaid: 600 }),
    "2025-05-10|600.00|18696"
  );
  assert.equal(
    paymentCompositeKey({ sourceCode: "18696", mrNo: "MR-12/88", paymentDate: "2025-05-10", amountPaid: 600 }),
    "MR1288|2025-05-10|600.00|18696"
  );
});

test("code collision with a different student name is flagged", () => {
  const result = matchStudentByIdentity(
    { name: "NILIMA MANDAL", codes: ["19150"] },
    [{ _id: "a1", fullName: "ANOTHER STUDENT", currentStCode: "19150" }]
  );
  assert.equal(result.status, "CONFLICT");
});

test("a code shared by an exact-name and different-name profile still requires review", () => {
  const result = matchStudentByIdentity(
    { name: "NILIMA MANDAL", codes: ["19150"] },
    [
      { _id: "a1", fullName: "NILIMA MANDAL", currentStCode: "19150" },
      { _id: "b2", fullName: "ANOTHER STUDENT", currentStCode: "19150" }
    ]
  );
  assert.equal(result.status, "CONFLICT");
  assert.equal(result.conflicts.length, 2);
});
