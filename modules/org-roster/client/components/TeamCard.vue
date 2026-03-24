<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-primary-300 hover:shadow-md transition-all"
    @click="$emit('select', team)"
  >
    <!-- Header -->
    <div class="flex items-start justify-between mb-2">
      <h3 class="text-base font-semibold text-gray-900">{{ team.name }}</h3>
      <span class="text-lg font-bold text-primary-600">{{ team.memberCount || 0 }}</span>
    </div>
    <p class="text-xs text-gray-500 mb-3">{{ team.org }}</p>

    <!-- PMs & Eng Lead -->
    <div class="space-y-1 mb-3 text-sm text-gray-600">
      <div v-if="team.productManagers && team.productManagers.length > 0" class="flex items-start gap-1.5">
        <span class="text-gray-400 shrink-0">PM:</span>
        <span>{{ team.productManagers.join(', ') }}</span>
      </div>
      <div v-if="team.engLeads && team.engLeads.length > 0" class="flex items-start gap-1.5">
        <span class="text-gray-400 shrink-0">Eng Lead:</span>
        <span>{{ team.engLeads.join(', ') }}</span>
      </div>
    </div>

    <!-- Role breakdown badges -->
    <div v-if="topRoles.length > 0" class="flex flex-wrap gap-1.5 mb-3">
      <span
        v-for="role in topRoles"
        :key="role.name"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
      >
        {{ role.count }} {{ role.name }}
      </span>
    </div>

    <!-- Components -->
    <div v-if="team.components && team.components.length > 0" class="flex flex-wrap gap-1 mb-3">
      <span
        v-for="comp in team.components.slice(0, 3)"
        :key="comp"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
      >
        {{ comp }}
      </span>
      <span
        v-if="team.components.length > 3"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-50 text-gray-500"
      >
        +{{ team.components.length - 3 }} more
      </span>
    </div>

    <!-- Footer: Board link + RFE count -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <a
          v-if="team.boardUrls && team.boardUrls.length > 0"
          :href="team.boardUrls[0]"
          target="_blank"
          rel="noopener noreferrer"
          class="text-gray-400 hover:text-primary-600"
          title="Jira Board"
          @click.stop
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
      <span
        v-if="team.rfeCount > 0"
        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
      >
        {{ team.rfeCount }} open RFEs
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  team: { type: Object, required: true }
})
defineEmits(['select'])

const topRoles = computed(() => {
  const hc = props.team.headcount?.byRole
  if (!hc) return []
  return Object.entries(hc)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }))
})
</script>
