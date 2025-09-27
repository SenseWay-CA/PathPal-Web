<script setup>
import { Home, MapPin, HeartPulse, Shield, Users, Settings, Bell, User } from 'lucide-vue-next'
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
  SidebarFooter,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useRoute, RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

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

const handleLogout = () => {
  authStore.logout()
  router.push('/auth')
}
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader>
      <div class="flex items-center gap-1">
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
    <SidebarFooter>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton class="group-data-[collapsible=icon]:justify-center">
            <Avatar class="size-4">
              <AvatarImage src="https://github.com/radix-vue.png" alt="@radix-vue" />
              <AvatarFallback>
                <User class="size-3" />
              </AvatarFallback>
            </Avatar>
            <span class="truncate group-data-[collapsible=icon]:hidden">
              {{ authStore.user?.email }}
            </span>
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="top"
          align="start"
          class="w-[--radix-dropdown-menu-trigger-width]"
        >
          <DropdownMenuItem @click="handleLogout"> Logout </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
