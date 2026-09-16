export class UpstreamError extends Error {
  constructor(public status: number, message = 'Upstream request failed') { super(message); }
}
export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export interface RequestContext { remaining: number; debug: boolean; fetcher: typeof fetch; pause: typeof sleep }
export function context(debug = false, fetcher: typeof fetch = (...args) => fetch(...args), pause = sleep): RequestContext {
  return { remaining: 40, debug, fetcher, pause };
}
export async function upstream(url: string, body: unknown, ctx: RequestContext, headers: Record<string, string> = {}): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (ctx.remaining <= 0) throw new UpstreamError(503, 'Request budget exhausted');
    if (ctx.remaining < 40) await ctx.pause(180);
    ctx.remaining--;
    const correlationId = crypto.randomUUID(), start = Date.now();
    let status = 0;
    try {
      const response = await ctx.fetcher(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ ...(body as object), correlationId }), signal: AbortSignal.timeout(10000), redirect: 'manual',
      });
      status = response.status;
      if (!response.ok) { await response.body?.cancel(); throw new UpstreamError(status); }
      return await response.json();
    } catch (error) {
      const transient = !(error instanceof UpstreamError) || [408, 429, 500, 502, 503, 504].includes(error.status);
      if (!transient || attempt === 2 || ctx.remaining <= 0) throw error;
      await ctx.pause(450 * 2 ** attempt + Math.random() * 200);
    } finally {
      const b = body as { from?: number; size?: number; products?: string[] };
      if (ctx.debug) console.log(JSON.stringify({ event: 'Telstra request', correlationId, from: b.from, size: b.size, skuCount: b.products?.length, status, duration: Date.now() - start }));
    }
  }
  throw new UpstreamError(503);
}
