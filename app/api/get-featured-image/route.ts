import { NextResponse } from 'next/server'
import { getMedia } from '@/lib/wordpress'

/**
 * POST /api/get-featured-image
 * Body: { mediaId: number }
 * Returns: { url: string | null }
 */
export async function POST(req: Request) {
  let mediaId: number | undefined

  try {
    const body = await req.json()
    mediaId = Number(body?.mediaId)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!mediaId || Number.isNaN(mediaId)) {
    return NextResponse.json({ error: 'mediaId (number) is required' }, { status: 400 })
  }

  try {
    const url = await getMedia(mediaId)
    return NextResponse.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/get-featured-image]', message)
    return NextResponse.json({ error: `Failed to load media: ${message}` }, { status: 500 })
  }
}
