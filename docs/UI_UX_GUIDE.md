# Interface and interaction guide

This document records the visual language for the RCLD Islampur ERP workspace. It is a practical guide for developers changing existing screens. It does not define new business features or authorize changes to routes, data contracts, roles or workflows.

## Design reference

The staff workspace takes visual direction from the Hando admin dashboard by Zoyothemes: https://zoyothemes.com/hando/html/

Use the reference for its restrained admin-dashboard presentation: persistent navigation, a compact utility bar, clear page hierarchy, useful summary cards, balanced data panels, readable tables and consistent component spacing. Build an RCLD interface around the institute's existing workflows; do not copy unrelated Hando CRM, sales, commerce or project features.

The earlier Lexa reference remains part of the project's visual history. Hando is the current direction for the ERP workspace.

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

The current theme tokens are declared near the Hando-inspired refresh section in app/globals.css.

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
