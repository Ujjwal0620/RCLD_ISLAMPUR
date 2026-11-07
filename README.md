# RCLD Islampur ERP

RCLD Islampur ERP is the internal operations system for a single computer-training institute in Islampur, West Bengal. It brings student records, courses, batches, timetable planning, employee operations, fee collection and management reporting into one application.

This repository is the working application—not a mock-up or a generic college ERP template. When changing a workflow, preserve the institute's operating rules documented in the docs folder.

## Start here

| Need | Read |
|---|---|
| Understand the application and its boundaries | docs/ARCHITECTURE.md |
| Find folders, routes and development conventions | docs/DEVELOPER_GUIDE.md |
| Understand entities and relationships | docs/DATA_MODEL.md |
| Change roles or protect an API | docs/ACCESS_CONTROL.md |
| Check what is implemented and what remains | docs/ERP_COMPLETENESS_AUDIT.md |
| Run, verify, release or recover the app | docs/OPERATIONS_RUNBOOK.md |
| Follow the engineering process | docs/SDLC.md |
| Find the protected baseline | docs/RESTORE_POINTS.md |
| Follow the shared visual language and UI rules | docs/UI_UX_GUIDE.md |

## Technology

- Next.js 16 App Router
- React 19
- JavaScript (ES modules); TypeScript is not part of this project
- MongoDB with Mongoose 8
- Cloudinary for uploaded images and documents
- jose for signed session tokens and bcryptjs for password hashing
- Zod is available for request validation
- Lucide React for interface icons

The application is a modular monolith. Pages, React components and route handlers live in the same deployable Next.js application. MongoDB is the source of truth for operational records.

## Repository and branch policy

- Repository: Ujjwal0620/RCLD_ISLAMPUR
- Integration branch: main
- Do not confuse this repository with the older, similarly named RCLD_ISLAMPUR_ERP repository.
- Keep changes focused and commit them to main unless a task explicitly calls for a feature branch.
- Create a named restore branch before risky structural, data or workflow changes.
- Never commit .env.local, credentials, private database dumps or uploaded private documents.

## Local development

Requirements: a compatible Node.js release, npm and a reachable MongoDB instance.

1. Clone the repository and enter its directory.
2. Run npm install.
3. Copy .env.example to .env.local.
4. Set the required values described in docs/OPERATIONS_RUNBOOK.md.
5. Run npm run dev.
6. Open http://localhost:3000.

Useful commands: npm run dev, npm run lint, npm run build and npm run start.

Local development has a MongoDB fallback at mongodb://127.0.0.1:27017/rcld_islampur. Production must provide MONGODB_URI. NEXT_PUBLIC_APP_URL is not required for the database connection or normal local startup.

## Business rules that must not be casually changed

1. RCLD Islampur is a single physical institute branch.
2. Academic structure: Course → Subject → Chapter.
3. Timetable structure: Course → Batch → Batch Series → Schedule.
4. A student belongs to the main batch. Series are timetable groups; do not create duplicate student populations for each series.
5. A-series and B-series use the institute's configured room/slot pattern. Check data/batchSchedule.js before changing it.
6. Draft and active batches reserve timetable hours. Conflicting hours must be rejected.
7. Faculty assignment must respect course skills, availability and schedule conflicts.
8. Batch movement must preserve the student's movement history.
9. Fee records and receipts are financial history. Do not silently overwrite or discard payment entries.
10. Course discounts are a privileged business decision; keep approval authority restricted to Super Admin.
11. Demo records must be identifiable and removable without touching real institute data.
12. A visible navigation item is not proof that its API is secure. Authorization belongs on the server.

## Product and UI direction

The interface is a compact, professional ERP. The current workspace direction is inspired by https://zoyothemes.com/hando/html/; the earlier Lexa reference remains part of the project's design history. Use these as visual references, not as code to copy. Follow docs/UI_UX_GUIDE.md for shared shell, component, responsive and accessibility conventions. Keep tables, forms, student profiles, receipts and timetable views information-dense but readable on desktop and small screens.

The public root page and student-facing operational pages should be treated as separate experiences from the authenticated staff workspace. Do not add an LMS course player or learning-content engine unless the product scope is explicitly revised.

## Engineering expectations

Before changing a module, read its route handlers, Mongoose schemas and existing UI together. A page is not complete just because its form renders. Follow the full path: validation → authorization → business rules → persistence → response → UI states.

For every meaningful change, preserve existing data and history, handle loading/empty/error/success states, verify server-side authorization, check desktop and mobile layouts, run lint and build when possible, update documentation and record tests that could not be run.

See docs/DEVELOPER_GUIDE.md for the practical workflow.
