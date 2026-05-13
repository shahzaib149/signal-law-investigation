/**
 * Normalize HTML or messy text for XPR precheck/ingest.
 * Raw HTML can skew AI classification (e.g. toward "advertorial") because of tags, CTAs, and chrome.
 */
export function htmlToPlainTextForXpr(input: string): string {
  if (!input || typeof input !== 'string') return ''
  const s = input.trim()
  if (!s.includes('<')) {
    return s
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  let t = s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")

  t = t
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

  return t.replace(/\n{3,}/g, '\n\n').trim()
}

/** Prefer de-HTMLized body; merge summary/title if extraction is too short (weak signal to XPR). */
export function resolvePlainContentForXpr(
  input: string | undefined,
  summary: string,
  title: string
): string {
  const raw = String(input ?? '').trim()
  const plain = htmlToPlainTextForXpr(raw)
  if (plain.length >= 80) return plain
  const merged = [plain, summary, title].filter(Boolean).join('\n\n').trim()
  return htmlToPlainTextForXpr(merged) || merged
}

const MAX_XPR_BODY_CHARS = 120_000

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Remove active content vectors; keep markup like client HTML bulletins. */
export function stripUnsafeHtmlOnly(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<\/?(?:object|embed|applet)[^>]*>/gi, '')
    .trim()
}

/**
 * Precheck/ingest `content`: full HTML when source is HTML (matches client contract);
 * plain text (e.g. PDF extract) → safe paragraph HTML.
 */
export function prepareXprContentForItem(
  content: string | undefined,
  summary: string,
  title: string
): string {
  const raw = String(content ?? '').trim()
  if (!raw) {
    return `<p>${escapeHtml(summary || title || ' ')}</p>`
  }
  if (raw.includes('<')) {
    return stripUnsafeHtmlOnly(raw).slice(0, MAX_XPR_BODY_CHARS)
  }
  return buildXprArticleBody(htmlToPlainTextForXpr(raw) || summary || title)
}

/** Minimal safe HTML paragraphs for XPR `content` field. */
export function buildXprArticleBody(plain: string): string {
  const t = plain.trim().slice(0, MAX_XPR_BODY_CHARS)
  if (!t) return '<p></p>'
  const escaped = t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const parts = escaped.split(/\n\n+/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean)
  if (parts.length === 0) return '<p></p>'
  return parts.map((p) => `<p>${p}</p>`).join('')
}
