/**
 * POST /api/upload-press-release-pdf
 * Multipart form data: { file: PDF File, recordId: string }
 * 1. Uploads the PDF to the WordPress media library
 * 2. Updates the Airtable record's WordPress Press Release URL
 * Returns: { pdfUrl: string }
 */
import { NextResponse } from 'next/server'
import { updatePressReleaseUrl } from '@/lib/airtable'

export async function POST(req: Request) {
  const WP_URL  = process.env.WORDPRESS_SITE_URL
  const WP_USER = process.env.WORDPRESS_USERNAME
  const WP_PASS = process.env.WORDPRESS_APP_PASSWORD?.replace(/\s/g, '')

  if (!WP_URL || !WP_USER || !WP_PASS) {
    return NextResponse.json({ error: 'WordPress credentials not configured' }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file     = formData.get('file')
  const recordId = formData.get('recordId')?.toString().trim() ?? ''

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '"file" field is required' }, { status: 400 })
  }
  if (!recordId) {
    return NextResponse.json({ error: '"recordId" field is required' }, { status: 400 })
  }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 })
  }

  const auth = Buffer.from(`${WP_USER}:${WP_PASS}`).toString('base64')

  // Sanitise filename — keep only safe chars
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-')

  // Build multipart upload to WordPress media library
  const wpForm = new FormData()
  wpForm.append('file', file, safeName)
  wpForm.append('title', safeName.replace(/\.pdf$/i, '').replace(/-/g, ' '))

  const uploadRes = await fetch(`${WP_URL}/wp-json/wp/v2/media`, {
    method:  'POST',
    headers: {
      Authorization:    `Basic ${auth}`,
      'Accept-Encoding': 'gzip, deflate',
      // DO NOT set Content-Type here — fetch sets it automatically with the multipart boundary
    },
    body: wpForm,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: (err as { message?: string })?.message ?? `WordPress upload failed (${uploadRes.status})` },
      { status: uploadRes.status }
    )
  }

  const media = await uploadRes.json() as { source_url?: string; guid?: { rendered?: string } }
  const pdfUrl = media.source_url ?? media.guid?.rendered ?? ''

  if (!pdfUrl) {
    return NextResponse.json({ error: 'WordPress returned no URL for the uploaded file' }, { status: 502 })
  }

  // Update Airtable record with the new PDF URL
  try {
    await updatePressReleaseUrl(recordId, pdfUrl)
  } catch (err) {
    // Non-fatal: return the URL even if Airtable update fails; user can manually update
    console.error('[upload-press-release-pdf] Airtable update failed:', err)
    return NextResponse.json({ pdfUrl, airtableError: err instanceof Error ? err.message : String(err) })
  }

  return NextResponse.json({ pdfUrl })
}
