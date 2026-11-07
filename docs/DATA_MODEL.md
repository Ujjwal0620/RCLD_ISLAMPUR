# Data model and domain rules

This document is a guide to the current MongoDB/Mongoose implementation and the business relationships the ERP must preserve. It is not a replacement for reading the actual schema before making a migration.

## General rules

- MongoDB is the system of record.
- Use MongoDB ObjectIds for document relationships where the schema defines references.
- Keep human-readable codes for staff workflows, but do not use names as database identity.
- Add indexes for uniqueness and real query patterns.
- Avoid hard deletion when another record or historical snapshot depends on the data.
- Keep a migration plan for schema changes; MongoDB's flexible document shape does not remove the need for data compatibility.
- Do not create duplicate student records for timetable series.

## Academic structure

The institute's agreed academic hierarchy is:

**Course → Subject → Chapter**

A Course defines the course code, name, category, duration, weekly class frequency, course fee, admission fee, description and required skills. A Subject belongs to a Course and contains ordered Chapters.

The current reusable schemas are models/Course.js and models/Subject.js.

## Timetable structure

The agreed operating hierarchy is:

**Course → Main Batch → Batch Series → Schedule**

A batch is the main student group. Series represent timetable groups/slots within that batch. A-series and B-series must not become separate student populations. Students are mapped to the main batch; the timetable determines when and where each series meets.

The current Batch schema stores:
- batchCode and name;
- courseId plus course code/name snapshots;
- series and weekly class frequency;
- capacity and start/end dates;
- faculty IDs/names and staff assignments;
- schedule entries with day, time, series, slot, faculty and room;
- lifecycle status and notes.

Batch statuses currently defined in models/Batch.js are Draft, Active, Completed, Suspended and Cancelled.

BatchSlotLock reserves a timetable key and prevents two Draft/Active batches from occupying the same configured day/time/series slot. Batch creation also validates selected series against course frequency and checks faculty availability, course skills and schedule conflicts. Read app/api/batches/route.js and data/batchSchedule.js before changing this behavior.

## Student records

The student domain has profile, registration, fee, attendance, contact-history and batch-history workflows. The current tree does not contain a standalone models/Student.js file; some student-related schemas are declared inside route handlers. Before changing a student field, search all route handlers and UI pages for that field and identify the collection actually used.

The agreed product rules include:
- Use the RCLD registration form as the institute registration entry point.
- Keep online and offline student operations distinguishable.
- Preserve student status and admission history.
- Students belong to the main batch, not individual timetable series.
- Batch transfers retain history and must not erase prior attendance or batch context.
- A student's login, once fully implemented, must be scoped to that student's own records.

The desired student lifecycle includes Registered, Admission Pending, Active, Course Completed, Dropped Out, Cancelled, Suspended and Alumni. Confirm the exact current enum/validation in the route before relying on it.

## Fees and payments

Fee-related schemas are currently declared inside app/api/students/[id]/fees/route.js rather than in a shared model file.

The payment entry includes amount, date, method, reference, UTR number, screenshot URL, receipt number, authorizer, recorder, note, payment type and installment month. The fee record stores the student identity and fee amounts such as total fee, discount, admission fee and registration fee.

Important rules:
- Payment entries are an append-only financial history in normal use.
- Receipt numbers must remain unique.
- The server calculates paid and outstanding amounts from persisted records.
- Never accept a browser-calculated balance as authoritative.
- Preserve proof URLs and transaction references.
- Keep the selected-transaction receipt distinct from the complete payment ledger.
- Discount authority belongs to Super Admin under the agreed business policy.
- PhonePe credentials in .env.example are placeholders; they do not prove that verified gateway processing is implemented.

Before changing fee logic, inspect the complete fee route and the student profile page together. Test partial payment, multiple payment entries, discount, admission fee, late fine, invalid amounts and receipt reprints.

## Employees and attendance

Employee schemas are not yet fully centralized in models/. Several route handlers define local Employee schema shapes. Search before changing employee fields; two inline schemas may intentionally select different fields for different operations.

EmployeeAttendance is a reusable model with:
- employeeId and date;
- punchIn and punchOut;
- breaks with start/end/reason/minutes;
- outTimes with start/end/minutes/reason and Personal or Official type;
- status, remarks and calculated total/work/overtime/late/early-leave minutes;
- createdBy and updatedBy.

A unique index exists for employeeId + date.

## Tasks

BackOfficeTask stores task title/type, optional batch/schedule context, one or more assignments, work area, date, start/end time, status and creator details. Current statuses are Open, In Progress, Completed and On Hold. Task type includes Regular and BatchSubstitution.

## Batch movement history

StudentBatchHistory stores studentId, action, fromBatch snapshot, toBatch snapshot, remark, actor, actor role, occurredAt and an attendance snapshot. Current action values include SHIFTED, DROPPED_OUT and REJOINED.

The snapshots are intentional: they preserve the context of a transfer even if the original batch later changes.

## Other reusable model files

The following model files are present in the current repository:

| Model | Purpose indicated by schema/file |
|---|---|
| AIConversation | AI assistant conversation history |
| AIKnowledge | AI/RAG knowledge records |
| BackOfficeTask | Employee operational tasks |
| Batch | Course batch and timetable |
| BatchContentProgress | Batch course-content progress |
| BatchSlotLock | Timetable slot reservation |
| Course | Course master |
| CourseContent | Course learning/reference content records |
| EmployeeAttendance | Employee time and attendance |
| StudentBatchHistory | Student batch movement history |
| StudentContactLog | Student contact history |
| Subject | Course subjects and chapters |

The inventory may change. Check the models directory and route-local schemas before adding or editing a collection.

## Relationships that still need a formal model

The product requirements call for first-class models/relationships for admission, enrollment, installment plans, discount approvals, online/offline student mode, subject-to-batch faculty assignments, examinations, question banks, results, certificates, audit events and role/permission assignments. These should be designed before implementation rather than represented as unrelated fields scattered across pages.

## Schema change checklist

1. Identify the current collection and every route that reads/writes it.
2. Decide whether the change is additive, a backfill or a migration.
3. Preserve existing field names unless a migration is explicitly planned.
4. Add validation and indexes where needed.
5. Make scripts safe to re-run.
6. Back up the database before bulk writes.
7. Verify document counts and representative records after migration.
8. Update this document and the implementation audit.
