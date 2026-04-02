<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Org-wide allocation bar -->
    <div v-if="orgSummary && orgSummary.totalPoints > 0" class="mb-6">
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-lg font-semibold text-gray-900">{{ orgName }} — Organization Overview</h2>
          <span class="text-sm text-gray-500">
            {{ orgSummary.totalPoints }} pts across {{ orgSummary.boardCount }} {{ orgSummary.boardCount === 1 ? 'board' : 'boards' }}
          </span>
        </div>
        <p class="text-xs text-gray-400 mb-2">Aggregated from each board's currently active sprint</p>
        <AllocationBar :buckets="orgSummary.buckets" :totalPoints="orgSummary.totalPoints" />
      </div>
    </div>

    <!-- Allocation legend -->
    <div data-testid="allocation-legend" class="flex items-center gap-4 mb-4 text-sm text-gray-600 flex-wrap">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-amber-400"></span>
        Tech Debt & Quality (40%)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-blue-400"></span>
        New Features (40%)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-green-400"></span>
        Learning & Enablement (20%)
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-gray-400"></span>
        Uncategorized
      </span>
    </div>

    <!-- Section divider -->
    <div class="flex items-center gap-3 mb-4 mt-2">
      <div class="flex-1 border-t border-gray-200"></div>
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        Projects{{ projects.length > 0 ? ` (${projects.length})` : '' }}
      </span>
      <div class="flex-1 border-t border-gray-200"></div>
    </div>

    <div v-if="projects.length === 0" class="text-center py-12 text-gray-500">
      <p class="text-lg">No projects configured.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ProjectCard
        v-for="project in projects"
        :key="project.key"
        :project="project"
        :summary="projectSummaries[project.key] || null"
        @select-project="$emit('select-project', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import AllocationBar from './AllocationBar.vue'
import ProjectCard from './ProjectCard.vue'

defineProps({
  orgName: {
    type: String,
    default: 'AI Engineering'
  },
  orgSummary: {
    type: Object,
    default: null
  },
  projects: {
    type: Array,
    default: () => []
  },
  projectSummaries: {
    type: Object,
    default: () => ({})
  }
})

defineEmits(['select-project'])
</script>
