import { NextResponse } from 'next/server'
import { getPostsFeaturedImages } from '@/lib/wordpress'

/**
 * POST /api/batch-featured-images
 * Body: { postIds: number[] }
 * Returns: { images: Record<string, string | null> }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  const raw = Array.isArray(body?.postIds) ? body.postIds : []
  const postIds = raw.map(Number).filter((n) => Number.isFinite(n) && n > 0)

  if (!postIds.length) return NextResponse.json({ images: {} })

  try {
    const images = await getPostsFeaturedImages(postIds)
    return NextResponse.json({ images })
  } catch (err) {
    console.error('[POST /api/batch-featured-images]', err)
    return NextResponse.json({ images: {} })
  }
}
