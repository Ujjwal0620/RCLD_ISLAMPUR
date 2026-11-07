# System architecture

## What this application is

RCLD Islampur ERP is a single-institute operations application for a computer-training institute. It is built as a modular monolith: one Next.js application, one MongoDB database and clearly separated business areas.

A modular monolith is deliberate. Student admission, fee collection, batch allocation, attendance and reporting share records and business rules. Splitting them into independently deployed services would add operational complexity without solving a current problem.

## Runtime and technology

| Area | Current implementation |
|---|---|
| Web framework | Next.js 16 App Router |
| UI | React 19, JavaScript |
| Server endpoints | Next.js Route Handlers under app/api |
| Database | MongoDB |
| ODM | Mongoose 8 |
| Session token | jose, signed JWT in an HTTP-only cookie |
| Password hashing | bcryptjs is used by the employee login flow |
| File storage | Cloudinary |
| Validation library | Zod is installed; use it consistently for new request contracts |
| Icons | Lucide React |

Exact dependency versions are defined in package.json. Update this table when the stack changes.

## Request flow

Browser page or React component → fetch request → app/api route handler → authentication → authorization → input validation → business rules → Mongoose query/write → JSON response → UI state.

The route handler is the server boundary. A client-side check, disabled button or hidden sidebar link is not an authorization control.

## Code map

- app/: public pages, dashboard pages and API route handlers.
- components/: shared interface components. ERPLayout.js owns the staff workspace shell and responsive sidebar.
- models/: reusable Mongoose model definitions.
- lib/: database connection, authentication, access-control catalog and Cloudinary configuration.
- data/: institute-owned reference data such as timetable slot definitions.
- scripts/: command-line maintenance/import scripts.
- docs/: engineering and operational documentation.

Some schemas are currently declared inside route handlers rather than in models/. This is existing implementation, not a pattern to spread further. When extracting one, preserve the MongoDB collection name and schema behavior; avoid creating a second model for the same collection.

## Current application areas

The current route tree includes dashboard and activity summary; student registration, listing, profile, attendance, fees, contact history and batch history; employee listing, creation, profile, attendance and back-office tasks; course and subject management; batch creation, detail, roster, student assignment, transfer, attendance, notes and course content; marketing and referrals; reports; login, logout, current-session and password-change endpoints; image/document upload endpoints; and AI/RAG assistant endpoints.

A route existing in the repository does not automatically mean the entire related business workflow is complete. See docs/ERP_COMPLETENESS_AUDIT.md.

## Data ownership and consistency

MongoDB is the system of record. React state is temporary presentation state; it must not become a second source of truth for fees, attendance, batch membership or employee records.

Use stable MongoDB document IDs for relationships. Keep denormalized display snapshots only where they serve a clear historical purpose—for example, a batch movement record may retain batch name and faculty details as they were at the time of movement.

Use database indexes for uniqueness and frequently queried relationships. Review indexes when query patterns change.

## Important domain relationships

- Course has Subjects; each Subject contains Chapters.
- Course has Batches; each Batch contains timetable series and schedules.
- A schedule records day, time, series, room and faculty assignment.
- Student profile/fee/attendance records are linked by student identity.
- Student batch movement history records before/after snapshots.
- Employee attendance records punches, breaks and personal/official out-times.
- Back-office tasks record assignments, work area, date, time and status.

This is a conceptual map, not a claim that every relationship is already represented by a dedicated model. See docs/DATA_MODEL.md for the current schema inventory and known gaps.

## Authentication and authorization boundary

Session helpers are in lib/auth.js. The app signs a 12-hour JWT and stores it in the rcld_session HTTP-only cookie. Employee role inference currently uses designation and department values in roleOfEmployee().

The centralized permission names live in lib/access-control.js. The permission catalog is not yet a complete, consistently enforced RBAC system. Some routes perform explicit session/role checks, while other route handlers still need a systematic security review. Do not describe the application as fully role-secured until every protected read and write has been audited.

The login route currently contains development-oriented fallback credential/secret behavior. Production deployment must replace this with mandatory, securely managed secrets and remove known default credentials. See docs/ACCESS_CONTROL.md and docs/OPERATIONS_RUNBOOK.md.

## File handling

Cloudinary is configured through lib/cloudinary.js. Configuration is read at request time and supports either the three standard credential variables or CLOUDINARY_URL. Upload routes should validate session, file type, size and purpose before sending files to Cloudinary. Store Cloudinary URLs and relevant metadata in MongoDB; do not store file bytes in application source or ordinary business documents.

## Design constraints

- Keep JavaScript; do not introduce TypeScript.
- Keep the app as a modular monolith unless a measured operational need justifies a different architecture.
- Keep institute rules in server-side business logic, not only in form components.
- Avoid duplicate student records for timetable series.
- Preserve financial and academic history.
- Prefer archive/status transitions over destructive deletion when records are referenced by history.
- Avoid new dependencies for small utilities when the current stack already covers the need.
