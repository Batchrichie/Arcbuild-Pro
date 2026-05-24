# Portal navigation patterns (standard)

Use these patterns for all new work. Migrate bespoke dialogs when touching a file.

## Tabs

- **Implementation:** React `useState` in portal shell (`activeTab` / `activeView`); not URL-routed unless specified.
- **Examples:** `CeoPortal`, `AccountantPortal`, `HrPortal`, `EmployeePortal`, `ClientPortal`, `TaxCentre`.

## Modals

- **Use:** [`Modal.jsx`](../components/ui/Modal.jsx) — `z-index: 80`, `max-h-[95vh]`, Escape + backdrop close.
- **Migrate from bespoke:** `TaxCentre` filing dialog, `MilestoneManager` confirm (done), `ApprovalQueue`, `AssetRegister`, registry pages.

## Slide-overs

- **Use:** [`SlideOver.jsx`](../components/ui/SlideOver.jsx) or classes `portal-slide-over-backdrop` + `portal-slide-over-panel`.
- **Stack:** backdrop `z-index: 60`, panel `z-index: 70`.

## Drill-downs

- Expand inline: `DebtorsLedger` client rows, `DailyProgressReport`, `EmployeeLoans`.
- Prefer `portal-table-wrap` on wide child tables.

## Page-within-page

- Replace main child via state (`EmployeePayslips`, `ClientProjects`); always provide a back control.

## Z-index stack

| Layer | Variable | Value |
|-------|----------|-------|
| Mobile nav | `--z-portal-nav` | 50 |
| Slide backdrop | `--z-portal-backdrop` | 60 |
| Slide panel | `--z-portal-slide-over` | 70 |
| Modal | `--z-portal-modal` | 80 |
| Lightbox / toast | `--z-portal-toast` | 90 |
