# AI Platform Team Tracker

## Local Development

### Quick Start

```bash
npm install
cp .env.example .env   # Edit with your credentials
npm run dev:full       # Starts Vite (5173) + Express (3001)
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `JIRA_EMAIL` | Your @redhat.com email |
| `JIRA_TOKEN` | Jira Cloud API token from https://id.atlassian.com/manage-profile/security/api-tokens |
| `ADMIN_EMAILS` | Comma-separated admin emails (seeds the allowlist) |

### Optional Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | Classic PAT with `read:user` scope (for contribution stats). Fine-grained tokens don't work with GraphQL API. |
| `GITLAB_TOKEN` | GitLab PAT with `read_api` scope (for contribution stats). Without it, only public project contributions are counted. |
| `GITLAB_BASE_URL` | GitLab instance URL (default: `https://gitlab.com`) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` | Path to Google SA JSON key (default: `/etc/secrets/google-sa-key.json`). For local dev: `./secrets/google-sa-key.json` |
| `DEMO_MODE` / `VITE_DEMO_MODE` | Set both to `true` to run with fixture data (no credentials needed) |

### Commands

- `npm run dev:full` — start both Vite and Express servers
- `npm run dev` — Vite only (frontend)
- `npm run dev:server` — Express only (backend, requires .env)
- `npm test` — run all tests
- `npm run test:watch` — run tests in watch mode

## Architecture

- **Frontend**: Vue 3 SPA with Composition API (`<script setup>`), Vite 6, Tailwind CSS 3
- **Backend**: Express API server (port 3001), single `server/dev-server.js` for both local dev and production
- **Charts**: Chart.js 4 + vue-chartjs 5
- **Auth**: OpenShift OAuth proxy in production; no auth in local dev (uses `ADMIN_EMAILS` env var)
- **Storage**: Local filesystem (`./data/`), mounted as PVC in OpenShift
- **Hosting**: OpenShift (frontend nginx + backend Express), deployed via ArgoCD

## Key Concepts

### Data Flow
- **Roster**: `data/org-roster-full.json` defines all orgs, teams, and members. Built automatically by roster sync (LDAP + Google Sheets). The `deriveRoster()` function transforms this into the API response format.
- **Person metrics**: Individual Jira stats stored as `data/people/{name}.json`. Fetched via JQL queries against Jira with 365-day lookback.
- **GitHub contributions**: `data/github-contributions.json` stores contribution counts per user. `data/github-history.json` stores monthly history. Fetched via GitHub GraphQL API with `GITHUB_TOKEN`.
- **GitLab contributions**: `data/gitlab-contributions.json` and `data/gitlab-history.json`. Fetched via GitLab REST API (`/api/v4/users/:id/events`) with `GITLAB_TOKEN`.
- **Trends**: Built dynamically from person metric files by bucketing resolved issues by month, with org/team breakdowns.
- **Composite keys**: Teams are identified by `orgKey::teamName` (e.g., `shgriffi::Model Serving`).

### Roster Sync (`server/roster-sync/`)
Automated roster building that replaces manual scripts:
- **LDAP** (`ldap.js`): Traverses Red Hat corporate directory from configured org root UIDs. Requires VPN.
  - `ldapjs` v3: `createClient()` is synchronous. Search entries use `entry.attributes` array with `.type` and `.values`.
  - Extracts GitHub and GitLab usernames from `rhatSocialUrl` LDAP field.
- **Google Sheets** (`sheets.js`): Enriches LDAP data with team assignments, focus areas, etc. Sheet names are auto-discovered from the spreadsheet ID.
  - Auth via `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` env var pointing to a service account JSON key.
- **Username Inference** (`username-inference.js`): Optionally infers missing GitHub/GitLab usernames by fuzzy-matching roster people against GitHub org members or GitLab group members. Configured via Settings UI (`githubOrgs`, `gitlabGroups`).
- **Config** (`config.js`): Org roots, Google Sheet ID, and username inference settings stored in `data/roster-sync-config.json`, managed via Settings UI.
- **Scheduler** (`index.js`): Runs sync daily (24h interval). Can be triggered manually via API or Settings UI.

### Jira Integration (Jira Cloud — redhat.atlassian.net)
- Auth: Basic auth with `JIRA_EMAIL` + `JIRA_TOKEN` (API token), base64-encoded
- Uses the Sprint Report API (`/rest/greenhopper/1.0/rapid/charts/sprintreport`) for sprint data (committed vs delivered)
- Uses `/rest/api/3/search/jql` (GET with cursor-based `nextPageToken` pagination) for person-level metrics
- Auto-resolves roster display names to Jira Cloud accountIds via `/rest/api/2/user/search?query=`, cached in `data/jira-name-map.json` (format: `{ "Name": { accountId, displayName } }`)
- JQL uses `assignee = "accountId"` (not display names)
- Story points field: `customfield_10028`
- Searches across all Jira projects (no project filter)

### GitHub Integration (`server/github/contributions.js`)
- Uses GitHub GraphQL API directly via `node-fetch` (no `gh` CLI dependency)
- Auth via `GITHUB_TOKEN` env var (classic PAT with `read:user` scope)
- Batches users (10 per batch for counts, 5 for history) with 2-second delays between batches to avoid rate limiting
- Functions are async: `fetchContributions(usernames)` and `fetchContributionHistory(usernames)`

### GitLab Integration (`server/gitlab/contributions.js`)
- Uses GitLab REST API (`/api/v4/users/:id/events`) via `node-fetch`
- Auth via `GITLAB_TOKEN` env var (PAT with `read_api` scope). Falls back to unauthenticated (public repos only).
- `GITLAB_BASE_URL` defaults to `https://gitlab.com`
- Sequential requests with delays (200ms authenticated, 7s unauthenticated)

### Caching
- Frontend uses localStorage stale-while-revalidate pattern (prefix `tt_cache:`)
- API functions accept an `onData` callback: called immediately with cached data, then again with fresh data

## Local Kind Cluster

For testing the containerized deployment locally, see `deploy/KIND.md`. The `deploy/openshift/overlays/local/` overlay strips OpenShift-specific resources (OAuth proxy, Route, ServiceAccount) and uses locally-built images with `imagePullPolicy: Never`. Cluster name is `team-tracker` (not the default `kind`). If using Podman: `export KIND_EXPERIMENTAL_PROVIDER=podman`.

## Deployment

Deployed to OpenShift via ArgoCD. Full deployment guide: `deploy/OPENSHIFT.md`.

| Component | Image | Details |
|-----------|-------|---------|
| Frontend | `quay.io/accorvin/team-tracker-frontend` | nginx serving Vue SPA, proxies /api to backend |
| Backend | `quay.io/accorvin/team-tracker-backend` | Express server with PVC-mounted data directory |
| OAuth Proxy | `quay.io/openshift/origin-oauth-proxy:4.16` | Sidecar on frontend pod |

Overlays: `deploy/openshift/overlays/dev/` (namespace: `team-tracker`), `deploy/openshift/overlays/preprod/` (namespace: `ambient-code--team-tracker`), and `deploy/openshift/overlays/prod/`.

Secrets (created manually on cluster, not in git):
- `team-tracker-secrets`: `JIRA_EMAIL`, `JIRA_TOKEN`, `GITHUB_TOKEN` (optional), `GITLAB_TOKEN` (optional)
- `frontend-proxy-cookie`: `session_secret`
- `google-sa-key`: Google service account JSON key (mounted at `/etc/secrets/`)

### Building images on ARM Macs
Standard `--platform linux/amd64` builds fail: npm times out under QEMU, esbuild crashes. Workaround: build/install natively, then copy into amd64 base images. See `deploy/OPENSHIFT.md` step 3 for details. This works because the backend has no native Node addons (all pure JS).

### Dev vs prod
- **Dev overlay** removes `ADMIN_EMAILS` from the configmap. When empty, the first authenticated user is auto-added to the allowlist.
- **Prod overlay** keeps `ADMIN_EMAILS` to pre-seed the allowlist with known admins.

### Auth flow (production)
OpenShift OAuth proxy (sidecar on frontend pod) authenticates users and sets `X-Forwarded-Email` / `X-Forwarded-User` headers. The backend reads `X-Forwarded-Email` and checks it against `data/allowlist.json`. If the allowlist is empty, the first request auto-adds the user.

## Project Structure

```
src/
  components/       # Vue components (App.vue is the root with hash routing)
  composables/      # Shared state (useRoster, useAuth, useGithubStats, useGitlabStats, useAllowlist, useRosterSync, useViewPreference)
  services/api.js   # API client with caching
  utils/metrics.js  # Metric calculations
  __tests__/        # Frontend tests

server/
  dev-server.js     # Express server (local dev + production)
  storage.js        # Local file storage abstraction
  jira/             # Jira API integration (client, sprint-report, person-metrics, orchestration)
  github/           # GitHub GraphQL API (contribution fetching)
  gitlab/           # GitLab REST API (contribution fetching)
  roster-sync/      # Automated roster sync (LDAP + Google Sheets + username inference)
  jira/__tests__/   # Backend tests

deploy/
  backend.Dockerfile    # Backend container image
  frontend.Dockerfile   # Frontend container image (multi-stage Vite build -> nginx)
  nginx.conf            # nginx config for SPA + API proxy
  openshift/
    base/               # Kustomize base manifests
    overlays/dev/       # Dev cluster overlay (namespace: team-tracker)
    overlays/preprod/   # Preprod cluster overlay (namespace: ambient-code--team-tracker)
    overlays/prod/      # Prod cluster overlay

data/               # Local dev data (gitignored)
secrets/            # Service account keys (gitignored)
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

In production, all routes are authenticated via OpenShift OAuth proxy. The proxy sets `X-Forwarded-Email` and `X-Forwarded-User` headers. All routes are prefixed with `/api`.

**GET:**
- `/api/healthz` — health check (no auth)
- `/api/whoami` — current user info
- `/api/roster` — org/team structure with members
- `/api/team/:teamKey/metrics` — team member metrics (teamKey = `orgKey::teamName`)
- `/api/person/:name/metrics` — individual person metrics
- `/api/people/metrics` — bulk all-people metrics
- `/api/github/contributions` — GitHub contribution data
- `/api/gitlab/contributions` — GitLab contribution data
- `/api/trends` — monthly Jira + GitHub + GitLab trend data
- `/api/allowlist` — authorized email list
- `/api/admin/roster-sync/config` — roster sync configuration
- `/api/admin/roster-sync/status` — sync status (running/last result)

**POST:**
- `/api/roster/refresh` — refresh all person metrics from Jira
- `/api/team/:teamKey/refresh` — refresh metrics for one team
- `/api/person/:name/metrics?refresh=true` — refresh single person
- `/api/github/refresh` — refresh all GitHub contributions
- `/api/github/contributions/:username/refresh` — refresh single user
- `/api/gitlab/refresh` — refresh all GitLab contributions
- `/api/gitlab/contributions/:username/refresh` — refresh single user
- `/api/trends/jira/refresh` — refresh Jira trends
- `/api/trends/github/refresh` — refresh GitHub history
- `/api/trends/gitlab/refresh` — refresh GitLab history
- `/api/admin/roster-sync/config` — save roster sync configuration
- `/api/admin/roster-sync/trigger` — trigger manual roster sync
- `/api/allowlist` — update authorized email list
