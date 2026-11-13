# Interface and interaction guide

This document records the visual language for the RCLD Islampur ERP workspace. It is a practical guide for developers changing existing screens. It does not define new business features or authorize changes to routes, data contracts, roles or workflows.

## Design reference

The staff ERP takes visual direction from the [Lexa Node dashboard reference](https://themesbrand.com/lexa-node/layouts/index.html). Use its clean vertical navigation, compact top bar, responsive page frame, restrained cards, readable tables, consistent form controls and clear page hierarchy as inspiration.

The RCLD application remains a native Next.js App Router + React + JavaScript application backed by MongoDB and Cloudinary. Do not copy or introduce the reference template's EJS, jQuery, Bootstrap or vendor assets. Rebuild the visual patterns with the project's existing React components and CSS.

Reference traits to preserve:
- A clear vertical sidebar with grouped navigation and a visible active route.
- A compact utility/top bar that does not compete with page content.
- Simple page headers with one primary action and quiet secondary actions.
- Consistent card, table, form, filter, status and empty-state patterns.
- Responsive layouts that remain usable on laptop, tablet and mobile.
- Light/dark theme parity without changing business behavior.

The shared design layer lives in `app/styles/design-system.css`, loaded after `app/globals.css` from `app/layout.js`. New reusable workspace styling belongs there. Keep highly specialized registration, receipt, timetable and report layout rules close to their feature until they can be safely migrated. Do not append another override block when the owning selector can be corrected directly.

See `docs/COMMAND_CATALOG.md` for the exact UI page, API route and data owner for each module.

## Current UI delivery checkpoint — 12 November 2026

The shared ERP shell and dashboard have received a compact-density pass on main (commit 707b3c90c468d42fbcd4c69efdf8e81f82b9d27d).

Delivered in that change:
- Reduced the visual height and spacing of the shared dashboard shell, page headings, cards, KPI panels, tables, forms and buttons.
- Reduced dashboard chart/panel heights so more operational information fits in the viewport.
- Added accessible chart labels and hover tooltip text to existing trend-chart points and mini-bar columns.
- Preserved existing dashboard API wiring and data sources; no fabricated chart values were introduced.
- Retained the existing light/dark theme and responsive styling.

This is a compact shared-style and dashboard improvement, not a completed page-by-page redesign of every ERP module. No lint, production build or browser regression run was recorded for this checkpoint. Verify locally before treating the change as release-ready.

## Design principles

1. **Operational clarity first.** Staff should understand the current page, its main action and the state of the records without visual noise.
2. **Keep the data visible.** Student, employee, fee and timetable screens are information-dense by nature. Use compact rows and well-labelled groups, not oversized decorative cards.
3. **Consistent shell.** Authenticated pages use ERPLayout, the shared sidebar and the top utility bar. Do not build a second page shell for an individual module.
4. **One visual language.** Buttons, filters, tables, badges, cards, form controls, dialogs and empty states should look and behave consistently.
5. **Responsive by design.** Desktop gets the full navigation rail and multi-column work areas. Smaller screens use the existing hamburger/off-canvas navigation and stacked layouts.
6. **Accessible interaction.** Controls need labels, keyboard focus, clear active states and semantic landmarks. Do not communicate status through colour alone.
7. **No surprise behavior.** A visual redesign must preserve the current API calls, field names, validation, permissions, navigation destinations and business rules.

## Workspace frame

The shared shell is implemented in components/ERPLayout.js and styled in app/globals.css.

- Left navigation: dark navy rail with the RCLD identity, institute context, grouped links, current-page indication and sign-out action.
- Utility bar: compact search affordance, utility icons, sidebar collapse control and signed-in user identity.
- Main workspace: page title/breadcrumb, page-specific actions and the existing module content.
- Mobile navigation: hamburger button, off-canvas sidebar and dismissible overlay.
- Keyboard navigation: skip link moves focus/navigation to the main workspace.

Keep navigation groups and links aligned with the routes that actually exist. Do not add menu items for unimplemented features.

## Visual tokens

Shared workspace tokens are declared in app/styles/design-system.css. Legacy feature-specific styles remain in app/globals.css until they can be migrated safely.

| Token / role | Current direction |
|---|---|
| Workspace background | Cool light grey |
| Surfaces | White |
| Primary text | Deep blue-grey |
| Secondary text | Muted slate |
| Primary action | Indigo |
| Sidebar | Deep navy |
| Borders | Soft cool grey |
| Cards | Subtle border and restrained shadow |
| Corners | Medium rounded corners; consistent within component families |

Use the existing CSS variables and component classes before introducing new colours. Avoid hard-coded one-off palettes on new pages. Keep semantic states distinct: success, warning, danger and informational.

## Component patterns

### Page header
Use the existing topbar pattern: breadcrumb/context, one clear page title and a compact action group. Keep the primary action visually prominent; secondary actions should remain quiet.

### Summary metrics
Use metric-grid / dash-kpi patterns only when the values help staff make a decision on that page. Do not add decorative numbers or fabricated trends.

### Panels
Use panel and panel-head for grouped content. A panel heading should say what the data represents; supporting text should explain scope or period where necessary.

### Tables
- Keep column labels short and unambiguous.
- Align currency and numeric values consistently.
- Preserve useful row actions without crowding the primary data.
- Keep horizontal overflow deliberate on narrow screens.
- Include loading, empty and error states.
- Avoid making a row clickable when it contains nested actions unless keyboard and event behavior are handled.

### Forms
- Group fields by the institute's existing workflow.
- Keep labels visible; do not rely on placeholder text as the only label.
- Use consistent field heights, spacing and validation feedback.
- Preserve existing field names, request payloads, validation and submission sequence.
- Show destructive or irreversible actions clearly.

### Dialogs and overlays
Use the existing modal patterns. Keep dialogs within the viewport, make their content scroll independently, preserve a clear close/cancel action and avoid nested overlays where possible.

### Student profiles and fee workspace
Keep the existing profile sections and fee operations. The visual refresh may improve hierarchy, density and legibility, but it must not change payment calculations, receipt data, transaction history or authorization.

### Batch and timetable screens
Preserve the existing Course → Batch → Series → Schedule model, Excel-like weekly slot visualization, slot locking, faculty assignment and conflict rules. Improve readability and responsive access without changing how a slot is selected or reserved.

### Print layouts
Screen styling and print styling are separate concerns. Do not allow workspace shadows, sticky headers, sidebar elements or responsive rules to leak into printed documents. Verify receipts in browser print preview at their intended page size. CSS dimensions alone are not proof of correct pagination.

## Appearance and workspace controls

The shared utility bar includes:
- **Theme switch:** toggles between light and dark palettes and remembers the choice in browser local storage for that device.
- **Full-screen mode:** uses the browser Fullscreen API to expand the ERP workspace; the same control exits full-screen mode. Browser/device policy may prevent this action.

The theme is presentation-only. It must not change stored ERP data, user roles, permissions, routes or API behavior. New components should use theme-aware surfaces and readable contrast in both modes.

## Responsive behavior

Use the existing breakpoints in app/globals.css as the baseline. Test at a wide desktop, a medium tablet, a narrow mobile and a small mobile viewport.

- Desktop: sidebar visible, utility bar full width, multi-column dashboard and forms where space permits.
- Tablet: preserve content hierarchy; reduce grid columns before shrinking text excessively.
- Mobile: hamburger navigation, stacked page actions, single-column forms and metric groups, scrollable data tables and dialogs that fit the viewport.
- Do not hide critical actions or essential record fields just to make a page appear less dense.

## Interaction and accessibility checklist

- [ ] Navigation has a visible active route and keyboard focus.
- [ ] Mobile menu opens, closes and does not cover the page after navigation.
- [ ] All icon-only controls have accessible names.
- [ ] Inputs have visible labels and clear focus states.
- [ ] Statuses remain understandable without colour alone.
- [ ] Tables work with keyboard and touch input.
- [ ] Dialogs have a clear close/cancel route and do not overflow.
- [ ] Loading, empty, error and success states are distinguishable.
- [ ] Reduced-motion preferences are respected.
- [ ] Print layouts are isolated from the application shell.

## Change boundaries

A UI-only task must not change:
- API endpoints, HTTP methods or request/response shapes;
- MongoDB schemas, field names, indexes or stored values;
- role/permission checks or session behavior;
- fee, discount, payment, attendance or timetable calculations;
- student/employee lifecycle states;
- route destinations or existing workflow steps.

If a design issue cannot be solved without changing one of those areas, stop and document the dependency rather than silently changing the feature.

## Verification before calling a redesign complete

1. Compare the old and new page's visible actions and workflow steps.
2. Verify every existing route still loads.
3. Exercise the primary create/edit/view action on the page with representative records.
4. Confirm the same API requests and payloads are used.
5. Check loading, empty, error and success states.
6. Check role-restricted actions with permitted and denied accounts.
7. Test desktop, tablet and mobile widths.
8. Check print preview for pages with print output.
9. Run npm run lint and npm run build.
10. Record what was not tested. Do not call an untested screen production-ready.

## Maintenance

When adding a reusable pattern, update this guide and the shared styles rather than styling a single page in isolation. Keep this document current when the shell, design tokens, breakpoints or component patterns change.


## Page-by-page redesign status — 13 November 2026

The Lexa-inspired shared layer is being applied in controlled phases. The shared layer improves navigation, page headings, panels, metrics, tables, filters, forms, modals and the Excel-like timetable without changing API contracts or institute rules. It does **not** mean every page has been individually redesigned.

- **Phase 1 — Shared workspace and core operations:** shared ERP shell, dashboard, student directory, employee directory, course catalog and batch/timetable screens. Shared Lexa-inspired styling is merged; the student and employee directories now have dedicated overview/metric layouts; course catalogue hierarchy and batch overview metrics have been refreshed. The dashboard and batch/timetable still require individual visual and interaction review.
- **Phase 2 — Student lifecycle:** registration, pending admissions, I-Cards, student profile, fee workspace, payment history, attendance, batch movement and import.
- **Phase 3 — Academic operations:** subjects/chapters, course content, batch details, batch roster, timetable detail and faculty assignment.
- **Phase 4 — People and administration:** employee create/profile, employee attendance, back-office tasks, permissions and settings.
- **Phase 5 — Business operations:** CRM, referrals, dropouts, reports and AI Copilot.
- **Phase 6 — Public and student experience:** the root route now has a public RCLD institute homepage with a live course catalogue and the ERP login link only in the footer. Student-specific sign-in and the student-facing learning area remain outstanding.

For each phase, preserve the current routes, API calls, field names, roles, fee calculations, batch relationships and historical records. Record the exact pages changed and the local/browser checks performed. Do not mark a phase complete until its pages have been reviewed at desktop, tablet and mobile widths.


### Public homepage scope

The root route `app/page.js` is a public institute landing page and reads active course records from `GET /api/courses`. It includes course details, duration, weekly class frequency and fee information returned by the API. It does not invent contact numbers or email addresses, and it does not claim that student authentication or an LMS course player is already implemented. The staff ERP login is intentionally linked only from the footer.


## RCLD registration print system

The student registration print document is designed against the supplied RCLD paper registration-form reference. The dedicated stylesheet `app/styles/registration-print.css` is imported last in `app/layout.js` and is the single owner of registration print rules. Legacy registration-specific `@media print` blocks were removed from `app/globals.css` so competing A4 coordinate systems cannot override one another.

The print layout is A4 portrait and includes:
- the RCLD logo, single-line institute heading, paper-form subtitle, registration-form label and Form No.;
- the original capital-letter instruction strip;
- office fields using the current registration data;
- applicant details and photograph;
- Present Address and Permanent Address boxes with the exact `#8493BD` border;
- contact details;
- the six-column qualification table in the paper reference order: Sl. No., Exam/Course, Board/University, College/Institute, Year and % of Marks;
- enclosure checkboxes, declaration and date/place/signature lines.

The print-only work does not change the student registration API payload, MongoDB schema, uploads, admission status rules or fee behavior. Verify the rendered result in Chrome print preview using A4 portrait, 100% scale, no margins and browser headers/footers disabled. A source change is not a substitute for checking the actual rendered print preview.
