'use client';

const WMO: [number[], string][] = [
  [[0], 'trời quang'], [[1, 2], 'ít mây'], [[3], 'nhiều mây'], [[45, 48], 'có sương mù'],
  [[51, 53, 55, 56, 57], 'mưa phùn'], [[61, 63, 65, 66, 67, 80, 81, 82], 'có mưa'], [[71, 73, 75, 77, 85, 86], 'có tuyết'], [[95, 96, 99], 'có dông'],
];

/** Real weather from Open-Meteo (free, no key) at the device's location. Returns null if the person says no or it fails. */
export async function getWeatherSummary(): Promise<string | null> {
  try {
    const pos = await new Promise<GeolocationPosition>((ok, no) => {
      if (!('geolocation' in navigator)) return no(new Error('no_geo'));
      navigator.geolocation.getCurrentPosition(ok, no, { timeout: 6000, maximumAge: 30 * 60_000 });
    });
    const { latitude: la, longitude: lo } = pos.coords;
    const r = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(2)}&longitude=${lo.toFixed(2)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&daily=temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=1`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (!r.ok) return null;
    const j = await r.json();
    const cur = j.current;
    const sky = WMO.find(([codes]) => codes.includes(cur.weather_code))?.[1] ?? 'không rõ';
    const rain = j.daily?.precipitation_probability_max?.[0];
    return `${Math.round(cur.temperature_2m)}°C (cảm giác ${Math.round(cur.apparent_temperature)}°C), ${sky}, độ ẩm ${cur.relative_humidity_2m}%${typeof rain === 'number' ? `, khả năng mưa hôm nay ${rain}%` : ''}${j.daily?.temperature_2m_max?.[0] != null ? `, cao nhất ${Math.round(j.daily.temperature_2m_max[0])}°C` : ''}`;
  } catch {
    return null;
  }
}
