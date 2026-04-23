import { NextResponse } from 'next/server'
import { fetchRecordById } from '@/lib/airtable'

/**
 * GET /api/airtable-record/[id]
 * Returns a single Airtable record by ID. Used by the investigation detail
 * page to resolve the WordPress post ID from the stored URL.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params

  if (!id) {
    return NextResponse.json({ error: 'record id is required' }, { status: 400 })
  }

  try {
    const record = await fetchRecordById(id)
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    return NextResponse.json(record)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[GET /api/airtable-record/${id}]`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
