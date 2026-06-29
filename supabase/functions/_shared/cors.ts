// CORS for browser-invoked Edge Functions.
//
// Origins are allowlisted (no wildcard). ALLOWED_ORIGINS is a comma-separated
// list of exact origins, e.g. "https://app.example.com,http://localhost:5173".
// We echo back the request's Origin only when it's on the list, so multiple
// origins (prod + local dev) work while everything else is denied. Falls back to
// the first configured origin for non-browser callers (no Origin header).
const DEFAULT_ORIGIN = 'http://localhost:5173'
const PARSED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? DEFAULT_ORIGIN)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
// Guard against an empty/whitespace ALLOWED_ORIGINS leaving the list empty,
// which would make the fallback origin `undefined` and break the CORS header.
const ALLOWED_ORIGINS = PARSED_ORIGINS.length > 0 ? PARSED_ORIGINS : [DEFAULT_ORIGIN]

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    // Response varies by request Origin, so caches must key on it.
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

// Per-request HTTP helpers bound to the caller's Origin. Use at the top of a
// handler: `const { json, preflight } = http(req)`.
export function http(req: Request) {
  const headers = corsHeaders(req.headers.get('Origin'))
  return {
    /** Response for an OPTIONS preflight. */
    preflight: () => new Response('ok', { headers }),
    /** JSON response carrying the right CORS headers. */
    json: (body: unknown, status = 200): Response =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' },
      }),
  }
}
