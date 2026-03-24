<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[80vh] flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <h2 class="text-lg font-semibold text-gray-900">{{ title }} ({{ issues.length }})</h2>
        <button @click="$emit('close')" class="text-gray-400 hover:text-gray-600">
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Table -->
      <div class="overflow-auto flex-1 px-6">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white">
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('key')">
                Key {{ sortIcon('key') }}
              </th>
              <th class="text-left py-2 px-2 text-gray-500 font-medium">Summary</th>
              <th class="text-left py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('type')">
                Type {{ sortIcon('type') }}
              </th>
              <th class="text-left py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('assignee')">
                Assignee {{ sortIcon('assignee') }}
              </th>
              <th class="text-right py-2 px-2 text-gray-500 font-medium cursor-pointer hover:text-gray-700" @click="toggleSort('effectivePoints')">
                Points {{ sortIcon('effectivePoints') }}
              </th>
              <th class="text-center py-2 px-2 text-gray-500 font-medium">Est?</th>
              <th class="text-center py-2 px-2 text-gray-500 font-medium">Added?</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="issue in sortedIssues"
              :key="issue.key"
              class="border-b border-gray-100 hover:bg-gray-50"
            >
              <td class="py-2 px-2">
                <a :href="issue.url" target="_blank" rel="noopener" class="text-primary-600 hover:text-primary-800 font-mono text-xs">
                  {{ issue.key }}
                </a>
              </td>
              <td class="py-2 px-2 text-gray-900 max-w-md truncate">{{ issue.summary }}</td>
              <td class="py-2 px-2">
                <span :class="typeClass(issue.type)" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium">
                  {{ issue.type }}
                </span>
              </td>
              <td class="py-2 px-2 text-gray-700">{{ issue.assignee?.displayName || 'Unassigned' }}</td>
              <td class="py-2 px-2 text-right" :class="issue.isEstimated ? 'text-gray-700' : 'text-amber-600'">
                {{ issue.effectivePoints }}
              </td>
              <td class="py-2 px-2 text-center">
                <span v-if="issue.isEstimated" class="text-green-500">Y</span>
                <span v-else class="text-amber-500">N</span>
              </td>
              <td class="py-2 px-2 text-center">
                <span v-if="issue.wasAddedMidSprint" class="text-amber-500">Y</span>
                <span v-else class="text-gray-300">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div class="px-6 py-3 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500">
        {{ issues.length }} issue{{ issues.length !== 1 ? 's' : '' }}
        | {{ totalPoints }} total pts
        | {{ unestimatedCount }} unestimated
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  title: { type: String, default: 'Issues' },
  issues: { type: Array, default: () => [] }
})

defineEmits(['close'])

const sortField = ref('key')
const sortDir = ref('asc')

const sortedIssues = computed(() => {
  return [...props.issues].sort((a, b) => {
    let aVal, bVal
    if (sortField.value === 'assignee') {
      aVal = (a.assignee?.displayName || 'zzz').toLowerCase()
      bVal = (b.assignee?.displayName || 'zzz').toLowerCase()
    } else {
      aVal = a[sortField.value]
      bVal = b[sortField.value]
    }
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = (bVal || '').toLowerCase()
    }
    if (sortDir.value === 'asc') return aVal < bVal ? -1 : aVal > bVal ? 1 : 0
    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0
  })
})

const totalPoints = computed(() =>
  props.issues.reduce((sum, i) => sum + (i.effectivePoints || 0), 0)
)

const unestimatedCount = computed(() =>
  props.issues.filter(i => !i.isEstimated).length
)

function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = field === 'effectivePoints' ? 'desc' : 'asc'
  }
}

function sortIcon(field) {
  if (sortField.value !== field) return ''
  return sortDir.value === 'asc' ? '\u25B2' : '\u25BC'
}

function typeClass(type) {
  switch (type) {
    case 'Story': return 'bg-green-100 text-green-800'
    case 'Bug': return 'bg-red-100 text-red-800'
    case 'Task': return 'bg-blue-100 text-blue-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}
</script>
