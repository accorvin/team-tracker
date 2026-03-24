<template>
  <div>
    <!-- Back button -->
    <button
      @click="nav.goBack()"
      class="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4"
    >
      <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to directory
    </button>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-700 text-sm">{{ error }}</p>
    </div>

    <template v-else-if="team">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{{ team.name }}</h2>
            <p class="text-sm text-gray-500 mt-1">{{ team.org }}</p>
          </div>
          <RfeBacklogBadge :count="team.rfeCount || 0" :url="teamRfeUrl" />
        </div>

        <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <!-- PMs -->
          <div v-if="team.pms && team.pms.length > 0">
            <p class="text-xs text-gray-500 uppercase font-medium mb-1">Product Manager</p>
            <p class="text-sm text-gray-800">{{ team.pms.join(', ') }}</p>
          </div>
          <!-- Eng Leads -->
          <div v-if="team.staffEngineers && team.staffEngineers.length > 0">
            <p class="text-xs text-gray-500 uppercase font-medium mb-1">Engineering Lead</p>
            <p class="text-sm text-gray-800">{{ team.staffEngineers.join(', ') }}</p>
          </div>
          <!-- Board Links -->
          <div v-if="boardLinks.length > 0">
            <p class="text-xs text-gray-500 uppercase font-medium mb-1">Jira Board{{ boardLinks.length > 1 ? 's' : '' }}</p>
            <div class="flex flex-col gap-1">
              <a
                v-for="(board, i) in boardLinks"
                :key="i"
                :href="board.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-primary-600 hover:underline truncate"
              >
                {{ board.label }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Headcount by Role -->
      <div v-if="team.headcount" class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Headcount by Role</h3>
        <HeadcountChart :headcount="team.headcount" />
      </div>

      <!-- Components -->
      <div v-if="team.components && team.components.length > 0" class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Components</h3>
        <ComponentList :components="team.components" :rfeCounts="rfeCounts" :rfeConfig="rfeConfig" />
      </div>

      <!-- Open RFEs -->
      <div v-if="rfeIssues.length > 0" class="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <button class="flex items-center gap-2 group" @click="sections.rfes = !sections.rfes">
            <svg
              class="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-transform"
              :class="{ '-rotate-90': !sections.rfes }"
              xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
            <h3 class="text-lg font-semibold text-gray-900">
              Open RFEs
              <span class="text-sm font-normal text-gray-500 ml-2">{{ sortedRfeIssues.length }} of {{ rfeIssues.length }} issue{{ rfeIssues.length !== 1 ? 's' : '' }}</span>
            </h3>
          </button>
          <a
            v-if="teamRfeUrl !== '#'"
            :href="teamRfeUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-xs text-primary-600 hover:text-primary-700"
          >
            View in Jira
          </a>
        </div>
        <template v-if="sections.rfes">
          <div class="relative mb-4">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="rfeSearch"
              type="text"
              placeholder="Search RFEs by key, summary, component, status..."
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" @click="toggleRfeSort('key')">
                    Key <span v-if="rfeSort === 'key'">{{ rfeSortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" @click="toggleRfeSort('summary')">
                    Summary <span v-if="rfeSort === 'summary'">{{ rfeSortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" @click="toggleRfeSort('components')">
                    Components <span v-if="rfeSort === 'components'">{{ rfeSortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" @click="toggleRfeSort('status')">
                    Status <span v-if="rfeSort === 'status'">{{ rfeSortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" @click="toggleRfeSort('priority')">
                    Priority <span v-if="rfeSort === 'priority'">{{ rfeSortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:text-gray-700 select-none" @click="toggleRfeSort('created')">
                    Created <span v-if="rfeSort === 'created'">{{ rfeSortDir === 'asc' ? '▲' : '▼' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                <tr v-for="issue in sortedRfeIssues" :key="issue.key" class="hover:bg-gray-50">
                  <td class="px-4 py-3 whitespace-nowrap">
                    <a
                      :href="jiraIssueUrl(issue.key)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-primary-600 hover:text-primary-800 hover:underline font-medium"
                    >
                      {{ issue.key }}
                    </a>
                  </td>
                  <td class="px-4 py-3 text-gray-800">{{ issue.summary }}</td>
                  <td class="px-4 py-3">
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="comp in issue.components"
                        :key="comp"
                        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700"
                      >
                        {{ comp }}
                      </span>
                    </div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      :class="statusClass(issue.statusCategory)"
                    >
                      {{ issue.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-gray-600">{{ issue.priority }}</td>
                  <td class="px-4 py-3 whitespace-nowrap text-gray-500">{{ formatDate(issue.created) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

      <!-- Team Members -->
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        <button class="flex items-center gap-2 group mb-4" @click="sections.members = !sections.members">
          <svg
            class="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-transform"
            :class="{ '-rotate-90': !sections.members }"
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          <h3 class="text-lg font-semibold text-gray-900">
            Team Members
            <span class="text-sm font-normal text-gray-500 ml-2">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</span>
          </h3>
        </button>
        <TeamMembersTable v-if="sections.members" :members="members" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import HeadcountChart from '../components/HeadcountChart.vue'
import TeamMembersTable from '../components/TeamMembersTable.vue'
import ComponentList from '../components/ComponentList.vue'
import RfeBacklogBadge from '../components/RfeBacklogBadge.vue'
import { useOrgRoster } from '../composables/useOrgRoster'

const nav = inject('moduleNav')
const { loadTeamDetail, loadTeamMembers, loadRfeBacklog, loadRfeConfig } = useOrgRoster()

const team = ref(null)
const members = ref([])
const rfeCounts = ref({})
const rfeIssues = ref([])
const rfeConfig = ref({})
const loading = ref(true)
const error = ref(null)
const rfeSort = ref('created')
const rfeSortDir = ref('desc')
const rfeSearch = ref('')
const sections = reactive({ rfes: true, members: true })

const boardLinks = computed(() => {
  if (!team.value) return []
  // Use enriched boards array if available, fall back to boardUrls
  const boards = team.value.boards || (team.value.boardUrls || []).map(url => ({ url, name: null }))
  return boards.map((board, i) => ({
    url: board.url,
    label: board.name || fallbackBoardLabel(board.url, i)
  }))
})

const teamRfeUrl = computed(() => {
  if (!team.value?.components?.length || !rfeConfig.value.jiraHost) return '#'
  const config = rfeConfig.value
  const host = config.jiraHost
  const project = config.jiraProject || 'RHAIRFE'
  const issueType = config.rfeIssueType || 'Feature Request'
  const mapping = config.componentMapping || {}
  const jiraComps = team.value.components.map(c => mapping[c] || c)
  const compList = jiraComps.map(c => `"${c}"`).join(', ')
  const jql = `project = ${project} AND component in (${compList}) AND issuetype = "${issueType}" AND statusCategory != "Done"`
  return `${host}/issues/?jql=${encodeURIComponent(jql)}`
})

const PRIORITY_ORDER = { Blocker: 0, Critical: 1, Major: 2, Normal: 3, Minor: 4, Trivial: 5 }

const sortedRfeIssues = computed(() => {
  if (!rfeIssues.value.length) return []
  let filtered = rfeIssues.value
  if (rfeSearch.value) {
    const q = rfeSearch.value.toLowerCase()
    filtered = filtered.filter(issue =>
      issue.key.toLowerCase().includes(q) ||
      issue.summary.toLowerCase().includes(q) ||
      issue.status.toLowerCase().includes(q) ||
      issue.priority.toLowerCase().includes(q) ||
      (issue.components || []).some(c => c.toLowerCase().includes(q))
    )
  }
  const dir = rfeSortDir.value === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    switch (rfeSort.value) {
      case 'key': return dir * a.key.localeCompare(b.key, undefined, { numeric: true })
      case 'summary': return dir * a.summary.localeCompare(b.summary)
      case 'components': return dir * (a.components || []).join(', ').localeCompare((b.components || []).join(', '))
      case 'status': return dir * a.status.localeCompare(b.status)
      case 'priority': return dir * ((PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99))
      case 'created': return dir * a.created.localeCompare(b.created)
      default: return 0
    }
  })
})

function toggleRfeSort(column) {
  if (rfeSort.value === column) {
    rfeSortDir.value = rfeSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    rfeSort.value = column
    rfeSortDir.value = (column === 'priority' || column === 'created') ? 'desc' : 'asc'
  }
}

function jiraIssueUrl(key) {
  const host = rfeConfig.value.jiraHost || 'https://redhat.atlassian.net'
  return `${host}/browse/${key}`
}

function statusClass(category) {
  if (category === 'Done') return 'bg-green-100 text-green-800'
  if (category === 'In Progress') return 'bg-blue-100 text-blue-800'
  return 'bg-gray-100 text-gray-700'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString()
}

function fallbackBoardLabel(url, index) {
  try {
    const u = new URL(url)
    return `Board ${index + 1} — ${u.hostname}`
  } catch {
    return `Board ${index + 1}`
  }
}

onMounted(async () => {
  const teamKey = nav.params.value?.teamKey
  if (!teamKey) {
    error.value = 'No team specified'
    loading.value = false
    return
  }

  try {
    const [teamData, membersData] = await Promise.all([
      loadTeamDetail(teamKey),
      loadTeamMembers(teamKey),
    ])
    team.value = teamData
    members.value = membersData.members || []

    // Load RFE data and config for components
    if (teamData.components && teamData.components.length > 0) {
      try {
        const [rfeData, rfeConfigData] = await Promise.all([
          loadRfeBacklog(),
          loadRfeConfig()
        ])
        rfeConfig.value = rfeConfigData
        const counts = {}
        const seenKeys = new Set()
        const issues = []
        for (const comp of teamData.components) {
          if (rfeData.byComponent?.[comp]) {
            counts[comp] = rfeData.byComponent[comp].count
            for (const issue of (rfeData.byComponent[comp].issues || [])) {
              if (!seenKeys.has(issue.key)) {
                seenKeys.add(issue.key)
                issues.push(issue)
              }
            }
          }
        }
        rfeCounts.value = counts
        rfeIssues.value = issues
      } catch {
        // RFE data is optional
      }
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})
</script>
