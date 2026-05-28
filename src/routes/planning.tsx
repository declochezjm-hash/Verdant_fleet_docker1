import { createFileRoute } from "@tanstack/react-router";
import { PlanningSupabaseView } from "@/components/views/planning-supabase-view";
export const Route = createFileRoute("/planning")({ component: PlanningSupabaseView });
