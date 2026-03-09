<template>
  <AuthGuard>
    <div id="app" class="min-h-screen bg-gray-50">
      <header class="bg-primary-700 text-white shadow-lg">
        <div class="container mx-auto px-6 py-2 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="/redhat-logo.svg" alt="Red Hat" class="h-8" />
            <h1 class="text-xl font-bold cursor-pointer" @click="navigateToDashboard">AI Engineering Team Tracker</h1>
          </div>
          <div class="flex items-center gap-4">
            <!-- Refresh All -->
            <button
              v-if="authUser"
              @click="handleRefreshAll($event)"
              :disabled="isRefreshing"
              class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 border border-primary-400"
            >
              <svg class="h-4 w-4" :class="{ 'animate-spin': isRefreshing }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ isRefreshing ? 'Refreshing...' : 'Refresh All' }}
            </button>
            <!-- User Avatar and Sign Out -->
            <div class="relative" v-if="authUser">
              <button
                @click="showUserMenu = !showUserMenu"
                class="flex items-center gap-2 hover:bg-primary-600 rounded-full p-1 transition-colors"
              >
                <div
                  v-if="!authUser.photoURL || avatarLoadError"
                  class="h-8 w-8 rounded-full border-2 border-white bg-white text-primary-700 flex items-center justify-center font-bold text-xs"
                >
                  {{ getUserInitials(authUser) }}
                </div>
                <img
                  v-else
                  :src="authUser.photoURL"
                  :alt="authUser.displayName || authUser.email"
                  class="h-8 w-8 rounded-full border-2 border-white"
                  @error="avatarLoadError = true"
                />
              </button>

              <div
                v-if="showUserMenu"
                class="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg py-1 z-10"
              >
                <div class="px-4 py-2 border-b border-gray-200">
                  <p class="text-sm font-medium text-gray-900">{{ authUser.displayName }}</p>
                  <p class="text-xs text-gray-500 truncate">{{ authUser.email }}</p>
                </div>
                <button
                  @click="handleSignOut"
                  class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
        <nav class="bg-primary-800">
          <div class="container mx-auto px-6 flex gap-1">
            <button
              v-for="tab in navTabs"
              :key="tab.view"
              @click="navigateToTab(tab.view)"
              class="px-4 py-2 text-sm font-medium transition-colors border-b-2"
              :class="isTabActive(tab.view)
                ? 'text-white border-white'
                : 'text-primary-200 border-transparent hover:text-white hover:border-primary-400'"
            >
              {{ tab.label }}
            </button>
          </div>
        </nav>
      </header>

      <!-- Dashboard View -->
      <main v-if="currentView === 'dashboard'" class="relative">
        <Dashboard
          @select-team="handleSelectTeam"
        />
        <LoadingOverlay v-if="isLoading" />
      </main>

      <!-- Team Roster View -->
      <main v-else-if="currentView === 'team-roster'">
        <TeamRosterView
          :team="selectedTeam"
          @select-person="handleSelectPerson"
          @back="navigateToDashboard"
        />
      </main>

      <!-- Person Detail View -->
      <main v-else-if="currentView === 'person-detail'">
        <PersonDetail
          :person="selectedPerson"
          :teamName="selectedTeam?.displayName || ''"
          @back="handleBackFromPerson"
          @go-dashboard="navigateToDashboard"
        />
      </main>

      <!-- People View -->
      <main v-else-if="currentView === 'people'">
        <PeopleView />
      </main>

      <!-- Trends View -->
      <main v-else-if="currentView === 'trends'">
        <TrendsView />
      </main>

      <!-- Reports View -->
      <main v-else-if="currentView === 'reports'">
        <ReportsView @back="navigateToDashboard" />
      </main>

      <!-- User Management View -->
      <main v-else-if="currentView === 'user-management'">
        <UserManagement
          @back="navigateToDashboard"
          @toast="({ message, type }) => showToast(message, type)"
        />
      </main>

      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :message="toast.message"
        :type="toast.type"
        :duration="toast.duration"
        @close="removeToast(toast.id)"
      />
    </div>
  </AuthGuard>
</template>

<script>
import AuthGuard from './AuthGuard.vue'
import Dashboard from './Dashboard.vue'
import LoadingOverlay from './LoadingOverlay.vue'
import PersonDetail from './PersonDetail.vue'
import TeamRosterView from './TeamRosterView.vue'
import Toast from './Toast.vue'
import PeopleView from './PeopleView.vue'
import ReportsView from './ReportsView.vue'
import TrendsView from './TrendsView.vue'
import UserManagement from './UserManagement.vue'
import { useAuth } from '../composables/useAuth'
import { useRoster } from '../composables/useRoster'
import { useGithubStats } from '../composables/useGithubStats'
import { refreshAllMetrics, refreshTrendsGithub } from '../services/api'

export default {
  name: 'App',
  components: {
    AuthGuard,
    Dashboard,
    LoadingOverlay,
    PeopleView,
    PersonDetail,
    ReportsView,
    TrendsView,
    TeamRosterView,
    Toast,
    UserManagement
  },
  setup() {
    const { user: authUser, signOut } = useAuth()
    const { loadRoster, teams, selectedOrgKey, selectOrg, loading: rosterLoading } = useRoster()
    const { loadGithubStats, refreshStats } = useGithubStats()
    return {
      authUser,
      signOut,
      loadRoster,
      loadGithubStats,
      refreshStats,
      rosterLoading,
      rosterTeams: teams,
      selectedOrgKey,
      selectOrg
    }
  },
  data() {
    return {
      currentView: 'dashboard',
      selectedTeam: null,
      selectedPerson: null,
      isLoading: false,
      isRefreshing: false,
      showUserMenu: false,
      avatarLoadError: false,
      toasts: [],
      navTabs: [
        { view: 'dashboard', label: 'Teams' },
        { view: 'people', label: 'People' },
        { view: 'trends', label: 'Trends' },
        { view: 'reports', label: 'Reports' },
        { view: 'user-management', label: 'Users' }
      ]
    }
  },
  watch: {
    authUser(newUser, oldUser) {
      this.avatarLoadError = false
      if (newUser && !oldUser) {
        this.loadInitialData()
      }
    }
  },
  mounted() {
    document.addEventListener('click', this.handleClickOutside)
    window.addEventListener('hashchange', this.onHashChange)
    if (this.authUser) {
      this.loadInitialData()
    }
  },
  beforeUnmount() {
    document.removeEventListener('click', this.handleClickOutside)
    window.removeEventListener('hashchange', this.onHashChange)
  },
  methods: {
    async loadInitialData() {
      this.isLoading = true
      try {
        await Promise.all([
          this.loadRoster(),
          this.loadGithubStats()
        ])
        this.restoreFromHash()
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        this.isLoading = false
      }
    },

    updateHash() {
      let hash = '#/'
      if (this.currentView === 'team-roster' && this.selectedTeam) {
        hash = `#/team/${encodeURIComponent(this.selectedTeam.key)}`
      } else if (this.currentView === 'person-detail' && this.selectedTeam && this.selectedPerson) {
        hash = `#/team/${encodeURIComponent(this.selectedTeam.key)}/person/${encodeURIComponent(this.selectedPerson.jiraDisplayName || this.selectedPerson.name)}`
      } else if (this.currentView === 'people') {
        hash = '#/people'
      } else if (this.currentView === 'trends') {
        hash = '#/trends'
      } else if (this.currentView === 'reports') {
        hash = '#/reports'
      } else if (this.currentView === 'user-management') {
        hash = '#/users'
      }
      if (window.location.hash !== hash) {
        window.location.hash = hash
      }
    },

    restoreFromHash() {
      const hash = window.location.hash || '#/'
      const parts = hash.slice(2).split('/').map(decodeURIComponent)

      if (parts[0] === 'team' && parts[1]) {
        const teamKey = parts[1]
        // Select the right org
        const orgKey = teamKey.split('::')[0]
        if (orgKey && this.selectedOrgKey !== orgKey) {
          this.selectOrg(orgKey)
        }
        const team = this.rosterTeams.find(t => t.key === teamKey)
        if (team) {
          this.selectedTeam = team
          if (parts[2] === 'person' && parts[3]) {
            const personName = parts[3]
            const person = team.members.find(m => (m.jiraDisplayName || m.name) === personName)
            if (person) {
              this.selectedPerson = person
              this.currentView = 'person-detail'
              return
            }
          }
          this.selectedPerson = null
          this.currentView = 'team-roster'
          return
        }
      } else if (parts[0] === 'people') {
        this.currentView = 'people'
        return
      } else if (parts[0] === 'trends') {
        this.currentView = 'trends'
        return
      } else if (parts[0] === 'reports') {
        this.currentView = 'reports'
        return
      } else if (parts[0] === 'users') {
        this.currentView = 'user-management'
        return
      }

      this.currentView = 'dashboard'
      this.selectedTeam = null
      this.selectedPerson = null
    },

    onHashChange() {
      this.restoreFromHash()
    },

    navigateToDashboard() {
      this.currentView = 'dashboard'
      this.selectedTeam = null
      this.selectedPerson = null
      this.updateHash()
    },

    navigateToTab(view) {
      if (view === 'dashboard') {
        this.navigateToDashboard()
      } else {
        this.currentView = view
        this.updateHash()
      }
    },

    isTabActive(tabView) {
      if (tabView === 'dashboard') {
        return ['dashboard', 'team-roster', 'person-detail'].includes(this.currentView)
      }
      return this.currentView === tabView
    },

    handleSelectTeam(team) {
      this.selectedTeam = team
      this.selectedPerson = null
      this.currentView = 'team-roster'
      this.updateHash()
    },

    handleSelectPerson(member) {
      this.selectedPerson = member
      this.currentView = 'person-detail'
      this.updateHash()
    },

    handleBackFromPerson() {
      this.currentView = 'team-roster'
      this.selectedPerson = null
      this.updateHash()
    },

    async handleRefreshAll(event) {
      const force = event?.shiftKey || false
      this.isRefreshing = true
      try {
        // Jira refresh is the primary action; GitHub refreshes are best-effort
        const results = await Promise.allSettled([
          refreshAllMetrics({ force }),
          this.refreshStats(),
          refreshTrendsGithub()
        ])
        const failed = results.filter(r => r.status === 'rejected')
        if (failed.length === results.length) {
          throw failed[0].reason
        }
        this.showToast(force ? 'Hard refresh started — ignoring cache' : 'Refresh started — data will update shortly')
      } catch (err) {
        console.error('Failed to start refresh:', err)
        this.showToast('Failed to start refresh', 'error')
      } finally {
        setTimeout(() => {
          this.isRefreshing = false
        }, 5000)
      }
    },

    async handleSignOut() {
      this.showUserMenu = false
      await this.signOut()
    },

    handleClickOutside(event) {
      if (!event.target.closest('.relative')) {
        this.showUserMenu = false
      }
    },

    showToast(message, type = 'success', duration = 3000) {
      const id = Date.now()
      this.toasts.push({ id, message, type, duration })
    },

    removeToast(id) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    },

    getUserInitials(user) {
      if (!user) return '?'
      if (user.displayName) {
        const parts = user.displayName.split(' ')
        if (parts.length >= 2) {
          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        }
        return user.displayName.substring(0, 2).toUpperCase()
      }
      if (user.email) {
        return user.email.substring(0, 2).toUpperCase()
      }
      return '??'
    }
  }
}
</script>
