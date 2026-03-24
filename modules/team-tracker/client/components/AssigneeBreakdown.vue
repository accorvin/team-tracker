<template>
  <div class="bg-white rounded-lg border border-gray-200 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-sm font-semibold text-gray-700">Assignee Breakdown</h3>
      <MethodologyInfo text="Shows each person's contribution to the sprint. Points completed are based on delivered issues assigned to them. Completion rate = issues completed / issues assigned * 100." />
    </div>

    <div v-if="sortedAssignees.length === 0" class="text-sm text-gray-400 italic py-4 text-center">
      No assignee data available
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('name')">
              Assignee {{ sortIcon('name') }}
            </th>
            <th class="text-right py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('pointsCompleted')">
              Pts Done {{ sortIcon('pointsCompleted') }}
            </th>
            <th class="text-right py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('issuesCompleted')">
              Issues Done {{ sortIcon('issuesCompleted') }}
            </th>
            <th class="text-right py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('pointsAssigned')">
              Pts Assigned {{ sortIcon('pointsAssigned') }}
            </th>
            <th class="text-right py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('completionRate')">
              Completion {{ sortIcon('completionRate') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="assignee in sortedAssignees"
            :key="assignee.name"
            class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
            @click="handleRowClick(assignee.name)"
          >
            <td class="py-2 px-2 font-medium text-gray-900">{{ assignee.name }}</td>
            <td class="py-2 px-2 text-right text-gray-700">{{ assignee.pointsCompleted }}</td>
            <td class="py-2 px-2 text-right text-gray-700">{{ assignee.issuesCompleted }}</td>
            <td class="py-2 px-2 text-right text-gray-500">{{ assignee.pointsAssigned }}</td>
            <td class="py-2 px-2 text-right">
              <span :class="completionColor(assignee.completionRate)">{{ assignee.completionRate }}%</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Per-person trend chart -->
    <AssigneeTrend
      v-if="selectedAssignee"
      :assigneeName="selectedAssignee"
      :trendData="trendData"
      @close="selectedAssignee = null"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import MethodologyInfo from './MethodologyInfo.vue'
import AssigneeTrend from './AssigneeTrend.vue'

const props = defineProps({
  byAssignee: { type: Object, default: () => ({}) },
  trendData: { type: Array, default: null }
})

const emit = defineEmits(['drill-down'])

const sortField = ref('pointsCompleted')
const sortDir = ref('desc')
const selectedAssignee = ref(null)

const sortedAssignees = computed(() => {
  const entries = Object.entries(props.byAssignee).map(([name, data]) => ({
    name,
    ...data
  }))

  return entries.sort((a, b) => {
    let aVal = a[sortField.value]
    let bVal = b[sortField.value]
    if (sortField.value === 'name') {
      aVal = aVal.toLowerCase()
      bVal = bVal.toLowerCase()
    }
    if (sortDir.value === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
  })
})

function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = field === 'name' ? 'asc' : 'desc'
  }
}

function sortIcon(field) {
  if (sortField.value !== field) return ''
  return sortDir.value === 'asc' ? '\u25B2' : '\u25BC'
}

function completionColor(rate) {
  if (rate >= 80) return 'text-green-600 font-medium'
  if (rate >= 60) return 'text-amber-600 font-medium'
  return 'text-red-600 font-medium'
}

function handleRowClick(name) {
  if (props.trendData && props.trendData.length > 1) {
    selectedAssignee.value = selectedAssignee.value === name ? null : name
  } else {
    emit('drill-down', name)
  }
}
</script>
