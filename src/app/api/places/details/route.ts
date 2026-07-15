import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId')
  if (!placeId) {
    return NextResponse.json({ error: 'placeId required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Maps not configured' }, { status: 503 })
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'addressComponents,location',
    },
  })

  if (!res.ok) {
    console.error('[places/details] Google API error:', await res.text())
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 })
  }

  const data = await res.json()

  const get = (type: string) =>
    data.addressComponents?.find((c: any) => c.types?.includes(type))

  const streetNumber = get('street_number')?.longText ?? ''
  const route        = get('route')?.longText ?? ''
  const city         = get('locality')?.longText
                    ?? get('sublocality_level_1')?.longText
                    ?? get('administrative_area_level_2')?.longText
                    ?? ''
  const state        = get('administrative_area_level_1')?.shortText ?? ''
  const zip          = get('postal_code')?.longText ?? ''

  return NextResponse.json({
    addressLine1: [streetNumber, route].filter(Boolean).join(' '),
    city,
    state,
    zip,
    lat: data.location?.latitude ?? null,
    lng: data.location?.longitude ?? null,
  })
}
