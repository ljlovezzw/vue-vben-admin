<script setup lang="ts">
import { shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';

import { resumeAdCvrExecutionTask } from './execution-task';
import TaskWorkbench from './TaskWorkbench.vue';

defineOptions({ name: 'KanbanAdCvrOptimization' });

const route = useRoute();
// KeepAlive retains both entries; the global route must not change a hidden
// monthly instance into a daily workbench (or overwrite its filters).
const entryRouteName = route.name;
const apiScope =
  entryRouteName === 'KanbanDailyAdOptimization' ? 'daily' : 'legacy';
const routeFilters = shallowRef({
  projectTags: [] as string[],
  snapshotDate: '',
});
watch(
  () => [route.name, route.query] as const,
  ([name, query]) => {
    if (name !== entryRouteName) return;
    const tags = query.projectTags;
    const projectTags = (Array.isArray(tags) ? tags : [tags]).filter(
      (tag): tag is string => typeof tag === 'string' && tag.length > 0,
    );
    const snapshotDate =
      apiScope === 'daily' && typeof query.snapshotDate === 'string'
        ? query.snapshotDate
        : '';
    const previous = routeFilters.value;
    if (
      previous.snapshotDate === snapshotDate &&
      previous.projectTags.length === projectTags.length &&
      previous.projectTags.every((tag, index) => tag === projectTags[index])
    )
      return;
    routeFilters.value = { projectTags, snapshotDate };
  },
  { deep: true, immediate: true },
);

// Restore asynchronous execution tracking without loading the retired list.
void resumeAdCvrExecutionTask(apiScope);
</script>

<template>
  <div class="ad-optimization-page">
    <!-- Keep this element as the only route root: ConfigProvider's fragment
         cannot complete an out-in leave hook. Root comments also break dev. -->
    <TaskWorkbench
      :scope="apiScope"
      :project-tags="routeFilters.projectTags"
      :snapshot-date="routeFilters.snapshotDate"
    />
  </div>
</template>
