export interface OpenMeteoLocation {
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  name: string;
}

interface OpenMeteoGeocodingResponse {
  results?: OpenMeteoLocation[];
}

export interface OpenMeteoCurrentWeather {
  apparent_temperature?: number;
  precipitation?: number;
  relative_humidity_2m?: number;
  temperature_2m?: number;
  weather_code?: number;
  wind_speed_10m?: number;
}

export interface OpenMeteoCurrentUnits {
  apparent_temperature?: string;
  precipitation?: string;
  relative_humidity_2m?: string;
  temperature_2m?: string;
  wind_speed_10m?: string;
}

export interface OpenMeteoForecastResponse {
  current?: OpenMeteoCurrentWeather;
  current_units?: OpenMeteoCurrentUnits;
}

export function getWeatherLabel(code?: number) {
  const labels: Record<number, string> = {
    0: 'clear skies',
    1: 'mostly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'foggy',
    48: 'rime fog',
    51: 'light drizzle',
    53: 'drizzle',
    55: 'dense drizzle',
    61: 'light rain',
    63: 'rain',
    65: 'heavy rain',
    71: 'light snow',
    73: 'snow',
    75: 'heavy snow',
    77: 'snow grains',
    80: 'rain showers',
    81: 'heavy rain showers',
    82: 'violent rain showers',
    95: 'thunderstorms',
    96: 'thunderstorms with hail',
    99: 'severe thunderstorms with hail',
  };

  return labels[code ?? -1] ?? 'unavailable conditions';
}

export function buildLocationLabel(location: OpenMeteoLocation) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(', ');
}

export async function geocodeWeatherQuery(query: string, signal?: AbortSignal) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', query);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  url.searchParams.set('format', 'json');

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Geocoding request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as OpenMeteoGeocodingResponse;
  return payload.results?.[0] ?? null;
}

export async function fetchCurrentWeather(latitude: number, longitude: number, signal?: AbortSignal) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
  );
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Forecast request failed with ${response.status}.`);
  }

  return (await response.json()) as OpenMeteoForecastResponse;
}
