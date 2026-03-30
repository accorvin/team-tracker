<script setup>
import { ref, computed } from 'vue'
import { useAIImpact } from '../composables/useAIImpact.js'
import PhaseSidebar from '../components/PhaseSidebar.vue'
import PhaseContent from '../components/PhaseContent.vue'
import ComingSoonPlaceholder from '../components/ComingSoonPlaceholder.vue'
import RFEDetailPanel from '../components/RFEDetailPanel.vue'

const selectedPhase = ref('rfe-review')
const selectedRFE = ref(null)
const timeWindow = ref('week')
const filter = ref('all')
const searchQuery = ref('')
const chartExpanded = ref(true)

const { rfeData, loading, error, load } = useAIImpact(timeWindow)

const metrics = computed(() => rfeData.value?.metrics || null)
const trendData = computed(() => rfeData.value?.trendData || [])
const breakdown = computed(() => rfeData.value?.breakdown || [])

const phases = [
  { id: 'rfe-review', name: 'RFE Review', order: 1, status: 'active' },
  { id: 'architecture', name: 'Architecture & Design', order: 2, status: 'coming-soon' },
  { id: 'implementation', name: 'Implementation', order: 3, status: 'coming-soon' },
  { id: 'qe-validation', name: 'QE / Validation', order: 4, status: 'coming-soon' },
  { id: 'security', name: 'Security Review', order: 5, status: 'coming-soon' },
  { id: 'documentation', name: 'Documentation', order: 6, status: 'coming-soon' },
  { id: 'build-release', name: 'Build & Release', order: 7, status: 'coming-soon' },
]

const activePhase = computed(() => phases.find(p => p.id === selectedPhase.value))

const timeWindowCutoff = computed(() => {
  const days = timeWindow.value === 'week' ? 7 : timeWindow.value === '3months' ? 90 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
})

const filteredRFEs = computed(() => {
  if (!rfeData.value?.issues) return []
  return rfeData.value.issues.filter(rfe => {
    const matchesTime = new Date(rfe.created) >= timeWindowCutoff.value
    const matchesFilter = filter.value === 'all' || rfe.aiInvolvement === filter.value
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = !q ||
      rfe.summary.toLowerCase().includes(q) ||
      rfe.key.toLowerCase().includes(q) ||
      (rfe.creatorDisplayName && rfe.creatorDisplayName.toLowerCase().includes(q))
    return matchesTime && matchesFilter && matchesSearch
  })
})

function handleRetry() {
  load()
}
</script>

<template>
  <div class="flex h-full bg-gray-50 dark:bg-gray-900">
    <PhaseSidebar
      :phases="phases"
      :selectedPhase="selectedPhase"
      @select="selectedPhase = $event; selectedRFE = null"
    />

    <template v-if="activePhase?.status === 'active'">
      <PhaseContent
        :phase="activePhase"
        :loading="loading"
        :error="error"
        :rfeData="rfeData"
        :metrics="metrics"
        :trendData="trendData"
        :breakdown="breakdown"
        :filteredRFEs="filteredRFEs"
        :timeWindow="timeWindow"
        :filter="filter"
        :searchQuery="searchQuery"
        :chartExpanded="chartExpanded"
        @update:timeWindow="timeWindow = $event"
        @update:filter="filter = $event"
        @update:searchQuery="searchQuery = $event"
        @update:chartExpanded="chartExpanded = $event"
        @selectRFE="selectedRFE = $event"
        @retry="handleRetry"
      />

      <RFEDetailPanel
        v-if="selectedRFE"
        :rfe="selectedRFE"
        :phases="phases"
        :jiraHost="rfeData?.jiraHost"
        @close="selectedRFE = null"
      />
    </template>

    <ComingSoonPlaceholder
      v-else
      :phaseName="activePhase?.name || 'this phase'"
    />
  </div>
</template>
