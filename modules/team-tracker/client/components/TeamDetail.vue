<template>
  <div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <button
          @click="$emit('back')"
          class="text-primary-600 hover:text-primary-800 font-medium flex items-center gap-1"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h2 class="text-xl font-bold text-gray-900">{{ board?.displayName || board?.name }}</h2>
      </div>
      <div v-if="viewMode === 'sprint-detail'" class="flex items-center gap-3">
        <SprintSelector
          v-if="sprints.length > 0"
          :sprints="sprints"
          :selectedSprintId="selectedSprint?.id"
          @select-sprint="$emit('select-sprint', $event)"
        />
        <SprintStatusBadge v-if="selectedSprint" :state="selectedSprint.state" />
        <span v-if="selectedSprint" class="text-sm text-gray-500">
          {{ formatDateRange(selectedSprint.startDate, selectedSprint.endDate) }}
        </span>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex gap-6">
        <button
          @click="$emit('switch-mode', 'overview')"
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="viewMode === 'overview'
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          Team Overview
        </button>
        <button
          @click="$emit('switch-mode', 'sprint-detail')"
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="viewMode === 'sprint-detail'
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
        >
          Sprint Detail
        </button>
      </nav>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading && viewMode === 'sprint-detail' && !sprintData" class="flex justify-center py-12">
      <svg class="animate-spin h-8 w-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>

    <!-- Team Overview mode -->
    <TeamOverview
      v-else-if="viewMode === 'overview'"
      :board="board"
      :trendData="trendData"
      :sprints="sprints"
      @select-sprint="$emit('select-sprint', $event)"
    />

    <!-- Sprint Detail mode -->
    <SprintDetailView
      v-else-if="viewMode === 'sprint-detail'"
      :sprintData="sprintData"
      :trendData="trendData"
      :trendLabels="trendLabels"
      @drill-down="openDrillDown"
      @assignee-drill-down="openAssigneeDrillDown"
    />

    <!-- Issue drill-down modal -->
    <IssueList
      v-if="drillDownVisible"
      :title="drillDownTitle"
      :issues="drillDownIssues"
      @close="drillDownVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SprintSelector from './SprintSelector.vue'
import SprintStatusBadge from './SprintStatusBadge.vue'
import TeamOverview from './TeamOverview.vue'
import SprintDetailView from './SprintDetail.vue'
import IssueList from './IssueList.vue'
import { formatDate } from '../utils/metrics'

const props = defineProps({
  board: { type: Object, default: null },
  sprints: { type: Array, default: () => [] },
  selectedSprint: { type: Object, default: null },
  sprintData: { type: Object, default: null },
  trendData: { type: Array, default: null },
  isLoading: { type: Boolean, default: false },
  viewMode: { type: String, default: 'overview' }
})

defineEmits(['select-sprint', 'back', 'switch-mode'])

const drillDownVisible = ref(false)
const drillDownTitle = ref('')
const drillDownIssues = ref([])

const trendLabels = computed(() => {
  if (!props.trendData) return []
  return props.trendData.map(d => {
    const name = d.sprintName || ''
    const match = name.match(/Sprint\s*(\d+)/i)
    return match ? `S${match[1]}` : name.slice(0, 15)
  })
})

function formatDateRange(start, end) {
  if (!start || !end) return ''
  return `${formatDate(start)} - ${formatDate(end)}`
}

function openDrillDown(category) {
  if (!props.sprintData) return

  const categoryMap = {
    committed: { title: 'Committed Issues', data: props.sprintData.committed },
    delivered: { title: 'Delivered Issues', data: props.sprintData.delivered },
    addedMidSprint: { title: 'Added Mid-Sprint', data: props.sprintData.addedMidSprint },
    removed: { title: 'Removed Issues', data: props.sprintData.removed },
    incomplete: { title: 'Incomplete Issues', data: props.sprintData.incomplete }
  }

  const entry = categoryMap[category]
  if (!entry) return

  drillDownTitle.value = entry.title
  drillDownIssues.value = entry.data.issues || []
  drillDownVisible.value = true
}

function openAssigneeDrillDown(assigneeName) {
  if (!props.sprintData?.byAssignee?.[assigneeName]) return

  drillDownTitle.value = `Issues: ${assigneeName}`
  drillDownIssues.value = props.sprintData.byAssignee[assigneeName].issues || []
  drillDownVisible.value = true
}
</script>
