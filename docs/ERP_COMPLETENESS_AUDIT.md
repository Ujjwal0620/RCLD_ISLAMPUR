# Implementation status and delivery gaps

Last repository inventory reviewed on 13 November 2026 against main commit 4f88a6df0d49e526703f82b0f9b19fcce3437c3b. This pass reviewed the complete recursive tree (220 entries), 26 dashboard page components, 48 API route handlers, 12 reusable model files and the shared shell/style entry points.

This is a code inventory, not a product-completion certificate. A page or API route being present does not prove that its full workflow is secure, tested or ready for production.

## Latest delivery checkpoint

**System organization baseline — merged to main on 13 November 2026 (PR #24, merge commit 305cb96503aea7b69927d727d9fed2d228af58b2).**

- Created source restore point branch `checkpoint/pre-system-audit-2026-11-13` from main commit `4f88a6df0d49e526703f82b0f9b19fcce3437c3b` before the audit changes.
- Added `docs/COMMAND_CATALOG.md` to map each current page to its API routes, models and shared logic.
- Added Prettier configuration and `format` / `format:check` npm scripts. Existing source-wide formatting still requires running `npm run format` in a local checkout; this remote repository session could not execute npm.
- Added `app/styles/design-system.css` as the shared Lexa-inspired UI layer and loaded it after the legacy global stylesheet.
- Removed the duplicated trailing registration border override blocks and corrected the original print border declarations to `#8493BD`; the print-only address elements now carry an explicit dedicated class.
- Full per-route visual regression, lint and production build are still pending local execution. The shared UI baseline is now in main, but this is not proof that every workflow is production-ready.

## Latest delivery checkpoint

**Compact dashboard UI refresh — committed to main.**

- Shared dashboard styling now uses a more compact density for navigation, toolbar, headings, cards, KPI panels, tables, forms and buttons.
- Dashboard chart/panel heights were reduced to show more operational information in the viewport.
- Existing chart points and mini-bars have accessible labels and hover tooltip text.
- Existing dashboard API wiring and data sources were retained; no fabricated chart values were added.
- Light/dark theme support and responsive styling remain in place.

**Verification status:** GitHub main contains the change. No npm run lint, npm run build or browser-based regression test was recorded for this checkpoint. Treat the UI as implemented but requiring local verification. The complete page-by-page UI redesign is still outstanding.

## Structure and maintainability findings

The 13 November source-tree pass identified these maintenance facts:

- The application is a modular monolith with 26 dashboard page components and 48 API route handlers.
- There are 12 reusable model files; employee/login and several fee/student schemas remain inline in route handlers. Consolidate only after collection-name and compatibility checks.
- `app/globals.css` is approximately 294 KB and contains historical style layers and repeated overrides. The shared workspace baseline is now separated into `app/styles/design-system.css`; migrate feature-specific rules incrementally rather than rewriting the whole stylesheet at once.
- The root package manifest previously had no Prettier setup. Prettier 3 configuration, ignore rules and npm format/check commands have now been added. The complete repository-wide formatter has not yet been executed in a local checkout.
- No automated test files or test runner were found in the reviewed source tree. Lint/build and manual workflow checks remain required before release.
- A module ownership index is available in `docs/COMMAND_CATALOG.md` so future changes can start from the owning page, API route, model and helper.

**Registration address border correction:** the original print rules contained hard-coded blue `!important` borders. Those source declarations now use `#8493BD`; the duplicated appended override tail was removed, and the print address panels have a dedicated class with a print-specific exact-color rule. The screen address card border declarations were also aligned to `#8493BD`. A real browser print preview and physical print still need confirmation.

## Present in the repository

The current route tree contains implementation areas for:

- Dashboard and activity summaries.
- Student registration, list/search, profile, attendance, fee records, payment history, contact log, batch history and bulk operations.
- Employee listing, creation, profile, employee attendance, task assignment and employee-related maintenance endpoints.
- Course catalog and course CRUD.
- Subject CRUD and chapter data.
- Batch creation/editing, batch series, schedules, roster, student assignment, student transfer, attendance and batch notes.
- Course content records and batch course-content endpoints.
- Marketing/referral pages and referral endpoints.
- Reports overview and batch reporting.
- Authentication endpoints for login, logout, current session and password change.
- Cloudinary-backed student-photo and batch-note upload endpoints.
- AI/RAG assistant endpoints.

Current reusable Mongoose model files include AIConversation, AIKnowledge, BackOfficeTask, Batch, BatchContentProgress, BatchSlotLock, Course, CourseContent, EmployeeAttendance, StudentBatchHistory, StudentContactLog and Subject. Some other schemas, including employee/login and fee-related schemas, are declared inside route handlers. See docs/DATA_MODEL.md.

## Business rules visible in current code

- Course records contain a course code, name, duration, weekly class frequency, fee, admission fee and required skills.
- Subjects belong to a course and contain ordered chapters.
- Batches refer to a course and contain series, schedules, faculty/staff assignments and status.
- Batch creation checks that selected series match the course's weekly class frequency.
- Draft and active batch hours are checked for timetable conflicts and protected by unique slot-lock keys.
- Faculty selection checks active employee records, course-required skills and schedule conflicts.
- Student batch movement has a dedicated history model with before/after snapshots.
- Employee attendance supports punch-in/out, breaks, personal/official out-times and calculated minute fields.
- Fee entries carry receipt numbers, payment metadata, proof URL, note, recorder and authorizer fields.
- The mobile navigation is controlled by a hamburger button and responsive CSS; desktop navigation remains in the sidebar.

## Important gaps and verification work

The following items are not evidenced as complete by the current route/model inventory and need implementation or a focused audit:

1. Complete server-side RBAC and record-level access checks on every API route.
2. A proper student authentication lifecycle and student-specific session identity.
3. A formal admission/enrollment model connecting registration, selected course, fee plan and batch.
4. Online and offline student separation as explicit, consistently enforced workflows.
5. Super Admin-controlled discount approval and a complete installment/fee policy.
6. Verified PhonePe checkout, callback/webhook signature validation, idempotency and reconciliation. Environment placeholders alone do not constitute integration.
7. Subject-to-batch teaching assignment and student chapter progress rules.
8. Exam/question-bank/admit-card/result/certificate modules and their models/routes.
9. A complete employee role/permission administration interface and tested permission enforcement.
10. Full employee leave and attendance policy, beyond the attendance record fields already present.
11. CRM enquiry lifecycle, follow-up ownership and admission conversion reporting.
12. Notifications, audit-log coverage and operational monitoring.
13. ID card and certificate document generation.
14. A safe, repeatable demo-data seed/cleanup process for students and employees.
15. Automated tests for fee calculations, batch conflicts, access control, data migration and core workflows.
16. Full responsive and print-preview verification, including half-page receipt output.

Treat these as tracked work, not as claims that the features already exist.

## Known security and maintenance concerns

- lib/access-control.js is a permission catalog; its comments state that full enforcement is deferred.
- The login route currently includes fallback Super Admin credentials and legacy password compatibility. Remove these before production.
- lib/auth.js has a development fallback session secret. Production must require an explicit strong secret.
- Some API routes use explicit session checks while others need a complete audit.
- Development routes under app/api/dev must not be exposed in production.
- Some Mongoose schemas are duplicated/declared inline. Consolidate carefully without changing collection names or breaking existing records.

## Next recommended order

1. Security baseline: secrets, password migration, route authorization and development-route protection.
2. Student identity and admission/enrollment data model.
3. Finance integrity: fee plans, discounts, installments, receipt history and verified payment gateway.
4. Batch/student relationship and academic assignment consistency.
5. Exams, results and certificates.
6. Employee access, attendance, leave and tasks.
7. CRM, audit logs, notifications and management reports.
8. Automated regression tests, responsive checks and production release runbook.

Update this file after each meaningful delivery. Use Implemented, In progress, Not started and Needs verification consistently; do not mark a feature complete based only on its UI.
