<script setup>
import { ref, onMounted, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)
const refreshStatus = ref(null)
const refreshTriggering = ref(false)
const clearingJiraCache = ref(false)
const clearJiraCacheResult = ref(null)
const prRefreshStatus = ref(null)
const prRefreshTriggering = ref(false)
const newPrRepo = ref('')
const assessmentStatus = ref(null)
const assessmentStatusLoading = ref(false)
const clearingAssessments = ref(false)
const clearAssessmentsResult = ref(null)
const featureStatus = ref(null)
const featureStatusLoading = ref(false)
const clearingFeatures = ref(false)
const clearFeaturesResult = ref(null)

// PR-specific save state
const prSaving = ref(false)
const prSaveError = ref(null)
const prSaveSuccess = ref(false)

// Per-repo data (lastFetchedAt per repo)
const repoMeta = ref({})
const repoRefreshing = ref({})

// Modal state
const showForceRefreshModal = ref(false)
const forceRefreshRepo = ref(null)
const showRemoveRepoModal = ref(false)
const removeRepoTarget = ref(null)
const removeRepoDeleteData = ref(false)
const showPruneModal = ref(false)
const pruneDays = ref(180)
const pruneAll = ref(false)
const pruning = ref(false)
const pruneResult = ref(null)
const clearingPrCache = ref(false)

// ─── Data loading ───

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiRequest('/modules/ai-impact/config')
  } catch {
    config.value = null
  } finally {
    loading.value = false
  }
}

async function loadRepoMeta() {
  try {
    const data = await apiRequest('/modules/ai-impact/pr-data')
    if (data?.repos && Array.isArray(data.repos)) {
      const meta = {}
      for (const r of data.repos) {
        if (r.repo) meta[r.repo] = { lastFetchedAt: r.lastFetchedAt, dataStartDate: r.dataStartDate, lastError: r.lastError, prCount: r.prCount }
      }
      repoMeta.value = meta
    }
  } catch {
    // ignore
  }
}

// ─── Jira config save ───

async function saveJiraConfig() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    const toSave = { ...config.value }
    if (typeof toSave.excludedStatuses === 'string') {
      toSave.excludedStatuses = toSave.excludedStatuses
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    }
    await apiRequest('/modules/ai-impact/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

// ─── PR config save ───

async function savePrConfig() {
  prSaving.value = true
  prSaveError.value = null
  prSaveSuccess.value = false
  try {
    const toSave = {
      prRepos: config.value.prRepos || [],
      prLookbackDays: config.value.prLookbackDays,
      prBotUsernames: config.value.prBotUsernames
    }
    if (typeof toSave.prBotUsernames === 'string') {
      toSave.prBotUsernames = toSave.prBotUsernames.split(',').map(s => s.trim()).filter(Boolean)
    }
    await apiRequest('/modules/ai-impact/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    })
    prSaveSuccess.value = true
    loadRepoMeta()
    setTimeout(() => { prSaveSuccess.value = false }, 3000)
  } catch (e) {
    prSaveError.value = e.message
  } finally {
    prSaving.value = false
  }
}

// ─── Jira refresh ───

async function triggerRefresh() {
  refreshTriggering.value = true
  try {
    const result = await apiRequest('/modules/ai-impact/refresh', { method: 'POST' })
    refreshStatus.value = result
    if (result.status === 'started') pollRefreshStatus()
  } catch (e) {
    refreshStatus.value = { status: 'error', message: e.message }
  } finally {
    refreshTriggering.value = false
  }
}

async function pollRefreshStatus() {
  const poll = async () => {
    try {
      const status = await apiRequest('/modules/ai-impact/refresh/status')
      refreshStatus.value = status
      if (status.running) setTimeout(poll, 3000)
    } catch { /* ignore */ }
  }
  setTimeout(poll, 2000)
}

async function clearJiraCache() {
  clearingJiraCache.value = true
  clearJiraCacheResult.value = null
  try {
    await apiRequest('/modules/ai-impact/cache', { method: 'DELETE' })
    clearJiraCacheResult.value = { status: 'success', message: 'Jira data cleared' }
    setTimeout(() => { clearJiraCacheResult.value = null }, 3000)
  } catch (e) {
    clearJiraCacheResult.value = { status: 'error', message: e.message }
  } finally {
    clearingJiraCache.value = false
  }
}

async function checkRefreshStatus() {
  try { refreshStatus.value = await apiRequest('/modules/ai-impact/refresh/status') } catch { /* ignore */ }
}

// ─── Assessment / Feature helpers ───

async function loadAssessmentStatus() {
  assessmentStatusLoading.value = true
  try {
    assessmentStatus.value = await apiRequest('/modules/ai-impact/assessments/status')
  } catch {
    assessmentStatus.value = null
  } finally {
    assessmentStatusLoading.value = false
  }
}

async function clearAssessments() {
  clearingAssessments.value = true
  clearAssessmentsResult.value = null
  try {
    await apiRequest('/modules/ai-impact/assessments', { method: 'DELETE' })
    clearAssessmentsResult.value = { status: 'success', message: 'Assessment data cleared' }
    loadAssessmentStatus()
    setTimeout(() => { clearAssessmentsResult.value = null }, 3000)
  } catch (e) {
    clearAssessmentsResult.value = { status: 'error', message: e.message }
  } finally {
    clearingAssessments.value = false
  }
}

async function loadFeatureStatus() {
  featureStatusLoading.value = true
  try {
    featureStatus.value = await apiRequest('/modules/ai-impact/features/status')
  } catch {
    featureStatus.value = null
  } finally {
    featureStatusLoading.value = false
  }
}

async function clearFeatures() {
  clearingFeatures.value = true
  clearFeaturesResult.value = null
  try {
    await apiRequest('/modules/ai-impact/features', { method: 'DELETE' })
    clearFeaturesResult.value = { status: 'success', message: 'Feature data cleared' }
    loadFeatureStatus()
    setTimeout(() => { clearFeaturesResult.value = null }, 3000)
  } catch (e) {
    clearFeaturesResult.value = { status: 'error', message: e.message }
  } finally {
    clearingFeatures.value = false
  }
}

// ─── PR refresh (all repos) ───

async function triggerPrRefreshAll() {
  prRefreshTriggering.value = true
  try {
    const result = await apiRequest('/modules/ai-impact/pr-refresh', { method: 'POST' })
    prRefreshStatus.value = result
    if (result.status === 'started') pollPrRefreshStatus()
  } catch (e) {
    prRefreshStatus.value = { status: 'error', message: e.message }
  } finally {
    prRefreshTriggering.value = false
  }
}

async function pollPrRefreshStatus() {
  const poll = async () => {
    try {
      const status = await apiRequest('/modules/ai-impact/pr-refresh/status')
      prRefreshStatus.value = status
      if (status.running) {
        setTimeout(poll, 3000)
      } else {
        loadRepoMeta()
      }
    } catch { /* ignore */ }
  }
  setTimeout(poll, 2000)
}

async function checkPrRefreshStatus() {
  try {
    prRefreshStatus.value = await apiRequest('/modules/ai-impact/pr-refresh/status')
    if (prRefreshStatus.value?.running) pollPrRefreshStatus()
  } catch { /* ignore */ }
}

// ─── Per-repo refresh ───

async function refreshRepo(repoSlug, force) {
  repoRefreshing.value = { ...repoRefreshing.value, [repoSlug]: true }
  try {
    const result = await apiRequest('/modules/ai-impact/pr-refresh/repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: repoSlug, force: !!force })
    })
    if (result.status === 'started') {
      const poll = async () => {
        try {
          const status = await apiRequest('/modules/ai-impact/pr-refresh/status')
          prRefreshStatus.value = status
          if (status.running) {
            setTimeout(poll, 3000)
          } else {
            repoRefreshing.value = { ...repoRefreshing.value, [repoSlug]: false }
            loadRepoMeta()
          }
        } catch {
          repoRefreshing.value = { ...repoRefreshing.value, [repoSlug]: false }
        }
      }
      setTimeout(poll, 2000)
    }
  } catch {
    repoRefreshing.value = { ...repoRefreshing.value, [repoSlug]: false }
  }
}

// ─── Repo management ───

function addPrRepo() {
  const repo = newPrRepo.value.trim()
  if (!repo) return
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) return
  if (!config.value.prRepos) config.value.prRepos = []
  if (!config.value.prRepos.includes(repo)) {
    config.value.prRepos.push(repo)
    savePrConfig()
  }
  newPrRepo.value = ''
}

async function initiateRemoveRepo(idx) {
  const repo = config.value.prRepos[idx]
  if (repoMeta.value[repo]?.lastFetchedAt) {
    removeRepoTarget.value = { repo, idx }
    removeRepoDeleteData.value = false
    showRemoveRepoModal.value = true
  } else {
    config.value.prRepos.splice(idx, 1)
    try {
      await apiRequest('/modules/ai-impact/pr-data/repo?repo=' + encodeURIComponent(repo), { method: 'DELETE' })
    } catch { /* ignore - file may not exist */ }
    savePrConfig()
  }
}

async function confirmRemoveRepo() {
  const { repo } = removeRepoTarget.value
  const idx = config.value.prRepos.indexOf(repo)
  if (idx !== -1) config.value.prRepos.splice(idx, 1)
  if (removeRepoDeleteData.value) {
    try {
      await apiRequest('/modules/ai-impact/pr-data/repo?repo=' + encodeURIComponent(repo), { method: 'DELETE' })
    } catch { /* ignore */ }
    const meta = { ...repoMeta.value }
    delete meta[repo]
    repoMeta.value = meta
  }
  showRemoveRepoModal.value = false
  await savePrConfig()
}

// ─── Force refresh modal ───

function initiateForceRefresh(repo) {
  if (!repoMeta.value[repo]?.lastFetchedAt) {
    refreshRepo(repo, true)
    return
  }
  forceRefreshRepo.value = repo
  showForceRefreshModal.value = true
}

function confirmForceRefresh() {
  refreshRepo(forceRefreshRepo.value, true)
  showForceRefreshModal.value = false
}

// ─── Prune modal ───

async function openPruneModal() {
  showPruneModal.value = true
  pruneDays.value = 180
  pruneAll.value = false
  pruneResult.value = null
}

function prunePayload() {
  return { olderThanDays: pruneAll.value ? 0 : pruneDays.value }
}

async function confirmPrune() {
  pruning.value = true
  try {
    await apiRequest('/modules/ai-impact/pr-data/prune', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prunePayload())
    })
    loadRepoMeta()
    showPruneModal.value = false
  } catch (e) {
    pruneResult.value = { error: e.message }
  } finally {
    pruning.value = false
  }
}

// ─── Clear PR metrics cache ───

async function clearPrCache() {
  clearingPrCache.value = true
  try {
    await apiRequest('/modules/ai-impact/pr-data/cache', { method: 'DELETE' })
  } catch { /* ignore */ }
  finally { clearingPrCache.value = false }
}

// ─── Helpers ───

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const ms = Date.now() - new Date(dateStr).getTime()
  if (ms < 60000) return 'just now'
  if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago'
  if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago'
  return Math.floor(ms / 86400000) + 'd ago'
}

const anyRefreshRunning = computed(() => prRefreshStatus.value?.running || Object.values(repoRefreshing.value).some(Boolean))


function displayList(field) {
  if (!config.value) return ''
  const val = config.value[field]
  if (Array.isArray(val)) return val.join(', ')
  return val || ''
}

onMounted(() => {
  loadConfig()
  checkRefreshStatus()
  checkPrRefreshStatus()
  loadAssessmentStatus()
  loadFeatureStatus()
  loadRepoMeta()
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading configuration...</div>

    <template v-else-if="config">
      <!-- Jira RFE Configuration -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jira Project</label>
          <input v-model="config.jiraProject" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Project</label>
          <input v-model="config.linkedProject" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created Label</label>
          <input v-model="config.createdLabel" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Revised Label</label>
          <input v-model="config.revisedLabel" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Exclusion Label</label>
          <input v-model="config.testExclusionLabel" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Type Name</label>
          <input v-model="config.linkTypeName" type="text" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Excluded Statuses</label>
          <input :value="displayList('excludedStatuses')" @input="config.excludedStatuses = $event.target.value" type="text" placeholder="Comma-separated, e.g. Closed, Done" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated list of Jira statuses to exclude</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lookback (months)</label>
          <input v-model.number="config.lookbackMonths" type="number" min="1" max="120" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trend Threshold (pp)</label>
          <input v-model.number="config.trendThresholdPp" type="number" min="0" max="50" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Percentage-point change needed to classify trend as growing/declining</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button @click="saveJiraConfig" :disabled="saving" class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
        <span v-if="saveSuccess" class="text-green-600 dark:text-green-400 text-sm">Saved successfully</span>
        <span v-if="saveError" class="text-red-600 dark:text-red-400 text-sm">{{ saveError }}</span>
      </div>
    </template>

    <!-- Autofix Configuration -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Jira AutoFix</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4" v-if="config">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jira Projects</label>
          <input :value="displayList('autofixProjects')" @input="config.autofixProjects = $event.target.value.split(',').map(s => s.trim()).filter(Boolean)" type="text" placeholder="AIPCC, RHOAIENG" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated Jira project keys to scan for autofix labels</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created After</label>
          <input v-model="config.autofixCreatedAfter" type="text" placeholder="2026-04-15" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Only include issues created on or after this date (YYYY-MM-DD)</p>
        </div>
      </div>
    </div>

    <!-- Jira Data Refresh -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jira Data Refresh</h4>
      <div class="flex items-center gap-3">
        <button @click="triggerRefresh" :disabled="refreshTriggering || refreshStatus?.running" class="px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-900 disabled:opacity-50">
          {{ refreshStatus?.running ? 'Refreshing...' : 'Refresh Now' }}
        </button>
        <button @click="clearJiraCache" :disabled="clearingJiraCache" class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
          {{ clearingJiraCache ? 'Clearing...' : 'Clear Jira Data' }}
        </button>
        <span v-if="clearJiraCacheResult" class="text-sm" :class="clearJiraCacheResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
          {{ clearJiraCacheResult.message }}
        </span>
        <div v-if="refreshStatus?.lastResult" class="text-sm text-gray-500 dark:text-gray-400">
          Last refresh:
          <span :class="refreshStatus.lastResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">{{ refreshStatus.lastResult.status }}</span>
          <span v-if="refreshStatus.lastResult.message"> &mdash; {{ refreshStatus.lastResult.message }}</span>
          <span v-if="refreshStatus.lastResult.completedAt"> at {{ new Date(refreshStatus.lastResult.completedAt).toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <!-- Assessment Data -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assessment Data</h4>
      <div v-if="assessmentStatusLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading assessment status...</div>
      <template v-else-if="assessmentStatus">
        <div class="grid grid-cols-3 gap-4 mb-3">
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Assessed</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ assessmentStatus.totalAssessed }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">History Entries</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ assessmentStatus.totalHistoryEntries }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Last Synced</p>
            <p class="text-sm font-medium dark:text-gray-200">{{ assessmentStatus.lastSyncedAt ? new Date(assessmentStatus.lastSyncedAt).toLocaleString() : 'Never' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button @click="clearAssessments" :disabled="clearingAssessments || assessmentStatus.totalAssessed === 0" class="px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
            {{ clearingAssessments ? 'Clearing...' : 'Clear Assessment Data' }}
          </button>
          <span v-if="clearAssessmentsResult" class="text-sm" :class="clearAssessmentsResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">{{ clearAssessmentsResult.message }}</span>
        </div>
      </template>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">No assessment data available</div>
    </div>

    <!-- Feature Review Data -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Feature Reviews</h4>
      <div v-if="featureStatusLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading feature status...</div>
      <template v-else-if="featureStatus">
        <div class="grid grid-cols-3 gap-4 mb-3">
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Features</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ featureStatus.totalFeatures }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">History Entries</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ featureStatus.totalHistoryEntries }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Last Synced</p>
            <p class="text-sm font-medium dark:text-gray-200">{{ featureStatus.lastSyncedAt ? new Date(featureStatus.lastSyncedAt).toLocaleString() : 'Never' }}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button @click="clearFeatures" :disabled="clearingFeatures || featureStatus.totalFeatures === 0" class="px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
            {{ clearingFeatures ? 'Clearing...' : 'Clear Feature Data' }}
          </button>
          <span v-if="clearFeaturesResult" class="text-sm" :class="clearFeaturesResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">{{ clearFeaturesResult.message }}</span>
        </div>
      </template>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">No feature data available</div>
    </div>

    <!-- Pull Requests Section (bottom) -->
    <div class="border-t-2 border-gray-300 dark:border-gray-600 pt-6" v-if="config">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Pull Requests</h3>

      <!-- PR Config fields -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PR Lookback Days</label>
          <input v-model.number="config.prLookbackDays" type="number" min="1" max="365" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Days of history to fetch when a repo is first added or force-refreshed (1-365). Regular refreshes are incremental.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">AI Reviewer Logins</label>
          <input :value="displayList('prBotUsernames')" @input="config.prBotUsernames = $event.target.value.split(',').map(s => s.trim()).filter(Boolean)" type="text" placeholder="coderabbitai[bot]" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500" />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated GitHub logins treated as AI reviewers</p>
        </div>
      </div>

      <!-- Repo table -->
      <div class="mb-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">GitHub Repos</label>
          <div class="flex items-center gap-2">
            <button @click="triggerPrRefreshAll" :disabled="anyRefreshRunning || !config.prRepos?.length" class="px-3 py-1.5 text-xs bg-gray-800 text-white rounded-md hover:bg-gray-900 disabled:opacity-50">
              {{ prRefreshStatus?.running && prRefreshStatus.reposTotal > 1 ? 'Refreshing...' : 'Refresh All' }}
            </button>
            <button @click="openPruneModal" class="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700">
              Prune Old Data...
            </button>
            <button @click="clearPrCache" :disabled="clearingPrCache" title="Clears the computed metrics cache (not PR data). Only needed if metrics appear stale after an error — the cache normally invalidates automatically." class="px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
              Clear Cache
            </button>
          </div>
        </div>

        <div v-if="prRefreshStatus?.running" class="text-sm text-gray-500 dark:text-gray-400 mb-2">
          {{ prRefreshStatus.currentRepo || 'Starting...' }}
          ({{ prRefreshStatus.reposCompleted }}/{{ prRefreshStatus.reposTotal }})
        </div>

        <!-- Repo table -->
        <div v-if="config.prRepos?.length" class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th class="text-left px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Repo</th>
                <th class="text-left px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Data Since</th>
                <th class="text-left px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Last Refresh</th>
                <th class="text-right px-4 py-2 text-gray-600 dark:text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <tr v-for="(repo, idx) in config.prRepos" :key="repo" class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td class="px-4 py-2">
                  <div class="text-gray-900 dark:text-gray-200 font-mono text-xs">{{ repo }}</div>
                  <div v-if="repoMeta[repo]?.lastError" class="text-xs text-red-600 dark:text-red-400 mt-0.5">{{ repoMeta[repo].lastError.message }}</div>
                </td>
                <td class="px-4 py-2 text-gray-500 dark:text-gray-400">
                  {{ repoMeta[repo]?.dataStartDate ? new Date(repoMeta[repo].dataStartDate).toISOString().slice(0, 10) : '—' }}
                </td>
                <td class="px-4 py-2 text-gray-500 dark:text-gray-400">
                  {{ timeAgo(repoMeta[repo]?.lastFetchedAt) }}
                </td>
                <td class="px-4 py-2 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      @click="refreshRepo(repo, false)"
                      :disabled="anyRefreshRunning"
                      class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300"
                    >{{ repoRefreshing[repo] ? 'Refreshing...' : 'Refresh' }}</button>
                    <button
                      @click="initiateForceRefresh(repo)"
                      :disabled="anyRefreshRunning"
                      class="px-2 py-1 text-xs border border-orange-300 dark:border-orange-600 rounded hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 text-orange-700 dark:text-orange-300"
                    >Force</button>
                    <button
                      @click="initiateRemoveRepo(idx)"
                      :disabled="anyRefreshRunning"
                      class="px-2 py-1 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >&times;</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-sm text-gray-400 dark:text-gray-500 py-2">No repos configured</div>

        <!-- Add repo input -->
        <div class="flex items-center gap-2 mt-2">
          <input v-model="newPrRepo" type="text" placeholder="owner/repo" class="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500" @keydown.enter.prevent="addPrRepo" />
          <button @click="addPrRepo" class="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Add</button>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Individual repos to track</p>
      </div>

      <!-- Save PR Configuration -->
      <div class="flex items-center gap-3">
        <button @click="savePrConfig" :disabled="prSaving" class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50">
          {{ prSaving ? 'Saving...' : 'Save PR Configuration' }}
        </button>
        <span v-if="prSaveSuccess" class="text-green-600 dark:text-green-400 text-sm">Saved successfully</span>
        <span v-if="prSaveError" class="text-red-600 dark:text-red-400 text-sm">{{ prSaveError }}</span>
      </div>
    </div>

    <!-- Force Refresh Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showForceRefreshModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showForceRefreshModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Force Refresh {{ forceRefreshRepo }}?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              All cached PR data for this repo will be replaced with a fresh fetch of the last {{ config?.prLookbackDays || 90 }} days. Any historical data older than that will be permanently lost.
            </p>
            <div class="flex justify-end gap-2">
              <button @click="showForceRefreshModal = false" class="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button @click="confirmForceRefresh" class="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700">Force Refresh</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Remove Repo Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRemoveRepoModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showRemoveRepoModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Remove {{ removeRepoTarget?.repo }}?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">This repo will be removed from the configuration.</p>
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
              <input type="checkbox" v-model="removeRepoDeleteData" class="rounded border-gray-300 dark:border-gray-600" />
              Also delete PR data for this repo
            </label>
            <div class="flex justify-end gap-2">
              <button @click="showRemoveRepoModal = false" class="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button @click="confirmRemoveRepo" class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">Remove</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Prune Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showPruneModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50" @click="showPruneModal = false" />
          <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Prune Old PR Data</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Remove PR records older than a specified number of days. The UI shows up to 3 months of data with a prior-period comparison, so 180 days is recommended as a minimum.
            </p>
            <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-3">
              <input type="checkbox" v-model="pruneAll" class="rounded border-gray-300 dark:border-gray-600" />
              Remove all stored PR data
            </label>
            <div class="mb-3" :class="{ 'opacity-40 pointer-events-none': pruneAll }">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days to keep</label>
              <input v-model.number="pruneDays" type="number" min="1" :disabled="pruneAll" class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 disabled:opacity-50" />
            </div>
            <div v-if="pruneResult?.error" class="text-sm text-red-600 dark:text-red-400 mb-3">{{ pruneResult.error }}</div>
            <div class="flex justify-end gap-2">
              <button @click="showPruneModal = false" class="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">Cancel</button>
              <button @click="confirmPrune" :disabled="pruning" class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                {{ pruning ? 'Pruning...' : 'Prune' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
