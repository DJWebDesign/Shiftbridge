import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input')
  if (!input || input.trim().length < 2) {
    return NextResponse.json({ suggestions: [] })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ suggestions: [] })
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
    },
    body: JSON.stringify({
      input: input.trim(),
      includedRegionCodes: ['us'],
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
    }),
  })

  if (!res.ok) {
    console.error('[places/autocomplete] Google API error:', await res.text())
    return NextResponse.json({ suggestions: [] })
  }

  const data = await res.json()

  const suggestions = (data.suggestions ?? []).map((s: any) => ({
    placeId:       s.placePrediction?.placeId ?? '',
    mainText:      s.placePrediction?.structuredFormat?.mainText?.text ?? '',
    secondaryText: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
    fullText:      s.placePrediction?.text?.text ?? '',
  })).filter((s: any) => s.placeId)

  return NextResponse.json({ suggestions })
}
