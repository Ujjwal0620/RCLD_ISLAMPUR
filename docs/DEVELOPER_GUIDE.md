# Developer guide

This is the quickest route from opening the repository to making a safe change. It describes the code that is in the repository today and calls out places where the implementation is still being consolidated.

## First five minutes

1. Check that the repository is Ujjwal0620/RCLD_ISLAMPUR.
2. Check out main and pull the latest changes.
3. Read README.md and docs/ERP_COMPLETENESS_AUDIT.md.
4. Find the page and API route for the workflow you are changing.
5. Find every model or inline schema used by those routes.
6. Check docs/DATA_MODEL.md before changing a relationship.
7. Create a restore point before a broad refactor or data migration.

## Project layout

| Path | Responsibility |
|---|---|
| app/page.js | Public root page |
| app/dashboard/ | Staff ERP pages |
| app/api/ | Server-side route handlers |
| components/ERPLayout.js | Shared dashboard shell, navigation and mobile menu |
| components/RAGAssistant.js | AI/RAG assistant UI |
| models/ | Reusable Mongoose schemas |
| lib/mongodb.js | MongoDB connection and connection cache |
| lib/auth.js | Session creation, verification, cookie and role inference |
| lib/access-control.js | Permission names, role defaults and skill catalog |
| lib/cloudinary.js | Cloudinary credential loading and client configuration |
| data/ | Institute timetable/reference data |
| scripts/ | Import and maintenance scripts |
| docs/ | Product, engineering and operational notes |

## Current page inventory

- app/dashboard/page.js — dashboard.
- app/dashboard/students/page.js — student listing.
- app/dashboard/students/register/page.js — RCLD student registration.
- app/dashboard/students/[id]/page.js — student profile and fee workspace.
- app/dashboard/students/import/page.js — student import.
- app/dashboard/employees/page.js — employee listing.
- app/dashboard/employees/create/page.js — employee creation.
- app/dashboard/employees/[id]/page.js — employee profile.
- app/dashboard/courses/page.js and courses/[id]/page.js — course catalog and detail/edit workflow.
- app/dashboard/subjects/page.js — subject and chapter management.
- app/dashboard/batches/page.js and batches/[id]/page.js — batch and timetable management.
- app/dashboard/batches/[id]/students/page.js — batch roster.
- app/dashboard/attendance/page.js — attendance workspace.
- app/dashboard/back-office/page.js — task assignment.
- app/dashboard/course-content/page.js — course content management.
- app/dashboard/reports/page.js — reports.
- app/dashboard/marketing/page.js and referrals/page.js — marketing and referral operations.
- app/dashboard/dropouts/page.js — dropout and movement workspace.
- app/dashboard/ai/page.js — AI assistant.
- app/dashboard/login/page.js and app/login/page.js — login entry points.

## API route map

The following route handlers are present in the current main tree. Check the handler before relying on its behavior.

| Area | Route |
|---|---|
| Authentication | /api/auth/login, /api/auth/logout, /api/auth/me, /api/auth/change-password |
| Dashboard | /api/dashboard, /api/dashboard/activity |
| Students | /api/students, /api/students/[id], /api/students/[id]/fees, /api/students/[id]/attendance |
| Student history | /api/students/[id]/batch-history, /api/students/[id]/contact-log |
| Student bulk actions | /api/students/bulk-actions, /api/students/bulk-assign-batch, /api/students/bulk-status, /api/students/bulk-import, /api/students/bulk-delete |
| Employees | /api/employees, /api/employees/[id], /api/employees/bulk-delete |
| Employee operations | /api/employee-attendance, /api/back-office/tasks |
| Courses and subjects | /api/courses, /api/courses/[id], /api/subjects, /api/subjects/[id] |
| Batches | /api/batches, /api/batches/[id], /api/batch-series |
| Batch operations | /api/batches/[id]/students, /api/batches/[id]/roster, /api/batches/[id]/transfer-students, /api/batches/[id]/attendance |
| Batch content | /api/course-content, /api/batches/[id]/course-content, /api/batches/[id]/notes |
| Reports and CRM | /api/reports/overview, /api/reports/batches, /api/referrals |
| Uploads | /api/uploads/student-photo, /api/uploads/batch-note |
| AI | /api/ai/chat |
| Health | /api/health |
| Development utilities | /api/dev/migrate-employee-logins, /api/dev/reset-employee-passwords, /api/dev/seed-course-content, /api/dev/seed-employees, /api/dev/sync-student-fees |

Development utility endpoints are sensitive. Do not expose them in production. The route inventory is not a promise that every endpoint has complete authorization or test coverage.

## How to trace a feature

For a page such as the student profile:

1. Read the page component and identify its API requests.
2. Read each corresponding route handler.
3. Find the Mongoose model or schema declaration used by the handler.
4. Search the repository for other reads/writes to the same collection.
5. Identify who can call each method and what record-level checks exist.
6. Follow the data from request payload through validation and persistence.
7. Update the relevant docs and test the whole workflow.

Do not change only the UI when the business rule belongs on the server.

## Existing implementation patterns

- Pages use the Next.js App Router and JavaScript.
- Route handlers return JSON with NextResponse.
- Mongoose models are imported from models/ where reusable definitions exist.
- Some legacy schemas are declared inline in route files. Consolidate them only as a deliberate migration.
- The MongoDB connection is cached in lib/mongodb.js to avoid opening a new connection for each request.
- Session helpers are in lib/auth.js.
- Cloudinary is configured on demand in lib/cloudinary.js.
- Shared staff navigation is in components/ERPLayout.js.
- Global and responsive styling is in app/globals.css.

## Timetable rules

The current timetable generator is data-driven. Read data/batchSchedule.js before changing the series/slot mapping. Batch creation validates weekly frequency, checks occupied timetable hours, checks active faculty, checks required skills and checks faculty time conflicts. BatchSlotLock provides a unique key for reserved timetable hours.

Do not replace these rules with client-side warnings only. The server must reject a conflicting schedule.

## Student and batch history

A student's batch movement is not a simple field update. The StudentBatchHistory model stores the action, source and destination snapshots, remark, actor and timestamp. Preserve that history when changing transfer behavior. Do not create separate student identities for A-series and B-series timetable groups.

## Fees and receipts

The student fee API stores payment entries with receipt number, date, amount, method, reference, UTR, proof URL, note, payment type, installment month, recorder and authorizer. Preserve existing entries. Calculate totals from stored payment history on the server. A printed receipt for a selected transaction is not the same thing as the complete lifetime payment ledger.

The half-page receipt layout is implemented in the student profile page. Any print CSS change must be checked in a real browser print preview at the target paper size. A code review alone cannot prove that it fits.

## Coding conventions

- JavaScript only. Do not add TypeScript.
- Prefer named functions for business rules that need tests or reuse.
- Keep route handlers readable; extract shared logic when it is genuinely shared.
- Validate untrusted input on the server.
- Use explicit error responses and avoid returning stack traces or secrets.
- Keep financial calculations deterministic and server-owned.
- Use stable IDs rather than display names for relationships.
- Do not silently rename MongoDB fields or collections.
- Keep accessibility labels on interactive controls.
- Preserve responsive behavior at small viewport widths.

## Before opening a pull request or committing

- Run npm run lint.
- Run npm run build.
- Test the changed workflow locally with representative data.
- Test a denied request for every protected operation.
- Check mobile layout if the page is user-facing.
- Check print preview if print CSS changed.
- Update docs/ERP_COMPLETENESS_AUDIT.md if feature status changed.
- Record anything not tested instead of implying it passed.
