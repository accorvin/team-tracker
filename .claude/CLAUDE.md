# AI Platform Team Tracker

## Architecture

- **Frontend**: Vue 3 SPA with Composition API (`<script setup>`), Vite 6, Tailwind CSS 3
- **Backend**: Express API server (port 3001), single `server/dev-server.js` for both local dev and production
- **Charts**: Chart.js 4 + vue-chartjs 5
- **Auth**: OpenShift OAuth proxy in production; no auth in local dev (uses `ADMIN_EMAILS` env var)
- **Storage**: Local filesystem (`./data/`), mounted as PVC in OpenShift
- **Hosting**: OpenShift (frontend nginx + backend Express), deployed via ArgoCD

## Key Concepts

### Data Flow
- **Roster**: `data/org-roster-full.json` defines all orgs, teams, and members. The `deriveRoster()` function transforms this into the API response format.
- **Person metrics**: Individual Jira stats stored as `data/people/{name}.json`. Fetched via JQL queries against Jira with 365-day lookback.
- **GitHub contributions**: `data/github-contributions.json` stores contribution counts per user. `data/github-history.json` stores monthly history.
- **Trends**: Built dynamically from person metric files by bucketing resolved issues by month, with org/team breakdowns.
- **Composite keys**: Teams are identified by `orgKey::teamName` (e.g., `shgriffi::Model Serving`).

### Jira Integration (Jira Cloud — redhat.atlassian.net)
- Auth: Basic auth with `JIRA_EMAIL` + `JIRA_TOKEN` (API token), base64-encoded
- Uses the Sprint Report API (`/rest/greenhopper/1.0/rapid/charts/sprintreport`) for sprint data (committed vs delivered)
- Uses `/rest/api/3/search/jql` (GET with cursor-based `nextPageToken` pagination) for person-level metrics
- Auto-resolves roster display names to Jira Cloud accountIds via `/rest/api/2/user/search?query=`, cached in `data/jira-name-map.json` (format: `{ "Name": { accountId, displayName } }`)
- JQL uses `assignee = "accountId"` (not display names)
- Story points field: `customfield_10028`
- Searches across all Jira projects (no project filter)

### Caching
- Frontend uses localStorage stale-while-revalidate pattern (prefix `tt_cache:`)
- API functions accept an `onData` callback: called immediately with cached data, then again with fresh data

## Deployment

Deployed to OpenShift via ArgoCD. Kustomize manifests in `deploy/openshift/`.

| Component | Image | Details |
|-----------|-------|---------|
| Frontend | `quay.io/accorvin/team-tracker-frontend` | nginx serving Vue SPA, proxies /api to backend |
| Backend | `quay.io/accorvin/team-tracker-backend` | Express server with PVC-mounted data directory |
| OAuth Proxy | `quay.io/openshift/origin-oauth-proxy:4.16` | Sidecar on frontend pod |

Overlays: `deploy/openshift/overlays/dev/` (namespace: `team-tracker`) and `deploy/openshift/overlays/prod/` (namespace: `ambient-code--team-tracker`).

Secrets (created manually on cluster, not in git):
- `team-tracker-secrets`: `JIRA_EMAIL`, `JIRA_TOKEN`
- `frontend-proxy-cookie`: `session_secret`

## Commands

- `npm run dev:full` — start both Vite and Express servers
- `npm run dev` — Vite only (frontend)
- `npm run dev:server` — Express only (backend, requires JIRA_EMAIL and JIRA_TOKEN in .env)
- `npm test` — run all tests
- `npm run test:watch` — run tests in watch mode

## Project Structure

```
src/
  components/       # Vue components (App.vue is the root with hash routing)
  composables/      # Shared state (useRoster, useAuth, useGithubStats, useAllowlist, useViewPreference)
  services/api.js   # API client with caching
  utils/metrics.js  # Metric calculations
  __tests__/        # Frontend tests

server/
  dev-server.js     # Express server (local dev + production)
  storage.js        # Local file storage abstraction
  jira/             # Jira API integration (client, sprint-report, person-metrics, orchestration)
  github/           # GitHub contribution fetching
  jira/__tests__/   # Backend tests

deploy/
  backend.Dockerfile    # Backend container image
  frontend.Dockerfile   # Frontend container image (multi-stage Vite build → nginx)
  nginx.conf            # nginx config for SPA + API proxy
  openshift/
    base/               # Kustomize base manifests
    overlays/dev/       # Dev cluster overlay (namespace: team-tracker)
    overlays/prod/      # Prod cluster overlay (namespace: ambient-code--team-tracker)

scripts/            # Utility scripts for roster building and data management
data/               # Local dev data (gitignored)
```

## Code Style

- Use `<script setup>` for new Vue components
- CommonJS (`require`) for server-side code
- ES modules (`import`) for frontend code
- No TypeScript — plain JavaScript throughout
- Prefer composables (`src/composables/`) for shared state logic
- Tailwind utility classes for styling; custom `primary` color palette defined in tailwind.config.mjs

## Testing

- Vitest + @vue/test-utils for frontend tests in `src/__tests__/`
- Vitest for backend unit tests in `server/jira/__tests__/`
- Run `npm test` before committing

## API Routes

In production, all routes are authenticated via OpenShift OAuth proxy. The proxy sets `X-Forwarded-Email` and `X-Forwarded-User` headers.

**GET:**
- `/healthz` — health check (no auth)
- `/whoami` — current user info (no auth)
- `/roster` — org/team structure with members
- `/team/:teamKey/metrics` — team member metrics (teamKey = `orgKey::teamName`)
- `/person/:name/metrics` — individual person metrics
- `/people/metrics` — bulk all-people metrics
- `/github/contributions` — GitHub contribution data
- `/trends` — monthly Jira + GitHub trend data
- `/allowlist` — authorized email list

**POST:**
- `/roster/refresh` — refresh all person metrics from Jira
- `/team/:teamKey/refresh` — refresh metrics for one team
- `/person/:name/metrics?refresh=true` — refresh single person
- `/github/refresh` — refresh all GitHub contributions
- `/github/contributions/:username/refresh` — refresh single user
- `/trends/jira/refresh` — refresh Jira trends
- `/trends/github/refresh` — refresh GitHub history
