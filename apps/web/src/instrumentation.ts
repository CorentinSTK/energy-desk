import type { Instrumentation } from "next";

/**
 * Server errors as one JSON line each, readable in the Vercel runtime logs (ADR 0011). No request
 * body, headers or query values are logged: only the route, the kind of render and the error.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      event: "server_error",
      path: request.path.split("?")[0],
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      renderSource: "renderSource" in context ? context.renderSource : undefined,
      digest: err.digest,
      name: err.name,
      message: err.message,
    }),
  );
};
