import { createFileRoute } from "@tanstack/react-router";
import { handleVerduraChatRequest } from "../../../../server/api/chat/verdura";

export const Route = createFileRoute("/api/chat/verdura")({
  server: {
    handlers: {
      POST: async ({ request }) => handleVerduraChatRequest(request),
    },
  },
});
