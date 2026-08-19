'use strict'

const { Octokit } = require('@octokit/rest')
const yaml = require('js-yaml')

const STORAGE_KEY = 'releases/component-architectures/latest.json'
const OWNER = 'red-hat-data-services'
const REPO = 'konflux-central'
const REPORT_PATH = 'multi-arch-report.yaml'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stripRhelSuffix(name) {
  return name.replace(/-rhel\d+$/, '')
}

async function discoverReleaseBranches(octokit, { maxBranches = 3 } = {}) {
  const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner: OWNER,
    repo: REPO,
    per_page: 100
  })

  const rhoaiBranches = branches
    .map(b => b.name)
    .filter(name => /^rhoai-\d/.test(name))

  rhoaiBranches.sort((a, b) => {
    const partsA = a.replace(/^rhoai-/, '').split(/[.-]/).map(Number)
    const partsB = b.replace(/^rhoai-/, '').split(/[.-]/).map(Number)
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const va = partsA[i] || 0
      const vb = partsB[i] || 0
      if (va !== vb) return vb - va
    }
    return 0
  })

  return rhoaiBranches.slice(0, maxBranches)
}

async function fetchBranchReport(octokit, branch) {
  const { data } = await octokit.rest.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: REPORT_PATH,
    ref: branch
  })

  const content = Buffer.from(data.content, 'base64').toString('utf8')
  const report = yaml.load(content)

  report.components = (report.components || []).map(comp => {
    if (comp.imageName) {
      return comp
    }
    const originalName = comp.name
    return {
      ...comp,
      name: stripRhelSuffix(originalName),
      imageName: originalName,
      image: `quay.io/rhoai/${originalName}`
    }
  })

  return report
}

function registerComponentArchitecturesFetcher(router, context) {
  const { storage, requireAdmin, requireScope, secrets } = context
  const { writeToStorage } = storage

  async function runFetch() {
    if (process.env.DEMO_MODE === 'true') {
      return { status: 'skipped', message: 'Fetch disabled in demo mode' }
    }

    const token = secrets && secrets.GITHUB_TOKEN
    if (!token) {
      return { status: 'error', message: 'No GITHUB_TOKEN configured' }
    }

    const octokit = new Octokit({ auth: token, request: { timeout: 30000 } })

    const branches = await discoverReleaseBranches(octokit, { maxBranches: 3 })
    if (!branches.length) {
      return { status: 'error', message: 'No rhoai-* release branches found' }
    }

    const branchData = {}
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i]
      console.log(`[component-architectures] Fetching report from ${branch} (${i + 1}/${branches.length})`)
      try {
        branchData[branch] = await fetchBranchReport(octokit, branch)
      } catch (err) {
        console.warn(`[component-architectures] No report on ${branch}: ${err.message}`)
      }
      if (i < branches.length - 1) await delay(200)
    }

    if (!Object.keys(branchData).length) {
      return { status: 'error', message: 'No multi-arch-report.yaml found on any release branch' }
    }

    const fetchedAt = new Date().toISOString()
    const result = {
      fetchedAt,
      source: { owner: OWNER, repo: REPO },
      branches: branchData
    }

    await writeToStorage(STORAGE_KEY, result)

    return {
      status: 'ok',
      branches: Object.keys(branchData),
      fetchedAt
    }
  }

  /**
   * @openapi
   * /api/modules/releases/component-architectures/refresh:
   *   post:
   *     summary: Trigger component architecture data refresh from GitHub (admin only)
   *     tags: [Releases - Component Architectures]
   *     responses:
   *       200:
   *         description: Refresh results
   */
  router.post('/refresh', requireAdmin, requireScope('releases:write'), async function (req, res) {
    if (context.isRefreshRunning && context.isRefreshRunning()) {
      return res.json({ status: 'already_running', message: 'A refresh is already in progress' })
    }
    try {
      const result = await runFetch()
      res.json(result)
    } catch (err) {
      console.error('[component-architectures] Refresh error:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  if (context.registerRefresh) {
    context.registerRefresh('component-architectures', {
      order: 85,
      cadence: '24h',
      timeout: 300000,
      description: 'Fetches component architecture reports from konflux-central GitHub repo',
      handler: async function () {
        if (process.env.DEMO_MODE === 'true') {
          return { status: 'skipped', message: 'Fetch disabled in demo mode' }
        }
        return runFetch()
      }
    })
  }
}

module.exports = {
  registerComponentArchitecturesFetcher,
  STORAGE_KEY,
  discoverReleaseBranches,
  fetchBranchReport,
  stripRhelSuffix
}
