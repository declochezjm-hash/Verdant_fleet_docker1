import { createFileRoute } from "@tanstack/react-router";
import { CarteSupabaseView } from "@/components/views/carte-supabase-view";
export const Route = createFileRoute("/carte")({ component: CarteSupabaseView });
