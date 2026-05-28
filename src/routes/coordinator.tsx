import { createFileRoute } from "@tanstack/react-router";
import { CoordinatorView } from "@/components/views/coordinator-view";

export const Route = createFileRoute("/coordinator")({
  component: CoordinatorView,
});