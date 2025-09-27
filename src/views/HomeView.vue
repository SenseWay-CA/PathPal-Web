<script setup>
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold">Home Overview</h1>
    <p class="text-zinc-400 mt-2">Monitor your PathPal status and safety information</p>
    <div class="flex flex-col">
      <div class="flex flex-row justify-between content-start">
        <Card>
          <CardHeader>
            <CardTitle>SOS Status</CardTitle>
          </CardHeader>
          <CardContent> Safe </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
      </div>
      <div class="flex flex-row justify-between content-start">
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
      </div>
      <div class="flex flex-row justify-between content-start">
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent> Card Content </CardContent>
          <CardFooter> Card Footer </CardFooter>
        </Card>
      </div>
    </div>
  </div>
</template>
