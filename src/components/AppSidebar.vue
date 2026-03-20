<template>
  <aside
    class="fixed top-0 left-0 h-screen z-30 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
    :class="collapsed ? 'w-[72px]' : 'w-[260px]'"
  >
    <div class="flex flex-col h-full m-2.5 bg-white/80 backdrop-blur-xl border border-gray-200/60 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.03)] overflow-hidden">
      <!-- Header -->
      <div
        class="flex items-center py-5 border-b border-gray-100 transition-all duration-300"
        :class="collapsed ? 'justify-center px-0' : 'gap-3 px-4'"
      >
        <img src="/redhat-logo.svg" alt="Red Hat" class="h-8 w-8 flex-shrink-0" />
        <transition name="fade">
          <div v-if="!collapsed" class="overflow-hidden whitespace-nowrap">
            <h1 class="text-sm font-bold text-gray-900 leading-tight">Team Tracker</h1>
            <p class="text-xs text-gray-400">AI Engineering</p>
          </div>
        </transition>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div v-for="section in navSections" :key="section.label">
          <p
            v-if="!collapsed && section.label"
            class="px-3 mb-2 mt-4 first:mt-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400"
          >{{ section.label }}</p>
          <button
            v-for="item in section.items"
            :key="item.id"
            @click="$emit('navigate', item.id)"
            class="group relative w-full flex items-center py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            :class="[
              activeModule === item.id
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              collapsed ? 'justify-center px-0' : 'gap-3 px-3'
            ]"
          >
            <component
              :is="item.icon"
              :size="20"
              :stroke-width="activeModule === item.id ? 2 : 1.7"
              class="flex-shrink-0"
            />
            <transition name="fade">
              <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
            </transition>
            <!-- Collapsed tooltip -->
            <span
              v-if="collapsed"
              class="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-lg"
            >
              {{ item.label }}
            </span>
          </button>
        </div>
      </nav>

      <!-- Footer -->
      <div class="px-3 py-3 border-t border-gray-100 space-y-1">
        <!-- User -->
        <div
          v-if="user"
          class="flex items-center py-2 rounded-xl"
          :class="collapsed ? 'justify-center px-0' : 'gap-3 px-3'"
        >
          <div class="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
            {{ getUserInitials(user) }}
          </div>
          <transition name="fade">
            <div v-if="!collapsed" class="overflow-hidden min-w-0">
              <p class="text-sm font-medium text-gray-900 truncate">{{ user.displayName || user.email }}</p>
              <p class="text-xs text-gray-400 truncate">{{ user.email }}</p>
            </div>
          </transition>
        </div>

        <!-- Collapse toggle -->
        <button
          @click="$emit('toggle-collapse')"
          class="w-full flex items-center py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
          :class="collapsed ? 'justify-center px-0' : 'gap-3 px-3'"
        >
          <component
            :is="collapsed ? ChevronsRight : ChevronsLeft"
            :size="20"
            :stroke-width="1.7"
            class="flex-shrink-0"
          />
          <transition name="fade">
            <span v-if="!collapsed">Collapse</span>
          </transition>
        </button>
      </div>
    </div>
  </aside>

  <!-- Mobile overlay -->
  <transition name="fade">
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 lg:hidden"
      @click="$emit('close-mobile')"
    />
  </transition>
</template>

<script setup>
import {
  BarChart3,
  Users,
  TrendingUp,
  FileText,
  Shield,
  Settings,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-vue-next'
import { computed } from 'vue'

const props = defineProps({
  collapsed: Boolean,
  mobileOpen: Boolean,
  activeModule: String,
  user: Object,
  isAdmin: Boolean
})

defineEmits(['navigate', 'toggle-collapse', 'close-mobile'])

const navSections = computed(() => {
  const sections = [
    {
      label: '',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
      ]
    },
    {
      label: 'Team Metrics',
      items: [
        { id: 'people', label: 'People', icon: Users },
        { id: 'trends', label: 'Trends', icon: TrendingUp },
        { id: 'reports', label: 'Reports', icon: FileText },
      ]
    }
  ]

  if (props.isAdmin) {
    sections.push({
      label: 'Admin',
      items: [
        { id: 'user-management', label: 'Users', icon: Shield },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    })
  }

  return sections
})

function getUserInitials(user) {
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
</script>
