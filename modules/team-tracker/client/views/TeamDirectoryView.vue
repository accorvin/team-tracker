<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useOrgRoster } from '../composables/useOrgRoster'
import OrgSelector from '../components/OrgSelector.vue'
import TeamCard from '../components/TeamCard.vue'

const nav = inject('moduleNav')
const { teams, orgs, selectedOrg, loading, error, searchQuery, sortBy, filteredTeams, loadTeams, loadOrgs } = useOrgRoster()

function openTeam(team) {
  nav.navigateTo('team-detail', { teamKey: `${team.org}::${team.name}` })
}

function selectOrg(org) {
  selectedOrg.value = org
  loadTeams(org)
}

onMounted(async () => {
  await Promise.all([loadTeams(), loadOrgs()])

  const orgParam = nav.params.value?.org
  if (orgParam) {
    selectedOrg.value = orgParam
    loadTeams(orgParam)
  }
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Team Directory</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ filteredTeams.length }} teams</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search teams..."
            class="w-64 pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select v-model="sortBy" class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="name">A–Z</option>
          <option value="headcount">Headcount</option>
          <option value="rfe">RFE Count</option>
        </select>
      </div>
    </div>

    <OrgSelector
      v-if="orgs.length > 1"
      :orgs="orgs"
      :model-value="selectedOrg"
      @select="selectOrg"
      class="mb-6"
    />

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="filteredTeams.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No Teams Found</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Try a different search or org filter.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <TeamCard
        v-for="team in filteredTeams"
        :key="`${team.org}::${team.name}`"
        :team="team"
        @click="openTeam(team)"
      />
    </div>
  </div>
</template>
