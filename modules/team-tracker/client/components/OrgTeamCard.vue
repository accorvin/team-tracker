<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all"
    @click="$emit('select', team)"
  >
    <div class="flex items-start justify-between mb-3">
      <h3 class="text-base font-semibold text-gray-900">{{ team.displayName }}</h3>
      <div class="flex items-center gap-2">
        <svg
          v-if="isUnassigned"
          class="h-4 w-4 text-amber-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          title="Members not yet assigned to a team"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-sm text-gray-500">{{ uniqueCount }} members</span>
      </div>
    </div>
    <div v-if="primaryDisplayField && Object.keys(breakdown).length > 0" class="flex flex-wrap gap-1.5">
      <DynamicFieldBadge
        v-for="(count, value) in breakdown"
        :key="value"
        :value="`${count} ${value}`"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DynamicFieldBadge from './DynamicFieldBadge.vue'
import { useRoster } from '@shared/client/composables/useRoster'

const props = defineProps({
  team: { type: Object, required: true }
})
defineEmits(['select'])

const { primaryDisplayField } = useRoster()

const uniqueMembers = computed(() => {
  const seen = new Set()
  return props.team.members.filter(m => {
    if (seen.has(m.jiraDisplayName)) return false
    seen.add(m.jiraDisplayName)
    return true
  })
})

const uniqueCount = computed(() => uniqueMembers.value.length)

const isUnassigned = computed(() => props.team.key.endsWith('::_unassigned'))

const breakdown = computed(() => {
  if (!primaryDisplayField.value) return {}
  const counts = {}
  for (const m of uniqueMembers.value) {
    const val = m.customFields?.[primaryDisplayField.value] || 'Other'
    counts[val] = (counts[val] || 0) + 1
  }
  return counts
})
</script>
