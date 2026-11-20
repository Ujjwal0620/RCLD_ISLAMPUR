# Multi-semester import foundation

This feature is additive by design. Existing `Student` documents remain operational ERP records because batches, attendance, fee screens, and other routes reference their ObjectIds. The new collections separate long-term identity from registration history without changing those existing references:

- `student_master_profiles`: permanent identity.
- `student_enrollments`: one document per St_Code/course/semester registration.
- `student_fee_payments`: imported receipt transaction with FIFO allocations.

The workbook importer must remain preview-first. It must not delete live data, replace existing Course Master values, or treat MR_No as a globally unique receipt number. The requested unique receipt key is scoped by MR_No + St_Code + payment date + amount.

Course-specific rules are isolated in `lib/student-import/course-fee-rules.js`. Unknown course codes are retained with `configured: false` and must be shown in the audit output. Separate registration/convenience fees, lab charges, late fines, and other institute charges are stored independently from the main course fee.

Identity matching is intentionally conservative. A match is accepted only when one candidate satisfies the DOB/father-token rule or exact father/phone rule. Multiple candidates remain ambiguous and must not be auto-merged.


## Implemented import and profile behavior

- The bulk importer detects the student worksheet by its student-column signature and independently scans every workbook sheet for the receipt columns `St_Code`, `St_Name_cr`, `St_Name`, `Amt_Paid`, `MR_No`, and `D_O_P`.
- Receipt rows are retained in `student_fee_payments`, including rows with missing/invalid dates or missing identity fields. Such rows carry `rawPaymentDate` and `importWarnings`; undated receipts are not FIFO-allocated until reviewed.
- Receipt identity is resolved by registration code plus normalized name, then registration code plus credit name, then a unique registration code, then an unambiguous legacy credit-name match. Unresolved rows are preserved under a separate legacy profile rather than discarded or force-merged.
- A master profile can link multiple legacy Student documents and multiple StudentEnrollment records. The directory returns one canonical row per master profile, and historical Student document IDs are retained to protect existing operational references.
- Enrollment uniqueness is scoped to `studentId + stCode + normalizedFullName`, allowing the same St_Code to exist for distinct master identities. The importer migrates the previous global St_Code/name index.
- Photo uploads are compressed in the browser and persisted to both the operational Student record and the linked StudentMaster profile. I-card renderers use the saved master photo, await image decoding, and use a placeholder only when an image cannot be loaded.
- The student profile API returns all linked receipt records and legacy embedded fee entries. The profile ledger can filter by any enrollment St_Code or show the complete history.

## One-time existing-profile consolidation

Run a read-only preview first:

```bash
npm run merge:student-profiles
```

Review the resulting profile counts and ambiguous identity samples. Ambiguous candidates remain separate by design. If the preview is acceptable, apply the links and enrollment records:

```bash
npm run merge:student-profiles -- --apply
```

The cleanup script does not delete legacy Student documents. It links them to one master identity and preserves their IDs because other ERP modules may reference those documents.
