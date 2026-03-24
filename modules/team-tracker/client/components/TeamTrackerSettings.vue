<template>
  <div class="space-y-6">
    <!-- Sub-tabs for Team Tracker settings -->
    <div class="flex space-x-4 border-b border-gray-200">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        class="pb-2 px-1 text-sm font-medium border-b-2 transition-colors"
        :class="activeTab === tab.id
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
      >
        {{ tab.label }}
      </button>
    </div>

    <RosterSyncSettings v-if="activeTab === 'roster-sync'" />
    <TeamStructureSettings v-if="activeTab === 'team-structure'" />
    <JiraSyncSettings v-if="activeTab === 'jira-sync'" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import RosterSyncSettings from './RosterSyncSettings.vue'
import TeamStructureSettings from './TeamStructureSettings.vue'
import JiraSyncSettings from './JiraSyncSettings.vue'

const tabs = [
  { id: 'roster-sync', label: 'Roster Sync' },
  { id: 'team-structure', label: 'Team Structure' },
  { id: 'jira-sync', label: 'Jira Sync' }
]

const activeTab = ref('roster-sync')
</script>
