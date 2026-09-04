# Jira Autofix reporting methodology

The Jira Autofix report keeps two cohorts separate.

## Gross policy cohort

The gross cohort query selects `type = Bug` in configured Autofix projects. It
excludes only deterministic issue markers that are observable without mutable
workflow state:

- `summary !~ "CVE-"`
- label `CVE`
- `summary !~ "EMBARGOED"`
- security level `Embargoed Security Issue`

It does not exclude closed or resolved tickets, `no-autofix`, or
`auto-created`. A ticket can have been eligible before it was closed or a
mutable opt-out label was added. The gross denominator therefore includes
those tickets and supports detection of work missed before pickup.

The report also exposes a current non-excluded snapshot. This snapshot removes
current `no-autofix`, `auto-created`, and `CVE` labels from the gross result.
It is a current-state diagnostic, not a historical eligibility denominator.

The query can be scoped with `autofixComponents`. When no component scope is
configured, the report marks the project-wide result as a non-authoritative
fallback because component-level policy ownership is unavailable.

## Pipeline cohort

The existing label query remains separate. It counts issues carrying a Jira
Autofix or triage label, including `jira-autofix-stale`. The ready share is
named `Pipeline-ready Share`; it is not an eligibility rate. Jira labels are
mutable and do not prove that a ticket passed policy gates at a historical
time.

## Lifecycle funnel

The report displays eligible, analyzed, PR proposed, and PR merged stages. It
also displays abandonment (stale, rejected, and max-retry outcomes) separately
from blocked workflow friction, with conversion rates between nested stages.

The preferred source is the immutable Autofix lifecycle outcome contract from
AIPCC-31384. This repository consumes canonical event fields only. It does not
copy or own that schema. Until the producer and contract MR land, the report
uses gross Jira cohort data, Jira pipeline labels, and Forge API responses as
proxy evidence and marks the funnel non-authoritative.

Event rows do not imply complete ingestion. The funnel is authoritative only
when the snapshot explicitly sets `outcomeEventsComplete` and the event source
provides canonical events for the reporting window. The API reports malformed
and out-of-window event counts separately.

Project, issue-type, and component filters are currently client-side and do not
receive the gross cohort rows. The UI therefore hides the funnel while one of
those filters is active instead of presenting unfiltered counts as team-level
results.

Forge proposal or merge evidence is verified only when an Autofix Jira comment
contains a GitHub PR or GitLab MR URL and the existing Forge client fetches its
status. A Jira link without a fetched status is an unverified lower bound. A
Jira label alone is not Forge verification.
