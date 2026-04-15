import { NextResponse } from 'next/server'
import { fetchPendingTopics } from '@/lib/airtable'

export async function GET() {
  try {
    const topics = await fetchPendingTopics()
    return NextResponse.json(topics)
  } catch (error) {
    console.error('[GET /api/topics]', error)
    return NextResponse.json(
      { error: 'Failed to fetch topics from Airtable' },
      { status: 500 }
    )
  }
}
