<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  pullRequests: { type: Array, default: () => [] }
})

const searchQuery = ref('')
const stateFilter = ref('all')
const sortField = ref('updatedAt')
const sortDirection = ref('desc')
const currentPage = ref(1)
const PAGE_SIZE = 50

function toggleSort(field) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDirection.value = field === 'cycleTimeHours' || field === 'updatedAt' || field === 'createdAt' ? 'desc' : 'asc'
  }
  currentPage.value = 1
}

function sortIndicator(field) {
  if (sortField.value !== field) return ''
  return sortDirection.value === 'asc' ? ' ▲' : ' ▼'
}

const filteredPRs = computed(() => {
  let prs = props.pullRequests
  if (stateFilter.value !== 'all') {
    prs = prs.filter(pr => pr.state === stateFilter.value)
  }
  const q = searchQuery.value.toLowerCase()
  if (q) {
    prs = prs.filter(pr =>
      pr.title.toLowerCase().includes(q) ||
      pr.author.toLowerCase().includes(q) ||
      pr.repo.toLowerCase().includes(q) ||
      String(pr.number).includes(q)
    )
  }
  return prs
})

const sortedPRs = computed(() => {
  const prs = [...filteredPRs.value]
  const dir = sortDirection.value === 'asc' ? 1 : -1
  prs.sort((a, b) => {
    let va = a[sortField.value]
    let vb = b[sortField.value]
    if (sortField.value === 'size') {
      va = (a.additions || 0) + (a.deletions || 0)
      vb = (b.additions || 0) + (b.deletions || 0)
    }
    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    if (typeof va === 'string') return va.localeCompare(vb) * dir
    return (va - vb) * dir
  })
  return prs
})

const totalPages = computed(() => Math.max(1, Math.ceil(sortedPRs.value.length / PAGE_SIZE)))
const paginatedPRs = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return sortedPRs.value.slice(start, start + PAGE_SIZE)
})

function formatCycleTime(hours) {
  if (hours == null) return '—'
  if (hours < 24) return `${Math.round(hours)}h`
  return `${Math.round(hours / 24 * 10) / 10}d`
}

function agingClass(pr) {
  if (pr.state !== 'open') return ''
  const hours = (Date.now() - new Date(pr.createdAt).getTime()) / 3600000
  if (hours >= 336) return 'bg-red-500'
  if (hours >= 168) return 'bg-orange-500'
  if (hours >= 48) return 'bg-amber-500'
  if (hours >= 24) return 'bg-lime-500'
  return 'bg-green-500'
}

function formatSize(pr) {
  return `+${pr.additions}/-${pr.deletions}`
}

const SIZE_COLORS = {
  XS: 'text-green-600 dark:text-green-400',
  S: 'text-lime-600 dark:text-lime-400',
  M: 'text-amber-600 dark:text-amber-400',
  L: 'text-orange-600 dark:text-orange-400',
  XL: 'text-red-600 dark:text-red-400'
}

function sizeColorClass(bucket) {
  return SIZE_COLORS[bucket] || 'text-gray-500 dark:text-gray-400'
}

function aiCommentPct(pr) {
  const total = pr.totalReviewThreads || 0
  if (total === 0) return null
  const ai = pr.aiThreads?.total || 0
  return Math.round((ai / total) * 100)
}

function aiThreadCount(pr) {
  return pr.aiThreads?.total || 0
}

function humanThreadCount(pr) {
  const total = pr.totalReviewThreads || 0
  const ai = pr.aiThreads?.total || 0
  return total - ai
}

function humanCommentPct(pr) {
  const total = pr.totalReviewThreads || 0
  if (total === 0) return null
  return 100 - Math.round(((pr.aiThreads?.total || 0) / total) * 100)
}
</script>

<template>
  <div class="px-6 pb-6">
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Pull Requests
          <span class="text-xs font-normal text-gray-400 dark:text-gray-500 ml-1">{{ filteredPRs.length }} total</span>
        </h3>
        <div class="flex items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search PRs..."
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 w-48"
          />
          <select
            v-model="stateFilter"
            class="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300"
          >
            <option value="all">All States</option>
            <option value="merged">Merged</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleSort('repo')">
                Repo{{ sortIndicator('repo') }}
              </th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleSort('title')">
                Title{{ sortIndicator('title') }}
              </th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleSort('author')">
                Author{{ sortIndicator('author') }}
              </th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium" title="AI bot review threads: count and percentage of total">AI Reviews</th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium" title="Human review threads: count and percentage of total">Human Reviews</th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleSort('size')">
                Size{{ sortIndicator('size') }}
              </th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleSort('cycleTimeHours')">
                Cycle Time{{ sortIndicator('cycleTimeHours') }}
              </th>
              <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" @click="toggleSort('state')">
                State{{ sortIndicator('state') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="pr in paginatedPRs"
              :key="`${pr.repo}#${pr.number}`"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <td class="px-5 py-2 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                {{ pr.repo.split('/')[1] }}
              </td>
              <td class="px-5 py-2 max-w-xs truncate">
                <a
                  :href="pr.url"
                  target="_blank"
                  rel="noopener"
                  class="text-primary-600 dark:text-blue-400 hover:underline"
                >#{{ pr.number }} {{ pr.title }}</a>
              </td>
              <td class="px-5 py-2 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                {{ pr.author }}
                <span v-if="pr.authorIsBot" class="ml-1 text-[10px] text-gray-400 dark:text-gray-500">(bot)</span>
              </td>
              <td class="px-5 py-2 text-xs whitespace-nowrap">
                <template v-if="aiCommentPct(pr) != null">
                  <span class="font-medium text-purple-600 dark:text-purple-400">{{ aiThreadCount(pr) }}</span>
                  <span class="text-gray-400 dark:text-gray-500 ml-0.5">({{ aiCommentPct(pr) }}%)</span>
                </template>
                <span v-else class="text-gray-400 dark:text-gray-500">—</span>
              </td>
              <td class="px-5 py-2 text-xs whitespace-nowrap">
                <template v-if="humanCommentPct(pr) != null">
                  <span class="font-medium text-sky-600 dark:text-sky-400">{{ humanThreadCount(pr) }}</span>
                  <span class="text-gray-400 dark:text-gray-500 ml-0.5">({{ humanCommentPct(pr) }}%)</span>
                </template>
                <span v-else class="text-gray-400 dark:text-gray-500">—</span>
              </td>
              <td class="px-5 py-2 text-xs whitespace-nowrap">
                <span class="text-gray-600 dark:text-gray-400">{{ formatSize(pr) }}</span>
                <span class="font-semibold ml-1" :class="sizeColorClass(pr.sizeBucket)">{{ pr.sizeBucket }}</span>
              </td>
              <td class="px-5 py-2 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                {{ formatCycleTime(pr.cycleTimeHours) }}
              </td>
              <td class="px-5 py-2">
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="pr.state === 'open'"
                    class="w-2 h-2 rounded-full shrink-0"
                    :class="agingClass(pr)"
                  />
                  <span
                    class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    :class="pr.state === 'merged'
                      ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
                      : pr.state === 'closed'
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
                        : 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'"
                  >{{ pr.state }}</span>
                </div>
              </td>
            </tr>
            <tr v-if="paginatedPRs.length === 0">
              <td colspan="8" class="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                No pull requests found matching the current filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <div class="flex items-center gap-1">
          <button
            :disabled="currentPage <= 1"
            @click="currentPage--"
            class="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >Prev</button>
          <button
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
            class="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
