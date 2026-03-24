import { defineAsyncComponent } from 'vue'

export const routes = {
  'dashboard': defineAsyncComponent(() => import('./views/Dashboard.vue')),
  'people': defineAsyncComponent(() => import('./views/PeopleView.vue')),
  'trends': defineAsyncComponent(() => import('./views/TrendsView.vue')),
  'reports': defineAsyncComponent(() => import('./views/ReportsView.vue')),
  'team-roster': defineAsyncComponent(() => import('./views/TeamRosterView.vue')),
  'person-detail': defineAsyncComponent(() => import('./views/PersonDetail.vue')),
}
