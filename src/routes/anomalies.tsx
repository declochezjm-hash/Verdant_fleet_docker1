import { createFileRoute } from "@tanstack/react-router";
import { AnomaliesView } from "@/components/views/anomalies-view";

export const Route = createFileRoute("/anomalies")({
  component: AnomaliesView,
});