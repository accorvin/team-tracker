# Feature Risk Report

Local report that summarizes FPDoR readiness and **feature risk** (high / medium / low) for a release cycle, split by release event tabs. Used for planning-freeze triage and execution handover.

## What it shows

| Tab | Cohort | Membership rule | Audience |
|-----|--------|-----------------|----------|
| **3.6 EA2** | Passed planning freeze | **Fix Version** only | Execution — what was committed at EA2 freeze |
| **3.6 GA** | Upcoming planning freeze | **Target Version** only | Planning — what is targeted for GA; shows Fix Version commitment when applicable |

Within each tab, gaps are grouped by FPDoR item **severity** (critical → soft), then feature risk level.

**Feature risk rules** (from failed FPDoR items only):

- **High** — any critical fail, or two or more high-severity fails
- **Medium** — exactly one high fail, or worst fail is medium (no critical)
- **Low** — all pass, or only soft fails remain

Ready stays binary (17-item FPDoR checklist; N/A counts as pass).

## Run

From the **rhai-org-pulse** repo root (requires `npm install` / `npm run setup` so `@org-pulse/core` and modules resolve):

```bash
node scripts/feature-risk-report/generate-feature-risk-report.js
```

Outputs (gitignored under `data/`):

- `data/feature-risk-report-3.6.html` — self-contained browser report (tabs per release event)
- `data/feature-risk-report-3.6.json`
- `data/feature-risk-report-3.6.md`

Regenerate HTML only from existing JSON:

```bash
node scripts/feature-risk-report/generate-feature-risk-report.js --html-only
```

## Inputs

| File | Purpose |
|------|---------|
| `data/jira-3.6-ea2-raw.json` | Cached Jira Feature/Initiative payload (refresh before a new run) |
| `data/jira-3.6-ea2-epic-counts.json` | Child epic enrichment for FPDoR Child epics check |
| `fixtures/releases/delivery/product-pages-releases-cache.json` | Planning freeze dates per product × event |

The generator reuses Org Pulse server modules (`fpdor.js`, `feature-query`) so checklist rules stay aligned with Features List.

## Handoff

Documented in [release-planner-tool turnover topics](https://github.com/emarion1/release-planner-tool/blob/master/docs/TURNOVER-TOPICS-ARJAY-HINEK.md) (topic **3a**). Future product home: Plan (upcoming freeze) and Execute → Feature Tracking (passed freeze) in Org Pulse.

## Configuration

Edit constants at the top of `generate-feature-risk-report.js`: `EVAL_DATE`, `CYCLE`, `EVENTS`, `PRODUCTS`.
