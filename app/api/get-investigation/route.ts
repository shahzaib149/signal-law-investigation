import { NextResponse } from 'next/server'
import { getPost, getPostBySlug, getMedia } from '@/lib/wordpress'

/**
 * POST /api/get-investigation
 * Body: { postId: number } OR { slug: string }
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const postId = body?.postId ? Number(body.postId) : NaN
  const slug   = body?.slug   ? String(body.slug).trim() : ''

  if (!Number.isNaN(postId) && postId > 0) {
    try {
      const post = await getPost(postId)
      if (!post) return NextResponse.json({ error: 'Investigation content not available' }, { status: 404 })
      if (!post.featured_media_url && post.featured_media) {
        post.featured_media_url = await getMedia(post.featured_media)
      }
      return NextResponse.json(post)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[POST /api/get-investigation] by ID', message)
      return NextResponse.json({ error: `Failed to load investigation: ${message}` }, { status: 500 })
    }
  }

  if (slug) {
    try {
      const post = await getPostBySlug(slug)
      if (!post) return NextResponse.json({ error: 'Investigation content not available' }, { status: 404 })
      if (!post.featured_media_url && post.featured_media) {
        post.featured_media_url = await getMedia(post.featured_media)
      }
      return NextResponse.json(post)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[POST /api/get-investigation] by slug', message)
      return NextResponse.json({ error: `Failed to load investigation: ${message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'postId (number) or slug (string) is required' }, { status: 400 })
}
