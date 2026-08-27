<script setup>
import { computed } from 'vue'
import { categorizeFeatures, summarizeSignalFeatures } from '../helpers/signal-groups.js'
import StatusBadge from './StatusBadge.vue'
import SignoffBadge from './SignoffBadge.vue'

const props = defineProps({
  features: { type: Array, default: () => [] },
  selectedSignals: { type: Array, default: () => [] }
})

const emit = defineEmits(['select'])

const signalGroups = computed(() => categorizeFeatures(props.features))

const visibleSignalGroups = computed(() => {
  if (!props.selectedSignals || props.selectedSignals.length === 0) return signalGroups.value
  return signalGroups.value.filter(g => props.selectedSignals.includes(g.id))
})

const summaryStats = computed(() => summarizeSignalFeatures(props.features))

function donutArc(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 2 * Math.PI) {
    return [
      'M ' + (cx + r) + ' ' + cy,
      'A ' + r + ' ' + r + ' 0 1 1 ' + (cx - r) + ' ' + cy,
      'A ' + r + ' ' + r + ' 0 1 1 ' + (cx + r) + ' ' + cy
    ].join(' ')
  }
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(endAngle)
  const y2 = cy + r * Math.sin(endAngle)
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  return 'M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2
}

function ageDays(isoDate) {
  if (!isoDate) return null
  const d = new Date(isoDate)
  const now = new Date()
  return Math.floor((now - d) / (1000 * 60 * 60 * 24))
}

function isStale(f) {
  if (f.statusCategory !== 'In Progress') return false
  const age = ageDays(f.lastUpdated)
  return age !== null && age > 7
}

function formatAge(days) {
  if (days === null) return ''
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return days + 'd ago'
  if (days < 365) return Math.floor(days / 30) + 'mo ago'
  return Math.floor(days / 365) + 'y ago'
}

function progressBarColor(pct) {
  if (pct >= 70) return 'bg-green-500'
  if (pct >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

function normalizeOwnerStatusColor(c) {
  const s = String(c || '').trim().toUpperCase()
  return s === 'GREEN' || s === 'YELLOW' || s === 'RED' ? s : null
}
</script>

<template>
  <div class="space-y-4">
    <div
      v-if="features.length && summaryStats"
      data-testid="signals-progress-summary"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5"
    >
      <div class="flex flex-col md:flex-row items-start md:items-center gap-6">
        <div class="flex-shrink-0">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="45" fill="none" stroke-width="14" class="stroke-gray-200 dark:stroke-gray-700" />
            <path
              v-if="summaryStats.done > 0"
              :d="donutArc(60, 60, 45, -Math.PI / 2, -Math.PI / 2 + (summaryStats.done / Math.max(summaryStats.total, 1)) * 2 * Math.PI)"
              fill="none"
              stroke-width="14"
              stroke-linecap="round"
              class="stroke-green-500"
            />
            <path
              v-if="summaryStats.inProgress > 0"
              :d="donutArc(60, 60, 45,
                -Math.PI / 2 + (summaryStats.done / Math.max(summaryStats.total, 1)) * 2 * Math.PI,
                -Math.PI / 2 + ((summaryStats.done + summaryStats.inProgress) / Math.max(summaryStats.total, 1)) * 2 * Math.PI)"
              fill="none"
              stroke-width="14"
              stroke-linecap="round"
              class="stroke-blue-500"
            />
            <text x="60" y="55" text-anchor="middle" class="fill-gray-900 dark:fill-gray-100 text-xl font-bold" font-size="22" font-weight="bold">{{ summaryStats.avgCompletion }}%</text>
            <text x="60" y="72" text-anchor="middle" class="fill-gray-500 dark:fill-gray-400" font-size="10">complete</text>
          </svg>
        </div>

        <div class="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 w-full">
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.total }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Features</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalEpics }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Epics</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-green-50 dark:bg-green-500/10">
            <div class="text-2xl font-bold text-green-600 dark:text-green-400">{{ summaryStats.done }}</div>
            <div class="text-[10px] text-green-600 dark:text-green-400 mt-0.5 uppercase tracking-wide">Done</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10">
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ summaryStats.inProgress }}</div>
            <div class="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 uppercase tracking-wide">Active</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-500 dark:text-gray-400">{{ summaryStats.todo }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Backlog</div>
          </div>
          <div class="text-center p-3 rounded-lg" :class="summaryStats.blockers > 0 ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-gray-900/50'">
            <div class="text-2xl font-bold" :class="summaryStats.blockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'">{{ summaryStats.blockers }}</div>
            <div class="text-[10px] mt-0.5 uppercase tracking-wide" :class="summaryStats.blockers > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'">Blockers</div>
          </div>
          <div class="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-900/50">
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ summaryStats.totalIssues }}</div>
            <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">Issues</div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-for="group in visibleSignalGroups"
      :key="group.id"
      class="rounded-lg border overflow-hidden"
      :class="[group.borderClass, group.bgClass]"
      :data-testid="'signal-group-' + group.id"
    >
      <div class="px-4 py-3 flex items-center justify-between" :class="group.headerBg">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" :class="group.dotClass" />
          <h3 class="text-sm font-semibold" :class="group.textClass">{{ group.title }}</h3>
          <span class="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60 dark:bg-gray-900/30" :class="group.textClass">{{ group.features.length }}</span>
        </div>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ group.subtitle }}</span>
      </div>

      <div class="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <div
          v-for="f in group.features"
          :key="f.key"
          data-testid="signal-feature-tile"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/80 dark:border-gray-700/80 cursor-pointer hover:shadow-md dark:hover:border-gray-600 transition-all overflow-hidden"
          @click="emit('select', f)"
        >
          <div class="px-4 pt-3 pb-2">
            <div class="flex items-center justify-between gap-2 mb-1">
              <div class="flex items-center gap-2">
                <span class="text-primary-600 dark:text-blue-400 font-mono text-xs font-semibold">{{ f.key }}</span>
                <StatusBadge :status="f.status" />
              </div>
              <StatusBadge
                v-if="normalizeOwnerStatusColor(f.colorStatus || f.ownerStatusColor)"
                :health="normalizeOwnerStatusColor(f.colorStatus || f.ownerStatusColor)"
              />
              <StatusBadge v-else status="Status color missing" />
            </div>
            <p class="text-sm text-gray-900 dark:text-gray-100 font-medium leading-snug">{{ f.summary }}</p>
          </div>

          <div class="px-4 pb-2">
            <div class="flex items-center gap-2">
              <div class="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="progressBarColor(f.completionPct || 0)"
                  :style="{ width: (f.completionPct || 0) + '%' }"
                />
              </div>
              <span class="text-xs font-bold w-10 text-right" :class="{
                'text-green-600 dark:text-green-400': (f.completionPct || 0) >= 70,
                'text-yellow-600 dark:text-yellow-400': (f.completionPct || 0) >= 40 && (f.completionPct || 0) < 70,
                'text-red-600 dark:text-red-400': (f.completionPct || 0) < 40
              }">{{ f.completionPct || 0 }}%</span>
            </div>
          </div>

          <div class="px-4 pb-2 flex items-center gap-3 text-xs">
            <span class="text-gray-500 dark:text-gray-400">
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ f.epicCount || 0 }}</span> Epics
            </span>
            <span class="text-gray-300 dark:text-gray-600">|</span>
            <span class="text-gray-500 dark:text-gray-400">
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ f.issueCount || 0 }}</span> Issues
            </span>
            <span v-if="f.blockerCount > 0" class="text-gray-300 dark:text-gray-600">|</span>
            <span v-if="f.blockerCount > 0" class="text-red-600 dark:text-red-400 font-semibold">
              {{ f.blockerCount }} Blockers
            </span>
          </div>

          <div class="px-4 pb-3 flex flex-wrap items-center gap-1.5">
            <span
              v-if="f.scopeChange === 'added'"
              class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300"
            >Late</span>
            <span
              v-if="f.scopeChange === 'dropped'"
              class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300"
            >Dropped</span>
            <span
              v-if="f.assignee"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >{{ f.assignee }}</span>
            <span
              v-else
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"
            >Unassigned</span>
            <span
              v-for="v in (f.fixVersions || []).slice(0, 2)"
              :key="v"
              class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400"
            >{{ v }}</span>
            <span
              v-if="f.lastUpdated"
              class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            >{{ formatAge(ageDays(f.lastUpdated)) }}</span>
            <span
              v-if="isStale(f)"
              class="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400"
            >Stale</span>
            <SignoffBadge
              :status="f.signoffStatus"
              :template-out-of-date="f.signoffTemplateOutOfDate === true"
              :checklist-total="f.signoffChecklistItemCount"
              :checklist-done="f.signoffChecklistDoneCount"
              :missing-count="f.signoffMissingCount"
              :rollup-in-progress="f.signoffRollupInProgress"
              :rollup-to-do="f.signoffRollupToDo"
              :rollup-other="f.signoffRollupOther"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-if="visibleSignalGroups.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      No features found matching the current filters.
    </div>
  </div>
</template>
