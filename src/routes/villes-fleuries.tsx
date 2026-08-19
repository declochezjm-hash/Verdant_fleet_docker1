import { createFileRoute } from '@tanstack/react-router'
import { VillesFleuriesView } from '@/components/views/villes-fleuries-view'

export const Route = createFileRoute('/villes-fleuries')({
  component: VillesFleuriesView,
})