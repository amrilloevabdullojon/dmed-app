'use client'

import dynamic from 'next/dynamic'

const Particles = dynamic(() => import('@/components/Particles').then((mod) => mod.Particles), {
  ssr: false,
})
const Snowfall = dynamic(() => import('@/components/Snowfall').then((mod) => mod.Snowfall), {
  ssr: false,
})
const NewYearBanner = dynamic(
  () => import('@/components/Snowfall').then((mod) => mod.NewYearBanner),
  { ssr: false }
)
const OfflineIndicator = dynamic(
  () => import('@/components/OfflineIndicator').then((mod) => mod.OfflineIndicator),
  { ssr: false }
)

export function ClientEffects() {
  return (
    <>
      <NewYearBanner />
      <Particles />
      <Snowfall />
      <OfflineIndicator />
    </>
  )
}
