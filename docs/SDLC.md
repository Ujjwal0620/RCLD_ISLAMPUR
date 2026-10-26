# RCLD Islampur ERP — Software Development Life Cycle

## 1. Objective
Build a reliable, maintainable, secure and production-ready ERP + LMS for RCLD Islampur using incremental delivery. Business rules, database relationships and workflows are defined before implementation so UI pages stay connected to the real system.

## 2. Fixed stack
- Web: Next.js
- Language: JavaScript only
- Database: MongoDB + Mongoose
- Files/images: Cloudinary
- UI: modern responsive Lexa-style admin experience
- Repository: Ujjwal0620/RCLD_ISLAMPUR
- Primary branch: main

## 3. SDLC stages
### Stage 0 — Project establishment
Repository, JavaScript Next.js foundation, environment contract, MongoDB/Cloudinary boundaries, health endpoint and base UI shell.

### Stage 1 — Requirements engineering
For every module define actors, permissions, inputs/outputs, business rules, validation, state transitions, relationships, reports and acceptance criteria.

### Stage 2 — System and data design
Define MongoDB entities/indexes, API contracts, permission matrix, navigation and page states before implementation.

### Stage 3 — UI/UX design
Create shared design tokens and reusable layouts, tables, forms, dialogs, filters, pagination and feedback components. Public LMS and internal ERP are distinct experiences with a common visual language.

### Stage 4 — Implementation
Implement vertically: database model -> server/API -> validation/authorization -> UI -> integration -> error/loading/empty/success states.

### Stage 5 — Verification
Run lint, production build, API tests, validation tests, permission tests, CRUD workflow tests, regression checks, responsive checks and relationship checks.

### Stage 6 — User acceptance
Test realistic workflows for superadmin, admin/employee, faculty and student roles.

### Stage 7 — Release
Verify environment variables, database/index setup, Cloudinary, production build, restore point and smoke tests.

### Stage 8 — Maintenance
Bug triage, security updates, performance monitoring, backup/recovery, audit logs and incremental releases.

## 4. Delivery order
Foundation -> Master Data -> Admissions/Finance -> Academic Operations -> Operations/Management -> Public LMS.

Foundation includes authentication, roles/permissions, settings, audit logging and media abstraction.

Master data includes courses, subjects, skills, employees/faculty, students and academic configuration.

Admissions/finance includes RCLD registration, admission, enrollment, discounts, installments, fees, payments, receipts and refunds.

Academic operations includes batch, batch series, schedule/timetable, faculty assignment, attendance, notes/materials, exams, results and certificates.

Operations includes CRM, tasks, employee attendance, break/out-time tracking, employee performance, reports and notifications.

Public/LMS includes homepage, course catalog/detail, student login/dashboard, learning content, video links and student-facing fees, attendance, notes, exams and certificates.

## 5. Critical RCLD batch model
Course -> Batch -> Batch Series -> Schedule.

Example:
DCA -> Main Batch -> A1 / A5.

Batch series share the same underlying academic/batch data model while allowing separate schedules and operational groupings.

Faculty assignment will use subject skill requirements so the system can filter/recommend eligible employees.

## 6. Data rules
- Separate production and test/demo data logically.
- Dummy data must be identifiable and removable safely.
- Frontend is never the source of truth for business records.
- Financial records require immutable audit history.
- Secrets never enter source control.
- Destructive actions require authorization, confirmation and audit where appropriate.
- Important entities should have createdAt, updatedAt and lifecycle status where appropriate.

## 7. Definition of Done
A feature is complete only when requirements, data model, server logic, authorization, UI, validation, state handling, integration and documentation are complete; lint/build pass; critical workflow tests pass; and a restore point exists for a major milestone.

## 8. Git workflow
The project uses main as the controlled integration branch. Keep commits small and feature-focused, use conventional commit messages, never commit secrets, create restore points before major changes, avoid unrelated refactors and keep main buildable.

## 9. M0 acceptance criteria
- JavaScript Next.js structure exists.
- MongoDB utility exists.
- Cloudinary utility exists.
- Environment contract exists.
- Public page exists.
- ERP login shell exists.
- Dashboard shell exists.
- Health endpoint exists.
- SDLC documentation exists.
- No TypeScript is introduced.
