# RCLD Islampur ERP — System Architecture

## Architectural decision
Use a modular monolith built inside Next.js.

This is the preferred starting architecture for RCLD Islampur because the ERP is a focused institute system and needs strong consistency across students, admissions, finance, batches, employees and reporting.

Microservices are not required at the initial stage.

## Logical layers
### 1. Presentation layer
Next.js pages/components provide dashboards, tables, forms, filters and reports. The presentation layer does not own business truth.

### 2. Application/API layer
Responsible for request handling, authentication context, authorization, validation, calling domain/application services and response/error formatting.

### 3. Domain/business layer
Contains business rules such as admission eligibility, enrollment state changes, discount authorization, installment calculations, payment status, batch assignment, faculty eligibility, attendance rules and result/certificate rules.

### 4. Data access layer
Responsible for Mongoose models, queries, indexes, persistence and database-specific operations.

### 5. Infrastructure layer
Responsible for MongoDB, Cloudinary, payment gateway, email/SMS/notification providers and logging/monitoring.

## ERP bounded modules
Identity & Access
Student Management
Employee Management
Course Management
Admission & Enrollment
Finance
Batch & Scheduling
Attendance
Examination & Results
Certificates
CRM
Tasks & Performance
Reports
Documents
Notifications
Settings
Audit

## Core relationship direction
Student → Admission → Enrollment → Course → Batch → Batch Series → Schedule → Faculty

Enrollment → Fee Structure → Discount → Installments → Payments → Receipts

Course → Subjects → Required Skills

Employee/Faculty → Skills → Subject eligibility → Batch/Schedule assignment

Student → Attendance → Exams → Results → Certificate

## Cross-cutting concerns
Authentication, authorization, validation, audit logging, error handling, file handling and observability must be reusable across modules.

## ERP-only boundary
The application does not contain an LMS course player, learning-content delivery engine, online lesson management, LMS progress tracking, LMS video library or LMS learning paths.

Student operational access is allowed only where it supports ERP workflows such as fees, attendance, results and certificates.