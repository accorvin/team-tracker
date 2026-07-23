<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release Capacity &amp; Feature Commitment</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Key deadlines and capacity overview for a selected release</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
      Loading releases...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Selection summary bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 px-5 py-4">
        <template v-if="hasSelection">
          <div class="flex items-start justify-between gap-4">
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Showing key deadlines for
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ familyNarrative }}</span>,
              <span class="font-semibold text-gray-900 dark:text-gray-100">version {{ selection.version }}</span>,
              covering the
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ phaseNarrative }}</span>
              {{ selection.phases.size === 1 ? 'phase' : 'phases' }}
              of the release lifecycle.
            </div>
            <button
              @click="openModal"
              class="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >Change</button>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-6">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Select a release version and product family to view key milestone deadlines across the release lifecycle.
            </p>
            <button
              @click="openModal"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >Select Release</button>
          </div>
        </template>
      </div>

      <!-- Deadline cards -->
      <div v-if="hasSelection" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="card in deadlineCards"
          :key="card.phase"
          class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
        >
          <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phaseLabel }} Key Deadlines</h3>
          </div>

          <div v-if="!card.hasData" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            No milestone dates configured for this phase.
          </div>

          <!-- Single family layout -->
          <table v-else-if="card.isSingleFamily" class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Milestone</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Days Away</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in card.rows"
                :key="row.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
                :class="row.isNext ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''"
              >
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <span v-if="row.isPast" class="text-gray-400 dark:text-gray-500">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                    <span v-if="row.isNext" class="w-1 h-5 rounded-full bg-primary-500 shrink-0"></span>
                    <span :class="row.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100 font-medium'">
                      {{ row.label }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-2.5 tabular-nums" :class="row.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'">
                  {{ row.dateFormatted }}
                </td>
                <td class="px-4 py-2.5 tabular-nums" :class="row.daysClass">
                  {{ row.daysLabel }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Multi family layout -->
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Milestone</th>
                <th
                  v-for="f in card.families"
                  :key="f"
                  class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >{{ f.toUpperCase() }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in card.rows"
                :key="row.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">
                  {{ row.label }}
                </td>
                <td
                  v-for="f in card.families"
                  :key="f"
                  class="px-4 py-2.5"
                >
                  <template v-if="row.cells[f].dateFormatted !== '—'">
                    <div class="tabular-nums" :class="row.cells[f].isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'">
                      {{ row.cells[f].dateFormatted }}
                    </div>
                    <div class="text-[11px] tabular-nums" :class="row.cells[f].daysClass">
                      {{ row.cells[f].daysLabel }}
                    </div>
                  </template>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Modal -->
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
                @click="selectVersion(v)"
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

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

// ── Constants ──

const STORAGE_KEY = 'tt_cache:capacity-report-selection'
const MILESTONES = [
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Release Date' }
]
const PHASE_ORDER = ['EA1', 'EA2', 'GA']

// ── Core state ──

const nav = inject('moduleNav')
const releases = ref([])
const loading = ref(true)
const error = ref(null)
const modalOpen = ref(false)

const selection = reactive({ version: '', families: new Set(), phases: new Set() })
const draft = reactive({ version: '', families: new Set(), phases: new Set() })

// ── Registry parsing ──

function parseReleaseId(id) {
  const match = id.match(/^([a-z]+)-(\d+\.\d+)(?:\.z)?(?:\.(ea\d?))?$/i)
  if (!match) return null
  return { family: match[1].toLowerCase(), version: match[2], phase: match[3] ? match[3].toUpperCase() : 'GA' }
}

const parsedReleases = computed(() => {
  return releases.value
    .filter(r => r.state === 'active')
    .map(r => ({ ...r, ...parseReleaseId(r.id) }))
    .filter(r => r.family)
})

const availableFamilies = computed(() => {
  return [...new Set(parsedReleases.value.map(r => r.family))].sort()
})

// Versions available for the draft's selected families
const draftVersions = computed(() => {
  if (draft.families.size === 0) return []
  const filtered = parsedReleases.value.filter(r => draft.families.has(r.family))
  return [...new Set(filtered.map(r => r.version))].sort()
})

// Phases available for the draft's selected version + families
const draftPhases = computed(() => {
  if (!draft.version || draft.families.size === 0) return []
  const filtered = parsedReleases.value.filter(r =>
    r.version === draft.version && draft.families.has(r.family)
  )
  return [...new Set(filtered.map(r => r.phase))].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
})

const isAllFamiliesDraft = computed(() =>
  availableFamilies.value.length > 0 && draft.families.size === availableFamilies.value.length
)

const hasSelection = computed(() =>
  selection.version && selection.families.size > 0 && selection.phases.size > 0
)

const canApply = computed(() =>
  draft.version && draft.families.size > 0 && draft.phases.size > 0
)

// ── Summary display ──

const familyNarrative = computed(() => {
  if (selection.families.size === availableFamilies.value.length) return 'all product families'
  const names = [...selection.families].sort().map(f => f.toUpperCase())
  if (names.length === 1) return names[0]
  if (names.length === 2) return names[0] + ' and ' + names[1]
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1]
})

const phaseNarrative = computed(() => {
  const sorted = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  if (sorted.length === PHASE_ORDER.length) return 'EA1, EA2, and GA'
  if (sorted.length === 1) return sorted[0]
  if (sorted.length === 2) return sorted[0] + ' and ' + sorted[1]
  return sorted.slice(0, -1).join(', ') + ', and ' + sorted[sorted.length - 1]
})

// ── Data loading ──

async function fetchRegistry() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = data.releases || []
    restoreSelection()
  } catch (e) {
    error.value = e.message || 'Failed to load releases'
  } finally {
    loading.value = false
  }
}

onMounted(fetchRegistry)

function restoreSelection() {
  // Try URL params first
  const params = nav?.params?.value || {}
  if (params.version) {
    const families = params.families
      ? params.families.split(',').filter(f => availableFamilies.value.includes(f))
      : [...availableFamilies.value]
    const phases = params.phases
      ? params.phases.split(',').filter(p => PHASE_ORDER.includes(p.toUpperCase())).map(p => p.toUpperCase())
      : ['GA']

    if (families.length > 0 && phases.length > 0) {
      applySelection(params.version, new Set(families), new Set(phases))
      return
    }
  }

  // Try localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.version && parsed.families?.length && parsed.phases?.length) {
        const validFamilies = parsed.families.filter(f => availableFamilies.value.includes(f))
        const validPhases = parsed.phases.filter(p => PHASE_ORDER.includes(p))
        if (validFamilies.length > 0 && validPhases.length > 0) {
          applySelection(parsed.version, new Set(validFamilies), new Set(validPhases))
          return
        }
      }
    }
  } catch { /* ignore */ }

  // Smart default: latest version, all families, GA
  if (availableFamilies.value.length > 0) {
    const allVersions = [...new Set(parsedReleases.value.map(r => r.version))].sort()
    const latestVersion = pickDefaultVersion(allVersions)
    if (latestVersion) {
      applySelection(latestVersion, new Set(availableFamilies.value), new Set(['GA']))
    }
  }
}

function pickDefaultVersion(versions) {
  const now = Date.now()
  let best = null
  let bestDelta = Infinity

  for (const v of versions) {
    const gaReleases = parsedReleases.value.filter(r => r.version === v && r.phase === 'GA' && r.milestones?.ga)
    for (const r of gaReleases) {
      const ts = new Date(r.milestones.ga).getTime()
      const delta = ts - now
      if (delta >= 0 && delta < bestDelta) {
        bestDelta = delta
        best = v
      }
    }
  }

  return best || versions[versions.length - 1] || null
}

function applySelection(version, families, phases) {
  selection.version = version
  selection.families = families
  selection.phases = phases
  persistSelection()
}

function persistSelection() {
  const data = {
    version: selection.version,
    families: [...selection.families],
    phases: [...selection.phases]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  nav.updateParams({
    version: selection.version,
    families: [...selection.families].join(','),
    phases: [...selection.phases].map(p => p.toLowerCase()).join(',')
  })
}

// ── Modal logic ──

function openModal() {
  draft.version = selection.version
  draft.families = new Set(selection.families.size > 0 ? selection.families : availableFamilies.value)
  draft.phases = new Set(selection.phases.size > 0 ? selection.phases : ['GA'])
  modalOpen.value = true
}

function cancelModal() {
  modalOpen.value = false
}

function applyModal() {
  if (!canApply.value) return
  applySelection(draft.version, new Set(draft.families), new Set(draft.phases))
  modalOpen.value = false
}

function toggleAllFamilies() {
  draft.families = new Set(availableFamilies.value)
  reconcileDraftVersion()
}

function toggleFamily(family) {
  const next = new Set(draft.families)
  if (isAllFamiliesDraft.value) {
    // Was "all" — switch to just this one
    next.clear()
    next.add(family)
  } else if (next.has(family) && next.size > 1) {
    next.delete(family)
  } else {
    next.add(family)
  }
  draft.families = next
  reconcileDraftVersion()
}

function selectVersion(version) {
  draft.version = version
  reconcileDraftPhases()
}

function togglePhase(phase) {
  const next = new Set(draft.phases)
  if (next.has(phase) && next.size > 1) {
    next.delete(phase)
  } else {
    next.add(phase)
  }
  draft.phases = next
}

// Keep version/phase valid when families change
function reconcileDraftVersion() {
  if (draft.version && !draftVersions.value.includes(draft.version)) {
    draft.version = ''
    draft.phases = new Set()
  } else {
    reconcileDraftPhases()
  }
}

function reconcileDraftPhases() {
  const available = draftPhases.value
  const next = new Set([...draft.phases].filter(p => available.includes(p)))
  if (next.size === 0 && available.includes('GA')) next.add('GA')
  else if (next.size === 0 && available.length > 0) next.add(available[0])
  draft.phases = next
}

// Close modal on Escape
function handleEscape(e) {
  if (e.key === 'Escape' && modalOpen.value) cancelModal()
}
onMounted(() => document.addEventListener('keydown', handleEscape))
onUnmounted(() => document.removeEventListener('keydown', handleEscape))

// ── Deadline cards ──

const deadlineCards = computed(() => {
  if (!hasSelection.value) return []

  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  const sortedFamilies = [...selection.families].sort()
  const single = sortedFamilies.length === 1

  return sortedPhases.map(phase => {
    const familyReleases = {}
    for (const family of sortedFamilies) {
      familyReleases[family] = parsedReleases.value.find(r =>
        r.family === family && r.version === selection.version && r.phase === phase
      ) || null
    }

    const rows = []
    let foundNext = false

    for (const { key, label } of MILESTONES) {
      if (single) {
        const rel = familyReleases[sortedFamilies[0]]
        const dateStr = rel?.milestones?.[key] || null
        if (!dateStr) continue
        const days = daysFromNow(dateStr)
        const isPast = days !== null && days < 0
        const isNext = !isPast && !foundNext
        if (isNext) foundNext = true
        rows.push({
          key, label, dateFormatted: formatDate(dateStr), days, isPast, isNext,
          daysLabel: formatDaysLabel(days),
          daysClass: getDaysClass(days, isPast, isNext)
        })
      } else {
        const cells = {}
        let hasAny = false
        for (const family of sortedFamilies) {
          const rel = familyReleases[family]
          const dateStr = rel?.milestones?.[key] || null
          const days = daysFromNow(dateStr)
          const isPast = days !== null && days < 0
          if (dateStr) hasAny = true
          cells[family] = {
            dateFormatted: dateStr ? formatDate(dateStr) : '—',
            days, isPast,
            daysLabel: formatDaysLabel(days),
            daysClass: getDaysClass(days, isPast, false)
          }
        }
        if (!hasAny) continue
        rows.push({ key, label, cells })
      }
    }

    return {
      phase,
      phaseLabel: phase,
      families: sortedFamilies,
      isSingleFamily: single,
      rows,
      hasData: rows.length > 0
    }
  })
})

// ── Helpers ──

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function formatDaysLabel(days) {
  if (days === null) return '—'
  if (days === 0) return 'Today'
  if (days < 0) return Math.abs(days) + ' days ago'
  return days + ' days'
}

function getDaysClass(days, isPast, isNext) {
  if (days === null) return 'text-gray-300 dark:text-gray-600'
  if (isPast) return 'text-gray-400 dark:text-gray-500'
  if (days === 0) return 'font-semibold text-primary-600 dark:text-primary-400'
  if (isNext) return 'font-semibold text-gray-900 dark:text-gray-100'
  return 'text-gray-600 dark:text-gray-300'
}
</script>
