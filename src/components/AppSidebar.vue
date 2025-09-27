<script setup>
import { Home, MapPin, HeartPulse, Shield, Users, Settings, Bell } from 'lucide-vue-next'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarHeader,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useRoute, RouterLink } from 'vue-router'

const route = useRoute()

const items = [
  {
    title: 'Home',
    to: { name: 'dashboard' },
    icon: Home,
  },
  {
    title: 'Location Tracking',
    to: { name: 'location-tracking' },
    icon: MapPin,
  },
  {
    title: 'Health Monitoring',
    to: { name: 'health-monitoring' },
    icon: HeartPulse,
  },
  {
    title: 'Safety Zones',
    to: { name: 'safety-zones' },
    icon: Shield,
  },
  {
    title: 'Trusted Contacts',
    to: { name: 'trusted-contacts' },
    icon: Users,
  },
  {
    title: 'Device Settings',
    to: { name: 'device-settings' },
    icon: Settings,
  },
  {
    title: 'Notifications',
    to: { name: 'notifications' },
    icon: Bell,
  },
]
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <div class="flex items-center gap-2">
        <SidebarTrigger />
        <span class="font-bold group-data-[collapsible=icon]:hidden">PathPal</span>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.title">
              <RouterLink :to="item.to" custom v-slot="{ navigate, isActive, href }">
                <SidebarMenuButton
                  as="a"
                  :href="href"
                  @click="navigate"
                  :isActive="item.to.name === 'dashboard' ? route.name === 'dashboard' : isActive"
                  :tooltip="item.title"
                >
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </SidebarMenuButton>
              </RouterLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
</template>
