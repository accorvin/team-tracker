<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release Capacity &amp; Commitment</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Key deadlines and capacity overview for a selected release</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-sm text-gray-500 dark:text-gray-400">
      Loading releases...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <template v-else>
      <!-- Selection summary bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6 px-5 py-4">
        <template v-if="hasSelection">
          <div class="flex items-start justify-between gap-4">
            <div class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              Showing key deadlines for
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ familyNarrative }}</span>,
              <span class="font-semibold text-gray-900 dark:text-gray-100">version {{ selection.version }}</span>,
              covering the
              <span class="font-semibold text-gray-900 dark:text-gray-100">{{ phaseNarrative }}</span>
              {{ selection.phases.size === 1 ? 'phase' : 'phases' }}
              of the release lifecycle.
            </div>
            <button
              @click="openModal"
              class="shrink-0 px-3 py-1.5 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >Change</button>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-6">
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Select a release version and product family to view key milestone deadlines across the release lifecycle.
            </p>
            <button
              @click="openModal"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 transition-colors"
            >Select Release</button>
          </div>
        </template>
      </div>

      <!-- Deadline cards -->
      <div v-if="hasSelection" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="card in deadlineCards"
          :key="card.phase"
          class="bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
        >
          <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
            <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phaseLabel }} Key Deadlines</h3>
          </div>

          <div v-if="!card.hasData" class="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            No milestone dates configured for this phase.
          </div>

          <!-- Single family layout -->
          <table v-else-if="card.isSingleFamily" class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Milestone</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Days Away</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in card.rows"
                :key="row.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
                :class="row.isNext ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''"
              >
                <td class="px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <span v-if="row.isPast" class="text-gray-400 dark:text-gray-500">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                    <span v-if="row.isNext" class="w-1 h-5 rounded-full bg-primary-500 shrink-0"></span>
                    <span :class="row.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100 font-medium'">
                      {{ row.label }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-2.5 tabular-nums" :class="row.isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'">
                  {{ row.dateFormatted }}
                </td>
                <td class="px-4 py-2.5 tabular-nums" :class="row.daysClass">
                  {{ row.daysLabel }}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Multi family layout -->
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100 dark:border-gray-800">
                <th class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Milestone</th>
                <th
                  v-for="f in card.families"
                  :key="f"
                  class="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >{{ f.toUpperCase() }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in card.rows"
                :key="row.key"
                class="border-b border-gray-100 dark:border-gray-800 last:border-0"
              >
                <td class="px-4 py-2.5 text-gray-900 dark:text-gray-100 font-medium">
                  {{ row.label }}
                </td>
                <td
                  v-for="f in card.families"
                  :key="f"
                  class="px-4 py-2.5"
                >
                  <template v-if="row.cells[f].dateFormatted !== '—'">
                    <div class="tabular-nums" :class="row.cells[f].isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'">
                      {{ row.cells[f].dateFormatted }}
                    </div>
                    <div class="text-[11px] tabular-nums" :class="row.cells[f].daysClass">
                      {{ row.cells[f].daysLabel }}
                    </div>
                  </template>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tabbed analysis section -->
      <div v-if="hasSelection" class="mt-6">
        <!-- Tab bar -->
        <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
          <nav class="flex gap-6 -mb-px">
            <button
              v-for="tab in analysisTabs"
              :key="tab.id"
              @click="activeAnalysisTab = tab.id"
              class="pb-2.5 text-sm font-medium transition-colors whitespace-nowrap border-b-2"
              :class="activeAnalysisTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >{{ tab.label }}</button>
          </nav>
        </div>

        <!-- Tab: Features & Initiatives by Status -->
        <div v-if="activeAnalysisTab === 'status-charts'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-if="featuresLoading" class="col-span-full text-center py-12 text-sm text-gray-400 dark:text-gray-500">
            Loading features...
          </div>

          <template v-else>
            <div
              v-for="card in featureStatusCards"
              :key="card.phase"
              class="inline-block bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phase }} Feature &amp; Initiative Status</h3>
              </div>

              <div v-if="card.total === 0" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No features found for this phase.
              </div>

              <div v-else class="p-5">
                <div class="inline-flex items-center gap-8">
                  <!-- Doughnut with center total -->
                  <div class="relative w-36 h-36 flex-shrink-0">
                    <Doughnut :data="card.chartData" :options="makeDoughnutOptions(card)" />
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{{ card.total }}</span>
                      <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">features</span>
                    </div>
                  </div>
                  <!-- Legend -->
                  <div class="flex-1 space-y-1.5">
                    <button
                      v-for="item in card.distribution"
                      :key="item.status"
                      @click="openFeatureList(item.status, card.phase)"
                      class="w-full flex items-center gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
                    >
                      <span
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: STATUS_COLORS[item.status] || '#d1d5db' }"
                      ></span>
                      <span class="text-gray-700 dark:text-gray-300">{{ item.status }}</span>
                      <span class="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ item.count }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ Math.round(item.count / card.total * 100) }}%)</span></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Tab: Features & Initiatives by Color Status -->
        <div v-if="activeAnalysisTab === 'color-status'" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div v-if="featuresLoading" class="col-span-full text-center py-12 text-sm text-gray-400 dark:text-gray-500">
            Loading features...
          </div>

          <template v-else>
            <div
              v-for="card in colorStatusCards"
              :key="card.phase"
              class="inline-block bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div class="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 flex items-center gap-2">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }}</span>
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ card.phase }} Color Status</h3>
              </div>

              <div v-if="card.total === 0" class="px-4 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No features found for this phase.
              </div>

              <div v-else class="p-5">
                <div class="inline-flex items-center gap-8">
                  <!-- Doughnut with center total -->
                  <div class="relative w-36 h-36 flex-shrink-0">
                    <Doughnut :data="card.chartData" :options="makeDoughnutOptions(card, 'colorStatus')" />
                    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span class="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{{ card.total }}</span>
                      <span class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">features</span>
                    </div>
                  </div>
                  <!-- Legend -->
                  <div class="flex-1 space-y-1.5">
                    <button
                      v-for="item in card.distribution"
                      :key="item.status"
                      @click="openFeatureList(item.status, card.phase, 'colorStatus')"
                      class="w-full flex items-center gap-2 text-sm rounded-md px-2 py-1 -mx-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer text-left"
                    >
                      <span
                        class="w-3 h-3 rounded-full flex-shrink-0"
                        :style="{ backgroundColor: COLOR_STATUS_COLORS[item.status] || '#d1d5db' }"
                      ></span>
                      <span class="text-gray-700 dark:text-gray-300">{{ item.status }}</span>
                      <span class="ml-auto whitespace-nowrap font-semibold tabular-nums text-gray-900 dark:text-gray-100">{{ item.count }} <span class="font-normal text-gray-400 dark:text-gray-500">({{ Math.round(item.count / card.total * 100) }}%)</span></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="modalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="cancelModal"></div>
        <div
          class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6"
          @keydown.escape="cancelModal"
        >
          <!-- Modal header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Select Release</h3>
            <button
              @click="cancelModal"
              class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Product Family -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Product Family</label>
            <div class="flex flex-wrap gap-2">
              <button
                @click="toggleAllFamilies"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="isAllFamiliesDraft
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >All</button>
              <button
                v-for="f in availableFamilies"
                :key="f"
                @click="toggleFamily(f)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.families.has(f)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ f.toUpperCase() }}</button>
            </div>
          </div>

          <!-- Version -->
          <div class="mb-5">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Version</label>
            <div v-if="draftVersions.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="v in draftVersions"
                :key="v"
                @click="selectVersion(v)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.version === v
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ v }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a product family first.</p>
          </div>

          <!-- Phase -->
          <div class="mb-6">
            <label class="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Phase</label>
            <div v-if="draftPhases.length > 0" class="flex flex-wrap gap-2">
              <button
                v-for="p in draftPhases"
                :key="p"
                @click="togglePhase(p)"
                class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                :class="draft.phases.has(p)
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-600'"
              >{{ p }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500">Select a version first.</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              @click="cancelModal"
              class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >Cancel</button>
            <button
              @click="applyModal"
              :disabled="!canApply"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >Apply</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Feature list modal -->
    <Teleport to="body">
      <div v-if="featureListStatus" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="closeFeatureList"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-h-[80vh] flex flex-col" :style="{ maxWidth: featureListMaxWidth }">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div class="flex items-center gap-3">
              <span
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: featureListDotColor }"
              ></span>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ featureListStatus }}</h3>
              <span class="text-sm text-gray-500 dark:text-gray-400">({{ featuresForStatus.length }})</span>
              <span v-if="featureListPhase" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{{ selection.version }} {{ featureListPhase }}</span>
            </div>
            <div class="flex items-center gap-2">
              <!-- Column settings toggle -->
              <div class="relative">
                <button
                  @click.stop="columnSettingsOpen = !columnSettingsOpen"
                  class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  title="Configure columns"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
                  </svg>
                </button>
                <!-- Column settings dropdown -->
                <div
                  v-if="columnSettingsOpen"
                  class="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg z-10"
                  @click.stop
                >
                  <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Columns</span>
                    <button
                      @click="resetColumns"
                      class="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                    >Reset</button>
                  </div>
                  <div class="py-1">
                    <div
                      v-for="(colKey, idx) in columnOrder"
                      :key="colKey"
                      draggable="true"
                      @dragstart="onColDragStart($event, idx)"
                      @dragover.prevent="onColDragOver($event, idx)"
                      @drop="onColDrop(idx)"
                      @dragend="colDragIdx = -1"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm cursor-grab active:cursor-grabbing select-none"
                      :class="colDragOverIdx === idx ? 'border-t-2 border-primary-500' : ''"
                    >
                      <span class="text-gray-400 dark:text-gray-500 text-xs shrink-0">&#x2807;</span>
                      <label class="flex items-center gap-2 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          :checked="activeColumnKeys.has(colKey)"
                          :disabled="colKey === 'key'"
                          @change="toggleColumn(colKey)"
                          class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                        />
                        <span class="text-gray-700 dark:text-gray-300" :class="colKey === 'key' ? 'opacity-50' : ''">{{ AVAILABLE_COLUMNS.find(c => c.key === colKey).label }}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <button
                @click="closeFeatureList"
                class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-auto flex-1">
            <table class="text-sm" style="table-layout:fixed" :style="{ width: tableWidth }">
              <colgroup>
                <col v-for="col in visibleColumns" :key="col.key" :style="{ width: (columnWidths[col.key] || 150) + 'px' }" />
              </colgroup>
              <thead class="sticky top-0 bg-gray-50 dark:bg-gray-800/90">
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th
                    v-for="col in visibleColumns"
                    :key="col.key"
                    class="relative px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                  >{{ col.label }}<span
                      class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize bg-gray-300 dark:bg-gray-600 hover:bg-primary-400 dark:hover:bg-primary-500 transition-colors"
                      @mousedown.prevent="startColResize($event, col.key)"
                    ></span></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="f in featuresForStatus"
                  :key="f.key"
                  class="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td
                    v-for="col in visibleColumns"
                    :key="col.key"
                    class="px-4 py-2.5 truncate"
                    :class="col.cellClass || 'text-gray-600 dark:text-gray-400'"
                  >
                    <span v-if="col.key === 'key'" class="inline-flex items-center gap-1.5">
                      <a
                        href="#"
                        class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                        @click.prevent="navigateToFeature(f.key)"
                      >{{ f.key }}</a>
                      <a
                        :href="'https://issues.redhat.com/browse/' + f.key"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
                        title="Open in Jira"
                        @click.stop
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </span>
                    <span v-else-if="col.key === 'summary'" class="text-gray-900 dark:text-gray-100">{{ f.summary || '—' }}</span>
                    <span v-else-if="col.key === 'fixVersions'">{{ (f.fixVersions || []).join(', ') || '—' }}</span>
                    <span v-else-if="col.key === 'components'">{{ (f.components || []).join(', ') || '—' }}</span>
                    <span v-else-if="col.key === 'labels'">{{ (f.labels || []).join(', ') || '—' }}</span>
                    <span v-else-if="col.key === 'completionPct'">{{ f.completionPct != null ? f.completionPct + '%' : '—' }}</span>
                    <span v-else>{{ f[col.key] || '—' }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

// ── Constants ──

const STORAGE_KEY = 'tt_cache:capacity-report-selection'
const MILESTONES = [
  { key: 'featureFreeze', label: 'Feature Freeze' },
  { key: 'codeFreeze', label: 'Code Freeze' },
  { key: 'ga', label: 'Release Date' }
]
const PHASE_ORDER = ['EA1', 'EA2', 'GA']
const analysisTabs = [
  { id: 'status-charts', label: 'Features & Initiatives by Status' },
  { id: 'color-status', label: 'Features & Initiatives by Color Status' }
]

// ── Core state ──

const nav = inject('moduleNav')
const releases = ref([])
const loading = ref(true)
const error = ref(null)
const modalOpen = ref(false)
const activeAnalysisTab = ref('status-charts')

const selection = reactive({ version: '', families: new Set(), phases: new Set() })
const draft = reactive({ version: '', families: new Set(), phases: new Set() })

// ── Registry parsing ──

function parseReleaseId(id) {
  const match = id.match(/^([a-z]+)-(\d+\.\d+)(?:\.z)?(?:\.(ea\d?))?$/i)
  if (!match) return null
  return { family: match[1].toLowerCase(), version: match[2], phase: match[3] ? match[3].toUpperCase() : 'GA' }
}

const parsedReleases = computed(() => {
  return releases.value
    .filter(r => r.state === 'active')
    .map(r => ({ ...r, ...parseReleaseId(r.id) }))
    .filter(r => r.family)
})

const availableFamilies = computed(() => {
  return [...new Set(parsedReleases.value.map(r => r.family))].sort()
})

// Versions available for the draft's selected families
const draftVersions = computed(() => {
  if (draft.families.size === 0) return []
  const filtered = parsedReleases.value.filter(r => draft.families.has(r.family))
  return [...new Set(filtered.map(r => r.version))].sort()
})

// Phases available for the draft's selected version + families
const draftPhases = computed(() => {
  if (!draft.version || draft.families.size === 0) return []
  const filtered = parsedReleases.value.filter(r =>
    r.version === draft.version && draft.families.has(r.family)
  )
  return [...new Set(filtered.map(r => r.phase))].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
})

const isAllFamiliesDraft = computed(() =>
  availableFamilies.value.length > 0 && draft.families.size === availableFamilies.value.length
)

const hasSelection = computed(() =>
  selection.version && selection.families.size > 0 && selection.phases.size > 0
)

const canApply = computed(() =>
  draft.version && draft.families.size > 0 && draft.phases.size > 0
)

// ── Summary display ──

const familyNarrative = computed(() => {
  if (selection.families.size === availableFamilies.value.length) return 'all product families'
  const names = [...selection.families].sort().map(f => f.toUpperCase())
  if (names.length === 1) return names[0]
  if (names.length === 2) return names[0] + ' and ' + names[1]
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1]
})

const phaseNarrative = computed(() => {
  const sorted = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  if (sorted.length === PHASE_ORDER.length) return 'EA1, EA2, and GA'
  if (sorted.length === 1) return sorted[0]
  if (sorted.length === 2) return sorted[0] + ' and ' + sorted[1]
  return sorted.slice(0, -1).join(', ') + ', and ' + sorted[sorted.length - 1]
})

// ── Data loading ──

async function fetchRegistry() {
  loading.value = true
  error.value = null
  try {
    const data = await apiRequest('/modules/releases/registry')
    releases.value = data.releases || []
    restoreSelection()
  } catch (e) {
    error.value = e.message || 'Failed to load releases'
  } finally {
    loading.value = false
  }
}

onMounted(fetchRegistry)

function restoreSelection() {
  // Try URL params first
  const params = nav?.params?.value || {}
  if (params.version) {
    const families = params.families
      ? params.families.split(',').filter(f => availableFamilies.value.includes(f))
      : [...availableFamilies.value]
    const phases = params.phases
      ? params.phases.split(',').filter(p => PHASE_ORDER.includes(p.toUpperCase())).map(p => p.toUpperCase())
      : ['GA']

    if (families.length > 0 && phases.length > 0) {
      applySelection(params.version, new Set(families), new Set(phases))
      return
    }
  }

  // Try localStorage
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed.version && parsed.families?.length && parsed.phases?.length) {
        const validFamilies = parsed.families.filter(f => availableFamilies.value.includes(f))
        const validPhases = parsed.phases.filter(p => PHASE_ORDER.includes(p))
        if (validFamilies.length > 0 && validPhases.length > 0) {
          applySelection(parsed.version, new Set(validFamilies), new Set(validPhases))
          return
        }
      }
    }
  } catch { /* ignore */ }

  // Smart default: latest version, all families, GA
  if (availableFamilies.value.length > 0) {
    const allVersions = [...new Set(parsedReleases.value.map(r => r.version))].sort()
    const latestVersion = pickDefaultVersion(allVersions)
    if (latestVersion) {
      applySelection(latestVersion, new Set(availableFamilies.value), new Set(['GA']))
    }
  }
}

function pickDefaultVersion(versions) {
  const now = Date.now()
  let best = null
  let bestDelta = Infinity

  for (const v of versions) {
    const gaReleases = parsedReleases.value.filter(r => r.version === v && r.phase === 'GA' && r.milestones?.ga)
    for (const r of gaReleases) {
      const ts = new Date(r.milestones.ga).getTime()
      const delta = ts - now
      if (delta >= 0 && delta < bestDelta) {
        bestDelta = delta
        best = v
      }
    }
  }

  return best || versions[versions.length - 1] || null
}

function applySelection(version, families, phases) {
  selection.version = version
  selection.families = families
  selection.phases = phases
  persistSelection()
}

function persistSelection() {
  const data = {
    version: selection.version,
    families: [...selection.families],
    phases: [...selection.phases]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  nav.updateParams({
    version: selection.version,
    families: [...selection.families].join(','),
    phases: [...selection.phases].map(p => p.toLowerCase()).join(',')
  })
}

// ── Modal logic ──

function openModal() {
  draft.version = selection.version
  draft.families = new Set(selection.families.size > 0 ? selection.families : availableFamilies.value)
  draft.phases = new Set(selection.phases.size > 0 ? selection.phases : ['GA'])
  modalOpen.value = true
}

function cancelModal() {
  modalOpen.value = false
}

function applyModal() {
  if (!canApply.value) return
  applySelection(draft.version, new Set(draft.families), new Set(draft.phases))
  modalOpen.value = false
}

function toggleAllFamilies() {
  draft.families = new Set(availableFamilies.value)
  reconcileDraftVersion()
}

function toggleFamily(family) {
  const next = new Set(draft.families)
  if (isAllFamiliesDraft.value) {
    // Was "all" — switch to just this one
    next.clear()
    next.add(family)
  } else if (next.has(family) && next.size > 1) {
    next.delete(family)
  } else {
    next.add(family)
  }
  draft.families = next
  reconcileDraftVersion()
}

function selectVersion(version) {
  draft.version = version
  reconcileDraftPhases()
}

function togglePhase(phase) {
  const next = new Set(draft.phases)
  if (next.has(phase) && next.size > 1) {
    next.delete(phase)
  } else {
    next.add(phase)
  }
  draft.phases = next
}

// Keep version/phase valid when families change
function reconcileDraftVersion() {
  if (draft.version && !draftVersions.value.includes(draft.version)) {
    draft.version = ''
    draft.phases = new Set()
  } else {
    reconcileDraftPhases()
  }
}

function reconcileDraftPhases() {
  const available = draftPhases.value
  const next = new Set([...draft.phases].filter(p => available.includes(p)))
  if (next.size === 0 && available.includes('GA')) next.add('GA')
  else if (next.size === 0 && available.length > 0) next.add(available[0])
  draft.phases = next
}

// Close modal on Escape
function handleEscape(e) {
  if (e.key !== 'Escape') return
  if (columnSettingsOpen.value) { columnSettingsOpen.value = false; return }
  if (featureListStatus.value) { closeFeatureList(); return }
  if (modalOpen.value) cancelModal()
}

function handleClickOutside() {
  if (columnSettingsOpen.value) columnSettingsOpen.value = false
}
onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.removeEventListener('click', handleClickOutside)
  var tooltipEl = document.getElementById('capacity-chart-tooltip')
  if (tooltipEl) tooltipEl.remove()
})

// ── Deadline cards ──

const deadlineCards = computed(() => {
  if (!hasSelection.value) return []

  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))
  const sortedFamilies = [...selection.families].sort()
  const single = sortedFamilies.length === 1

  return sortedPhases.map(phase => {
    const familyReleases = {}
    for (const family of sortedFamilies) {
      familyReleases[family] = parsedReleases.value.find(r =>
        r.family === family && r.version === selection.version && r.phase === phase
      ) || null
    }

    const rows = []
    let foundNext = false

    for (const { key, label } of MILESTONES) {
      if (single) {
        const rel = familyReleases[sortedFamilies[0]]
        const dateStr = rel?.milestones?.[key] || null
        if (!dateStr) continue
        const days = daysFromNow(dateStr)
        const isPast = days !== null && days < 0
        const isNext = !isPast && !foundNext
        if (isNext) foundNext = true
        rows.push({
          key, label, dateFormatted: formatDate(dateStr), days, isPast, isNext,
          daysLabel: formatDaysLabel(days),
          daysClass: getDaysClass(days, isPast, isNext)
        })
      } else {
        const cells = {}
        let hasAny = false
        for (const family of sortedFamilies) {
          const rel = familyReleases[family]
          const dateStr = rel?.milestones?.[key] || null
          const days = daysFromNow(dateStr)
          const isPast = days !== null && days < 0
          if (dateStr) hasAny = true
          cells[family] = {
            dateFormatted: dateStr ? formatDate(dateStr) : '—',
            days, isPast,
            daysLabel: formatDaysLabel(days),
            daysClass: getDaysClass(days, isPast, false)
          }
        }
        if (!hasAny) continue
        rows.push({ key, label, cells })
      }
    }

    return {
      phase,
      phaseLabel: phase,
      families: sortedFamilies,
      isSingleFamily: single,
      rows,
      hasData: rows.length > 0
    }
  })
})

// ── Feature status chart ──

const STATUS_COLORS = {
  'New': '#9ca3af',
  'Backlog': '#a1a1aa',
  'To Do': '#d4d4d8',
  'Refinement': '#a78bfa',
  'In Progress': '#3b82f6',
  'Review': '#f59e0b',
  'Release Pending': '#10b981',
  'Closed': '#6366f1'
}

const allFeatures = ref([])
const featuresLoading = ref(false)

async function fetchFeatures() {
  featuresLoading.value = true
  try {
    const data = await apiRequest('/modules/releases/execution/features')
    allFeatures.value = data.features || []
  } catch (e) {
    console.error('[capacity-report] Failed to fetch features:', e)
    allFeatures.value = []
  } finally {
    featuresLoading.value = false
  }
}

onMounted(fetchFeatures)

// Restore modal state when returning from feature detail
watch(featuresLoading, (loading) => {
  if (loading) return
  const params = nav?.params?.value || {}
  if (params.modalStatus && params.modalPhase) {
    openFeatureList(params.modalStatus, params.modalPhase, params.modalField)
    if (params.modalField === 'colorStatus') activeAnalysisTab.value = 'color-status'
    nav.updateParams({ modalStatus: undefined, modalPhase: undefined, modalField: undefined })
  }
})

function normalizeFixVersion(v) {
  return String(v).replace(/[\s.-]+/g, ' ').replace(/\s*release$/i, '').trim().toLowerCase()
}

function buildExpectedVersions(version, families, phases) {
  const patterns = []
  for (const family of families) {
    for (const phase of phases) {
      const f = family.toUpperCase()
      const p = phase.toUpperCase()
      // New format: "3.5 GA RHOAI RELEASE" → normalized: "3 5 ga rhoai"
      patterns.push(normalizeFixVersion(version + ' ' + p + ' ' + f))
      // Legacy format: "rhoai-3.5.EA1" → normalized: "rhoai 3 5 ea1"
      patterns.push(normalizeFixVersion(f + '-' + version + '.' + p))
      patterns.push(normalizeFixVersion(f + '-' + version + ' ' + p))
      patterns.push(normalizeFixVersion(f + '-' + version + p))
      // GA can also be the bare version: "rhoai-3.5" → normalized: "rhoai 3 5"
      if (p === 'GA') {
        patterns.push(normalizeFixVersion(f + '-' + version))
      }
    }
  }
  return [...new Set(patterns)]
}

function matchFeaturesForPhase(phase) {
  if (allFeatures.value.length === 0) return []
  const expected = buildExpectedVersions(
    selection.version,
    [...selection.families],
    [phase]
  )
  return allFeatures.value.filter(f =>
    f.fixVersions && f.fixVersions.some(v => expected.includes(normalizeFixVersion(v)))
  )
}

function buildDistribution(features) {
  const counts = {}
  for (const f of features) {
    const status = f.status || 'Unknown'
    counts[status] = (counts[status] || 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, count }))
}

const featureStatusCards = computed(() => {
  if (!hasSelection.value) return []
  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))

  return sortedPhases.map(phase => {
    const features = matchFeaturesForPhase(phase)
    const distribution = buildDistribution(features)
    const total = features.length
    const chartData = distribution.length > 0 ? {
      labels: distribution.map(d => d.status),
      datasets: [{
        data: distribution.map(d => d.count),
        backgroundColor: distribution.map(d => STATUS_COLORS[d.status] || '#d1d5db'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    } : null

    return { phase, features, distribution, total, chartData }
  })
})

// ── Color status charts ──

const COLOR_STATUS_COLORS = {
  'Green': '#22c55e',
  'Yellow': '#eab308',
  'Red': '#ef4444',
  'Not Set': '#d1d5db'
}

function buildColorDistribution(features) {
  const counts = {}
  for (const f of features) {
    const color = f.colorStatus || 'Not Set'
    counts[color] = (counts[color] || 0) + 1
  }
  const order = ['Green', 'Yellow', 'Red', 'Not Set']
  return order
    .filter(c => counts[c])
    .map(c => ({ status: c, count: counts[c] }))
}

const colorStatusCards = computed(() => {
  if (!hasSelection.value) return []
  const sortedPhases = [...selection.phases].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b))

  return sortedPhases.map(phase => {
    const features = matchFeaturesForPhase(phase)
    const distribution = buildColorDistribution(features)
    const total = features.length
    const chartData = distribution.length > 0 ? {
      labels: distribution.map(d => d.status),
      datasets: [{
        data: distribution.map(d => d.count),
        backgroundColor: distribution.map(d => COLOR_STATUS_COLORS[d.status] || '#d1d5db'),
        borderWidth: 0,
        hoverOffset: 4
      }]
    } : null

    return { phase, features, distribution, total, chartData }
  })
})

// ── Feature list modal ──

const featureListStatus = ref(null)
const columnSettingsOpen = ref(false)

const COLUMNS_STORAGE_KEY = 'tt_cache:capacity-report-columns'
const AVAILABLE_COLUMNS = [
  { key: 'key', label: 'Key' },
  { key: 'summary', label: 'Summary' },
  { key: 'issueType', label: 'Type' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'pm', label: 'PM' },
  { key: 'team', label: 'Team' },
  { key: 'components', label: 'Components' },
  { key: 'fixVersions', label: 'Fix Versions' },
  { key: 'health', label: 'Health' },
  { key: 'completionPct', label: 'Completion' },
  { key: 'colorStatus', label: 'Color Status' },
  { key: 'labels', label: 'Labels' },
  { key: 'architect', label: 'Architect' }
]
const DEFAULT_COLUMN_KEYS = ['key', 'summary', 'assignee', 'priority']
const ALL_COLUMN_KEYS = AVAILABLE_COLUMNS.map(c => c.key)

// Column order includes all columns (visible + hidden), in user-chosen order
const columnOrder = ref([...ALL_COLUMN_KEYS])
const activeColumnKeys = ref(new Set(DEFAULT_COLUMN_KEYS))

function loadColumnPrefs() {
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!stored) return
    const parsed = JSON.parse(stored)
    if (parsed.order && parsed.active) {
      // Merge in any new columns added since the prefs were saved
      const validOrder = parsed.order.filter(k => ALL_COLUMN_KEYS.includes(k))
      for (const k of ALL_COLUMN_KEYS) {
        if (!validOrder.includes(k)) validOrder.push(k)
      }
      columnOrder.value = validOrder
      activeColumnKeys.value = new Set(parsed.active.filter(k => ALL_COLUMN_KEYS.includes(k)))
      // Key is always visible
      activeColumnKeys.value.add('key')
    }
  } catch { /* ignore */ }
}

function saveColumnPrefs() {
  localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify({
    order: columnOrder.value,
    active: [...activeColumnKeys.value]
  }))
}

loadColumnPrefs()

const featureListMaxWidth = computed(() => {
  const count = activeColumnKeys.value.size
  // ~200px per column, clamped between 600px and 95vw
  return Math.min(window.innerWidth * 0.95, Math.max(600, count * 200)) + 'px'
})

const visibleColumns = computed(() => {
  return columnOrder.value
    .filter(k => activeColumnKeys.value.has(k))
    .map(k => AVAILABLE_COLUMNS.find(c => c.key === k))
    .filter(Boolean)
})

function toggleColumn(colKey) {
  if (colKey === 'key') return
  const next = new Set(activeColumnKeys.value)
  if (next.has(colKey)) {
    next.delete(colKey)
  } else {
    next.add(colKey)
  }
  activeColumnKeys.value = next
  saveColumnPrefs()
}

function resetColumns() {
  columnOrder.value = [...ALL_COLUMN_KEYS]
  activeColumnKeys.value = new Set(DEFAULT_COLUMN_KEYS)
  saveColumnPrefs()
  Object.assign(columnWidths, DEFAULT_COL_WIDTHS)
  saveColumnWidths()
}

// Column drag reorder
const colDragIdx = ref(-1)
const colDragOverIdx = ref(-1)

function onColDragStart(event, idx) {
  colDragIdx.value = idx
  event.dataTransfer.effectAllowed = 'move'
}

function onColDragOver(_event, idx) {
  colDragOverIdx.value = idx
}

function onColDrop(targetIdx) {
  const fromIdx = colDragIdx.value
  if (fromIdx < 0 || fromIdx === targetIdx) {
    colDragIdx.value = -1
    colDragOverIdx.value = -1
    return
  }
  const next = [...columnOrder.value]
  const item = next.splice(fromIdx, 1)[0]
  next.splice(targetIdx, 0, item)
  columnOrder.value = next
  colDragIdx.value = -1
  colDragOverIdx.value = -1
  saveColumnPrefs()
}

// Column resize
const DEFAULT_COL_WIDTHS = { key: 130, summary: 300, issueType: 100, assignee: 140, priority: 100, pm: 140, team: 140, components: 160, fixVersions: 160, health: 90, completionPct: 110, colorStatus: 120, labels: 160, architect: 140 }
const WIDTHS_STORAGE_KEY = 'tt_cache:capacity-report-col-widths'
const columnWidths = reactive({ ...DEFAULT_COL_WIDTHS })

function loadColumnWidths() {
  try {
    const stored = localStorage.getItem(WIDTHS_STORAGE_KEY)
    if (stored) Object.assign(columnWidths, JSON.parse(stored))
  } catch { /* ignore */ }
}
loadColumnWidths()

function saveColumnWidths() {
  localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify({ ...columnWidths }))
}

const tableWidth = computed(() => {
  let total = 0
  for (const col of visibleColumns.value) {
    total += columnWidths[col.key] || 150
  }
  return total + 'px'
})

let resizeCol = null
let resizeStartX = 0
let resizeStartW = 0

function startColResize(event, colKey) {
  resizeCol = colKey
  resizeStartX = event.clientX
  resizeStartW = columnWidths[colKey] || 150
  document.addEventListener('mousemove', onColResizeMove)
  document.addEventListener('mouseup', onColResizeEnd)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onColResizeMove(event) {
  if (!resizeCol) return
  const diff = event.clientX - resizeStartX
  columnWidths[resizeCol] = Math.max(60, resizeStartW + diff)
}

function onColResizeEnd() {
  document.removeEventListener('mousemove', onColResizeMove)
  document.removeEventListener('mouseup', onColResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  if (resizeCol) saveColumnWidths()
  resizeCol = null
}

const featureListPhase = ref(null)
const featureListFilterField = ref('status')

const featuresForStatus = computed(() => {
  if (!featureListStatus.value) return []
  const field = featureListFilterField.value
  const cards = field === 'colorStatus' ? colorStatusCards.value : featureStatusCards.value
  const card = cards.find(c => c.phase === featureListPhase.value)
  if (!card) return []
  return card.features
    .filter(f => {
      if (field === 'colorStatus') return (f.colorStatus || 'Not Set') === featureListStatus.value
      return (f.status || 'Unknown') === featureListStatus.value
    })
    .sort((a, b) => (a.key || '').localeCompare(b.key || ''))
})

const featureListDotColor = computed(() => {
  if (!featureListStatus.value) return '#d1d5db'
  if (featureListFilterField.value === 'colorStatus') return COLOR_STATUS_COLORS[featureListStatus.value] || '#d1d5db'
  return STATUS_COLORS[featureListStatus.value] || '#d1d5db'
})

function openFeatureList(status, phase, field) {
  featureListStatus.value = status
  featureListPhase.value = phase || null
  featureListFilterField.value = field || 'status'
  columnSettingsOpen.value = false
}

function closeFeatureList() {
  featureListStatus.value = null
  featureListPhase.value = null
  featureListFilterField.value = 'status'
  columnSettingsOpen.value = false
}

function navigateToFeature(key) {
  const params = {
    key,
    from: 'capacity-report',
    modalStatus: featureListStatus.value,
    modalPhase: featureListPhase.value,
    modalField: featureListFilterField.value
  }
  closeFeatureList()
  nav.navigateTo('feature-detail', params)
}

function makeDoughnutOptions(card, field) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    cutout: '60%',
    onClick: function (_event, elements) {
      if (elements.length > 0) {
        var idx = elements[0].index
        var item = card.distribution[idx]
        if (item) openFeatureList(item.status, card.phase, field)
      }
    },
    onHover: function (event, elements) {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: function (context) {
          var tooltipEl = document.getElementById('capacity-chart-tooltip')
          if (!tooltipEl) {
            tooltipEl = document.createElement('div')
            tooltipEl.id = 'capacity-chart-tooltip'
            tooltipEl.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;padding:6px 10px;font-size:12px;white-space:nowrap;transition:opacity 0.15s;'
            document.body.appendChild(tooltipEl)
          }

          var model = context.tooltip
          if (model.opacity === 0) {
            tooltipEl.style.opacity = '0'
            return
          }

          if (model.body) {
            var idx = model.dataPoints[0].dataIndex
            var item = card.distribution[idx]
            var pct = card.total > 0 ? Math.round(item.count / card.total * 100) : 0
            tooltipEl.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:' + (STATUS_COLORS[item.status] || '#d1d5db') + '"></span>' + item.status + ': ' + item.count + ' (' + pct + '%)'
          }

          var canvas = context.chart.canvas
          var rect = canvas.getBoundingClientRect()
          tooltipEl.style.opacity = '1'
          tooltipEl.style.left = rect.left + model.caretX + 'px'
          tooltipEl.style.top = rect.top + model.caretY + 'px'
          tooltipEl.style.transform = 'translate(-50%, -120%)'
        }
      }
    }
  }
}

// ── Helpers ──

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysFromNow(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function formatDaysLabel(days) {
  if (days === null) return '—'
  if (days === 0) return 'Today'
  if (days < 0) return Math.abs(days) + ' days ago'
  return days + ' days'
}

function getDaysClass(days, isPast, isNext) {
  if (days === null) return 'text-gray-300 dark:text-gray-600'
  if (isPast) return 'text-gray-400 dark:text-gray-500'
  if (days === 0) return 'font-semibold text-primary-600 dark:text-primary-400'
  if (isNext) return 'font-semibold text-gray-900 dark:text-gray-100'
  return 'text-gray-600 dark:text-gray-300'
}
</script>
