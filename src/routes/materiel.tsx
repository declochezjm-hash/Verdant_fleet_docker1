import { createFileRoute } from "@tanstack/react-router";
import { MaterielView } from "@/components/views/materiel-view";
export const Route = createFileRoute("/materiel")({ component: MaterielView });
