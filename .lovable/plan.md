## Manual Review — corrections (approved v2 + Start-review clarification)

Frontend-only edits to `src/routes/_authenticated/manual-review.tsx`. No schema, RLS, grant, or `rescore.functions.ts` changes.

### 1. Reviewer form — 2 numeric inputs replace 4 dropdowns

Remove ICP segment, International maturity, Growth momentum, Buyer intent selects (engine outputs).

Add two numeric inputs, pre-filled from `lead.review_values` when both keys exist as numbers:

- `intl_revenue_share` — `<Input type="number" step="0.1" min="0" max="100">`; parsed to one-decimal number.
- `countries_with_revenue` — `<Input type="number" step="1" min="0">`; parsed to non-negative integer.

Inline validation errors appear only after the user has typed in that field. Fields are optional for Start review and Reject; Confirm requires both valid.

### 2. Actions — approved set

Footer order: Reset form · Reject · Start review · Confirm & rescore.

- **Reset form** — local only. Restores inputs and notes to `lead.review_values` / `lead.review_notes`. No DB write. Replaces "Discard".
- **Start review** — writes exactly: `review_state='in_review'`, `reviewed_by=auth.uid()`, `reviewed_at=now()`, `review_notes` (trimmed or null). **Does NOT write `review_values`.** Purpose: claim before researching. Numeric fields are not validated for this action.
- **Reject** — writes exactly: `review_state='rejected'`, `reviewed_by`, `reviewed_at`, `review_notes` (trimmed or null). **Does NOT write `review_values`.** Does not touch `status`.
- **Confirm & rescore** — validates both numeric fields, then writes the 5-column set including `review_values = { intl_revenue_share, countries_with_revenue }` (exact two-key shape, numbers, never null-written, never partial). Then `requestRescore({ account_slug, domain, review_values })` with baseline-captured poll on `score_last_calculated_at`.

Guarantee held by construction: `review_values` is written only inside Confirm's payload builder, from validated numbers → always absent or exact 2-key shape.

Admin gate unchanged (only `admin` / `hayas_admin` can write). DB check confirmed: `review_state` is plain `text`, no CHECK constraint, so `'rejected'` writes cleanly.

### 3. Confirm 503 branch

When `rescoreFn` returns `status === 503` (verified in `src/lib/rescore.functions.ts` line 18: `"rescore webhook not configured yet"`), show the info banner literal: `Rescore pipeline not live yet — review saved.` Review is already persisted; no poll starts; invalidate queue. Other `status >= 400` keep the existing generic message. Thrown errors keep the existing catch branch.

### 4. Gate reason header

Rename literal `GATE REASON` → `Why it's here` inside the alert block. Render `lead.review_reason` verbatim — no translation, no formatting.

### 5. State filter

Add segmented control above the queue with: Worklist (default, `review_state IS NULL OR = 'in_review'`) · Pending (`IS NULL`) · In review (`= 'in_review'`) · Confirmed (`= 'confirmed'`) · Rejected (`= 'rejected'`) · All. `status='manual_review'` stays as outer constraint for every option. Filter is part of the React Query key. Selection auto-advances to first item of the filtered list when it changes.

### 6. Stale-review badge

When `lead.reviewed_at` and `lead.score_last_calculated_at` are both non-null and `reviewed_at < score_last_calculated_at`, render a small badge under the domain: `Reviewed before current data` (chart-4 outline styling, matching existing "In progress" badge).

### Out of scope

Queue count, absent AI placeholder, `— /130` empty score, not-reviewed footer state — unchanged.

### Publish

After edits, publish to production. User re-verifies before any real review.
