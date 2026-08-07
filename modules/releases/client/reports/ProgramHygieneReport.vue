<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { useReleaseSelector } from '../composables/useReleaseSelector.js'

const nav = inject('moduleNav')

const {
  modalOpen,
  selection,
  draft,
  availableFamilies,
  draftVersions,
  draftPhases,
  isAllFamiliesDraft,
  hasSelection,
  canApply,
  fetchRegistry,
  restoreSelection,
  openModal,
  cancelModal,
  applyModal,
  toggleAllFamilies,
  toggleFamily,
  selectVersionDraft,
  togglePhase,
  familyNarrative,
  phaseNarrative,
  selectedRegistryIdSet
} = useReleaseSelector({ storageKey: 'tt_cache:hygiene-report-selection' })

// ── State ──

const loading = ref(true)
const error = ref(null)
const reportData = ref(null)
const activeTab = ref('features')

// ── Data loading ──

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const [hygieneData] = await Promise.all([
      apiRequest('/modules/releases/hygiene/program-report'),
      fetchRegistry()
    ])
    reportData.value = hygieneData
    restoreSelection()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

// ── Hygiene data ──

const allVersions = computed(() => reportData.value?.versions || [])
const ruleDefinitions = computed(() => reportData.value?.ruleDefinitions || {})

const selectedRegistryIds = computed(() => selectedRegistryIdSet())

const activeVersions = computed(() => {
  if (!hasSelection.value) return []
  const ids = selectedRegistryIds.value
  return allVersions.value.filter(v => v.registryId && ids.has(v.registryId))
})

// ── Aggregated totals ──

const totals = computed(() => {
  let totalFeatures = 0
  let featuresWithViolations = 0
  const violationsByRule = {}
  const violationsByTeam = {}

  for (const ver of activeVersions.value) {
    totalFeatures += ver.totalFeatures
    featuresWithViolations += ver.featuresWithViolations
    for (const [id, count] of Object.entries(ver.violationsByRule || {})) {
      violationsByRule[id] = (violationsByRule[id] || 0) + count
    }
    for (const [team, count] of Object.entries(ver.violationsByTeam || {})) {
      violationsByTeam[team] = (violationsByTeam[team] || 0) + count
    }
  }

  const totalViolations = Object.values(violationsByRule).reduce((a, b) => a + b, 0)

  return { totalFeatures, featuresWithViolations, totalViolations, violationsByRule, violationsByTeam }
})

const sortedRuleViolations = computed(() => {
  const byRule = totals.value.violationsByRule
  return Object.keys(byRule)
    .map(id => ({
      id,
      name: ruleDefinitions.value[id]?.name || id,
      category: ruleDefinitions.value[id]?.category || 'unknown',
      count: byRule[id]
    }))
    .sort((a, b) => b.count - a.count)
})

const maxRuleCount = computed(() => sortedRuleViolations.value[0]?.count || 1)

const sortedTeamViolations = computed(() => {
  const byTeam = totals.value.violationsByTeam
  return Object.keys(byTeam)
    .map(team => ({ team, count: byTeam[team] }))
    .sort((a, b) => b.count - a.count)
})

const maxTeamCount = computed(() => sortedTeamViolations.value[0]?.count || 1)

// ── Tab A: Feature-level table ──

const allFeatures = computed(() => {
  const features = []
  for (const ver of activeVersions.value) {
    for (const f of (ver.features || [])) {
      features.push({ ...f, version: ver.displayName || ver.versionId })
    }
  }
  return features
})

const popoverFeature = ref(null)
const popoverStyle = ref({})

function showViolations(feature, event) {
  if (feature.violationCount === 0) return
  if (popoverFeature.value?.key === feature.key && popoverFeature.value?.version === feature.version) {
    popoverFeature.value = null
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  popoverStyle.value = {
    position: 'absolute',
    top: (rect.bottom + window.scrollY + 6) + 'px',
    right: Math.max(12, window.innerWidth - rect.right) + 'px'
  }
  popoverFeature.value = feature
}

function closePopover() {
  popoverFeature.value = null
}

const featureSortKey = ref('violationCount')
const featureSortAsc = ref(false)

const sortedFeatures = computed(() => {
  const key = featureSortKey.value
  const dir = featureSortAsc.value ? 1 : -1
  return [...allFeatures.value].sort((a, b) => {
    const va = a[key] ?? ''
    const vb = b[key] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb)) * dir
  })
})

function toggleFeatureSort(key) {
  if (featureSortKey.value === key) {
    featureSortAsc.value = !featureSortAsc.value
  } else {
    featureSortKey.value = key
    featureSortAsc.value = key === 'key' || key === 'summary' || key === 'team'
  }
}

function sortIcon(key) {
  if (featureSortKey.value !== key) return ''
  return featureSortAsc.value ? ' ▲' : ' ▼'
}

// ── Tab B: Team accountability ──

const teamAccountability = computed(() => {
  const teamMap = {}
  for (const ver of activeVersions.value) {
    for (const f of (ver.features || [])) {
      const team = f.team || 'Unassigned'
      if (!teamMap[team]) {
        teamMap[team] = { team, totalFeatures: 0, featuresWithViolations: 0, totalViolations: 0, byCategory: {} }
      }
      teamMap[team].totalFeatures++
      if (f.violationCount > 0) {
        teamMap[team].featuresWithViolations++
        teamMap[team].totalViolations += f.violationCount
      }
      for (const vid of (f.violations || [])) {
        const cat = ruleDefinitions.value[vid]?.category || 'unknown'
        teamMap[team].byCategory[cat] = (teamMap[team].byCategory[cat] || 0) + 1
      }
    }
  }
  return Object.values(teamMap).sort((a, b) => b.totalViolations - a.totalViolations)
})

const categoryColors = {
  ownership: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  timeliness: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  metadata: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  lifecycle: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
}

const tabs = [
  { id: 'features', label: 'Features' },
  { id: 'teams', label: 'Team Accountability' }
]
</script>

<template>
  <div>
    <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">Program Hygiene Report</h2>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading report data...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- No data -->
    <div v-else-if="allVersions.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      No hygiene data available. Trigger a hygiene refresh from the Feature Status tab first.
    </div>

    <template v-else>
      <!-- Selection bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 px-5 py-4">
        <template v-if="hasSelection">
          <div class="flex items-start justify-between gap-4">
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Showing hygiene data for
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ familyNarrative }}</span>,
              <span class="font-semibold text-gray-900 dark:text-gray-100">version {{ selection.version }}</span>,
              covering the
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ phaseNarrative }}</span>
              {{ selection.phases.size === 1 ? 'phase' : 'phases' }}
              of the release lifecycle.
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                @click="openModal"
                class="px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >Select Release</button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-6">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Select a release version and product family to view hygiene data across the release lifecycle.
            </p>
            <button
              @click="openModal"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >Select Release</button>
          </div>
        </template>
      </div>

      <template v-if="hasSelection">
        <!-- Summary cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Versions</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ activeVersions.length }}</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Features</div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ totals.totalFeatures }}</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Features with Violations</div>
            <div class="text-2xl font-bold" :class="totals.featuresWithViolations > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'">
              {{ totals.featuresWithViolations }}
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Violations</div>
            <div class="text-2xl font-bold" :class="totals.totalViolations > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'">
              {{ totals.totalViolations }}
            </div>
          </div>
        </div>

        <!-- Two-column layout: by rule + by team bar charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <!-- Violations by rule -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Violations by Rule</h3>
            <div v-if="sortedRuleViolations.length === 0" class="text-sm text-gray-400">No violations found.</div>
            <div v-else class="space-y-2.5">
              <div v-for="rule in sortedRuleViolations" :key="rule.id" class="flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{{ rule.name }}</span>
                    <span class="px-1.5 py-0.5 text-[9px] font-medium rounded" :class="categoryColors[rule.category] || 'bg-gray-100 text-gray-600'">
                      {{ rule.category }}
                    </span>
                  </div>
                  <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-red-500 dark:bg-red-400 rounded-full transition-all"
                      :style="{ width: (rule.count / maxRuleCount * 100) + '%' }"
                    />
                  </div>
                </div>
                <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 w-10 text-right shrink-0">{{ rule.count }}</span>
              </div>
            </div>
          </div>

          <!-- Violations by team -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Violations by Team</h3>
            <div v-if="sortedTeamViolations.length === 0" class="text-sm text-gray-400">No violations found.</div>
            <div v-else class="space-y-2.5">
              <div v-for="team in sortedTeamViolations" :key="team.team" class="flex items-center gap-3">
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-medium text-gray-700 dark:text-gray-300 truncate mb-0.5">{{ team.team }}</div>
                  <div class="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-orange-500 dark:bg-orange-400 rounded-full transition-all"
                      :style="{ width: (team.count / maxTeamCount * 100) + '%' }"
                    />
                  </div>
                </div>
                <span class="text-sm font-semibold text-gray-900 dark:text-gray-100 w-10 text-right shrink-0">{{ team.count }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabbed detail section -->
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <!-- Tab bar -->
          <div class="border-b border-gray-200 dark:border-gray-700 px-4">
            <div class="flex gap-4">
              <button
                v-for="tab in tabs"
                :key="tab.id"
                @click="activeTab = tab.id"
                class="py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
                :class="activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
              >{{ tab.label }}</button>
            </div>
          </div>

          <!-- Tab: Features -->
          <div v-if="activeTab === 'features'">
            <div v-if="sortedFeatures.length === 0" class="p-6 text-center text-sm text-gray-400">
              No features in selected scope.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th class="px-4 py-2 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('key')">
                      Key{{ sortIcon('key') }}
                    </th>
                    <th class="px-4 py-2 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('summary')">
                      Summary{{ sortIcon('summary') }}
                    </th>
                    <th class="px-4 py-2 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('assignee')">
                      Assignee{{ sortIcon('assignee') }}
                    </th>
                    <th class="px-4 py-2 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('team')">
                      Team{{ sortIcon('team') }}
                    </th>
                    <th class="px-4 py-2 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('status')">
                      Status{{ sortIcon('status') }}
                    </th>
                    <th class="px-4 py-2 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('version')">
                      Version{{ sortIcon('version') }}
                    </th>
                    <th class="px-4 py-2 font-medium text-right cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleFeatureSort('violationCount')">
                      Violations{{ sortIcon('violationCount') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr v-for="f in sortedFeatures" :key="f.key + f.version" class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="px-4 py-2 whitespace-nowrap">
                      <div class="flex items-center gap-1.5">
                        <button
                          class="font-mono text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          @click="nav.navigateTo('feature-detail', {
                            key: f.key,
                            from: 'hygiene-report'
                          })"
                        >{{ f.key }}</button>
                        <a
                          :href="'https://redhat.atlassian.net/browse/' + f.key"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Open in Jira"
                          @click.stop
                        >
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      </div>
                    </td>
                    <td class="px-4 py-2 text-gray-900 dark:text-gray-100 max-w-md truncate">{{ f.summary }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ f.assignee }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ f.team }}</td>
                    <td class="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ f.status || '—' }}</td>
                    <td class="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{{ f.version }}</td>
                    <td class="px-4 py-2 text-right">
                      <button
                        v-if="f.violationCount > 0"
                        class="inline-flex items-center justify-center min-w-[1.5rem] px-1.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-800/40 cursor-pointer transition-colors"
                        @click="showViolations(f, $event)"
                      >
                        {{ f.violationCount }}
                      </button>
                      <span v-else class="text-gray-300 dark:text-gray-600">0</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="sortedFeatures.length > 0" class="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              {{ sortedFeatures.length }} feature{{ sortedFeatures.length !== 1 ? 's' : '' }}
            </div>

            <!-- Violations popover -->
            <teleport to="body">
              <div v-if="popoverFeature" class="fixed inset-0 z-40" @click="closePopover" />
              <div
                v-if="popoverFeature"
                :style="popoverStyle"
                class="z-50 w-80 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-xl"
              >
                <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                  <div class="min-w-0">
                    <button
                      class="text-xs font-mono text-primary-600 dark:text-primary-400 hover:underline"
                      @click="nav.navigateTo('feature-detail', {
                        key: popoverFeature.key,
                        from: 'hygiene-report'
                      })"
                    >{{ popoverFeature.key }}</button>
                    <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ popoverFeature.summary }}</div>
                  </div>
                  <button class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" @click="closePopover">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <ul class="px-4 py-3 space-y-2">
                  <li v-for="vid in popoverFeature.violations" :key="vid" class="flex items-start gap-2">
                    <span class="mt-0.5 px-1.5 py-0.5 text-[9px] font-medium rounded shrink-0" :class="categoryColors[ruleDefinitions[vid]?.category] || 'bg-gray-100 text-gray-600'">
                      {{ ruleDefinitions[vid]?.category || 'unknown' }}
                    </span>
                    <span class="text-sm text-gray-700 dark:text-gray-300">{{ ruleDefinitions[vid]?.name || vid }}</span>
                  </li>
                </ul>
              </div>
            </teleport>
          </div>

          <!-- Tab: Team Accountability -->
          <div v-if="activeTab === 'teams'">
            <div v-if="teamAccountability.length === 0" class="p-6 text-center text-sm text-gray-400">
              No features in selected scope.
            </div>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                    <th class="px-4 py-2 font-medium">Team</th>
                    <th class="px-4 py-2 font-medium text-right">Features</th>
                    <th class="px-4 py-2 font-medium text-right">With Violations</th>
                    <th class="px-4 py-2 font-medium text-right">Total Violations</th>
                    <th class="px-4 py-2 font-medium text-right">Ownership</th>
                    <th class="px-4 py-2 font-medium text-right">Timeliness</th>
                    <th class="px-4 py-2 font-medium text-right">Metadata</th>
                    <th class="px-4 py-2 font-medium text-right">Lifecycle</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr v-for="team in teamAccountability" :key="team.team" class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td class="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ team.team }}</td>
                    <td class="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300">{{ team.totalFeatures }}</td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="team.featuresWithViolations > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-400'">
                        {{ team.featuresWithViolations }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="team.totalViolations > 0 ? 'text-orange-600 dark:text-orange-400 font-semibold' : 'text-gray-400'">
                        {{ team.totalViolations }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="(team.byCategory.ownership || 0) > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'">
                        {{ team.byCategory.ownership || 0 }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="(team.byCategory.timeliness || 0) > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-300 dark:text-gray-600'">
                        {{ team.byCategory.timeliness || 0 }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="(team.byCategory.metadata || 0) > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-gray-300 dark:text-gray-600'">
                        {{ team.byCategory.metadata || 0 }}
                      </span>
                    </td>
                    <td class="px-4 py-2.5 text-right">
                      <span :class="(team.byCategory.lifecycle || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-300 dark:text-gray-600'">
                        {{ team.byCategory.lifecycle || 0 }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-if="teamAccountability.length > 0" class="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              {{ teamAccountability.length }} team{{ teamAccountability.length !== 1 ? 's' : '' }}
            </div>
          </div>
        </div>
      </template>
    </template>

    <!-- Release selection modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="cancelModal"></div>
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
          @keydown.escape="cancelModal"
        >
          <!-- Modal header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Release</h3>
            <button
              @click="cancelModal"
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Product Family -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Product Family</label>
            <div class="flex flex-wrap gap-2">
              <button
                @click="toggleAllFamilies"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="isAllFamiliesDraft
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >All</button>
              <button
                v-for="f in availableFamilies"
                :key="f"
                @click="toggleFamily(f)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.families.has(f)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ f.toUpperCase() }}</button>
            </div>
          </div>

          <!-- Version -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Version</label>
            <div v-if="draftVersions.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="v in draftVersions"
                :key="v"
                @click="selectVersionDraft(v)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.version === v
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ v }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a product family first.</p>
          </div>

          <!-- Phase -->
          <div class="mb-6">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Phase</label>
            <div v-if="draftPhases.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="p in draftPhases"
                :key="p"
                @click="togglePhase(p)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.phases.has(p)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ p }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a version first.</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="cancelModal"
              class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >Cancel</button>
            <button
              @click="applyModal"
              :disabled="!canApply"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >Apply</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
