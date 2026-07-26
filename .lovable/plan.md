## Scope

Frontend-only refinement of the existing `TrendDelta` component in `src/routes/_authenticated/leads.tsx`. The Sparkline column was already replaced with `TrendDelta` in the previous turn, but three spec points are not yet implemented:

1. Explicit "current score NULL → —" branch (needs the lead's current `score_total`, not just the history array).
2. "— no change" wording (currently renders a bare "—", indistinguishable from the null case).
3. Tooltip on the delta showing previous score, its date in Europe/London, and `engine_version` when it differs from the current one.

No changes to queries, schema, RLS, routes, or to the lead detail Sheet timeline.

## Changes in `src/routes/_authenticated/leads.tsx`

1. Extend `TrendDelta` props to `{ points: SparkPoint[]; currentScore: number | null }`.
2. Branch order:
   - `currentScore == null` → muted `—`.
   - `scored.length === 0` → muted `—` (defensive; should not happen when currentScore is set).
   - `scored.length === 1` → muted italic `First run`.
   - Compute `delta = round((latest − prev) * 10) / 10`.
   - `delta === 0` → muted `— no change`.
   - Otherwise `▲ +X.X` (chart-2) or `▼ −X.X` (destructive), one decimal, subtle.
3. Wrap the rendered delta/label (all non-null branches except the initial null) in a shadcn `Tooltip` whose content shows:
   - `Previous: <prev score>`
   - `<formatLondon(prev.recorded_at)>` (reuse helper from `@/lib/lead-presentation`).
   - `Engine <prev.engine_version> → <latest.engine_version>` only when the two differ and both are non-null.
   For "First run", the tooltip may be omitted (no prior data).
4. Update the call site in the table body to pass `currentScore={lead.score_total}`.

## Technical notes

- Reuse existing batched `lead_score_history` query — no new queries.
- `formatLondon` already imported from `@/lib/lead-presentation`.
- Tooltip primitives (`Tooltip`, `TooltipTrigger`, `TooltipContent`) already imported in this file (used by the score bar).

## Verification

- Typecheck.
- Expected on current production data: most rows `First run`; `crepprotect.com` shows `▼ −32.1`; `111skin.com` shows `First run` (its prior score was null, so the only scored history entry is the current 30.62).

## Publish

Publish after the edit lands.
