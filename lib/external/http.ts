// Shared fetch + Zod validation for the external API clients (server only).

import type { z } from "zod";

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export class ExternalApiError extends Error {
  constructor(
    readonly service: "steam" | "faceit" | "leetify",
    readonly status: number,
    message: string,
  ) {
    super(`${service}: ${message}`);
    this.name = "ExternalApiError";
  }
}

export interface GetJsonOptions {
  service: ExternalApiError["service"];
  headers?: Record<string, string>;
  /** Seconds the Next.js data cache may reuse the response (0 = never cached, e.g. Leetify). */
  revalidate: number;
  fetch?: FetchLike;
  /** Return null instead of throwing on 404. */
  allowNotFound?: boolean;
}

/**
 * GET a JSON endpoint and validate it. Never logs the URL: it can carry an API key (Steam).
 * Throws `ExternalApiError` on non-2xx responses and on bodies that do not match the schema.
 */
export async function getJson<S extends z.ZodType>(
  url: string,
  schema: S,
  opts: GetJsonOptions & { allowNotFound: true },
): Promise<z.infer<S> | null>;
export async function getJson<S extends z.ZodType>(
  url: string,
  schema: S,
  opts: GetJsonOptions,
): Promise<z.infer<S>>;
export async function getJson<S extends z.ZodType>(
  url: string,
  schema: S,
  opts: GetJsonOptions,
): Promise<z.infer<S> | null> {
  const doFetch = opts.fetch ?? fetch;
  const init: RequestInit & { next?: { revalidate: number } } = {
    headers: { Accept: "application/json", ...opts.headers },
    signal: AbortSignal.timeout(10_000),
    ...(opts.revalidate === 0
      ? { cache: "no-store" as const }
      : { next: { revalidate: opts.revalidate } }),
  };
  const res = await doFetch(url, init);
  if (res.status === 404 && opts.allowNotFound) return null;
  if (!res.ok) {
    throw new ExternalApiError(opts.service, res.status, `HTTP ${res.status}`);
  }
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    throw new ExternalApiError(
      opts.service,
      res.status,
      `unexpected response shape: ${parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
