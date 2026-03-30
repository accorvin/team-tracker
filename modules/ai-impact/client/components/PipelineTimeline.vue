<script setup>
defineProps({
  rfe: { type: Object, required: true },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null }
})

function getPhaseSignal(phaseId, rfe) {
  switch (phaseId) {
    case 'rfe-review':
      return {
        completed: true,
        aiUsed: rfe.aiInvolvement !== 'none',
        detail: rfe.aiInvolvement !== 'none'
          ? `AI ${rfe.aiInvolvement === 'both' ? 'created & assessed' : rfe.aiInvolvement}`
          : 'No AI involvement'
      }
    case 'architecture':
      if (rfe.linkedFeature) {
        return {
          completed: false,
          aiUsed: null,
          detail: `${rfe.linkedFeature.key} - ${rfe.linkedFeature.status}`,
          linkedKey: rfe.linkedFeature.key,
          fixVersions: rfe.linkedFeature.fixVersions
        }
      }
      return { completed: false, aiUsed: null, detail: 'No linked feature' }
    case 'build-release':
      if (rfe.linkedFeature?.fixVersions?.length > 0) {
        return {
          completed: false,
          aiUsed: null,
          detail: `Target: ${rfe.linkedFeature.fixVersions.join(', ')}`
        }
      }
      return { completed: false, aiUsed: null, detail: 'No signals yet' }
    default:
      return { completed: false, aiUsed: null, detail: 'No signals yet' }
  }
}
</script>

<template>
  <div>
    <h5 class="text-sm font-medium mb-3 dark:text-gray-200">Pipeline Progress</h5>
    <div class="relative">
      <!-- Timeline line -->
      <div class="absolute left-4 top-6 bottom-6 w-px bg-gray-200 dark:bg-gray-700" />

      <div class="space-y-4">
        <div
          v-for="phase in phases"
          :key="phase.id"
          class="flex items-start gap-4 relative"
        >
          <div
            class="w-8 h-8 rounded-full flex items-center justify-center z-10"
            :class="{
              'bg-green-500 text-white': getPhaseSignal(phase.id, rfe).completed,
              'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600': phase.status === 'coming-soon' && !getPhaseSignal(phase.id, rfe).completed,
              'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400': phase.status === 'active' && !getPhaseSignal(phase.id, rfe).completed
            }"
          >
            <!-- Checkmark for completed -->
            <svg v-if="getPhaseSignal(phase.id, rfe).completed" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <!-- Lock for coming-soon -->
            <svg v-else-if="phase.status === 'coming-soon'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <!-- Circle for active but not completed -->
            <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke-width="2" />
            </svg>
          </div>

          <div class="flex-1 pt-1">
            <div class="flex items-center gap-2">
              <span
                class="text-sm font-medium dark:text-gray-200"
                :class="{ 'text-gray-300 dark:text-gray-600': phase.status === 'coming-soon' && phase.id !== 'build-release' }"
              >
                {{ phase.name }}
              </span>
              <svg
                v-if="getPhaseSignal(phase.id, rfe).aiUsed"
                class="h-3 w-3 text-blue-500 dark:text-blue-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>

            <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              <!-- Architecture: show linked feature link -->
              <template v-if="phase.id === 'architecture' && getPhaseSignal(phase.id, rfe).linkedKey">
                <a
                  v-if="jiraHost"
                  :href="`${jiraHost}/browse/${getPhaseSignal(phase.id, rfe).linkedKey}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {{ getPhaseSignal(phase.id, rfe).linkedKey }}
                </a>
                <span v-else>{{ getPhaseSignal(phase.id, rfe).linkedKey }}</span>
                - {{ getPhaseSignal(phase.id, rfe).detail.split(' - ')[1] }}
                <span v-if="getPhaseSignal(phase.id, rfe).fixVersions?.length > 0" class="ml-1">
                  ({{ getPhaseSignal(phase.id, rfe).fixVersions.join(', ') }})
                </span>
              </template>
              <template v-else-if="phase.status === 'coming-soon' && phase.id !== 'architecture' && phase.id !== 'build-release'">
                <span class="text-gray-300 dark:text-gray-600">No signals yet</span>
              </template>
              <template v-else>
                {{ getPhaseSignal(phase.id, rfe).detail }}
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
