---
status: draft
owner: demo-team
created: 2026-11-03
updated: 2026-11-03
release_type: UX
baseline_tag: none
depends_on: []
amends: []
---

# Navigation and Routing Spec

## 1. Problem

- Screens are switched with React state only (`App.jsx`). The URL never
  changes, so the browser Back button leaves the app, a reload always returns
  to the Workbench, and a presenter can't bookmark or share "Recall Trace for
  lot L-2291" or "lineage for PO-1".
- Cross-screen links (Modernization → lineage, Catalog → Workbench, Recall →
  lineage) pass context in memory with a `nonce`; it is lost on reload.
- **More… → Classic Investigation** (`Investigation.jsx`) is an earlier version
  of the Workbench. No spec owns it, and it competes with the Workbench as the
  "investigation" screen.

## 2. Users and audience

- Primary user: the presenter moving between screens during a live demo.
- Secondary users: evaluators revisiting a screen after the session from a link.
- Demo audience: all.

## 3. Goals

- Every screen, and every cross-screen link, has a URL.
- Back and Forward move between screens as users expect.
- One investigation screen.

## 4. Product outcomes

- A presenter can open the demo straight to any step from a bookmark.
- Follow-up emails can link to the exact screen and selection shown.

## 5. Demo success criteria

- Reloading any screen keeps the screen and its selection.
- Back after Modernization → "Open lineage" returns to Modernization.

## 6. Non-goals

- A router library (no new dependency); hash routing is enough for a demo.
- URLs for in-screen state beyond the selections listed in section 9
  (tabs inside the Data view, expanded panels, Presenter Mode).
- Changing screen content or layout.

## 7. Requirements

- **REQ-001:** Each top-level screen shall have a hash URL (section 9), and
  selecting a screen shall update it.
- **REQ-002:** Opening a URL directly or reloading shall show that screen; an
  unknown or empty hash shall show the Workbench.
- **REQ-003:** Browser Back and Forward shall move between previously shown
  screens and selections.
- **REQ-004:** Cross-screen links (plan a change, open lineage, investigate an
  interface) shall carry their selection in the URL, so it survives a reload.
- **REQ-005:** The Recall Trace lot and the Modernization system shall be in the
  URL.
- **REQ-006:** Classic Investigation shall be removed from the navigation and
  its component deleted; `DEMO.md` and `README.md` shall no longer mention it.

## 8. UX design

No visible change except the address bar and the **More…** menu, which keeps
only Presenter Console. Links inside the app stay buttons; they push a URL.

## 9. Data and API design

No API change. URL shapes:

| Screen | URL |
|---|---|
| Workbench | `#/workbench`, `#/workbench?interface=<key>` |
| Catalog & Lineage | `#/lineage`, `#/lineage?entity=<key>&flow=<flow>` |
| Modernization | `#/modernization?system=<key>` |
| Recall Trace | `#/recall?lot=<lot>` |
| Context Ingestion | `#/ingestion` |
| Presenter Console | `#/presenter` |

The exact query fields for Catalog & Lineage follow the current `catalogTarget`
object; implementation lists them in section 15.

## 10. MongoDB usage

None.

## 11. Acceptance criteria

- [ ] REQ-001 — automated: `frontend/src/App.test.jsx` (clicking a screen sets the hash)
- [ ] REQ-002 — automated: `frontend/src/App.test.jsx` (initial hash renders that screen; unknown hash renders Workbench)
- [ ] REQ-003 — automated: `frontend/src/App.test.jsx` (`hashchange` switches screen); manual: Back/Forward in Chrome, by demo-team
- [ ] REQ-004 — automated: `frontend/src/App.test.jsx` (cross-screen link writes selection to the hash)
- [ ] REQ-005 — automated: `frontend/src/components/RecallTrace.test.jsx`
- [ ] REQ-006 — automated: `npm run spec:check` plus a test that **More…** lists only Presenter Console

## 12. Product risks

- Someone may use Classic Investigation in a talk track not in `DEMO.md`.
- Hash routing conflicts with in-page anchors if any are added later.

## 13. Validation plan

- Unit/API checks: none.
- Frontend checks: `cd frontend && npm test`, `npm run build`.
- Smoke checks: `npm run smoke` (unchanged API).
- Demo rehearsal checks: run the `DEMO.md` hero path using Back between steps; reload mid-path.

## 14. Implementation tasks

- [ ] Small hash-route helper (parse/serialize) and `hashchange` listener in `App.jsx`.
- [ ] Move `tab`, `modernizationSystem`, `catalogTarget`, `workbenchFocus` to the URL.
- [ ] Recall Trace reads/writes `lot`.
- [ ] Delete `Investigation.jsx`; update **More…**, `DEMO.md`, `README.md`.
- [ ] `App.test.jsx` and the Recall Trace test update.

## 15. Decisions

- Hash routing without a library: works on the Vite dev server and any static
  host with no server config, and adds no dependency.

## 16. Roadmap priority

1. REQ-001–REQ-003 (Back works, reload keeps the screen).
2. REQ-004–REQ-005 (shareable selections).
3. REQ-006 (remove Classic Investigation).

## 17. Follow-ups

- URL state for Data view tabs and the lineage as-of date.
