import { createFileRoute } from "@tanstack/react-router";
import { AdminAnalytics } from "@/components/views/admin-analytics";

export const Route = createFileRoute("/analytics")({
  component: AdminAnalytics,
});