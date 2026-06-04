import { isAbortError } from '../abort-utils';
import { ToolExecutionContext, ToolRegistryEntry, ToolResult } from './types';

interface OpenMeteoGeocodingResponse {
  results?: Array<{
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
}

interface OpenMeteoForecastResponse {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  current_units?: {
    temperature_2m?: string;
    apparent_temperature?: string;
    relative_humidity_2m?: string;
    precipitation?: string;
    wind_speed_10m?: string;
  };
}

function getWeatherLabel(code?: number) {
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

function buildLocationLabel(location: OpenMeteoGeocodingResponse['results'][number]) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(', ');
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildError(summary: string): ToolResult {
  return {
    toolId: 'weather',
    functionName: 'get_current_weather',
    ok: false,
    summary,
    error: summary,
  };
}

async function geocode(query: string, signal?: AbortSignal) {
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

async function forecast(latitude: number, longitude: number, signal?: AbortSignal) {
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

export const weatherTool: ToolRegistryEntry = {
  definition: {
    id: 'weather',
    label: 'Weather',
    alias: '/weather',
    description: 'Looks up current weather conditions for a city or place query.',
    enabledByDefault: true,
    functions: [
      {
        name: 'get_current_weather',
        description: 'Get the current weather for a place query such as "Boston, MA" or "Paris, France".',
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'Place query to geocode before loading current weather.',
            required: true,
          },
        ],
      },
    ],
  },
  async execute(invocation, context: ToolExecutionContext) {
    const query = asString(invocation.args.query);
    if (!query) {
      return buildError('Weather lookup requires a non-empty `query` argument.');
    }

    try {
      const location = await geocode(query, context.signal);
      if (!location) {
        return buildError(`No weather location matched "${query}".`);
      }

      const weather = await forecast(location.latitude, location.longitude, context.signal);
      const current = weather.current;
      if (current?.temperature_2m == null || current.weather_code === undefined) {
        return buildError(`Current weather was unavailable for "${buildLocationLabel(location)}".`);
      }

      const locationLabel = buildLocationLabel(location);
      const summary = `${Math.round(current.temperature_2m)}${weather.current_units?.temperature_2m ?? '°F'}, ${getWeatherLabel(current.weather_code)} in ${locationLabel}.`;

      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary,
        data: {
          location: locationLabel,
          temperature: current.temperature_2m,
          temperatureUnit: weather.current_units?.temperature_2m ?? '°F',
          apparentTemperature: current.apparent_temperature,
          humidity: current.relative_humidity_2m,
          humidityUnit: weather.current_units?.relative_humidity_2m ?? '%',
          precipitation: current.precipitation,
          precipitationUnit: weather.current_units?.precipitation ?? 'in',
          windSpeed: current.wind_speed_10m,
          windSpeedUnit: weather.current_units?.wind_speed_10m ?? 'mph',
          condition: getWeatherLabel(current.weather_code),
        },
      };
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Weather lookup failed.';
      return buildError(message);
    }
  },
};
