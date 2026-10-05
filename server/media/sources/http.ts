// Fetch with timeouts and retries for the online sound sources. Retries rate limits (429,
// honouring Retry-After) and server/network errors with backoff; other 4xx fail at once.

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 3, timeoutMs = 30_000, baseDelayMs = 500, fetchFn = fetch as FetchFn } = {},
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    let error: unknown = null;
    try {
      res = await fetchFn(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      error = err;
    }
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (res && !retryable) return res;
    if (attempt >= retries) {
      if (res) return res;
      throw error instanceof Error ? error : new Error(String(error));
    }
    const retryAfter = Number(res?.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 30) * 1000 : baseDelayMs * 2 ** attempt);
  }
}

/** Short, key-free description of a failed response for error messages. */
export async function describeFailure(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  let detail = body;
  try {
    detail = (JSON.parse(body) as { detail?: string }).detail ?? body;
  } catch {
    // not JSON
  }
  return `${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
}
