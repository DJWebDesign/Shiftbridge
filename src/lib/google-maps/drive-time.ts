/**
 * Google Distance Matrix API wrapper.
 * Calculates driving time from one origin to multiple destinations.
 * Called server-side only — never in client components or hooks.
 *
 * Add to .env.local:
 *   GOOGLE_MAPS_API_KEY=AIza...
 */

interface LatLng {
  lat: number
  lng: number
}

interface DriveTimeResult {
  /** Index matches the input destinations array */
  minutes: number | null
}

/**
 * Fetch driving minutes from one origin to up to 25 destinations.
 * Returns null for any destination where routing is unavailable.
 * Skips the API call entirely if GOOGLE_MAPS_API_KEY is not configured.
 */
export async function getDriveTimes(
  origin: LatLng,
  destinations: LatLng[]
): Promise<DriveTimeResult[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.warn('[google-maps] Drive time skipped — GOOGLE_MAPS_API_KEY not configured')
    return destinations.map(() => ({ minutes: null }))
  }

  if (destinations.length === 0) {
    return []
  }

  // Distance Matrix allows max 25 destinations per call
  const destParam = destinations
    .map(d => `${d.lat},${d.lng}`)
    .join('|')

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json` +
    `?origins=${origin.lat},${origin.lng}` +
    `&destinations=${encodeURIComponent(destParam)}` +
    `&mode=driving` +
    `&key=${apiKey}`

  try {
    const res = await fetch(url, { next: { revalidate: 0 } })
    if (!res.ok) {
      console.error('[google-maps] Distance Matrix HTTP error:', res.status)
      return destinations.map(() => ({ minutes: null }))
    }

    const data = await res.json()

    if (data.status !== 'OK') {
      console.error('[google-maps] Distance Matrix API error:', data.status, data.error_message)
      return destinations.map(() => ({ minutes: null }))
    }

    const elements = data.rows?.[0]?.elements ?? []
    return elements.map((el: { status: string; duration?: { value: number } }) => ({
      minutes: el.status === 'OK' && el.duration
        ? Math.round(el.duration.value / 60)
        : null,
    }))
  } catch (err) {
    console.error('[google-maps] Drive time fetch error:', err)
    return destinations.map(() => ({ minutes: null }))
  }
}
