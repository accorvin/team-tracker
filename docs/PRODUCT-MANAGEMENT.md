# Org Pulse — Product Management Plan

**Product:** Org Pulse (AI Engineering Team Tracker)
**Product Owner:** [Your Name]
**Last Updated:** April 16, 2026
**Status:** Living Document

---

## Table of Contents

1. [Product Vision & Strategy](#1-product-vision--strategy)
2. [User Personas](#2-user-personas)
3. [Module Persona Matrix](#3-module-persona-matrix)
4. [Feature Backlog Management](#4-feature-backlog-management)
5. [Feedback Collection Framework](#5-feedback-collection-framework)
6. [Cadenced Meetings](#6-cadenced-meetings)
7. [RACI Chart](#7-raci-chart)
8. [Roadmap & Release Planning](#8-roadmap--release-planning)
9. [Success Metrics & KPIs](#9-success-metrics--kpis)
10. [Appendix — Module Inventory](#10-appendix--module-inventory)

---

## 1. Product Vision & Strategy

### Vision Statement

Enable AI Platform engineering leadership to make data-driven decisions about team health, delivery performance, and organizational effectiveness through a single, unified internal dashboard.

### Problem Statement

Engineering managers and leaders across the AI Platform org lack a unified view of delivery metrics, team composition, allocation patterns, and upstream contributions. Information is scattered across Jira, GitHub, GitLab, Google Sheets, and tribal knowledge, making it difficult to identify bottlenecks, track trends, and plan effectively.

### Strategic Pillars

| Pillar | Description |
|--------|-------------|
| **Visibility** | Surface delivery and organizational data that is currently buried across tools |
| **Actionability** | Present metrics in context so leaders can act, not just observe |
| **Modularity** | Allow teams to opt into the modules that matter to them without forced adoption |
| **Trust** | Ensure data accuracy, transparent methodology, and privacy-aware design |

### Product Principles

1. **Metrics inform, not punish.** Org Pulse is a leadership tool, not a surveillance tool. All metrics are team-oriented, not used for individual performance reviews.
2. **Sensible defaults, full configurability.** Every module works out of the box but can be tuned via Settings.
3. **Data stays internal.** All data is stored on-prem (OpenShift PVC); no external SaaS dependencies for storage.
4. **Modular by design.** Modules can be enabled/disabled independently. New modules can be added without touching the core shell.

---

## 2. User Personas

### Persona 1: **Engineering Director / VP — "The Strategist"**

| Attribute | Detail |
|-----------|--------|
| **Role** | Senior engineering leader (Director/VP level) |
| **Goal** | Understand org-wide delivery health, staffing balance, and strategic alignment at a glance |
| **Pain Points** | Needs cross-team visibility without digging into Jira boards; wants trend data to present in leadership meetings; frustrated by manual spreadsheet aggregation |
| **Key Modules** | Team Tracker (Trends, Dashboard), Org Roster (Org Dashboard), AI Impact, Release Analysis |
| **Frequency** | Weekly check-ins; deep dives before quarterly planning |
| **Success Criteria** | Can answer "How is my org performing?" in under 2 minutes |

### Persona 2: **Engineering Manager — "The Coach"**

| Attribute | Detail |
|-----------|--------|
| **Role** | First-line or second-line engineering manager |
| **Goal** | Monitor their team's sprint delivery, identify bottlenecks, and ensure balanced allocation |
| **Pain Points** | Sprint reports in Jira are noisy; difficult to see cross-platform (Jira + GitHub) contributions; allocation tracking is manual |
| **Key Modules** | Team Tracker (People, Dashboard, Reports), Allocation Tracker, Org Roster (Team Directory) |
| **Frequency** | Daily glances; detailed review at sprint boundaries |
| **Success Criteria** | Can identify blocked team members and allocation imbalances within a single view |

### Persona 3: **Scrum Master / Delivery Lead — "The Operator"**

| Attribute | Detail |
|-----------|--------|
| **Role** | Scrum master, agile coach, or delivery lead |
| **Goal** | Track sprint health, velocity trends, and delivery risks for their teams |
| **Pain Points** | Jira dashboards lack historical context; cross-team dependency visibility is poor; manual burndown tracking |
| **Key Modules** | Team Tracker (Trends, Reports), Allocation Tracker, Feature Traffic |
| **Frequency** | Daily during sprints; intensive during planning and retrospectives |
| **Success Criteria** | Can generate sprint-over-sprint comparison data without manual spreadsheet work |

### Persona 4: **Program Manager — "The Planner"**

| Attribute | Detail |
|-----------|--------|
| **Role** | Program or release manager coordinating across teams |
| **Goal** | Track feature delivery against release timelines; understand upstream dependencies |
| **Pain Points** | Feature progress is scattered across Jira epics and GitLab pipelines; release readiness requires manual aggregation; upstream contribution impact is opaque |
| **Key Modules** | Release Analysis, Feature Traffic, Upstream Pulse, AI Impact |
| **Frequency** | Weekly; daily during release windows |
| **Success Criteria** | Can assess release readiness and identify at-risk features from a single dashboard |

### Persona 5: **BU Product Manager — "The Compass"**

| Attribute | Detail |
|-----------|--------|
| **Role** | Business Unit product manager responsible for product strategy, customer requirements, and go-to-market alignment |
| **Goal** | Validate that engineering investment aligns with customer-facing product priorities; track whether the right features are being built at the right pace; use delivery data to inform release commitments and stakeholder updates |
| **Pain Points** | Disconnected from day-to-day engineering throughput; relies on status meetings and slide decks to understand delivery progress; cannot independently verify whether sprint work maps to strategic features; release forecasting is gut-feel rather than data-driven; AI adoption metrics are not tied back to product value |
| **Key Modules** | Release Analysis (release readiness, velocity, component breakdown), AI Impact (AI adoption tied to strategic features), Feature Traffic (feature delivery progress against plan), Team Tracker (Trends — velocity and throughput over time), Org Roster (Org Dashboard — understand team structure and ownership) |
| **Frequency** | Weekly review of release and feature dashboards; deep dives during release planning, PI planning, and quarterly business reviews |
| **Success Criteria** | Can independently answer "Are we on track for the next release?" and "Is engineering investment aligned with product priorities?" without scheduling a meeting |

#### How BU Product Management Uses Org Pulse

| Use Case | Module(s) | What They Get |
|----------|-----------|---------------|
| **Release readiness check** | Release Analysis | Component-level completion status, velocity trends, and at-risk areas — replaces manual release status slide decks |
| **Feature delivery tracking** | Feature Traffic | Real-time view of which strategic features are progressing through the pipeline and which are stalled |
| **Investment alignment** | AI Impact | Quantified view of AI adoption across the delivery pipeline, linked back to strategic features (RHAISTRAT), proving ROI of AI investment to BU leadership |
| **Velocity & predictability** | Team Tracker (Trends) | Historical velocity data to make evidence-based release commitments instead of optimistic guesses |
| **Capacity vs. priority audit** | Allocation Tracker | Verify that the 40-40-20 allocation model reflects product priorities — flag when too much capacity goes to unplanned work or tech debt at the expense of customer features |
| **Stakeholder reporting** | Team Tracker (Dashboard), Release Analysis | Pull pre-built metrics into quarterly business reviews, executive updates, and customer-facing release communications |
| **Team & ownership clarity** | Org Roster (Org Dashboard) | Understand which teams own which components and who to engage for specific product areas — critical during cross-team feature planning |
| **Upstream dependency awareness** | Upstream Pulse | Gauge upstream OSS contribution health for components that depend on community projects — early warning if upstream engagement drops |

#### Key Workflows for Product Management

**1. Weekly Release Pulse (15 min)**
Open Release Analysis → review velocity trend → check component breakdown for red flags → cross-reference with Feature Traffic for strategic feature progress → update release confidence score in planning doc.

**2. Quarterly Business Review Prep (30 min)**
Pull AI Impact metrics for AI adoption narrative → export Team Tracker trends for throughput story → use Release Analysis velocity to project next quarter's delivery capacity → combine into executive summary.

**3. PI / Release Planning Input (ongoing)**
Use Team Tracker historical velocity to set realistic sprint commitments → review Allocation Tracker to negotiate capacity split with engineering → validate feature sequencing against Feature Traffic dependencies.

### Persona 6: **Platform Admin — "The Maintainer"**

| Attribute | Detail |
|-----------|--------|
| **Role** | Tool administrator responsible for Org Pulse deployment and configuration |
| **Goal** | Keep Org Pulse running, manage access, configure integrations, and onboard new teams |
| **Pain Points** | Managing credentials (Jira, GitHub, GitLab, Google SA); debugging data sync issues; onboarding new org trees |
| **Key Modules** | Settings (all tabs), Must-Gather diagnostics, API token management |
| **Frequency** | As needed; weekly health checks |
| **Success Criteria** | Can diagnose and resolve sync issues in under 15 minutes; zero unplanned downtime |

### Persona 7: **API Consumer — "The Automator"**

| Attribute | Detail |
|-----------|--------|
| **Role** | Developer or CI system consuming Org Pulse data programmatically |
| **Goal** | Pull metrics data into custom dashboards, reports, or automation pipelines |
| **Pain Points** | Needs stable, documented API endpoints; token-based auth for non-interactive use |
| **Key Modules** | API Docs (`/api/docs`), API Tokens, all module REST endpoints |
| **Frequency** | Automated (scheduled jobs) |
| **Success Criteria** | Stable API contract; clear Swagger documentation; no breaking changes without notice |

---

## 3. Module Persona Matrix

Which personas care about which modules and how much (H = High, M = Medium, L = Low, — = Not relevant).

| Module | The Strategist | The Coach | The Operator | The Planner | The Compass (BU PM) | The Maintainer | The Automator |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Team Tracker** | H | H | H | M | H | L | H |
| **Org Roster** | H | H | M | M | M | H | M |
| **AI Impact** | H | M | L | H | H | L | M |
| **Release Analysis** | H | L | M | H | H | L | M |
| **Feature Traffic** | M | L | M | H | H | L | H |
| **Allocation Tracker** | M | H | H | L | M | L | M |
| **Upstream Pulse** | M | L | L | H | L | L | M |
| **Settings / Admin** | — | — | — | — | — | H | L |

---

## 4. Feature Backlog Management

### 4.1 Backlog Structure

The feature backlog is organized in a **three-tier hierarchy**:

```
Theme (strategic initiative)
  └── Epic (large deliverable, typically spanning 2-4 sprints)
       └── Story / Task (implementable unit, fits in a single sprint)
```

### 4.2 Backlog Categories

Every backlog item is tagged with one of the following categories:

| Category | Description | Target % of Capacity |
|----------|-------------|---------------------|
| **New Feature** | Net-new module or capability | 40% |
| **Enhancement** | Improvement to an existing module | 25% |
| **Tech Debt** | Refactoring, performance, test coverage | 15% |
| **Bug Fix** | Defect resolution | 10% |
| **Ops / Infra** | Deployment, CI/CD, monitoring improvements | 10% |

### 4.3 Backlog Intake Process

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Idea / Need │────▶│   Triage     │────▶│  Refinement  │────▶│  Sprint      │
│  Submitted   │     │  (Weekly)    │     │  (Bi-weekly) │     │  Planning    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Step 1 — Submission:** Anyone can submit a feature request via:
- GitHub Issues on the `rhai-org-pulse` repository (preferred)
- Slack channel `#org-pulse-feedback`
- Direct conversation captured in meeting notes

**Step 2 — Triage (Weekly):** Product Owner reviews new submissions every Monday and:
- Assigns a category (feature / enhancement / bug / tech debt / ops)
- Sets initial priority (P0-Critical through P3-Nice-to-Have)
- Tags the relevant module(s)
- Moves to "Needs Refinement" or "Ready" if small enough

**Step 3 — Refinement (Bi-weekly):** Product Owner + Tech Lead refine items:
- Break epics into stories
- Define acceptance criteria
- Estimate story points (1, 2, 3, 5, 8, 13 Fibonacci scale)
- Identify dependencies and risks

**Step 4 — Sprint Planning:** Refined items are pulled into the sprint backlog based on priority and capacity.

### 4.4 Prioritization Framework — RICE Score

Each feature is scored using the **RICE** framework:

| Factor | Definition | Scale |
|--------|-----------|-------|
| **R**each | How many users / teams will this affect per quarter? | Number of impacted users |
| **I**mpact | How much will this move the needle per user? (3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal) | 0.25 – 3 |
| **C**onfidence | How confident are we in R, I, and effort estimates? | 100% / 80% / 50% |
| **E**ffort | Person-sprints to deliver | Number |

**RICE Score = (Reach × Impact × Confidence) / Effort**

Items are stack-ranked by RICE score within each category. Product Owner retains override authority for strategic alignment.

### 4.5 Backlog Hygiene

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Triage new items | Weekly (Monday) | Product Owner |
| Groom / refine top 10 items | Bi-weekly (alternate Wednesdays) | Product Owner + Tech Lead |
| Archive stale items (no activity > 90 days) | Monthly | Product Owner |
| Full backlog review & re-prioritize | Quarterly | Product Owner + Stakeholders |
| Remove duplicates, merge related items | Ongoing | Product Owner |

---

## 5. Feedback Collection Framework

### 5.1 Feedback Channels

| Channel | Type | Audience | Frequency | Owner |
|---------|------|----------|-----------|-------|
| **GitHub Issues** | Structured | All users | Ongoing | Product Owner triages |
| **Slack #org-pulse-feedback** | Informal | All users | Ongoing | Product Owner monitors |
| **Monthly User Survey** | Quantitative | All active users | Monthly | Product Owner sends |
| **Stakeholder 1:1s** | Qualitative | Directors, VPs | Quarterly | Product Owner schedules |
| **Sprint Demo Feedback** | Live | Sprint demo attendees | Every sprint | Scrum Master captures |
| **Dogfooding Sessions** | Observational | Internal team | Monthly | Product Owner facilitates |
| **Must-Gather / Bug Reports** | Diagnostic | Admins, power users | As needed | Admin submits, Dev triages |

### 5.2 Monthly User Survey Template

A lightweight 5-question survey sent to all active users:

1. **Overall Satisfaction:** How satisfied are you with Org Pulse this month? (1-5 scale)
2. **Most Valuable Module:** Which module provided the most value? (dropdown)
3. **Biggest Pain Point:** What frustrated you most? (free text)
4. **Missing Feature:** What one feature would you most like to see? (free text)
5. **NPS:** How likely are you to recommend Org Pulse to a colleague? (0-10)

Results are aggregated monthly and reviewed in the Monthly Product Review.

### 5.3 Feedback-to-Backlog Pipeline

```
Feedback Received
       │
       ▼
  Is it actionable?  ──No──▶  Archive with tag "noted"
       │
      Yes
       │
       ▼
  Matches existing item?  ──Yes──▶  Add +1 vote, link feedback
       │
       No
       │
       ▼
  Create new backlog item
  (auto-tagged "user-feedback")
       │
       ▼
  Enters Triage pipeline
```

### 5.4 Closing the Loop

Every piece of feedback that results in a shipped feature triggers a **close-the-loop** notification:
- Reply to the original GitHub issue with the release version
- Post in `#org-pulse-feedback` tagging the requester
- Include in the next Monthly Update email

---

## 6. Cadenced Meetings

### 6.1 Meeting Calendar

| Meeting | Cadence | Duration | Day/Time | Attendees | Purpose |
|---------|---------|----------|----------|-----------|---------|
| **Daily Standup** | Daily | 15 min | Mon–Fri, 10:00 AM | Dev Team, Scrum Master | Blockers, progress, plan for today |
| **Sprint Planning** | Bi-weekly | 90 min | Sprint Day 1, 10:30 AM | Product Owner, Dev Team, Scrum Master | Commit to sprint scope |
| **Backlog Refinement** | Bi-weekly | 60 min | Alternate Wednesdays, 2:00 PM | Product Owner, Tech Lead, Senior Devs | Break down, estimate, and clarify upcoming work |
| **Sprint Review / Demo** | Bi-weekly | 45 min | Sprint Last Day, 2:00 PM | Product Owner, Dev Team, Stakeholders | Demo completed work, collect feedback |
| **Sprint Retrospective** | Bi-weekly | 45 min | Sprint Last Day, 3:00 PM | Dev Team, Scrum Master, Product Owner | Process improvement |
| **Weekly Triage** | Weekly | 30 min | Monday, 9:30 AM | Product Owner, Tech Lead | Triage new issues, bugs, feedback |
| **Monthly Product Review** | Monthly | 60 min | First Thursday, 11:00 AM | Product Owner, Tech Lead, Key Stakeholders | Review metrics, survey results, roadmap adjustments |
| **Quarterly Planning** | Quarterly | 3 hours | First week of quarter | Product Owner, Dev Team, Directors | Set quarterly OKRs, theme priorities, capacity planning |
| **Stakeholder 1:1** | Quarterly | 30 min | Scheduled individually | Product Owner + each Director/VP | Deep-dive on their needs, satisfaction, strategic input |

### 6.2 Meeting Artifacts

| Meeting | Input Artifacts | Output Artifacts |
|---------|----------------|-----------------|
| Sprint Planning | Refined backlog, velocity chart, capacity | Sprint backlog, sprint goal |
| Backlog Refinement | Raw backlog items, feedback log | Refined stories with acceptance criteria and estimates |
| Sprint Review | Working software, sprint goal | Demo recording, stakeholder feedback notes |
| Retrospective | Previous action items, sprint data | Action items with owners and deadlines |
| Weekly Triage | New GitHub issues, Slack feedback, bugs | Triaged and categorized items in backlog |
| Monthly Product Review | Survey results, usage analytics, roadmap | Updated roadmap, priority adjustments |
| Quarterly Planning | OKR proposals, RICE-scored backlog, capacity | Quarterly themes, committed epics, updated roadmap |

---

## 7. RACI Chart

### 7.1 Core Product Activities

| Activity | Product Owner | Tech Lead | Dev Team | Scrum Master | Stakeholders (Directors/VPs) | Platform Admin |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| **Product Vision & Strategy** | A | C | I | I | C | I |
| **Roadmap Planning** | A/R | C | I | I | C | I |
| **Backlog Prioritization** | A/R | C | I | I | C | — |
| **Feature Specification** | A/R | C | C | I | I | — |
| **Backlog Refinement** | A | R | R | C | — | — |
| **Sprint Planning** | A | C | R | R | — | — |
| **Sprint Execution** | I | R | R | C | — | — |
| **Code Review** | — | A | R | — | — | — |
| **Testing** | I | A | R | — | — | — |
| **Sprint Demo** | A | C | R | R | I | — |
| **Sprint Retrospective** | C | C | R | A/R | — | — |
| **Release / Deployment** | A | R | R | I | I | C |
| **User Feedback Collection** | A/R | I | I | C | C | I |
| **Stakeholder Communication** | A/R | C | — | I | I | — |
| **Incident Response** | I | A | R | — | I | R |
| **Platform Admin / Ops** | I | C | C | — | — | A/R |
| **Access / Allowlist Mgmt** | A | — | — | — | I | R |
| **Integration Config (Jira/GH/GL)** | C | A | R | — | — | R |
| **Data Privacy & Security** | A | R | R | — | I | C |
| **Documentation** | A | R | R | — | I | C |

**Legend:** **R** = Responsible (does the work) | **A** = Accountable (owns the outcome) | **C** = Consulted | **I** = Informed

### 7.2 Per-Module RACI

| Decision Area | Product Owner | Module Dev Lead | Platform Admin |
|---------------|:-:|:-:|:-:|
| Enable / disable module for org | A | C | R |
| Module feature prioritization | A/R | C | — |
| Module data schema changes | C | A/R | I |
| Module API contract changes | A | R | I |
| Module integration credentials | I | C | A/R |
| Module-specific settings UI | C | A/R | I |
| Module export / must-gather hooks | I | A/R | C |

---

## 8. Roadmap & Release Planning

### 8.1 Release Cadence

| Type | Cadence | Scope | Communication |
|------|---------|-------|---------------|
| **Sprint Release** | Bi-weekly (end of sprint) | Completed stories from sprint | Sprint demo + release notes in Slack |
| **Minor Release** | Monthly | Aggregated sprint releases + polish | Monthly product update email |
| **Major Release** | Quarterly | New modules, breaking changes, major features | Stakeholder briefing + announcement |

### 8.2 Roadmap Horizons

| Horizon | Timeframe | Granularity | Commitment Level |
|---------|-----------|-------------|-----------------|
| **Now** | Current sprint | Stories with acceptance criteria | Committed |
| **Next** | Next 1–2 sprints | Refined epics / stories | High confidence |
| **Later** | This quarter | Themes and epics | Medium confidence |
| **Future** | Next quarter+ | Themes only | Exploratory |

### 8.3 Current Module Maturity & Focus Areas

| Module | Maturity | Current Quarter Focus |
|--------|----------|----------------------|
| **Team Tracker** | Stable | Trend enhancements, snapshot reliability, GitLab multi-instance polish |
| **Org Roster** | Stable | RFE backlog integration improvements, Google Sheets config flexibility |
| **AI Impact** | Growing | Strategic feature linkage depth, AI classification accuracy |
| **Release Analysis** | Growing | Product Pages OAuth hardening, velocity view customization |
| **Feature Traffic** | Growing | GitLab artifact pipeline reliability, filtering UX |
| **Allocation Tracker** | Early | Onboarding more teams, 40-40-20 model refinement |
| **Upstream Pulse** | Early | Proxy stability, caching improvements, standalone-to-module migration |

---

## 9. Success Metrics & KPIs

### 9.1 Product Health Metrics

| Metric | Target | Measurement Method | Review Cadence |
|--------|--------|-------------------|----------------|
| **Monthly Active Users (MAU)** | 80% of target org | Auth proxy logs | Monthly |
| **Weekly Active Users (WAU)** | 50% of target org | Auth proxy logs | Weekly |
| **User Satisfaction (CSAT)** | ≥ 4.0 / 5.0 | Monthly survey | Monthly |
| **NPS** | ≥ 40 | Monthly survey | Monthly |
| **Module Adoption** | ≥ 3 modules enabled per deployment | Module state config | Quarterly |
| **Time to Insight** | < 2 min to answer a delivery question | Dogfooding observation | Quarterly |

### 9.2 Engineering Health Metrics

| Metric | Target | Measurement Method | Review Cadence |
|--------|--------|-------------------|----------------|
| **Sprint Velocity** | Stable ± 15% | Story points completed | Per sprint |
| **Bug Escape Rate** | < 2 P0/P1 bugs per sprint | GitHub issues | Per sprint |
| **Data Freshness** | Jira/GH sync < 4 hours stale | Sync timestamps | Weekly |
| **Uptime** | 99.5% | OpenShift monitoring | Monthly |
| **Test Coverage** | > 70% for shared/, > 50% for modules | Vitest coverage report | Per sprint |
| **Lint Pass Rate** | 100% on merge | CI | Continuous |

### 9.3 Stakeholder Value Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Replaced Manual Reports** | ≥ 3 recurring manual reports per quarter | Stakeholder 1:1 feedback |
| **Decision Speed** | Leadership can make data-backed decisions in meetings without pre-work | Qualitative (quarterly survey) |
| **Onboarding Time** | New team fully onboarded in < 1 day | Admin tracking |

---

## 10. Appendix — Module Inventory

### Active Modules (Default On)

| Module | Slug | Key Views | Data Sources | Key Env Vars |
|--------|------|-----------|--------------|-------------|
| Team Tracker | `team-tracker` | Dashboard, People, Trends, Reports | Jira, GitHub, GitLab | `JIRA_*`, `GITHUB_TOKEN`, `GITLAB_*` |
| Org Roster | `org-roster` | Team Directory, Org Dashboard | LDAP, Google Sheets, Jira RFE | `GOOGLE_SERVICE_ACCOUNT_*` |
| AI Impact | `ai-impact` | AI Metrics, Trends | Jira (RHAIRFE labels, RHAISTRAT links) | `JIRA_*` |
| Release Analysis | `release-analysis` | Release View, Velocity, Components | Jira, Product Pages | `PRODUCT_PAGES_*`, `RELEASE_ANALYSIS_*` |
| Feature Traffic | `feature-traffic` | Feature Index, Feature Detail | GitLab CI artifacts | `FEATURE_TRAFFIC_GITLAB_TOKEN` |

### Optional Modules (Default Off)

| Module | Slug | Key Views | Data Sources | Key Env Vars |
|--------|------|-----------|--------------|-------------|
| Allocation Tracker | `allocation-tracker` | Allocation Dashboard | Jira boards/sprints | `JIRA_*` |
| Upstream Pulse | `upstream-pulse` | Contributions Dashboard | External Upstream Pulse API | `UPSTREAM_PULSE_API_URL` |

### External (Git-Static) Modules

Admins can register additional modules via Settings that are cloned from Git repositories and rendered in an iframe. These are managed through the admin UI and stored in `data/modules-state.json`.

---

## Document Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-04-16 | 1.0 | [Your Name] | Initial creation |

---

*This is a living document. It should be reviewed and updated at every Quarterly Planning session and whenever significant process changes occur.*
