<template>
  <div class="mt-4 border-t border-gray-200 pt-4">
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-sm font-medium text-gray-700">{{ assigneeName }} - Trend</h4>
      <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div v-if="chartData.length > 0">
      <TrendChart
        :labels="chartData.map(d => d.label)"
        :datasets="[
          {
            label: 'Points Completed',
            data: chartData.map(d => d.pointsCompleted),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)'
          },
          {
            label: 'Issues Completed',
            data: chartData.map(d => d.issuesCompleted),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22, 163, 74, 0.1)'
          }
        ]"
      />
    </div>
    <p v-else class="text-sm text-gray-400 italic">No trend data available for this person.</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import TrendChart from './TrendChart.vue'

const props = defineProps({
  assigneeName: { type: String, required: true },
  trendData: { type: Array, default: () => [] }
})

defineEmits(['close'])

const chartData = computed(() => {
  if (!props.trendData) return []

  return props.trendData.map(sprint => {
    const assigneeData = sprint.byAssignee?.[props.assigneeName]
    const name = sprint.sprintName || ''
    const match = name.match(/Sprint\s*(\d+)/i)
    const label = match ? `S${match[1]}` : name.slice(0, 15)

    return {
      label,
      pointsCompleted: assigneeData?.pointsCompleted || 0,
      issuesCompleted: assigneeData?.issuesCompleted || 0
    }
  })
})
</script>
