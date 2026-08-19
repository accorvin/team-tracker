<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
    <div class="flex flex-wrap items-center gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
      <label class="relative min-w-[12rem] flex-1 max-w-sm">
        <span class="sr-only">Search feedback issues</span>
        <input
          v-model="filters.search"
          type="search"
          placeholder="Search key, summary, person..."
          aria-label="Search feedback issues"
          data-testid="bu-feedback-search"
          class="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md pl-3 pr-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
        />
      </label>

      <select
        v-model="filters.issueType"
        aria-label="Filter by type"
        data-testid="bu-feedback-filter-type"
        :class="selectClass"
      >
        <option value="">All types</option>
        <option v-for="opt in filterOptions.issueType" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <select
        v-model="filters.status"
        aria-label="Filter by status"
        data-testid="bu-feedback-filter-status"
        :class="selectClass"
      >
        <option value="">All statuses</option>
        <option v-for="opt in filterOptions.status" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <select
        v-model="filters.priority"
        aria-label="Filter by priority"
        data-testid="bu-feedback-filter-priority"
        :class="selectClass"
      >
        <option value="">All priorities</option>
        <option v-for="opt in filterOptions.priority" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <select
        v-model="filters.component"
        aria-label="Filter by component"
        data-testid="bu-feedback-filter-component"
        :class="selectClass"
      >
        <option value="">All components</option>
        <option v-for="opt in filterOptions.component" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <select
        v-model="filters.source"
        aria-label="Filter by source"
        data-testid="bu-feedback-filter-source"
        :class="selectClass"
      >
        <option value="">All sources</option>
        <option v-for="opt in filterOptions.source" :key="opt" :value="opt">{{ sourceShortLabel(opt) }}</option>
      </select>

      <button
        v-if="filtersActive"
        type="button"
        data-testid="bu-feedback-clear-filters"
        class="px-2.5 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        @click="clearFilters"
      >
        Clear
      </button>

      <span class="ml-auto text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" data-testid="bu-feedback-count">
        <template v-if="paged.total">{{ paged.start }}–{{ paged.end }} of {{ paged.total }}</template>
        <template v-else>0 issues</template>
      </span>
    </div>

    <div class="overflow-x-auto">
      <table role="table" class="w-full table-fixed text-sm" data-testid="bu-feedback-table">
        <thead role="rowgroup" class="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <tr role="row">
            <th
              v-for="col in columns"
              :key="col.key"
              role="columnheader"
              :scope="'col'"
              :aria-sort="sortAria(col.key)"
              :class="['px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide', col.widthClass, col.hideClass]"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200"
                @click="toggleSort(col.key)"
              >
                {{ col.label }}
                <span v-if="sortKey === col.key" class="text-[10px] leading-none">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr v-if="!paged.items.length">
            <td :colspan="columns.length" class="px-4 py-10 text-center text-gray-400 dark:text-gray-500">
              {{ props.issues.length ? 'No issues match the current filters' : 'No feedback issues found' }}
            </td>
          </tr>
          <template v-for="issue in paged.items" :key="issue.key">
            <tr
              role="row"
              :data-testid="'bu-feedback-row-' + issue.key"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-primary-50/40 dark:hover:bg-gray-800/60 cursor-pointer even:bg-gray-50/70 dark:even:bg-gray-800/30"
              :class="expandedKey === issue.key ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''"
              @click="toggleExpand(issue.key)"
            >
              <td class="px-3 py-2.5 align-top">
                <div class="flex items-start gap-1.5 min-w-0">
                  <span class="mt-0.5 text-gray-400 dark:text-gray-500 text-xs shrink-0" aria-hidden="true">
                    {{ expandedKey === issue.key ? '▾' : '▸' }}
                  </span>
                  <div class="min-w-0">
                    <a
                      :href="issue.url"
                      target="_blank"
                      rel="noopener"
                      class="text-primary-600 dark:text-primary-400 hover:underline font-medium whitespace-nowrap"
                      @click.stop
                    >{{ issue.key }}</a>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <span
                        v-for="lbl in (issue.feedbackLabels || [])"
                        :key="lbl"
                        class="inline-block px-1.5 py-0.5 text-[10px] font-semibold rounded"
                        :class="lbl === 'AIBU_Feedback' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'"
                        :title="lbl"
                      >{{ sourceShortLabel(lbl) }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5 align-top min-w-0">
                <div class="min-w-0">
                  <span
                    class="inline-block w-fit max-w-full px-1.5 py-0.5 text-[10px] font-semibold rounded leading-tight"
                    :class="typeBadgeClass(issue.issueType)"
                  >{{ issue.issueType || '—' }}</span>
                  <p class="mt-1 text-gray-900 dark:text-gray-100 leading-snug line-clamp-2" :title="issue.summary">{{ issue.summary }}</p>
                  <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400 truncate">
                    {{ issue.assignee || 'Unassigned' }}
                    <span class="md:hidden">
                      <span v-if="(issue.components || []).length"> · {{ (issue.components || []).join(', ') }}</span>
                    </span>
                  </p>
                </div>
              </td>
              <td class="px-3 py-2.5 align-top hidden md:table-cell">
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="comp in componentChips(issue).shown"
                    :key="comp"
                    class="inline-block max-w-[9rem] truncate px-1.5 py-0.5 text-[11px] rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    :title="comp"
                  >{{ comp }}</span>
                  <span
                    v-if="componentChips(issue).overflow"
                    class="inline-block px-1.5 py-0.5 text-[11px] rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    :title="componentChips(issue).overflowTitle"
                  >+{{ componentChips(issue).overflow }}</span>
                  <span v-if="!(issue.components || []).length" class="text-gray-400 dark:text-gray-500">—</span>
                </div>
              </td>
              <td class="px-3 py-2.5 align-top">
                <span
                  class="inline-block max-w-full truncate px-2 py-0.5 text-xs font-medium rounded-full"
                  :class="statusClasses(issue.statusCategory)"
                  :title="issue.status"
                >{{ issue.status }}</span>
              </td>
              <td class="px-3 py-2.5 align-top hidden sm:table-cell whitespace-nowrap">
                <span class="inline-flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                  <span :class="priorityDot(issue.priority)" class="w-2 h-2 rounded-full inline-block shrink-0" />
                  <span class="truncate">{{ issue.priority || '—' }}</span>
                </span>
              </td>
              <td class="px-3 py-2.5 align-top hidden lg:table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {{ formatDate(issue.created) }}
              </td>
            </tr>
            <tr v-if="expandedKey === issue.key" class="bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700">
              <td :colspan="columns.length" class="px-4 py-3">
                <dl class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Assignee</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ issue.assignee || 'Unassigned' }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Reporter</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ issue.reporter || '—' }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Resolution</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ issue.resolution || '—' }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Created</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ formatDate(issue.created) || '—' }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Updated</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ formatDate(issue.updated) || '—' }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Due date</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ issue.dueDate ? formatDate(issue.dueDate) : 'None' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Components</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ (issue.components || []).join(', ') || '—' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-gray-400 dark:text-gray-500 uppercase tracking-wide">Fix versions</dt>
                    <dd class="text-gray-800 dark:text-gray-200 mt-0.5">{{ (issue.fixVersions || []).join(', ') || '—' }}</dd>
                  </div>
                </dl>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div
      v-if="paged.pageCount > 1"
      class="flex items-center justify-between gap-3 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60"
    >
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40"
        :disabled="paged.page <= 1"
        data-testid="bu-feedback-prev-page"
        @click="page = paged.page - 1"
      >
        Previous
      </button>
      <span class="text-xs text-gray-500 dark:text-gray-400">Page {{ paged.page }} of {{ paged.pageCount }}</span>
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800 disabled:opacity-40"
        :disabled="paged.page >= paged.pageCount"
        data-testid="bu-feedback-next-page"
        @click="page = paged.page + 1"
      >
        Next
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import {
  PAGE_SIZE,
  emptyFilters,
  hasActiveFilters,
  collectFilterOptions,
  filterIssues,
  sortIssues,
  paginate,
  sourceShortLabel,
  typeBadgeClass,
  statusClasses,
  priorityDot,
  formatDate,
  visibleChips
} from '../utils/bu-feedback-table.js'

var props = defineProps({
  issues: { type: Array, default: function() { return [] } }
})

var selectClass = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2.5 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 max-w-[11rem]'

var columns = [
  { key: 'key', label: 'Key', widthClass: 'w-44' },
  { key: 'summary', label: 'Issue' },
  { key: 'component', label: 'Components', widthClass: 'w-40', hideClass: 'hidden md:table-cell' },
  { key: 'status', label: 'Status', widthClass: 'w-28' },
  { key: 'priority', label: 'Priority', widthClass: 'w-24', hideClass: 'hidden sm:table-cell' },
  { key: 'created', label: 'Created', widthClass: 'w-24', hideClass: 'hidden lg:table-cell' }
]

var filters = reactive(emptyFilters())
var sortKey = ref('created')
var sortDir = ref('desc')
var page = ref(1)
var expandedKey = ref(null)

var filterOptions = computed(function() {
  return collectFilterOptions(props.issues)
})

var filtersActive = computed(function() {
  return hasActiveFilters(filters)
})

var sortedIssues = computed(function() {
  return sortIssues(filterIssues(props.issues, filters), sortKey.value, sortDir.value)
})

var paged = computed(function() {
  return paginate(sortedIssues.value, page.value, PAGE_SIZE)
})

watch(filters, function() {
  page.value = 1
  expandedKey.value = null
}, { deep: true })

function clearFilters() {
  Object.assign(filters, emptyFilters())
}

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'created' || key === 'updated' ? 'desc' : 'asc'
  }
  page.value = 1
}

function sortAria(key) {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function toggleExpand(key) {
  expandedKey.value = expandedKey.value === key ? null : key
}

function componentChips(issue) {
  return visibleChips(issue.components)
}
</script>
