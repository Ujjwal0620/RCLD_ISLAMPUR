# Change command catalog

This file is the quick index for making targeted changes without searching the whole application. It is an ownership map, not a guarantee that every workflow is fully implemented. Always inspect the route handler and model before changing behavior.

## How to request a change

Use a precise instruction such as:

> In **Students → Registration**, change the address section border to `#8493BD`. Preserve the existing registration payload, pending-admission rules, upload behavior and print layout. Update the relevant test and documentation.

For a system-wide task, state the module, user role, expected behavior, existing behavior to preserve, and whether the change affects data or print output.

## Fast development commands

| Goal | Command |
|---|---|
| Install dependencies | `npm install` |
| Start local development | `npm run dev` |
| Run lint | `npm run lint` |
| Format supported source/docs | `npm run format` |
| Check formatting | `npm run format:check` |
| Create production build | `npm run build` |
| Run production server locally | `npm run start` |
| Import students from the configured spreadsheet | `npm run import:students` |

Run commands from the repository root. Keep `.env.local` private. See [Operations Runbook](OPERATIONS_RUNBOOK.md).

## Module ownership map

| Module / page | UI entry point | API ownership | Data / shared logic |
|---|---|---|---|
| Staff dashboard | `app/dashboard/page.js` | `/api/dashboard`, `/api/dashboard/activity` | Dashboard aggregation and activity routes |
| Student directory | `app/dashboard/students/page.js` | `/api/students`, `/api/students/[id]`, bulk student routes | Student schema is currently declared in route handlers; inspect before extracting |
| Student registration | `app/dashboard/students/register/page.js` (screen form and print document markup) | `/api/students`, `/api/courses`, `/api/referrals`, `/api/uploads/student-photo` | Registration payload, pending status and print-only registration document |
| Pending admissions | `app/dashboard/students/pending/page.js` | `/api/students` | Required-detail completeness and admission status |
| Student I-Cards | `app/dashboard/students/icards/page.js` | `/api/students` | Student completeness/eligibility rules |
| Student profile and fees | `app/dashboard/students/[id]/page.js` | `/api/students/[id]`, `/fees`, `/attendance`, `/batch-history`, `/contact-log` | Student, payment history, receipt and movement history |
| Student import | `app/dashboard/students/import/page.js` | `/api/students/bulk-import` | `scripts/import-students.mjs` for CLI import |
| Employee directory | `app/dashboard/employees/page.js` | `/api/employees`, `/api/employees/bulk-delete` | Employee/login schema currently resides in route handlers |
| Employee creation | `app/dashboard/employees/create/page.js` | `/api/employees` | Employee record and account creation rules |
| Employee profile | `app/dashboard/employees/[id]/page.js` | `/api/employees/[id]`, `/api/employee-attendance`, `/api/back-office/tasks` | Employee attendance and assigned tasks |
| Attendance workspace | `app/dashboard/attendance/page.js` | `/api/batches/[id]/attendance`, `/api/students/[id]/attendance`, `/api/employee-attendance` | Attendance records and employee attendance model |
| Courses | `app/dashboard/courses/page.js`, `app/dashboard/courses/[id]/page.js` | `/api/courses`, `/api/courses/[id]` | `models/Course.js`, `data/courseCatalog.js` |
| Subjects and chapters | `app/dashboard/subjects/page.js` | `/api/subjects`, `/api/subjects/[id]` | `models/Subject.js` |
| Batches and timetable | `app/dashboard/batches/page.js`, `app/dashboard/batches/[id]/page.js` | `/api/batches`, `/api/batches/[id]`, `/api/batch-series`, `/api/batches/faculty-options` | `models/Batch.js`, `models/BatchSlotLock.js`, `data/batchSchedule.js` |
| Batch roster | `app/dashboard/batches/[id]/students/page.js` | `/api/batches/[id]/students`, `/api/batches/[id]/roster`, `/api/batches/[id]/transfer-students` | `models/StudentBatchHistory.js` |
| Course content | `app/dashboard/course-content/page.js` | `/api/course-content`, `/api/batches/[id]/course-content`, `/api/batches/[id]/notes` | `models/CourseContent.js`, `models/BatchContentProgress.js`, `data/courseContentSeed.js` |
| Marketing CRM | `app/dashboard/marketing/page.js` | `/api/referrals` | Referral/enquiry schema in route handler |
| Referrals | `app/dashboard/referrals/page.js` | `/api/referrals` | Referral records and marketing employee mapping |
| Dropouts and movement | `app/dashboard/dropouts/page.js` | `/api/students`, `/api/students/[id]/batch-history` | Student status and `models/StudentBatchHistory.js` |
| Reports | `app/dashboard/reports/page.js` | `/api/reports/overview`, `/api/reports/batches` | Report aggregation in route handlers |
| Back-office tasks | `app/dashboard/back-office/page.js` | `/api/back-office/tasks` | `models/BackOfficeTask.js` |
| AI Copilot | `app/dashboard/ai/page.js` | `/api/ai/chat` | `models/AIConversation.js`, `models/AIKnowledge.js`, `lib/ai-rag.js`, `data/aiContext.js` |
| Login | `app/dashboard/login/page.js`, `app/login/page.js` | `/api/auth/login`, `/api/auth/me` | `lib/auth.js` |
| Change password | `app/dashboard/change-password/page.js` | `/api/auth/change-password` | `lib/auth.js` |
| Shared ERP shell | `components/ERPLayout.js` | `/api/auth/me`, `/api/auth/logout` | Shared navigation, theme, user bar and responsive menu |
| Public homepage | `app/page.js` | Public course data where used | Keep public/student-facing experience separate from staff navigation |

## Shared foundations

| Concern | Owner |
|---|---|
| Global legacy styles | `app/globals.css` |
| Shared design tokens and reusable workspace styling | `app/styles/design-system.css` (also owns the final registration print overrides loaded after globals) |
| App metadata and global stylesheet imports | `app/layout.js` |
| Authentication/session | `lib/auth.js`, `app/api/auth/*` |
| Permission catalog | `lib/access-control.js` (catalog only; full enforcement is not complete) |
| MongoDB connection | `lib/mongodb.js` |
| Cloudinary | `lib/cloudinary.js`, `app/api/uploads/*` |
| Shared logo | `components/RCLDLogo.js` |
| Shared assistant | `components/RAGAssistant.js` |

## Safe change procedure

1. Confirm the repository and current `main` commit.
2. Read this module map and the relevant product/data-model documentation.
3. Trace the page → API route → schema/model → shared helper path.
4. Search for every other read/write to the same collection before changing data fields.
5. Preserve existing IDs, field names, financial history, batch history and uploaded-file URLs unless a migration is explicitly planned.
6. Implement server-side validation and authorization; never rely only on hidden UI controls.
7. Add/update tests where the project has a test harness. If no test harness exists, record a reproducible manual test.
8. Run `npm run format`, `npm run lint` and `npm run build`.
9. Update the relevant docs and the implementation audit.
10. Create a restore point before risky work; merge only after reviewing the exact diff.

## Do not do these things casually

- Do not move routes or rename models as a cleanup-only exercise.
- Do not create a second model for a collection already represented by an inline schema.
- Do not alter fee totals or receipt history while changing receipt presentation.
- Do not change batch series membership into separate student populations.
- Do not mark a feature complete because a page or navigation link exists.
- Do not expose `app/api/dev/*` routes in production.
- Do not commit secrets, database exports or private student documents.
