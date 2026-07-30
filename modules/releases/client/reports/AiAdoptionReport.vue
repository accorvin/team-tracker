<script setup>
import { ref, shallowRef, computed, onMounted, watch } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import { useAiAdoption } from '../composables/useAiAdoption.js'
import { apiRequest } from '@shared/client'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend)

const PIPELINE_META = {
  stratCreator: { name: 'Strategy Creator', short: 'Strat', description: 'AI auto-generates and refines feature strategy definitions, validated against a quality rubric with optional human sign-off.', labels: ['strat-creator-auto-created', 'strat-creator-auto-refined', 'strat-creator-rubric-pass', 'strat-creator-human-sign-off'] },
  rfeCreator: { name: 'RFE Creator', short: 'RFE', description: 'AI auto-creates RFEs, runs feasibility assessment, auto-fixes quality issues, and can split large features.', labels: ['rfe-creator-auto-created', 'rfe-creator-autofix-rubric-pass', 'rfe-creator-feasibility-pass', 'rfe-creator-split-result'] },
  testPlan: { name: 'Test Plan Generator', short: 'Test Plan', description: 'AI auto-generates and revises test plans for features, validated against a quality rubric.', labels: ['test-plan-auto-created', 'test-plan-auto-revised', 'test-plan-rubric-pass'] },
  qg1: { name: 'Priority Scoring (QG1)', short: 'QG1', description: 'Automated RICE priority scoring and quality gate evaluation for feature prioritization.', labels: ['rp-qg1-auto-rice', 'rp-qg1-pass', 'rp-qg1-fail'] },
  aiDoc: { name: 'AI-First Documentation', short: 'AI Doc', description: 'AI contributes documentation drafts, Jira content, and technical writing.', labels: ['ai1st-doc-contributed', 'ai1st-doc-invoked', 'ai1st-jira-contributed'] },
  uxdAgentic: { name: 'UXD Agentic', short: 'UXD', description: 'AI-assisted UX design process for generating or validating design specifications.', labels: ['uxd-agentic'] }
}
const PIPELINE_KEYS = Object.keys(PIPELINE_META)
const RELEASE_OPTIONS = [
  { value: 'all', label: 'All Releases' },
  { value: '3.4 GA', label: '3.4 GA' },
  { value: '3.5 EA1', label: '3.5 EA1' },
  { value: '3.5 EA2', label: '3.5 EA2' },
  { value: '3.5 GA', label: '3.5 GA' }
]
const BASELINE_NAME = '3.4 GA'

const { data, loading, error, fetchData } = useAiAdoption()
const scorecardData = shallowRef(null)
const selectedRelease = ref('all')
const selectedComponent = ref('all')
const expandedPipelines = ref({})

async function loadData() {
  const comp = selectedComponent.value === 'all' ? null : selectedComponent.value
  const rel = selectedRelease.value === 'all' ? null : selectedRelease.value

  await fetchData(rel, comp)

  if (!scorecardData.value || comp !== _lastScorecardComp) {
    const full = await apiRequest(
      `/modules/releases/ai-adoption${comp ? '?component=' + encodeURIComponent(comp) : ''}`
    )
    scorecardData.value = full
    _lastScorecardComp = comp
  }
}
let _lastScorecardComp = null

onMounted(() => loadData())
watch([selectedRelease, selectedComponent], () => loadData())

const releaseGroups = computed(() => data.value?.releaseGroups || [])
const scorecardGroups = computed(() => scorecardData.value?.releaseGroups || [])

const allComponents = computed(() => {
  const set = new Set()
  const groups = scorecardGroups.value.length ? scorecardGroups.value : releaseGroups.value
  for (const rg of groups) {
    for (const c of rg.components || []) set.add(c.name)
  }
  return [...set].sort()
})

const baseline = computed(() => scorecardGroups.value.find(r => r.releaseGroup === BASELINE_NAME) || null)
const postBaselineGroups = computed(() => scorecardGroups.value.filter(r => r.releaseGroup !== BASELINE_NAME))

const summaryStats = computed(() => {
  const groups = releaseGroups.value
  const totalFeatures = groups.reduce((s, g) => s + g.totalFeatures, 0)
  const aiTouched = groups.reduce((s, g) => s + g.aiTouchedFeatures, 0)
  const pct = totalFeatures > 0 ? Math.round((aiTouched / totalFeatures) * 100) : 0
  const activePipelines = new Set()
  for (const g of groups) {
    for (const c of g.components || []) {
      for (const k of PIPELINE_KEYS) {
        if (c.pipelines[k] > 0) activePipelines.add(k)
      }
    }
  }
  return { totalFeatures, aiTouched, pct, activePipelines: activePipelines.size }
})

function groupPipelineTotals(group) {
  const totals = {}
  for (const k of PIPELINE_KEYS) totals[k] = 0
  for (const c of group.components || []) {
    for (const k of PIPELINE_KEYS) totals[k] += c.pipelines[k] || 0
  }
  return totals
}

function delta(current, base) {
  const d = current - base
  if (d > 0) return '+' + d
  if (d < 0) return String(d)
  return '—'
}

function deltaPp(currentPct, basePct) {
  const d = currentPct - basePct
  if (d > 0) return '+' + d + 'pp'
  if (d < 0) return d + 'pp'
  return '—'
}

function aiPct(group) {
  return group.totalFeatures > 0 ? Math.round((group.aiTouchedFeatures / group.totalFeatures) * 100) : 0
}

function activePipelineCount(group) {
  const totals = groupPipelineTotals(group)
  return PIPELINE_KEYS.filter(k => totals[k] > 0).length
}

const SCORECARD_METRICS = [
  { key: 'features', label: 'Total Features Delivered', tooltip: 'Total number of Jira Feature issues shipped in this release across selected projects and components.', getValue: g => g.totalFeatures, group: 'summary' },
  { key: 'aiTouched', label: 'Features Using AI', tooltip: 'Features where at least one AI pipeline assisted in strategy, planning, testing, or documentation.', getValue: g => g.aiTouchedFeatures, group: 'summary' },
  { key: 'aiPct', label: 'AI Adoption Rate', tooltip: 'Percentage of delivered features that used AI pipelines. Calculated as Features Using AI / Total Features × 100.', getValue: g => aiPct(g), isPct: true, group: 'summary', highlight: true },
  { key: 'activePipelines', label: 'Active AI Pipelines', tooltip: 'How many of the 6 available AI pipelines were used by at least one feature in this release.', getValue: g => activePipelineCount(g), suffix: '/6', group: 'summary' },
  ...PIPELINE_KEYS.map(k => ({
    key: k, label: PIPELINE_META[k].name,
    tooltip: PIPELINE_META[k].description,
    getValue: g => groupPipelineTotals(g)[k],
    group: 'pipeline'
  }))
]


const scorecardColumns = computed(() => {
  const bl = baseline.value
  const post = postBaselineGroups.value
  if (!bl) return []
  return [bl, ...post]
})

function scorecardDelta(metric, group) {
  if (!baseline.value || group.releaseGroup === BASELINE_NAME) return null
  const current = metric.getValue(group)
  const base = metric.getValue(baseline.value)
  if (metric.isPct) return deltaPp(current, base)
  return delta(current, base)
}

function scorecardDeltaClass(metric, group) {
  if (!baseline.value || group.releaseGroup === BASELINE_NAME) return ''
  const diff = metric.getValue(group) - metric.getValue(baseline.value)
  if (diff > 0) return 'text-green-600 dark:text-green-400'
  if (diff < 0) return 'text-red-500 dark:text-red-400'
  return 'text-gray-400 dark:text-gray-500'
}

function scorecardColHeaderClass(releaseGroup) {
  const isBase = releaseGroup === BASELINE_NAME
  const isSelected = selectedRelease.value !== 'all' && releaseGroup === selectedRelease.value
  if (isSelected) return 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 border-b-2 border-primary-500'
  if (isBase) return 'bg-amber-50/60 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400'
  return 'text-gray-500 dark:text-gray-400'
}

function scorecardColCellClass(releaseGroup) {
  const isBase = releaseGroup === BASELINE_NAME
  const isSelected = selectedRelease.value !== 'all' && releaseGroup === selectedRelease.value
  if (isSelected) return 'bg-primary-50/50 dark:bg-primary-900/10'
  if (isBase) return 'bg-amber-50/30 dark:bg-amber-900/5'
  return ''
}

function formatCellValue(metric, group) {
  const val = metric.getValue(group)
  if (metric.isPct) return val + '%'
  if (metric.suffix) return val + metric.suffix
  return val
}

const stackedBarData = computed(() => {
  const groups = releaseGroups.value
  return {
    labels: groups.map(g => g.releaseGroup),
    datasets: [
      {
        label: 'AI-Touched',
        data: groups.map(g => g.aiTouchedFeatures),
        backgroundColor: '#3b82f6',
        borderRadius: 4
      },
      {
        label: 'No AI Evidence',
        data: groups.map(g => g.totalFeatures - g.aiTouchedFeatures),
        backgroundColor: '#d1d5db',
        borderRadius: 4
      }
    ]
  }
})

const stackedBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { stacked: true, grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
    y: { stacked: true, grid: { color: 'rgba(156,163,175,0.15)' }, ticks: { color: '#9ca3af', font: { size: 11 } } }
  },
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, color: '#6b7280', font: { size: 11 } } },
    tooltip: { backgroundColor: '#111827', bodyFont: { size: 11 }, padding: 10, cornerRadius: 8 }
  }
}

const coverageLineData = computed(() => {
  const groups = releaseGroups.value
  return {
    labels: groups.map(g => g.releaseGroup),
    datasets: [{
      label: 'AI Coverage %',
      data: groups.map(g => aiPct(g)),
      borderColor: '#22c55e',
      backgroundColor: 'rgba(34,197,94,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 5,
      pointBackgroundColor: '#22c55e'
    }]
  }
})

const coverageLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
    y: { min: 0, max: 100, grid: { color: 'rgba(156,163,175,0.15)' }, ticks: { color: '#9ca3af', font: { size: 11 }, callback: v => v + '%' } }
  },
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#111827', bodyFont: { size: 11 }, padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.parsed.y + '%' } }
  }
}

const perComponentRows = computed(() => {
  const map = {}
  for (const rg of releaseGroups.value) {
    for (const c of rg.components || []) {
      if (!map[c.name]) {
        map[c.name] = { name: c.name, total: 0, aiTouched: 0, pipelines: {} }
        for (const k of PIPELINE_KEYS) map[c.name].pipelines[k] = 0
      }
      map[c.name].total += c.total
      map[c.name].aiTouched += c.aiTouched
      for (const k of PIPELINE_KEYS) map[c.name].pipelines[k] += c.pipelines[k] || 0
    }
  }
  return Object.values(map).sort((a, b) => b.aiTouched - a.aiTouched)
})

function togglePipeline(key) {
  expandedPipelines.value[key] = !expandedPipelines.value[key]
}

const insightText = computed(() => {
  const bl = baseline.value
  const ga = releaseGroups.value.find(r => r.releaseGroup === '3.5 GA')
  if (!bl || !ga) return null
  const blPct = aiPct(bl)
  const gaPct = aiPct(ga)
  return `AI adoption grew from ${blPct}% (3.4 GA baseline) to ${gaPct}% (3.5 GA), a ${gaPct - blPct}pp increase. Feature volume went from ${bl.totalFeatures} to ${ga.totalFeatures} features between these releases.`
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">AI Adoption Report</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
        Projects: AIPCC, RHAIENG, RHOAIENG, INFERENG, RHAI, RHAISTRAT &middot; Issue type: Feature &middot; Source: Jira
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading && !data" class="text-center py-16">
      <svg class="animate-spin h-6 w-6 text-primary-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">Fetching AI adoption data from Jira...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error && !data" class="text-center py-16">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      <button @click="fetchData()" class="mt-3 px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700">Retry</button>
    </div>

    <template v-else-if="data">
      <!-- Filter bar -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 px-5 py-4 flex items-center gap-5 flex-wrap shadow-sm">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Component</label>
          <select v-model="selectedComponent" class="text-sm font-medium rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pl-3 pr-8 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors appearance-none cursor-pointer" :class="selectedComponent !== 'all' ? 'border-primary-400 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : ''">
            <option value="all">All Components</option>
            <option v-for="c in allComponents" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Release</label>
          <select v-model="selectedRelease" class="text-sm font-medium rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 pl-3 pr-8 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors appearance-none cursor-pointer" :class="selectedRelease !== 'all' ? 'border-primary-400 dark:border-primary-500 bg-primary-50/50 dark:bg-primary-900/20' : ''">
            <option v-for="r in RELEASE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </div>
        <button v-if="selectedComponent !== 'all' || selectedRelease !== 'all'" @click="selectedComponent = 'all'; selectedRelease = 'all'" class="self-end mb-0.5 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          Reset Filters
        </button>
        <div v-if="loading" class="ml-auto self-end mb-1">
          <span class="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
            <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Refreshing...
          </span>
        </div>
      </div>

      <!-- Summary stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalFeatures }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Features</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 text-center">
          <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ summaryStats.aiTouched }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">AI-Touched Features</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-800 p-4 text-center">
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ summaryStats.pct }}%</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall AI Adoption</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.activePipelines }}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Active Pipelines</p>
        </div>
      </div>

      <!-- Scorecard table — transposed: metrics as rows, releases as columns -->
      <div v-if="scorecardColumns.length" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto shadow-sm">
        <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Release Scorecard</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">All metrics compared against the 3.4 GA baseline. Deltas show change from baseline.</p>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-gray-200 dark:border-gray-600">
              <th class="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-52">Metric</th>
              <th v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap" :class="scorecardColHeaderClass(col.releaseGroup)">
                <div class="flex items-center justify-center gap-1.5">
                  {{ col.releaseGroup }}
                  <span v-if="col.releaseGroup === BASELINE_NAME" class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-800 dark:bg-amber-800/50 dark:text-amber-300 uppercase tracking-wide">Base</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Summary metrics group -->
            <tr class="border-b border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/20">
              <td :colspan="scorecardColumns.length + 1" class="px-5 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Overview</td>
            </tr>
            <template v-for="metric in SCORECARD_METRICS.filter(m => m.group === 'summary')" :key="metric.key">
              <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="metric.highlight ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''">
                <td class="px-5 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-1.5 relative">
                    <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                    <span class="relative group/tip inline-flex">
                      <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                      <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                    </span>
                  </div>
                </td>
                <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                  <span class="font-semibold text-[15px]" :class="metric.highlight ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'">{{ formatCellValue(metric, col) }}</span>
                  <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                </td>
              </tr>
            </template>

            <!-- Pipeline metrics group -->
            <tr class="border-b border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/20">
              <td :colspan="scorecardColumns.length + 1" class="px-5 py-1.5 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Pipeline Breakdown</td>
            </tr>
            <template v-for="(metric, idx) in SCORECARD_METRICS.filter(m => m.group === 'pipeline')" :key="metric.key">
              <tr class="border-b border-gray-100 dark:border-gray-700/40 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20" :class="idx % 2 === 0 ? 'bg-gray-50/30 dark:bg-gray-800/30' : ''">
                <td class="px-5 py-3 whitespace-nowrap">
                  <div class="flex items-center gap-1.5 relative">
                    <span class="font-medium text-gray-900 dark:text-gray-100 text-[13px]">{{ metric.label }}</span>
                    <span class="relative group/tip inline-flex">
                      <svg class="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-help hover:text-gray-500 dark:hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" stroke-linecap="round" /></svg>
                      <span class="invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100 transition-opacity duration-150 absolute bottom-full left-0 mb-2 z-50 w-64 whitespace-normal break-words px-3 py-2 text-[11px] leading-relaxed text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none after:content-[''] after:absolute after:top-full after:left-4 after:border-4 after:border-transparent after:border-t-gray-900 dark:after:border-t-gray-700">{{ metric.tooltip }}</span>
                    </span>
                  </div>
                </td>
                <td v-for="col in scorecardColumns" :key="col.releaseGroup" class="px-4 py-3 text-center" :class="scorecardColCellClass(col.releaseGroup)">
                  <span class="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{{ formatCellValue(metric, col) }}</span>
                  <div v-if="scorecardDelta(metric, col)" class="text-[11px] mt-0.5 font-medium" :class="scorecardDeltaClass(metric, col)">{{ scorecardDelta(metric, col) }}</div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Charts (only when all releases visible) -->
      <template v-if="selectedRelease === 'all' && releaseGroups.length > 1">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <!-- Stacked bar: AI adoption over releases -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">AI Adoption Over Releases</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Features with at least one AI pipeline label per release</p>
            <div class="h-64">
              <Bar :data="stackedBarData" :options="stackedBarOptions" />
            </div>
          </div>

          <!-- Line chart: AI coverage rate -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">AI Coverage Rate Trend</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Adoption percentage per release, starting from 3.4 GA baseline</p>
            <div class="h-64">
              <Line :data="coverageLineData" :options="coverageLineOptions" />
            </div>
          </div>
        </div>
      </template>

      <!-- Per-component breakdown (when All Components) -->
      <div v-if="selectedComponent === 'all' && perComponentRows.length > 1" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 overflow-x-auto">
        <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Per-Component Breakdown</h3>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Component</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Features</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI-Touched</th>
              <th class="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">AI %</th>
              <th class="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dominant Pipelines</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in perComponentRows" :key="row.name" :class="idx % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''" class="border-b border-gray-100 dark:border-gray-700/50">
              <td class="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">{{ row.name }}</td>
              <td class="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{{ row.total }}</td>
              <td class="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{{ row.aiTouched }}</td>
              <td class="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{{ row.total > 0 ? Math.round((row.aiTouched / row.total) * 100) : 0 }}%</td>
              <td class="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                {{ PIPELINE_KEYS.filter(k => row.pipelines[k] > 0).map(k => PIPELINE_META[k].short).join(', ') || 'None' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pipeline taxonomy (collapsible) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Pipelines Identified</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Six distinct AI automation pipelines detected via Jira labels</p>
        </div>
        <div class="divide-y divide-gray-100 dark:divide-gray-700/50">
          <div v-for="(meta, key) in PIPELINE_META" :key="key">
            <button @click="togglePipeline(key)" class="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
              <span class="flex items-center gap-2">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ meta.name }}</span>
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">{{ meta.labels.length }} labels</span>
              </span>
              <svg :class="expandedPipelines[key] ? 'rotate-180' : ''" class="w-4 h-4 text-gray-400 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div v-if="expandedPipelines[key]" class="px-5 pb-3">
              <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">{{ meta.description }}</p>
              <p class="text-xs text-gray-400 dark:text-gray-500">Labels: {{ meta.labels.join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Key insight callout -->
      <div v-if="insightText" class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-5 py-4 mb-6">
        <h4 class="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">Key Finding</h4>
        <p class="text-sm text-green-700 dark:text-green-400">{{ insightText }}</p>
      </div>
    </template>
  </div>
</template>
