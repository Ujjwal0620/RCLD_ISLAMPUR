# RCLD Islampur ERP

A web-based ERP system only for RCLD Islampur, an education institute focused on computer-related courses.

This project is intentionally not an LMS. It manages administrative, academic-operation, financial, employee and reporting workflows. Student-facing access is limited to ERP functions such as registration, admission, fees, attendance, results and certificates where required.

## Fixed technology decisions
- Next.js
- JavaScript only — no TypeScript
- MongoDB with Mongoose
- Cloudinary for images and files
- Modern responsive ERP UI inspired by the information architecture and visual patterns of Lexa Node
- Next.js server/API routes for application logic

## Engineering model

The project uses a hybrid Agile + incremental + risk-driven SDLC with a modular monolith architecture.

Engineering flow: Requirements → Domain Model → Data Model → API/Business Logic → UI → Integration → Automated Verification → UAT → Release

The ERP is divided into business modules with clear boundaries. We will not build isolated screens first and connect them later.

## Core ERP domains
1. Authentication, users, roles and permissions
2. Students
3. Employees and faculty
4. Courses and subjects
5. Admissions and registration
6. Enrollments
7. Fees, discounts, installments and payments
8. Batches, batch series and schedules
9. Faculty/subject skill mapping
10. Attendance
11. Exams and results
12. Certificates
13. CRM and enquiries
14. Employee attendance and break/out-time
15. Tasks and employee performance
16. Reports and dashboards
17. Notifications
18. Documents/files
19. Settings
20. Audit logs

## Core principle
The database is the source of truth. UI components consume validated server-side data. Business rules, permissions, financial calculations and status transitions must not be trusted to browser code.

## Quality gates
- Requirements and acceptance criteria documented
- Database relationships defined
- Server-side validation
- Authorization/permission checks
- CRUD/workflow implementation
- Loading, empty, error and success states
- Automated verification where practical
- Production build passes
- Regression checks pass
- Documentation updated
- Major milestones have a restore point

## Test data
Dummy/demo data must be explicitly identifiable and removable without affecting real production records. It must be stored in MongoDB and must never be hard-coded as the application's source of truth.

## Repository
- Repository: Ujjwal0620/RCLD_ISLAMPUR
- Primary branch: main

## Local setup
1. Copy .env.example to .env.local.
2. Add MongoDB and Cloudinary credentials.
3. Run npm install.
4. Run npm run dev.
5. Open http://localhost:3000.

Do not add TypeScript files or migrate this project to TypeScript.