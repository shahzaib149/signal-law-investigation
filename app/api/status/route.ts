import { NextResponse } from 'next/server'
import { fetchStatusItems } from '@/lib/airtable'

export async function GET() {
  try {
    const items = await fetchStatusItems()
    return NextResponse.json(items)
  } catch (error) {
    console.error('[GET /api/status]', error)
    return NextResponse.json(
      { error: 'Failed to fetch status from Airtable' },
      { status: 500 }
    )
  }
}
