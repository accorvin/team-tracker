<template>
  <div>
    <!-- Loading state -->
    <div v-if="loading" class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="text-center">
        <svg
          class="animate-spin h-12 w-12 text-primary-700 mx-auto mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-gray-600 text-lg">Authenticating...</p>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
        <svg
          class="h-16 w-16 text-red-500 mx-auto mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h2>
        <p class="text-gray-600 mb-6">{{ error }}</p>
        <button
          @click="signIn"
          class="px-6 py-3 bg-primary-700 text-white rounded-md font-medium hover:bg-primary-800 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>

    <!-- Allowlist denied state -->
    <div v-else-if="allowlistDenied" class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
        <svg
          class="h-16 w-16 text-amber-500 mx-auto mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Access Restricted</h2>
        <p class="text-gray-600 mb-1">Signed in as <span class="font-medium">{{ user.email }}</span></p>
        <p class="text-gray-500 text-sm mb-6">You are not on the access list. Contact a team member to request access.</p>
        <button
          @click="signOut"
          class="px-6 py-3 bg-primary-700 text-white rounded-md font-medium hover:bg-primary-800 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>

    <!-- Unauthenticated state -->
    <div v-else-if="!user" class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
        <img src="/redhat-logo.svg" alt="Red Hat" class="h-16 mx-auto mb-6" />
        <h2 class="text-2xl font-bold text-gray-900 mb-2">AI Engineering Team Tracker</h2>
        <p class="text-gray-600 mb-6">Sign in with your @redhat.com account to continue</p>
        <button
          @click="signIn"
          class="px-6 py-3 bg-primary-700 text-white rounded-md font-medium hover:bg-primary-800 transition-colors inline-flex items-center gap-2"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>

    <!-- Authenticated state - render app -->
    <slot v-else></slot>
  </div>
</template>

<script setup>
import { useAuth } from '../composables/useAuth'

const { user, loading, error, allowlistDenied, signIn, signOut } = useAuth()
</script>
