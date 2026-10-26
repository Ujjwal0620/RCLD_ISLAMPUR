# RCLD Islampur ERP

Web-based ERP + LMS for RCLD Islampur, an education institute focused on computer-related courses.

## Fixed technology decisions
- Next.js
- JavaScript only (no TypeScript)
- MongoDB with Mongoose
- Cloudinary for images and files
- Modern responsive UI inspired by the Lexa Node admin layout
- Server/API logic inside Next.js

## Development principles
1. Document requirements and business rules before implementation.
2. Map database relationships before finalizing UI workflows.
3. Frontend components consume backend data; business data is never hard-coded.
4. Authentication and authorization are enforced server-side.
5. Every module has validation, loading, empty, error and success states.
6. Production and dummy/test data remain separable.
7. Major milestones pass lint, build, functional and regression checks.
8. Main is the controlled integration branch.

## Core direction
Registration/Admission -> Course -> Enrollment -> Fees/Payments -> Batch/Series/Schedule -> Attendance -> Learning/Notes -> Exams/Results -> Certificate -> Reports.

Supporting domains: Employees, Roles/Permissions, CRM, Tasks, Performance, Settings and Public LMS pages.

## Local setup
1. Copy .env.example to .env.local.
2. Add MongoDB and Cloudinary credentials.
3. Run npm install.
4. Run npm run dev.
5. Open http://localhost:3000.

Do not add TypeScript files. Use JavaScript throughout.
