<template>
  <div class="space-y-6">
    <!-- Google Sheet ID -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Google Sheets Integration</h3>
      <p class="text-sm text-gray-500 mb-4">
        Optionally enrich LDAP data with team assignments from a Google Sheet.
      </p>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Spreadsheet ID</label>
        <input
          v-model="editSheetId"
          placeholder="e.g. 1gQfxqHE5y9PIuW-pJONDITbeNA0Vg2x1pazywAcDHTg"
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p class="text-xs text-gray-500 mt-1">
          All sheets in the spreadsheet are auto-discovered. Sheets without a recognized name column are automatically skipped.
        </p>
      </div>
    </div>

    <!-- Required Fields -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Required Column Mappings</h3>
      <p class="text-sm text-gray-500 mb-4">
        Map the required columns from your spreadsheet. These are used to match people and group them into teams.
      </p>

      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name Column <span class="text-red-500">*</span></label>
          <input
            v-model="editNameColumn"
            placeholder="e.g. Associate's Name"
            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p class="text-xs text-gray-400 mt-0.5">Exact column header used to match people from LDAP</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Team Grouping Column <span class="text-red-500">*</span></label>
          <input
            v-model="editTeamGroupingColumn"
            placeholder="e.g. Scrum Team Name"
            class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <p class="text-xs text-gray-400 mt-0.5">Column used to group people into teams (comma-separated values create multi-team membership)</p>
        </div>
      </div>
    </div>

    <!-- Custom Fields -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 class="text-lg font-semibold text-gray-900 mb-3">Custom Fields</h3>
      <p class="text-sm text-gray-500 mb-4">
        Map additional spreadsheet columns to custom fields. These can be displayed on person cards and used for filtering.
      </p>

      <div class="space-y-3 mb-4">
        <div
          v-for="(field, idx) in editCustomFields"
          :key="idx"
          class="p-3 bg-gray-50 rounded-md"
        >
          <div class="grid grid-cols-3 gap-3 mb-2">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Spreadsheet Column</label>
              <input
                v-model="field.columnLabel"
                placeholder="e.g. Engineering Speciality"
                class="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                :class="columnLabelError(idx) ? 'border-red-300 bg-red-50' : 'border-gray-300'"
              />
              <p v-if="columnLabelError(idx)" class="text-xs text-red-500 mt-0.5">{{ columnLabelError(idx) }}</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Display Label</label>
              <input
                v-model="field.displayLabel"
                placeholder="e.g. Specialty"
                class="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">Key</label>
              <input
                v-model="field.key"
                placeholder="auto-generated"
                class="w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                :class="keyError(idx) ? 'border-red-300 bg-red-50' : 'border-gray-300'"
              />
              <p v-if="keyError(idx)" class="text-xs text-red-500 mt-0.5">{{ keyError(idx) }}</p>
              <p v-else class="text-xs text-gray-400 mt-0.5">Letters, numbers, underscores</p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                v-model="field.visible"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-xs text-gray-600">Show in person details</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer group relative">
              <input
                type="radio"
                name="primaryDisplay"
                :value="idx"
                :checked="primaryDisplayIdx === idx"
                @change="setPrimaryDisplay(idx)"
                class="border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span class="text-xs text-gray-600">Show as badge on person cards</span>
              <svg class="h-3.5 w-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute bottom-full left-0 mb-1 hidden group-hover:block w-64 p-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                The badge field appears as a colored tag on each person card and as a filter on the People view. Only one field can be the badge. Use "Show in person details" for additional fields you want displayed.
              </div>
            </label>
            <button
              @click="removeField(idx)"
              class="ml-auto p-1 text-gray-400 hover:text-red-600 transition-colors"
              title="Remove field"
            >
              <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="addField"
          :disabled="editCustomFields.length >= 20"
          class="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Add field
        </button>
        <button
          v-if="primaryDisplayIdx !== null"
          @click="clearPrimaryDisplay"
          class="text-sm text-gray-500 hover:text-gray-700 font-medium"
        >
          Clear primary display
        </button>
      </div>
    </div>

    <!-- Save -->
    <div class="flex items-center gap-3">
      <button
        @click="handleSave"
        :disabled="saving || !canSave"
        class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {{ saving ? 'Saving...' : 'Save Team Structure' }}
      </button>
      <span v-if="saveMessage" class="text-sm" :class="saveError ? 'text-red-600' : 'text-green-600'">
        {{ saveMessage }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRosterSync } from '../composables/useRosterSync'

const emit = defineEmits(['toast'])

const {
  config,
  saving,
  fetchConfig,
  saveConfig
} = useRosterSync()

const editSheetId = ref('')
const editNameColumn = ref('')
const editTeamGroupingColumn = ref('')
const editCustomFields = ref([])
const primaryDisplayIdx = ref(null)
const saveMessage = ref(null)
const saveError = ref(false)

function populateForm() {
  if (config.value) {
    editSheetId.value = config.value.googleSheetId || ''
    const ts = config.value.teamStructure
    if (ts) {
      editNameColumn.value = ts.nameColumn || ''
      editTeamGroupingColumn.value = ts.teamGroupingColumn || ''
      editCustomFields.value = (ts.customFields || []).map(f => ({ ...f }))
      const pIdx = editCustomFields.value.findIndex(f => f.primaryDisplay)
      primaryDisplayIdx.value = pIdx >= 0 ? pIdx : null
    } else {
      editNameColumn.value = ''
      editTeamGroupingColumn.value = ''
      editCustomFields.value = []
      primaryDisplayIdx.value = null
    }
  }
}

watch(config, populateForm)

onMounted(async () => {
  await fetchConfig()
  populateForm()
})

function addField() {
  editCustomFields.value.push({ key: '', columnLabel: '', displayLabel: '', visible: false, primaryDisplay: false })
}

function removeField(idx) {
  editCustomFields.value.splice(idx, 1)
  if (primaryDisplayIdx.value === idx) {
    primaryDisplayIdx.value = null
  } else if (primaryDisplayIdx.value !== null && primaryDisplayIdx.value > idx) {
    primaryDisplayIdx.value--
  }
}

function setPrimaryDisplay(idx) {
  primaryDisplayIdx.value = idx
}

function clearPrimaryDisplay() {
  primaryDisplayIdx.value = null
}

function keyError(idx) {
  const key = (editCustomFields.value[idx].key || '').trim()
  if (!key) return null
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) return 'Invalid: letters, numbers, underscores only'
  const reserved = ['_teamGrouping', 'name', 'originalName', 'sourceSheet', '__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'hasOwnProperty']
  if (reserved.includes(key)) return 'Reserved key'
  const duplicate = editCustomFields.value.some((f, i) => i !== idx && f.key.trim() === key)
  if (duplicate) return 'Duplicate key'
  return null
}

function columnLabelError(idx) {
  const col = (editCustomFields.value[idx].columnLabel || '').trim()
  if (!col) return null
  const duplicate = editCustomFields.value.some((f, i) => i !== idx && (f.columnLabel || '').trim() === col)
  if (duplicate) return 'Duplicate column'
  return null
}

const hasErrors = computed(() => {
  return editCustomFields.value.some((_, idx) => keyError(idx) || columnLabelError(idx))
})

const canSave = computed(() => {
  if (hasErrors.value) return false
  // If any team structure fields are filled, both required fields must be present
  const hasAnyStructure = editNameColumn.value.trim() || editTeamGroupingColumn.value.trim() || editCustomFields.value.length > 0
  if (hasAnyStructure) {
    if (!editNameColumn.value.trim() || !editTeamGroupingColumn.value.trim()) return false
  }
  return true
})

function generateKey(label) {
  if (!label) return ''
  return label
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

function deduplicateKey(key, existingKeys) {
  if (!existingKeys.has(key)) return key
  let i = 2
  while (existingKeys.has(key + i)) i++
  return key + i
}

async function handleSave() {
  saveMessage.value = null
  saveError.value = false

  try {
    // Build teamStructure if configured
    let teamStructure = null
    if (editNameColumn.value.trim() && editTeamGroupingColumn.value.trim()) {
      const usedKeys = new Set()
      const customFields = editCustomFields.value
        .filter(f => f.columnLabel.trim())
        .map((f, idx) => {
          let key = f.key.trim()
          if (!key) {
            key = generateKey(f.displayLabel || f.columnLabel)
          }
          if (!key) key = 'field'
          key = deduplicateKey(key, usedKeys)
          usedKeys.add(key)
          return {
            key,
            columnLabel: f.columnLabel.trim(),
            displayLabel: (f.displayLabel || f.columnLabel).trim(),
            visible: !!f.visible,
            primaryDisplay: primaryDisplayIdx.value === idx
          }
        })

      teamStructure = {
        nameColumn: editNameColumn.value.trim(),
        teamGroupingColumn: editTeamGroupingColumn.value.trim(),
        customFields
      }
    }

    await saveConfig({
      googleSheetId: editSheetId.value.trim() || null,
      teamStructure
    })
    saveMessage.value = 'Team structure saved.'
    emit('toast', { message: 'Team structure configuration saved', type: 'success' })
    setTimeout(() => { saveMessage.value = null }, 3000)
  } catch (err) {
    saveMessage.value = err.message
    saveError.value = true
  }
}
</script>
