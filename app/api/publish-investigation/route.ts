import { NextResponse } from 'next/server'
import { publishPost } from '@/lib/wordpress'
import { markRecordPublished } from '@/lib/airtable'

/**
 * POST /api/publish-investigation
 * Body: { postId: number, airtableRecordId: string }
 *
 * Flow:
 *   1. Set WordPress post status → publish (returns live permalink)
 *   2. Optionally patch Airtable: status → Published, URL → live permalink (skipped when
 *      `airtableRecordId` is a WordPress-only id: `wp-{postId}`).
 *
 * If step 2 fails, step 1 is NOT rolled back — we return success=true with
 * the permalink but include a warning. This keeps the WP side authoritative.
 */
export async function POST(req: Request) {
  let postId: number | undefined
  let airtableRecordId: string | undefined

  try {
    const body = await req.json()
    postId = Number(body?.postId)
    airtableRecordId = body?.airtableRecordId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!postId || Number.isNaN(postId)) {
    return NextResponse.json({ error: 'postId (number) is required' }, { status: 400 })
  }

  if (!airtableRecordId || typeof airtableRecordId !== 'string') {
    return NextResponse.json({ error: 'airtableRecordId (string) is required' }, { status: 400 })
  }

  const skipAirtable = airtableRecordId.startsWith('wp-')

  // 1. Publish in WordPress
  let permalink: string
  try {
    const published = await publishPost(postId)
    permalink = published.link
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/publish-investigation] WP publish failed:', message)
    return NextResponse.json(
      { error: `WordPress publish failed: ${message}` },
      { status: 502 }
    )
  }

  // 2. Patch Airtable (skip for WordPress-only dashboard ids `wp-{postId}`)
  let airtableWarning: string | undefined
  if (!skipAirtable) {
    try {
      await markRecordPublished(airtableRecordId, permalink)
    } catch (err) {
      airtableWarning = err instanceof Error ? err.message : 'Unknown error'
      console.error('[POST /api/publish-investigation] Airtable update failed:', airtableWarning)
    }
  }

  return NextResponse.json({
    success: true,
    permalink,
    ...(airtableWarning ? { airtableWarning } : {}),
  })
}
