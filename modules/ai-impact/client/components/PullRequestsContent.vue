<script setup>
import { ref, computed, watch } from 'vue'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'
import PRMetricsRow from './PRMetricsRow.vue'
import PRCharts from './PRCharts.vue'
import PRTable from './PRTable.vue'
import { usePullRequests } from '../composables/usePullRequests.js'

const props = defineProps({
  timeWindow: { type: String, default: 'month' }
})

const emit = defineEmits(['update:timeWindow'])

const timeWindowRef = computed(() => props.timeWindow)
const selectedRepo = ref('all')
const knownRepos = ref([])

const { prData, loading, error, load, isAggregate } = usePullRequests(timeWindowRef, selectedRepo)

watch(prData, (data) => {
  if (!data) return
  // Update known repos from aggregate response (which includes the repos array)
  if (data.repos && Array.isArray(data.repos) && data.repos.length > 0) {
    if (typeof data.repos[0] === 'string') {
      knownRepos.value = [...data.repos].sort()
    } else {
      knownRepos.value = data.repos.map(r => r.repo).sort()
    }
  }
  // If only 1 repo, auto-select it (no "All" option needed)
  if (knownRepos.value.length === 1 && selectedRepo.value === 'all') {
    selectedRepo.value = knownRepos.value[0]
  }
}, { immediate: true })

const isEmpty = computed(() => !prData.value?.fetchedAt)
const noReposConfigured = computed(() => knownRepos.value.length === 0 && isEmpty.value)
const showAllOption = computed(() => knownRepos.value.length > 1)

const metrics = computed(() => prData.value?.metrics || null)
const trendData = computed(() => prData.value?.trendData || [])
const pullRequests = computed(() => prData.value?.pullRequests || [])
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold dark:text-gray-100">Pull Requests</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          AI involvement in PR velocity
          <span v-if="prData?.fetchedAt" class="ml-2 text-gray-400 dark:text-gray-500">&middot; {{ new Date(prData.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }} {{ new Date(prData.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select
          v-if="knownRepos.length > 0"
          v-model="selectedRepo"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option v-if="showAllOption" value="all">All Repos ({{ knownRepos.length }})</option>
          <option v-for="r in knownRepos" :key="r" :value="r">{{ r }}</option>
        </select>
        <select
          :value="timeWindow"
          @change="emit('update:timeWindow', $event.target.value)"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
        </select>
      </div>
    </header>

    <div class="flex-1 overflow-auto">
      <LoadingOverlay v-if="loading && !prData" />

      <div v-else-if="error" class="p-6">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 class="text-red-800 dark:text-red-200 font-medium">Failed to load data</h3>
          <p class="text-red-600 dark:text-red-400 text-sm mt-1">{{ error }}</p>
          <button
            @click="load"
            class="mt-3 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >Retry</button>
        </div>
      </div>

      <div v-else-if="noReposConfigured" class="p-6 flex flex-col items-center justify-center h-full">
        <div class="text-center max-w-md">
          <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Configure repos to get started</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            Add GitHub repos in Settings &gt; AI Impact to begin tracking PR analytics.
          </p>
        </div>
      </div>

      <div v-else-if="isEmpty" class="p-6 flex flex-col items-center justify-center h-full">
        <div class="text-center max-w-md">
          <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">No PR data yet</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            An admin can trigger a PR data refresh from Settings &gt; AI Impact.
          </p>
        </div>
      </div>

      <template v-else>
        <PRMetricsRow
          v-if="metrics"
          :metrics="metrics"
        />

        <PRCharts
          v-if="metrics"
          :metrics="metrics"
          :trendData="trendData"
        />

        <!-- PR table only shown for per-repo view -->
        <PRTable
          v-if="!isAggregate && pullRequests.length > 0"
          :pullRequests="pullRequests"
        />

        <div v-if="isAggregate && metrics" class="px-6 py-4">
          <p class="text-sm text-gray-500 dark:text-gray-400 text-center">
            Select a specific repo to view the PR table.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
