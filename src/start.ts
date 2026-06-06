import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { consumeLastCapturedError } from "./lib/error-capture";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Log both the caught error and any out-of-band captured error for diagnostics
    let captured: unknown;
    try {
      captured = consumeLastCapturedError();
      console.error("SSR error caught:", error, "; captured:", captured);
    } catch (e) {
      console.error("SSR error caught (failed to read captured):", error);
    }

    // In development show error details in the 500 page to aid debugging
    const isDev = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') || true;
    if (isDev) {
      const body = `${renderErrorPage()}\n<pre style="white-space:pre-wrap;background:#111;color:#fff;padding:1rem;border-radius:6px;margin:1rem;">${String(error)}\n\nCaptured: ${String(captured)}</pre>`;
      return new Response(body, {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
}));
