import type { Plugin } from "vite";
import { handleVerduraChatRequest } from "./server/api/chat/verdura";

async function nodeRequestToFetch(req: import("http").IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const method = req.method ?? "GET";
  let body: Buffer | undefined;

  if (method !== "GET" && method !== "HEAD") {
    body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  }

  return new Request(url, {
    method,
    headers,
    body: body?.length ? body : undefined,
  });
}

async function sendFetchResponse(
  res: import("http").ServerResponse,
  response: Response,
): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const body = Buffer.from(await response.arrayBuffer());
  res.end(body);
}

/** Branche POST /api/chat/verdura en dev Vite (hors pipeline SSR TanStack). */
export function verduraChatApiPlugin(): Plugin {
  return {
    name: "verdura-chat-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (pathname !== "/api/chat/verdura") {
          next();
          return;
        }

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
          res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
          res.end();
          return;
        }

        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ code: "METHOD_NOT_ALLOWED", message: "POST uniquement." }));
          return;
        }

        try {
          const request = await nodeRequestToFetch(req);
          const response = await handleVerduraChatRequest(request);
          await sendFetchResponse(res, response);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Erreur serveur",
            }),
          );
        }
      });
    },
  };
}
