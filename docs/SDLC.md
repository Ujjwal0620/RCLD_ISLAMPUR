# RCLD Islampur ERP — SDLC and Engineering Model

## 1. Purpose
Build a secure, maintainable, scalable and production-ready ERP for RCLD Islampur.

This system is ERP-only. It does not include an LMS, course-video learning platform, online learning-content delivery system or public LMS experience.

The ERP may expose limited student-facing operational pages when required for ERP processes, such as registration, fees, attendance, results and certificates.

## 2. Recommended development model
There is no single universally best SDLC for every ERP. For this project, the strongest practical model is a hybrid Agile + incremental + risk-driven SDLC.

Agile provides short feedback cycles. Incremental delivery produces complete business capabilities in usable slices. Risk-driven planning addresses authentication, finance, data integrity and permissions early. Domain-first design prevents disconnected modules. Quality gates prevent unfinished features from being treated as complete.

Delivery loop: Discover → Specify → Model → Design → Build → Verify → Demonstrate → Accept → Release → Learn

Each iteration must produce a working, testable increment.

## 3. Architecture model
The recommended architecture is a modular monolith.

RCLD Islampur is a focused single-institute ERP. Starting with microservices would add deployment, networking, observability and consistency complexity without a clear initial business benefit.

The application remains one Next.js deployable application while maintaining strong internal module boundaries.

Logical flow:
UI Layer → Application/API Layer → Domain/Business Rules → Data Access Layer → MongoDB

Cross-cutting services: Authentication, Authorization, Validation, Audit Logging, File/Media Management, Notifications, Error Handling and Observability.

Services may be extracted later only when scale or operational requirements justify it.

## 4. SDLC stages
### Stage 0 — Project establishment
Confirm repository, technology decisions, JavaScript-only policy, application structure, environment contract, MongoDB, Cloudinary, logging/error strategy and Git conventions.
Gate: application foundation builds successfully.

### Stage 1 — Requirements engineering
For every module define actors, roles, permissions, business objectives, inputs, outputs, business rules, validation, status transitions, relationships, reports, audit requirements, edge cases and acceptance criteria.
Gate: module specification approved before implementation.

### Stage 2 — Domain and data modeling
Identify entities, ownership, relationships, lifecycle/status, references versus embedded data, unique constraints, indexes, audit requirements and financial/data integrity rules.
Gate: domain model and MongoDB model reviewed before UI implementation.

### Stage 3 — Application/API design
Define endpoints/server actions, request/response contracts, validation schemas, authentication, authorization, error contracts, pagination/filter/sort behavior and consistency strategy.
Gate: API/business contract is clear enough for UI and testing.

### Stage 4 — UI/UX design
Create a shared ERP design system: app shell, sidebar, header, breadcrumbs, dashboard cards, data tables, advanced filters, search, pagination, forms, drawers/modals, confirmation dialogs, status badges, toasts, empty states, error states, loading states and responsive behavior.

The visual direction should be modern, professional and information-dense, using Lexa Node as a reference rather than copying its implementation.
Gate: the business workflow can be completed through the designed UI.

### Stage 5 — Vertical implementation
Implement a feature completely instead of building only its screen:
Model → Data Access → Business Logic → API → Authorization → UI → Validation → Tests

Example: course creation is not complete when the form exists. Persistence, validation, permissions, listing, editing, deactivation, relationships and error handling must work together.

### Stage 6 — Verification
Run JavaScript/ESLint checks, production build, unit tests for important business rules, API/integration tests, permission tests, CRUD tests, workflow tests, financial calculation tests, regression tests, responsive UI checks and database relationship checks.

### Stage 7 — User Acceptance Testing
Test realistic RCLD scenarios for Superadmin, Admin, Employee, Faculty, Admission/Fee Operator and Student.
UAT must test complete workflows, not merely individual pages.

### Stage 8 — Release
Verify environment variables, database indexes, authentication, permissions, Cloudinary, production build, smoke tests and restore point before deployment.

### Stage 9 — Maintenance
Bug triage, security updates, performance monitoring, database maintenance, backup/recovery, audit review, regression testing and incremental improvements.

## 5. ERP module implementation order
### Phase A — Foundation
Authentication; Users; Roles; Permissions; Settings; Audit Logs; File/Document abstraction; Error handling and observability.

### Phase B — Master Data
Students; Employees; Faculty profiles; Skills; Courses; Subjects; Course-subject mapping; Subject-skill requirements.

### Phase C — Admissions and Enrollment
RCLD registration; Admission; Course selection; Enrollment; Admission status; Student lifecycle; Document collection.

### Phase D — Finance
Fee structures; Admission fee; Discounts; Installments; Payment records; Receipts; Outstanding dues; Refund/cancellation rules; Payment gateway integration; Financial reports.

Financial rules receive additional verification because incorrect financial records can affect real business operations.

### Phase E — Batch and Academic Operations
Batch; Batch series; Schedule; Timetable; Faculty assignment; Skill-based faculty eligibility; Student-to-batch mapping; Attendance; Exams; Results; Certificates.

Critical hierarchy: Course → Batch → Batch Series → Schedule

Example: DCA → Main Batch → A1 / A5

### Phase F — Employee and Operations
Employee attendance; Office in/out; Break tracking; Personal/official out-time classification; Tasks; Task assignment; Task status; Employee performance; Performance reports.

### Phase G — CRM and Reporting
Enquiries; Leads; Follow-ups; Admission conversion; Communication history; Operational dashboards; Financial dashboards; Student reports; Employee reports; Batch reports; Attendance reports; Management reports.

### Phase H — ERP student operational portal
This is not an LMS.

Only ERP functions are exposed: profile, registration/admission information, enrollment, fees, installments, receipts, attendance, exam/results, certificate status and necessary notices/documents.

No LMS course player, learning-content platform, online teaching system or LMS progress tracking is included.

## 6. Domain boundaries
Identity & Access; Student Management; Employee Management; Course Management; Admission & Enrollment; Finance; Batch & Scheduling; Attendance; Examination & Results; Certificates; CRM; Tasks & Performance; Reports; Documents; Notifications; Settings; Audit.

Modules should reference each other through stable IDs and application services. Avoid uncontrolled direct coupling between unrelated modules.

## 7. Data integrity
1. MongoDB is the system of record.
2. Business data is never hard-coded in React components.
3. Financial records retain audit history.
4. Important lifecycle changes are traceable.
5. Destructive operations require authorization.
6. Prefer soft deactivation where historical records must remain valid.
7. Enforce unique identifiers at database level where appropriate.
8. Design indexes around real query patterns.
9. Dummy records must be identifiable and removable independently.
10. Secrets must never be committed to Git.

## 8. Security
Security is part of the design, not a final-stage feature.

Required controls: secure authentication, server-side authorization, role-based access control, permission checks, password hashing, session/token protection, input validation, file upload validation, rate limiting where appropriate, audit logging, secure environment variables, protection against unauthorized record access and privilege escalation.

## 9. Definition of Ready
A feature enters implementation only when its requirement, actors, permissions, business rules, entity relationships, acceptance criteria, dependencies and edge cases are defined.

## 10. Definition of Done
A feature is DONE only when requirements, database model, server/business logic, authorization, UI, validation, state handling and integration are complete; automated verification passes where applicable; production build passes; critical workflow passes; documentation is updated; and major milestones have a restore point.

## 11. Git strategy
The project uses main as the controlled integration branch.

Rules: small feature-focused commits; conventional commit messages; no secrets; no unrelated refactoring inside feature commits; keep main buildable; create restore points before major milestones; verify after significant changes.

## 12. M0 — ERP Foundation acceptance criteria
JavaScript Next.js foundation; MongoDB connection; Cloudinary abstraction; environment contract; application shell; ERP login shell; dashboard shell; health endpoint; SDLC documentation; architecture documentation; no TypeScript; no LMS functionality.