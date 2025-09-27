<script setup>
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import { SidebarProvider } from '@/components/ui/sidebar'
</script>

<template>
  <div class="flex h-screen bg-background">
    <SidebarProvider>
      <AppSidebar />
      <main class="flex-1 overflow-y-auto p-6">
        <header class="flex items-center justify-end mb-6"></header>
        <div class="content">
          <RouterView />
        </div>
      </main>
    </SidebarProvider>
  </div>
</template>
