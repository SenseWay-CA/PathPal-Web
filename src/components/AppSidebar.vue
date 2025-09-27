<script setup>
import { Home, MapPin, HeartPulse, Shield, Users, Settings, Bell } from 'lucide-vue-next'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const items = [
  {
    title: 'Dashboard',
    url: '#',
    icon: Home,
  },
  {
    title: 'Location Tracking',
    url: '#',
    icon: MapPin,
  },
  {
    title: 'Health Monitoring',
    url: '#',
    icon: HeartPulse,
  },
  {
    title: 'Safety Zones',
    url: '#',
    icon: Shield,
  },
  {
    title: 'Trusted Contacts',
    url: '#',
    icon: Users,
  },
  {
    title: 'Device Settings',
    url: '#',
    icon: Settings,
  },
  {
    title: 'Notifications',
    url: '#',
    icon: Bell,
  },
]
</script>

<template>
  <Sidebar>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>PathPal</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in items" :key="item.title">
              <SidebarMenuButton asChild>
                <a :href="item.url">
                  <component :is="item.icon" />
                  <span>{{ item.title }}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>
