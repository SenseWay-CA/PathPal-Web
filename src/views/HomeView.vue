<script setup lang="ts">
import { ref } from 'vue'
import {
  Heart,
  ShieldAlert,
  MapPin,
  Battery,
  BatteryCharging,
  BatteryLow,
  Footprints,
  Phone,
  Info,
  Plus,
  Dot,
  Settings,
  Home,
} from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

// Reactive data for progress bar example
const progressValue = ref(78)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
      <p class="text-muted-foreground">Monitor your SmartCane status and safety information.</p>
    </div>

    <main class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">SOS Status</CardTitle>
          <ShieldAlert class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold text-green-500">SAFE</div>
          <p class="text-xs text-muted-foreground">Last updated: 2 minutes ago</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Device Battery</CardTitle>
          <Battery class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="flex items-center gap-2">
            <div class="text-2xl font-bold">{{ progressValue }}%</div>
            <Progress :model-value="progressValue" class="h-2 flex-1" />
          </div>
          <p class="text-xs text-muted-foreground">~12 hours remaining</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">Heart Rate</CardTitle>
          <Heart class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">72 BPM</div>
          <p class="text-xs text-muted-foreground">Normal</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle class="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-2">
          <Button class="w-full" variant="destructive">
            <ShieldAlert class="mr-2 h-4 w-4" /> Emergency SOS
          </Button>
          <Button variant="outline" class="w-full">
            <Phone class="mr-2 h-4 w-4" /> Call Guardian
          </Button>
        </CardContent>
      </Card>

      <Card class="lg:col-span-2 lg:row-span-2">
        <CardHeader>
          <CardTitle>Real-Time Location</CardTitle>
        </CardHeader>
        <CardContent class="h-[calc(100%-80px)] flex flex-col justify-between">
          <div
            class="relative flex items-center justify-center h-full w-full bg-muted rounded-md mb-4"
          >
            <MapPin class="h-10 w-10 text-muted-foreground" />
            <div
              class="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"
            >
              <span class="text-sm">Interactive Map View</span>
              <span class="text-xs">Current Location: Home</span>
            </div>
          </div>
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last GPS Update: 30 seconds ago</span>
            <Button variant="outline" size="sm">
              <MapPin class="mr-2 h-3 w-3" /> Center on User
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card class="lg:col-span-2">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid gap-4">
            <div class="flex items-center gap-4">
              <BatteryCharging class="h-5 w-5 text-muted-foreground" />
              <div>
                <p class="text-sm font-medium">Device Connected</p>
                <p class="text-xs text-muted-foreground">Today at 9:15 AM</p>
              </div>
            </div>
            <Separator />
            <div class="flex items-center gap-4">
              <Footprints class="h-5 w-5 text-muted-foreground" />
              <div>
                <p class="text-sm font-medium">Walking session started</p>
                <p class="text-xs text-muted-foreground">Today at 8:45 AM</p>
              </div>
            </div>
            <Separator />
            <div class="flex items-center gap-4">
              <Home class="h-5 w-5 text-muted-foreground" />
              <div>
                <p class="text-sm font-medium">Arrived at safe zone</p>
                <p class="text-xs text-muted-foreground">Yesterday at 6:30 PM</p>
              </div>
            </div>
          </div>
          <div class="mt-4 text-center">
            <Button variant="link" class="text-sm">View All Activity</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety Zones</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">Home</p>
              <p class="text-sm text-muted-foreground">Currently inside</p>
            </div>
            <Badge variant="secondary">
              <Dot class="h-4 w-4 text-green-500" />
            </Badge>
          </div>
          <Separator />
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium">Park</p>
              <p class="text-sm text-muted-foreground">2.3 km away</p>
            </div>
            <Button variant="ghost" size="icon">
              <Info class="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" class="w-full">
            <Plus class="mr-2 h-4 w-4" /> Add New Zone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trusted Contacts</CardTitle>
        </CardHeader>
        <CardContent class="grid gap-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Avatar>
                <AvatarImage src="/avatars/02.png" alt="Sarah Johnson" />
                <AvatarFallback>SJ</AvatarFallback>
              </Avatar>
              <div>
                <p class="font-medium">Sarah Johnson</p>
                <p class="text-sm text-muted-foreground">Daughter</p>
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <Phone class="h-4 w-4" />
            </Button>
          </div>
          <Separator />
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Avatar>
                <AvatarImage src="/avatars/03.png" alt="Dr. Michael Chen" />
                <AvatarFallback>MC</AvatarFallback>
              </Avatar>
              <div>
                <p class="font-medium">Dr. Michael Chen</p>
                <p class="text-sm text-muted-foreground">Physician</p>
              </div>
            </div>
            <Button variant="ghost" size="icon">
              <Phone class="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
