<template>
  <div class="space-y-6">
    <!-- Rolling average summary cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        label="Reliability"
        :value="rollingReliability"
        unit="%"
        :subtitle="`${rollingSprintCount}-sprint rolling avg`"
        tooltip="Commitment reliability: delivered points / committed points over the last 6 closed sprints"
        :colorThresholds="{ good: 80, warn: 60 }"
      />
      <MetricCard
        label="Avg Velocity"
        :value="rollingVelocity"
        unit="pts"
        :subtitle="`${rollingSprintCount}-sprint rolling avg`"
        tooltip="Average story points delivered per sprint over the last 6 closed sprints"
      />
      <MetricCard
        label="Avg Scope Change"
        :value="rollingScopeChange"
        :subtitle="`${rollingSprintCount}-sprint rolling avg`"
        tooltip="Average number of issues added mid-sprint over the last 6 closed sprints"
      />
    </div>

    <!-- Trend charts (2-up) -->
    <div v-if="trendData && trendData.length > 1" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Velocity Trend</h3>
        <TrendChart
          :labels="trendLabels"
          :datasets="[{
            label: 'Velocity (pts)',
            data: trendData.map(d => d.velocityPoints),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)'
          }]"
        />
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-5">
        <h3 class="text-sm font-semibold text-gray-700 mb-3">Commitment Reliability Trend</h3>
        <TrendChart
          :labels="trendLabels"
          :datasets="[{
            label: 'Reliability (%)',
            data: trendData.map(d => d.commitmentReliabilityPoints),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)'
          }]"
          :suggestedMin="0"
          :suggestedMax="120"
        />
      </div>
    </div>

    <!-- Contribution donut chart -->
    <div class="bg-white rounded-lg border border-gray-200 p-5">
      <h3 class="text-sm font-semibold text-gray-700 mb-1">Contribution Breakdown</h3>
      <p class="text-xs text-gray-400 mb-4">Share of completed story points over last {{ rollingSprintCount }} sprints. Click a slice to see details.</p>
      <div v-if="contributionLabels.length > 0">
        <DoughnutChart
          :labels="contributionLabels"
          :data="contributionData"
          @slice-click="handleSliceClick"
        />
      </div>
      <p v-else class="text-sm text-gray-400 italic text-center py-8">
        No assignee data available in recent sprints
      </p>
    </div>

    <!-- Expanded sprint breakdown for selected associate -->
    <div v-if="selectedAssignee" class="bg-white rounded-lg border border-gray-200 p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-700">{{ selectedAssignee }} - Sprint Breakdown</h3>
        <button @click="selectedAssignee = null" class="text-gray-400 hover:text-gray-600">
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 px-2 text-gray-500 font-medium">Sprint</th>
              <th class="text-right py-2 px-2 text-gray-500 font-medium">Pts Done</th>
              <th class="text-right py-2 px-2 text-gray-500 font-medium">Issues Done</th>
              <th class="text-right py-2 px-2 text-gray-500 font-medium">Pts Assigned</th>
              <th class="text-right py-2 px-2 text-gray-500 font-medium">Completion</th>
              <th class="text-center py-2 px-2 text-gray-500 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in assigneeSprintRows"
              :key="row.sprintId"
              class="border-b border-gray-100 hover:bg-gray-50"
            >
              <td class="py-2 px-2 text-gray-900">
                <button
                  class="text-primary-600 hover:text-primary-800 text-left"
                  @click="$emit('select-sprint', row.sprintId)"
                >
                  {{ row.sprintName }}
                </button>
              </td>
              <td class="py-2 px-2 text-right text-gray-700">{{ row.pointsCompleted }}</td>
              <td class="py-2 px-2 text-right text-gray-700">{{ row.issuesCompleted }}</td>
              <td class="py-2 px-2 text-right text-gray-500">{{ row.pointsAssigned }}</td>
              <td class="py-2 px-2 text-right">
                <span :class="completionColor(row.completionRate)">{{ row.completionRate }}%</span>
              </td>
              <td class="py-2 px-2 text-center">
                <button
                  @click="openAnnotation(row)"
                  class="inline-flex items-center gap-1 text-gray-400 hover:text-primary-600"
                  :class="{ 'text-primary-600': row.annotationCount > 0 }"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span v-if="row.annotationCount > 0" class="text-xs font-medium">{{ row.annotationCount }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Annotation modal -->
    <AnnotationModal
      v-if="annotationModal.visible"
      :sprintName="annotationModal.sprintName"
      :assigneeName="annotationModal.assigneeName"
      :annotations="annotationModal.annotations"
      @close="annotationModal.visible = false"
      @save="handleSaveAnnotation"
      @delete="handleDeleteAnnotation"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import MetricCard from './MetricCard.vue'
import TrendChart from './TrendChart.vue'
import DoughnutChart from './DoughnutChart.vue'
import AnnotationModal from './AnnotationModal.vue'
import { getSprintAnnotations, saveAnnotation, deleteAnnotation } from '@shared/client/services/api'

const ROLLING_COUNT = 6

const props = defineProps({
  board: { type: Object, default: null },
  trendData: { type: Array, default: () => [] },
  sprints: { type: Array, default: () => [] }
})

defineEmits(['select-sprint'])

const selectedAssignee = ref(null)
const annotationsCache = ref({})

const annotationModal = ref({
  visible: false,
  sprintId: null,
  sprintName: '',
  assigneeName: '',
  annotations: []
})

const recentSprints = computed(() => {
  if (!props.trendData) return []
  return props.trendData.slice(-ROLLING_COUNT)
})

const rollingSprintCount = computed(() => recentSprints.value.length)

const rollingReliability = computed(() => {
  const sprints = recentSprints.value
  if (sprints.length === 0) return null
  let totalCommitted = 0
  let totalDelivered = 0
  for (const s of sprints) {
    totalCommitted += s.committedPoints || 0
    totalDelivered += s.deliveredPoints || 0
  }
  return totalCommitted > 0 ? Math.round((totalDelivered / totalCommitted) * 100) : 0
})

const rollingVelocity = computed(() => {
  const sprints = recentSprints.value
  if (sprints.length === 0) return null
  const total = sprints.reduce((sum, s) => sum + (s.velocityPoints || 0), 0)
  return Math.round(total / sprints.length)
})

const rollingScopeChange = computed(() => {
  const sprints = recentSprints.value
  if (sprints.length === 0) return null
  const total = sprints.reduce((sum, s) => sum + (s.scopeChangeCount || 0), 0)
  return +(total / sprints.length).toFixed(1)
})

const trendLabels = computed(() => {
  if (!props.trendData) return []
  return props.trendData.map(d => {
    const name = d.sprintName || ''
    const match = name.match(/Sprint\s*(\d+)/i)
    return match ? `S${match[1]}` : name.slice(0, 15)
  })
})

// Aggregate assignee contributions across recent sprints
const assigneeContributions = computed(() => {
  const contributions = {}
  for (const sprint of recentSprints.value) {
    if (!sprint.byAssignee) continue
    for (const [name, data] of Object.entries(sprint.byAssignee)) {
      if (!contributions[name]) contributions[name] = 0
      contributions[name] += data.pointsCompleted || 0
    }
  }
  // Sort by points descending
  return Object.entries(contributions)
    .filter(([, pts]) => pts > 0)
    .sort((a, b) => b[1] - a[1])
})

const contributionLabels = computed(() => assigneeContributions.value.map(([name]) => name))
const contributionData = computed(() => assigneeContributions.value.map(([, pts]) => pts))

// Sprint-by-sprint rows for selected assignee
const assigneeSprintRows = computed(() => {
  if (!selectedAssignee.value || !props.trendData) return []
  return recentSprints.value.map(sprint => {
    const data = sprint.byAssignee?.[selectedAssignee.value] || {}
    const sprintAnnotations = annotationsCache.value[sprint.sprintId]?.[selectedAssignee.value] || []
    return {
      sprintId: sprint.sprintId,
      sprintName: sprint.sprintName,
      pointsCompleted: data.pointsCompleted || 0,
      issuesCompleted: data.issuesCompleted || 0,
      pointsAssigned: data.pointsAssigned || 0,
      completionRate: data.completionRate || 0,
      annotationCount: sprintAnnotations.length
    }
  })
})

function handleSliceClick(assigneeName) {
  selectedAssignee.value = selectedAssignee.value === assigneeName ? null : assigneeName
  if (selectedAssignee.value) {
    loadAnnotationsForRecentSprints()
  }
}

async function loadAnnotationsForRecentSprints() {
  for (const sprint of recentSprints.value) {
    if (annotationsCache.value[sprint.sprintId]) continue
    try {
      const result = await getSprintAnnotations(sprint.sprintId)
      annotationsCache.value[sprint.sprintId] = result.annotations || {}
    } catch {
      annotationsCache.value[sprint.sprintId] = {}
    }
  }
}

function openAnnotation(row) {
  const sprintAnnotations = annotationsCache.value[row.sprintId]?.[selectedAssignee.value] || []
  annotationModal.value = {
    visible: true,
    sprintId: row.sprintId,
    sprintName: row.sprintName,
    assigneeName: selectedAssignee.value,
    annotations: sprintAnnotations
  }
}

async function handleSaveAnnotation({ text }) {
  const { sprintId, assigneeName } = annotationModal.value
  try {
    const annotation = await saveAnnotation(sprintId, { assignee: assigneeName, text })
    // Update cache
    if (!annotationsCache.value[sprintId]) annotationsCache.value[sprintId] = {}
    if (!annotationsCache.value[sprintId][assigneeName]) annotationsCache.value[sprintId][assigneeName] = []
    annotationsCache.value[sprintId][assigneeName].push(annotation)
    // Update modal list
    annotationModal.value.annotations = [...annotationsCache.value[sprintId][assigneeName]]
  } catch (error) {
    console.error('Failed to save annotation:', error)
  }
}

async function handleDeleteAnnotation(annotationId) {
  const { sprintId, assigneeName } = annotationModal.value
  try {
    await deleteAnnotation(sprintId, assigneeName, annotationId)
    // Update cache
    if (annotationsCache.value[sprintId]?.[assigneeName]) {
      annotationsCache.value[sprintId][assigneeName] =
        annotationsCache.value[sprintId][assigneeName].filter(a => a.id !== annotationId)
      annotationModal.value.annotations = [...annotationsCache.value[sprintId][assigneeName]]
    }
  } catch (error) {
    console.error('Failed to delete annotation:', error)
  }
}

function completionColor(rate) {
  if (rate >= 80) return 'text-green-600 font-medium'
  if (rate >= 60) return 'text-amber-600 font-medium'
  return 'text-red-600 font-medium'
}

// Reset selection when trend data changes
watch(() => props.trendData, () => {
  selectedAssignee.value = null
  annotationsCache.value = {}
})
</script>
