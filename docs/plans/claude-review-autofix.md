# Claude Code Review Autofix — Implementation Plan

## Overview

Update the Claude code review GitHub Action (`.github/workflows/claude-review.yml`) to automatically push fixes for issues it finds during PR reviews. Currently the workflow is read-only; this change gives Claude write access to edit files and push commits in a single review pass.

## Requirements (gathered from user)

| Decision | Choice |
|----------|--------|
| Trigger | Automatic on every PR review |
| Fix scope | All fixable issues (bugs, style, security, performance) |
| Delivery | Push commits directly to the PR branch |
| Safeguards | Minimal guardrails — trust PR author to review the commit |
| Fork PRs | ~~Read-only review~~ Not feasible (see Design Decisions) — keep current behavior of skipping forks |
| Architecture | Single pass — review and fix in one step |

## Current State

The workflow at `.github/workflows/claude-review.yml`:
- Uses `anthropics/claude-code-action@v1` with Vertex AI (GCP)
- Triggers on PR open/synchronize/reopened, `@claude` comments, workflow_dispatch
- Read-only tools: `Read, Glob, Grep, gh pr comment/diff/view, mcp__github_inline_comment__create_inline_comment`
- Skips fork PRs entirely (line 31: `head.repo.full_name == github.repository`)
- Permissions already include `contents: write`
- `continue-on-error: true`
- `actions/checkout@v4` with `persist-credentials: true` (default) — stores GITHUB_TOKEN in local git config, enabling `git push`

## Design Decisions

### Fork PRs: Keep skipping entirely

The original user request was "review forks read-only, skip autofix." However, this is **not feasible** with the current architecture:

- GitHub Actions does **not expose repository secrets** to workflows triggered by `pull_request` events from forks (security measure)
- `secrets.GCP_SA_KEY` would be empty → the "Authenticate to Google Cloud" step would **fail** before Claude starts
- Without Vertex AI credentials, Claude cannot run at all — not even for read-only review

**Decision**: Keep the existing `head.repo.full_name == github.repository` check in the `if` condition. Fork PRs from `pull_request` events are skipped entirely.

**Exception — `issue_comment` trigger**: The `issue_comment` event runs in the base repo context, so secrets ARE available even on fork PRs. If someone comments `@claude` on a fork PR, the workflow runs. The prompt handles this by detecting fork status dynamically via `gh pr view --json isCrossRepository` and performing a read-only review (no file edits, commits, or pushes). This prevents Claude from inadvertently pushing a fork branch to origin.

### GITHUB_TOKEN pushes do not trigger CI

This is a critical GitHub Actions behavior: **events triggered by GITHUB_TOKEN do not create new workflow runs.** This means:

1. **No infinite loop risk** — When Claude pushes a fix commit, the `synchronize` event fires but no workflows run. The `github.actor != 'github-actions[bot]'` check is retained as defense-in-depth but is not the primary protection.

2. **CI won't run on autofix commits** — The required "Test & Build" status check from `ci.yml` will NOT update for the new HEAD. This means:
   - If branch protection uses "Require branches to be up to date before merging" (strict mode), the PR could get stuck with a pending check on the autofix commit
   - The PR author may need to push a trivial change or re-run CI manually

3. **Mitigation** — Claude is instructed to run `npm test` before pushing to validate its fixes locally. This doesn't update the GitHub status check, but ensures the fix isn't broken. The PR author can re-run CI if needed.

**Alternative considered**: Using `GH_PAT` instead of GITHUB_TOKEN for checkout would make PAT-triggered pushes fire CI. However, this reintroduces infinite loop risk — the `github.actor` would be the PAT owner's username (not `github-actions[bot]`), so the actor check wouldn't prevent re-triggers. This approach was rejected as too risky.

## Implementation Plan

### 1. Keep the `if` condition unchanged for `pull_request` fork PRs

The existing `full_name == github.repository` check stays for `pull_request` events. Fork PRs remain skipped because secrets are unavailable for fork-triggered workflows.

Note: The `issue_comment` trigger does NOT have this guard and runs in the base repo context (secrets are available). If someone comments `@claude` on a fork PR, the workflow runs. The prompt handles this by detecting fork PRs dynamically via `gh pr view --json isCrossRepository` and skipping autofix (see step 5 below).

### 2. Expand the allowed tools

**Current** `claude_args`:
```
--allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*),Read,Glob,Grep"
```

**New** — add `Edit`, `Write`, and git/gh CLI tools for pushing:
```
--allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*),Bash(gh pr checkout:*),Bash(git add:*),Bash(git commit:*),Bash(git push origin:*),Bash(git diff:*),Bash(git status:*),Bash(npm test:*),Bash(npm run lint:*),Read,Glob,Grep,Edit,Write"
```

Key additions:
- `Edit` / `Write` — modify source files
- `Bash(gh pr checkout:*)` — check out the PR branch locally (handles branch switching for all trigger types)
- `Bash(git add:*)`, `Bash(git commit:*)` — stage and commit fixes
- `Bash(git push origin:*)` — push fixes (scoped to `origin` to prevent pushing to arbitrary remotes; prompt constrains to `git push origin HEAD` only and forbids force push)
- `Bash(git diff:*)`, `Bash(git status:*)` — inspect working tree state
- `Bash(npm test:*)`, `Bash(npm run lint:*)` — validate fixes before pushing

Removed from previous draft:
- `Bash(git checkout:*)` — unnecessary since `gh pr checkout` is used, and `git checkout` could discard changes (`git checkout -- .`) or switch to unintended branches

### 3. Add Node.js setup and dependency install

The workflow needs Node.js and dependencies installed for `npm test` and `npm run lint` to work. Without this, Claude might misinterpret npm failures as code problems and make spurious fix commits.

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'

- name: Install dependencies
  run: npm ci
```

### 4. Configure git identity

Add a step after checkout to set git user for commits:

```yaml
- name: Configure git identity
  run: |
    git config user.name "claude-code-review[bot]"
    git config user.email "claude-code-review[bot]@users.noreply.github.com"
```

### 5. Update the prompt

Replace the current prompt with an expanded version that instructs Claude to fix issues, validate, and push commits. Key prompt design decisions:

- **`gh pr checkout`** handles branch switching for all trigger types (PR events, issue_comment, workflow_dispatch). No `ref` parameter needed on the checkout step.
- **Fork detection for `issue_comment`** — The `if` condition only guards `pull_request` events from forks. The `issue_comment` trigger runs in the base repo context (secrets available), so if someone comments `@claude` on a fork PR, Claude runs. The prompt detects this via `gh pr view --json isCrossRepository` and skips autofix to prevent pushing an unexpected branch to origin.
- **`git add -u`** instead of `git add -A` to avoid staging unintended files (temp files, build artifacts). Only tracks modifications to already-tracked files.
- **`npm test` before pushing** to validate fixes since CI won't run on GITHUB_TOKEN-pushed commits.
- **`workflow_dispatch`** handled gracefully — Claude exits if no PR number is available.

See the complete workflow YAML below for the full prompt text.

### 6. Keep `continue-on-error: true`

Keep `continue-on-error: true` so that review failures don't block the PR status check. The "Test & Build" job is the required check, not this one.

## Files Modified

| File | Change |
|------|--------|
| `.github/workflows/claude-review.yml` | All changes described above |

This is a single-file change.

## Complete Updated Workflow

```yaml
name: Claude Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths-ignore:
      - 'docs/**'
      - '*.md'
      - 'deploy/openshift/overlays/*/kustomization.yaml'
  issue_comment:
    types: [created]
  workflow_dispatch:

concurrency:
  group: claude-review-${{ github.event_name }}-${{ github.event.pull_request.number || github.event.issue.number || github.run_id }}
  cancel-in-progress: true

permissions:
  contents: write
  pull-requests: write
  issues: write
  id-token: write

jobs:
  claude-review:
    name: Claude Review
    timeout-minutes: 20
    if: |
      (github.event_name == 'pull_request' &&
       github.event.pull_request.head.repo.full_name == github.repository &&
       github.event.pull_request.draft != true &&
       github.actor != 'github-actions[bot]') ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       contains(github.event.comment.body, '@claude') &&
       github.event.comment.author_association != 'NONE' &&
       github.event.comment.author_association != 'FIRST_TIMER' &&
       github.event.comment.author_association != 'FIRST_TIME_CONTRIBUTOR') ||
      (github.event_name == 'workflow_dispatch')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Configure git identity
        run: |
          git config user.name "claude-code-review[bot]"
          git config user.email "claude-code-review[bot]@users.noreply.github.com"

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Claude Code Review
        uses: anthropics/claude-code-action@v1
        continue-on-error: true
        with:
          use_vertex: "true"
          track_progress: true
          display_report: "true"
          claude_args: '--model claude-opus-4-6 --allowedTools "mcp__github_inline_comment__create_inline_comment,Bash(gh pr comment:*),Bash(gh pr diff:*),Bash(gh pr view:*),Bash(gh pr checkout:*),Bash(git add:*),Bash(git commit:*),Bash(git push origin:*),Bash(git diff:*),Bash(git status:*),Bash(npm test:*),Bash(npm run lint:*),Read,Glob,Grep,Edit,Write"'
          prompt: |
            REPO: ${{ github.repository }}
            PR NUMBER: ${{ github.event.pull_request.number || github.event.issue.number }}

            You are reviewing a pull request. Your job is to:

            1. **Determine PR context**:
               - If no PR number is available (e.g., workflow_dispatch without context),
                 post a comment explaining that no PR was found and exit.
               - Run `gh pr view <PR_NUMBER> --json isCrossRepository` to check if
                 this is a fork PR. If `isCrossRepository` is true, do a **read-only
                 review only** — post comments but do NOT edit files, commit, or push.
               - Run `gh pr checkout <PR_NUMBER>` to switch to the PR branch.

            2. **Review** the PR diff for:
               - Code quality and maintainability
               - Security vulnerabilities (OWASP top 10, injection, XSS, etc.)
               - Potential bugs and edge cases
               - Adherence to project conventions (see CLAUDE.md)
               - Performance concerns

            3. **Fix** any issues you find by editing the files directly:
               - Use Edit/Write tools to modify the source files
               - Fix all issues you're confident about: bugs, style, security, performance
               - After making all fixes, validate them:
                 ```
                 npm test
                 npm run lint
                 ```
               - If tests or lint fail due to your changes, fix the issues or revert
                 your changes to that file
               - Only commit and push if you actually made changes and tests pass:
                 ```
                 git add -u
                 git diff --cached --quiet || git commit -m "fix: Claude code review autofix

                 <concise summary of changes>"
                 git push origin HEAD
                 ```

            4. **Report** your findings:
               - Use inline comments for issues you found (whether or not you fixed them)
               - Post a top-level PR comment summarizing:
                 - Issues found and fixed (with brief descriptions)
                 - Issues found but NOT fixed (with explanations of why)
                 - If no issues were found, say so briefly
               - NOTE: CI (the "Test & Build" check) will NOT automatically run on
                 your autofix commit. Mention this in your summary so the PR author
                 knows to re-run CI if needed.

            **Important rules:**
            - Never force push. Only push to the current PR branch via `git push origin HEAD`.
            - Use `git add -u` (not `git add -A`) to avoid staging untracked files.
            - Be concise. Focus on actionable feedback. Don't nitpick style unless
              it impacts readability.
            - Only fix things you're confident about. If a fix is ambiguous or
              subjective, comment instead of changing code.
            - Do not modify files outside the scope of the PR unless necessary to
              fix an issue (e.g., a missing import in another file).
        env:
          ANTHROPIC_VERTEX_PROJECT_ID: "itpc-gcp-ai-eng-claude"
          CLOUD_ML_REGION: "us-east5"
          CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1"
          DISABLE_PROMPT_CACHING: "1"
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Claude pushes broken code | Claude runs `npm test` and `npm run lint` before pushing. `continue-on-error: true` means the review step never blocks merging. PR author reviews the autofix commit. |
| Infinite loop (autofix triggers `synchronize`) | **Primary**: GitHub's built-in policy — GITHUB_TOKEN-triggered events do not create new workflow runs. **Secondary**: `github.actor != 'github-actions[bot]'` check as defense-in-depth. Both must be verified during testing. |
| CI won't run on autofix commits | By design (GITHUB_TOKEN policy). Claude validates locally via `npm test`. PR author is informed in the summary comment to re-run CI if needed. Documented in Design Decisions above. |
| If someone later switches to GH_PAT | The `github.actor` check would NOT prevent loops (actor = PAT owner, not `github-actions[bot]`). If PAT is ever needed, must add explicit loop detection (e.g., check if last commit author is the bot). Documented here as a warning for future maintainers. |
| Claude modifies unrelated files | Prompt instructs to stay within PR scope. `git add -u` only stages tracked files (no temp files or artifacts). |
| Pushing to wrong branch/remote | `git push` allowlist scoped to `Bash(git push origin:*)`. Prompt constrains to `git push origin HEAD` only and forbids force push. `git checkout` removed from allowlist. |
| `@claude` comment on fork PR | `issue_comment` runs in base repo context (secrets available), so Claude starts. Prompt detects fork via `gh pr view --json isCrossRepository` and skips autofix to prevent pushing an unexpected branch to origin. |
| `git add -A` staging unintended files | Changed to `git add -u` which only stages modifications to tracked files. |
| Empty commit on clean PRs | `git diff --cached --quiet \|\|` guard skips commit/push when no changes were made. |
| `workflow_dispatch` with no PR context | Prompt instructs Claude to detect missing PR number and exit gracefully. |
| `npm test` fails due to missing Node.js/deps | Added `setup-node` and `npm ci` steps before the Claude step. |
| Concurrency cancellation mid-push | If the job is cancelled after pushing but before commenting, the PR gets a commit without a summary comment. Low risk — the commit message explains the changes, and the PR author can see the diff. |
| `paths-ignore` suppresses re-review of autofix | If Claude's fix only touches `docs/**` or `*.md`, the `synchronize` event is filtered by `paths-ignore`. This is acceptable — doc-only fixes don't need re-review. |
| Claude re-reviews its own fixes | If a human pushes on top of Claude's fix, the next review includes Claude's previous changes in the diff. Acceptable — Claude may catch issues in its own code, and the context is minimal. |

## Testing Plan

1. **Manual test**: Open a PR with a known lint/bug issue. Verify Claude reviews, fixes, runs tests, and pushes a commit.
2. **No-issues test**: Open a clean PR. Verify Claude posts a summary saying no issues found and does not push an empty commit.
3. **Re-trigger test**: After Claude pushes a fix, verify CI does NOT run on the autofix commit (expected GITHUB_TOKEN behavior). Verify no infinite loop occurs.
4. **CI re-run test**: After Claude pushes an autofix, manually re-run CI. Verify "Test & Build" passes against the new HEAD.
5. **`@claude` comment test**: Comment `@claude` on a PR. Verify the review + fix flow works via issue_comment trigger.
6. **`@claude` on fork PR**: Comment `@claude` on a fork PR. Verify Claude detects `isCrossRepository: true` via `gh pr view`, performs read-only review, and does NOT edit/commit/push.
7. **`npm test` failure test**: Introduce a fix that breaks tests. Verify Claude reverts the bad change and does not push broken code.
8. **`workflow_dispatch` test**: Trigger the workflow manually without PR context. Verify Claude handles it gracefully.

## Backward Compatibility

- The workflow file name and job name remain the same
- The `if` condition is unchanged — fork PRs continue to be skipped
- No new secrets required (`contents: write` permission already exists)
- `continue-on-error: true` is preserved so this never blocks CI
- Added `setup-node` and `npm ci` steps add ~30s to workflow runtime but are required for test validation
