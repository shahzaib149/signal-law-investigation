import { NextResponse } from 'next/server'
import { launchInvestigation, fetchRecordById } from '@/lib/airtable'

export async function POST(req: Request) {
  let recordId: string | undefined

  try {
    const body = await req.json()
    recordId = body?.recordId
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!recordId || typeof recordId !== 'string') {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 })
  }

  // 1. Update Airtable: set status → Intake + stamp Submitted At
  try {
    await launchInvestigation(recordId)
  } catch (error) {
    console.error('[POST /api/launch] Airtable update failed:', error)
    return NextResponse.json(
      { error: 'Failed to update Airtable record' },
      { status: 500 }
    )
  }

  // 2. Fire Make.com webhook (non-blocking — don't fail the launch if webhook errors)
  const webhookUrl = process.env.MAKE_WEBHOOK_URL
  if (webhookUrl) {
    try {
      // Fetch the updated record to send full context to Make.com
      const record = await fetchRecordById(recordId)
      const webhookRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId,
          company_name:           record?.company_name           ?? '',
          ticker_symbol:          record?.ticker_symbol          ?? '',
          investigation_category: record?.investigation_category ?? '',
          brief_topic:            record?.brief_topic            ?? '',
          why_it_matters:         record?.why_it_matters         ?? '',
          suggested_date:         record?.suggested_date         ?? '',
          submitted_at:           record?.submitted_at           ?? new Date().toISOString(),
          investigation_status:   'Intake',
        }),
      })
      if (!webhookRes.ok) {
        console.warn('[POST /api/launch] Webhook returned non-OK:', webhookRes.status)
      } else {
        console.log('[POST /api/launch] Webhook fired successfully')
      }
    } catch (webhookError) {
      // Log but don't fail — Airtable update already succeeded
      console.error('[POST /api/launch] Webhook error (non-fatal):', webhookError)
    }
  }

  return NextResponse.json({ success: true, recordId })
}
