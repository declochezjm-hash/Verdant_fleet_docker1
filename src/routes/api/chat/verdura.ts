import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/chat/verdura")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleVerduraChatRequest } = await import(
          "../../../../server/api/chat/verdura"
        );
        return handleVerduraChatRequest(request);
      },
    },
  },
});
