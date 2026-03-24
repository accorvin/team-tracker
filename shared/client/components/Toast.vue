<template>
  <transition name="toast">
    <div
      v-if="visible"
      class="fixed top-4 right-4 z-50 max-w-md bg-white rounded-lg shadow-lg border-l-4 p-4"
      :class="borderColorClass"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <div class="flex-shrink-0">
          <svg
            v-if="type === 'success'"
            class="h-5 w-5 text-green-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <svg
            v-else-if="type === 'error'"
            class="h-5 w-5 text-red-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <svg
            v-else-if="type === 'warning'"
            class="h-5 w-5 text-yellow-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm font-medium text-gray-900">{{ message }}</p>
        </div>
        <button
          @click="close"
          class="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'Toast',
  props: {
    message: { type: String, required: true },
    type: { type: String, default: 'success', validator: (v) => ['success', 'error', 'warning'].includes(v) },
    duration: { type: Number, default: 3000 }
  },
  data() {
    return { visible: false, timeoutId: null }
  },
  computed: {
    borderColorClass() {
      return {
        'border-green-500': this.type === 'success',
        'border-red-500': this.type === 'error',
        'border-yellow-500': this.type === 'warning'
      }
    }
  },
  mounted() {
    this.visible = true
    if (this.duration > 0) {
      this.timeoutId = setTimeout(() => this.close(), this.duration)
    }
  },
  beforeUnmount() {
    if (this.timeoutId) clearTimeout(this.timeoutId)
  },
  methods: {
    close() {
      this.visible = false
      setTimeout(() => this.$emit('close'), 300)
    }
  }
}
</script>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { transform: translateX(100%); opacity: 0; }
.toast-leave-to { transform: translateY(-20px); opacity: 0; }
</style>
