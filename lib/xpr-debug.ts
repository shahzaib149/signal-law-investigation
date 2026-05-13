/**
 * XPR integration diagnostics — logs to stdout (Vercel Function / local terminal).
 * Set XPR_DEBUG_LOGS=1 (or true) on Vercel when you need full request/response traces.
 * Local dev logs whenever NODE_ENV === 'development' OR XPR_DEBUG_LOGS is set.
 *
 * Full bodies: `logXprJsonFull` / `logXprTextFull` split large payloads into chunks so
 * Vercel log lines are not silently truncated.
 */

const XPR_LOG_CHUNK_CHARS = 24_000

function envTruthy(v: string | undefined): boolean {
  if (!v) return false
  const s = v.toLowerCase()
  return s === '1' || s === 'true' || s === 'yes'
}

export function xprDebugLogsEnabled(): boolean {
  if (envTruthy(process.env.XPR_DEBUG_LOGS)) return true
  // Preview deployments on Vercel: full XPR traces without touching Production env vars
  if (process.env.VERCEL_ENV === 'preview') return true
  return process.env.NODE_ENV === 'development'
}

/** Remove apiKey query param for safe logging */
export function redactXprUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.searchParams.has('apiKey')) u.searchParams.set('apiKey', '[REDACTED]')
    return u.toString()
  } catch {
    return url.replace(/apiKey=[^&]+/gi, 'apiKey=[REDACTED]')
  }
}

export function logXpr(tag: string, data: unknown): void {
  if (!xprDebugLogsEnabled()) return
  const line = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  console.log(`[XPR:${tag}]`, line)
}

/** Pretty-print JSON and log in chunks (full body for XPR request/response analysis). */
export function logXprJsonFull(tag: string, partLabel: string, value: unknown): void {
  if (!xprDebugLogsEnabled()) return
  let text: string
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  } catch {
    text = String(value)
  }
  logXprTextFull(tag, partLabel, text)
}

/** Log a raw string in chunks (non-JSON responses, or already-stringified bodies). */
export function logXprTextFull(tag: string, partLabel: string, text: string): void {
  if (!xprDebugLogsEnabled()) return
  const len = text.length
  if (len <= XPR_LOG_CHUNK_CHARS) {
    console.log(`[XPR:${tag}] ${partLabel} (${len} chars)\n${text}`)
    return
  }
  const totalParts = Math.ceil(len / XPR_LOG_CHUNK_CHARS)
  for (let i = 0; i < totalParts; i++) {
    const start = i * XPR_LOG_CHUNK_CHARS
    const chunk = text.slice(start, start + XPR_LOG_CHUNK_CHARS)
    console.log(`[XPR:${tag}] ${partLabel} — part ${i + 1}/${totalParts} (chars ${start}-${start + chunk.length} of ${len})\n${chunk}`)
  }
}
