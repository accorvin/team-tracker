<template>
  <div>
    <template v-if="sprintData">
      <!-- Sprint Overview -->
      <SprintOverview
        :sprintData="sprintData"
        @drill-down="$emit('drill-down', $event)"
      />

      <!-- Trend Charts (2-up) -->
      <div v-if="trendData && trendData.length > 1" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
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

      <!-- Assignee Breakdown -->
      <div class="mt-6">
        <AssigneeBreakdown
          :byAssignee="sprintData.byAssignee"
          :trendData="trendData"
          @drill-down="$emit('assignee-drill-down', $event)"
        />
      </div>
    </template>

    <div v-else class="text-center py-12 text-gray-500">
      <p>No sprint data available. Try refreshing from Jira.</p>
    </div>
  </div>
</template>

<script setup>
import SprintOverview from './SprintOverview.vue'
import TrendChart from './TrendChart.vue'
import AssigneeBreakdown from './AssigneeBreakdown.vue'

defineProps({
  sprintData: { type: Object, default: null },
  trendData: { type: Array, default: null },
  trendLabels: { type: Array, default: () => [] }
})

defineEmits(['drill-down', 'assignee-drill-down'])
</script>
