import { QueryClient } from "@tanstack/react-query";
import { createRouter as createRouterImpl } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Top-level debug to verify module load and routeTree presence
console.debug("[router module] loaded, routeTree present:", !!routeTree);

// Factory used by the server to create a fresh router per request.
export const createRouter = () => {
  const queryClient = new QueryClient();

  return createRouterImpl({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });
};

// Client-side cached router getter used during hydration.
let _router: ReturnType<typeof createRouter> | null = null;
export const getRouter = () => {
  // Debug: log calls to getRouter to diagnose hydration timing issues
  console.debug("[getRouter] called, existing router:", !!_router);
  if (_router) return _router;

  _router = createRouter();

  return _router;
};
