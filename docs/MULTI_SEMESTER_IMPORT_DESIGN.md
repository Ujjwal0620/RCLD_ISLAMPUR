# Multi-semester import foundation

This feature is additive by design. Existing `Student` documents remain operational ERP records because batches, attendance, fee screens, and other routes reference their ObjectIds. The new collections separate long-term identity from registration history without changing those existing references:

- `student_master_profiles`: permanent identity.
- `student_enrollments`: one document per St_Code/course/semester registration.
- `student_fee_payments`: imported receipt transaction with FIFO allocations.

The workbook importer must remain preview-first. It must not delete live data, replace existing Course Master values, or treat MR_No as a globally unique receipt number. The requested unique receipt key is scoped by MR_No + St_Code + payment date + amount.

Course-specific rules are isolated in `lib/student-import/course-fee-rules.js`. Unknown course codes are retained with `configured: false` and must be shown in the audit output. Separate registration/convenience fees, lab charges, late fines, and other institute charges are stored independently from the main course fee.

Identity matching is intentionally conservative. A match is accepted only when one candidate satisfies the DOB/father-token rule or exact father/phone rule. Multiple candidates remain ambiguous and must not be auto-merged.
