import { NextResponse } from 'next/server'
import { getPostByIdAnyType, getPostBySlugAnyType, getMedia } from '@/lib/wordpress'
import type { WordPressPost, WordPressMeta } from '@/types/investigation'

/**
 * POST /api/get-press-release
 * Body: { link: string }  — the full press release URL
 *
 * Strategy:
 *  1. If URL has ?p=N → try REST API by post ID (posts then pages)
 *  2. Try REST API by slug (posts then pages then press_release types)
 *  3. Fall back: fetch HTML from the URL directly and extract title + content
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const link = body?.link ? String(body.link).trim() : ''
  if (!link) return NextResponse.json({ error: 'link is required' }, { status: 400 })

  // ── Step 1: try by numeric post ID ──────────────────────────────
  const idMatch = link.match(/[?&]p=(\d+)/)
  if (idMatch) {
    const postId = Number(idMatch[1])
    try {
      const post = await getPostByIdAnyType(postId)
      if (post) {
        if (!post.featured_media_url && post.featured_media) {
          post.featured_media_url = await getMedia(post.featured_media)
        }
        console.log('[get-press-release] found via REST id=', postId)
        return NextResponse.json(post)
      }
    } catch { /* fall through */ }
  }

  // ── Step 2: try by slug ──────────────────────────────────────────
  try {
    const u    = new URL(link)
    const slug = u.pathname.replace(/\/$/, '').split('/').pop()
    if (slug) {
      const post = await getPostBySlugAnyType(slug)
      if (post) {
        if (!post.featured_media_url && post.featured_media) {
          post.featured_media_url = await getMedia(post.featured_media)
        }
        console.log('[get-press-release] found via REST slug=', slug)
        return NextResponse.json(post)
      }
    }
  } catch { /* fall through */ }

  // ── Step 3: Fetch URL — detect PDF redirect or scrape HTML ──────
  console.log('[get-press-release] REST lookup failed, fetching URL:', link)
  try {
    const res = await fetch(link, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SignalLawDashboard/1.0)',
        Accept: 'text/html,application/pdf,*/*',
      },
      redirect: 'follow',
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch press release (${res.status})` }, { status: 404 })
    }

    const finalUrl    = res.url
    const contentType = res.headers.get('content-type') ?? ''
    const isPdf       = finalUrl.toLowerCase().endsWith('.pdf') || contentType.includes('application/pdf')

    console.log('[get-press-release] finalUrl:', finalUrl, 'isPdf:', isPdf, 'contentType:', contentType)

    if (isPdf) {
      const rawSlug  = link.replace(/\/$/, '').split('/').pop() ?? ''
      const pdfTitle = rawSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      console.log('[get-press-release] PDF detected, pdfUrl:', finalUrl)

      // Extract full text from the PDF so XPR validation gets real content
      let pdfText = ''
      try {
        const pdfBytes = await fetch(finalUrl, {
          headers: { 'Accept-Encoding': 'gzip, deflate' },
          cache: 'no-store',
        }).then(r => r.arrayBuffer())
        const { PDFParse } = await import('pdf-parse')
        const parser = new PDFParse({ data: Buffer.from(pdfBytes), verbosity: 0 })
        const result = await parser.getText()
        pdfText = result.text.trim()
        console.log('[get-press-release] PDF text extracted, length:', pdfText.length)
      } catch (e) {
        console.warn('[get-press-release] PDF text extraction failed:', e)
      }

      return NextResponse.json({
        id: 0, title: pdfTitle, content: pdfText, status: 'publish', date: '',
        link, pdfUrl: finalUrl, isPdf: true,
        featured_media: 0, featured_media_url: null, press_release_link: null,
        meta: {
          vigilant_risk_score: '', escalation_momentum_score: '', litigation_readiness_index: '',
          legal_process_indicator: '', threat_horizon_index: '', case_impact_score: '',
          loss_severity_band: '', executive_intelligence_summary: '', investigation_status: '', last_updated: '',
        },
      })
    }

    const html = await res.text()
    const { title, content, imageUrl, date } = extractFromHtml(html)

    console.log('[get-press-release] scraped title=', title, 'content length=', content.length)

    const emptyMeta: WordPressMeta = {
      vigilant_risk_score: '', escalation_momentum_score: '', litigation_readiness_index: '',
      legal_process_indicator: '', threat_horizon_index: '', case_impact_score: '',
      loss_severity_band: '', executive_intelligence_summary: '', investigation_status: '', last_updated: '',
    }

    const scraped: WordPressPost = {
      id: 0, title, content, status: 'publish', date: date ?? '',
      link, featured_media: 0,
      featured_media_url: imageUrl,
      press_release_link: null,
      meta: emptyMeta,
    }

    return NextResponse.json(scraped)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[get-press-release] HTML scrape failed:', message)
    return NextResponse.json({ error: 'Press release not found' }, { status: 404 })
  }
}

/* ── HTML extractor ─────────────────────────────────────────────── */

function extractFromHtml(html: string): {
  title: string; content: string; imageUrl: string | null; date: string | null
} {
  // Title: og:title → h1.entry-title → <title>
  const title =
    html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i)?.[1] ||
    html.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ||
    html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s*[-–|].*$/, '').trim() ||
    ''

  // Featured image: og:image
  const imageUrl =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i)?.[1] ||
    null

  // Published date: article:published_time or datePublished
  const date =
    html.match(/<meta\s+property="article:published_time"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] ||
    null

  // Log structure hints for debugging
  const divClasses = [...html.matchAll(/class=["']([^"']*?)["']/gi)]
    .map(m => m[1])
    .filter(c => c.includes('content') || c.includes('entry') || c.includes('post') || c.includes('article') || c.includes('main'))
    .slice(0, 20)
  console.log('[get-press-release] content-related classes found:', divClasses)

  // Content: try many div class patterns (single + double quotes)
  const CONTENT_PATTERNS = [
    'entry-content', 'post-content', 'article-content', 'wp-block-post-content',
    'entry_content', 'post_content', 'the-content', 'page-content',
    'et_pb_text_inner',       // Divi
    'elementor-text-editor',  // Elementor
    'fl-module-content',      // Beaver Builder
    'td-post-content',        // TD themes
    'mkdf-post-text-inner',   // Mikado
    'single-post-content',    'content-inner', 'post-body', 'article-body',
  ]

  let content = ''

  for (const cls of CONTENT_PATTERNS) {
    // Match both double and single quote variants
    const re = new RegExp(`<div[^>]*class=["'][^"']*${cls}[^"']*["']`, 'i')
    const startIdx = html.search(re)
    if (startIdx !== -1) {
      const tagEnd = html.indexOf('>', startIdx)
      if (tagEnd !== -1) {
        let depth = 1, pos = tagEnd + 1
        while (depth > 0 && pos < html.length) {
          const nextOpen  = html.indexOf('<div',  pos)
          const nextClose = html.indexOf('</div>', pos)
          if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
            depth++; pos = nextOpen + 4
          } else if (nextClose !== -1) {
            depth--
            if (depth === 0) { content = html.slice(tagEnd + 1, nextClose); break }
            pos = nextClose + 6
          } else break
        }
        if (content.trim()) { console.log('[get-press-release] content matched class:', cls); break }
      }
    }
  }

  // Fallback 1: <article> element
  if (!content.trim()) {
    const articleMatch = html.match(/<article[^>]*>([\s\S]+?)<\/article>/i)
    if (articleMatch) {
      content = articleMatch[1]
      console.log('[get-press-release] content from <article>')
    }
  }

  // Fallback 2: <main> element
  if (!content.trim()) {
    const mainMatch = html.match(/<main[^>]*>([\s\S]+?)<\/main>/i)
    if (mainMatch) {
      content = mainMatch[1]
      console.log('[get-press-release] content from <main>')
    }
  }

  // Fallback 3: anything between h1 and footer/comments
  if (!content.trim()) {
    const h1End = html.search(/<\/h1>/i)
    const footerStart = html.search(/<(?:footer|div[^>]*class="[^"]*(?:footer|comments)[^"]*")[^>]*>/i)
    if (h1End !== -1 && footerStart !== -1 && footerStart > h1End) {
      content = html.slice(h1End + 5, footerStart)
      console.log('[get-press-release] content from h1→footer slice')
    }
  }

  // Nuclear fallback: strip everything known non-content from <body>
  if (!content.trim()) {
    const bodyStart = html.search(/<body[^>]*>/i)
    const bodyEnd   = html.lastIndexOf('</body>')
    if (bodyStart !== -1 && bodyEnd !== -1) {
      content = html.slice(html.indexOf('>', bodyStart) + 1, bodyEnd)
      console.log('[get-press-release] content from full <body>')
    }
  }

  // Strip non-content elements
  content = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()

  return { title, content, imageUrl, date }
}
