<template>
  <div
    class="bg-white rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-primary-300 hover:shadow-sm transition-all"
    @click="$emit('select', member)"
  >
    <div class="flex items-start justify-between">
      <div class="min-w-0">
        <h4 class="text-sm font-semibold text-gray-900 truncate">{{ member.name }}</h4>
        <DynamicFieldBadge
          v-if="primaryDisplayField && member.customFields"
          :value="member.customFields[primaryDisplayField]"
          class="mt-1"
        />
      </div>
      <span
        v-if="teamCount > 1"
        class="flex-shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700"
        :title="`Member of ${teamCount} teams`"
      >
        {{ teamCount }} teams
      </span>
    </div>
    <div class="mt-2 text-xs text-gray-500 space-y-0.5">
      <p v-if="member.manager" class="truncate">
        <span class="text-gray-400">Mgr:</span> {{ member.manager }}
      </p>
      <template v-if="member.customFields">
        <p
          v-for="field in nonPrimaryVisibleFields"
          :key="field.key"
          class="truncate"
        >
          <span class="text-gray-400">{{ field.label }}:</span> {{ member.customFields[field.key] || '—' }}
        </p>
      </template>
      <p v-if="metrics?.nameNotFound" class="truncate">
        <span class="text-gray-400 italic">no Jira user</span>
      </p>
      <p v-else-if="metrics" class="truncate">
        <span class="text-gray-400">Resolved (90d):</span> {{ metrics.resolvedCount ?? '--' }}
        <span class="mx-1 text-gray-300">·</span>
        <span class="text-gray-400">Points:</span> {{ metrics.resolvedPoints ?? '--' }}
      </p>
      <p class="truncate">
        <span class="text-gray-400">GitHub:</span>
        <template v-if="githubContributions != null">{{ githubContributions.totalContributions }} contributions</template>
        <span v-else-if="member.githubUsername" class="text-gray-300">—</span>
        <span v-else class="text-gray-300 italic text-xs" title="GitHub username not configured">no GitHub</span>
      </p>
      <p class="truncate">
        <span class="text-gray-400">GitLab:</span>
        <template v-if="gitlabContributions != null">{{ gitlabContributions.totalContributions }} contributions</template>
        <span v-else-if="member.gitlabUsername" class="text-gray-300">—</span>
        <span v-else class="text-gray-300 italic text-xs" title="GitLab username not configured">no GitLab</span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import DynamicFieldBadge from './DynamicFieldBadge.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'

const props = defineProps({
  member: { type: Object, required: true },
  teamCount: { type: Number, default: 1 },
  metrics: { type: Object, default: null }
})
defineEmits(['select'])

const { visibleFields, primaryDisplayField } = useRoster()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributionsFn } = useGitlabStats()
const githubContributions = computed(() => getContributions(props.member.githubUsername))
const gitlabContributions = computed(() => getGitlabContributionsFn(props.member.gitlabUsername))

const nonPrimaryVisibleFields = computed(() => {
  return visibleFields.value.filter(f => f.key !== primaryDisplayField.value)
})
</script>
