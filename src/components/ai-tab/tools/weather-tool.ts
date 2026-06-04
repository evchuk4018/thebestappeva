import { isAbortError } from '../abort-utils';
import { formatCoordinate, getCurrentPosition } from './browser-context';
import { buildLocationLabel, fetchCurrentWeather, geocodeWeatherQuery, getWeatherLabel } from './weather-service';
import { ToolExecutionContext, ToolRegistryEntry, ToolResult } from './types';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildError(functionName: string, summary: string): ToolResult {
  return {
    toolId: 'weather',
    functionName,
    ok: false,
    summary,
    error: summary,
  };
}

function buildWeatherSummary(temperature: number, temperatureUnit: string | undefined, weatherCode: number, locationLabel: string) {
  return `${Math.round(temperature)}${temperatureUnit ?? 'F'}, ${getWeatherLabel(weatherCode)} in ${locationLabel}.`;
}

function buildCoordinateLocationLabel(latitude: number, longitude: number) {
  return `${formatCoordinate(latitude)}, ${formatCoordinate(longitude)}`;
}

function buildWeatherResult(
  invocationToolId: string,
  invocationFunctionName: string,
  weather: Awaited<ReturnType<typeof fetchCurrentWeather>>,
  locationLabel: string,
  extraData: Record<string, unknown> = {},
) {
  const current = weather.current;
  if (current?.temperature_2m == null || current.weather_code === undefined) {
    return buildError(invocationFunctionName, `Current weather was unavailable for "${locationLabel}".`);
  }

  return {
    toolId: invocationToolId,
    functionName: invocationFunctionName,
    ok: true,
    summary: buildWeatherSummary(current.temperature_2m, weather.current_units?.temperature_2m, current.weather_code, locationLabel),
    data: {
      location: locationLabel,
      temperature: current.temperature_2m,
      temperatureUnit: weather.current_units?.temperature_2m ?? 'F',
      apparentTemperature: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      humidityUnit: weather.current_units?.relative_humidity_2m ?? '%',
      precipitation: current.precipitation,
      precipitationUnit: weather.current_units?.precipitation ?? 'in',
      windSpeed: current.wind_speed_10m,
      windSpeedUnit: weather.current_units?.wind_speed_10m ?? 'mph',
      condition: getWeatherLabel(current.weather_code),
      ...extraData,
    },
  };
}

export const weatherTool: ToolRegistryEntry = {
  definition: {
    id: 'weather',
    label: 'Weather',
    alias: '/weather',
    description: 'Looks up current weather conditions for a place query or the current browser location.',
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
      {
        name: 'get_current_weather_for_current_location',
        description: 'Get the current weather using the browser geolocation coordinates.',
        parameters: [],
      },
    ],
  },
  async execute(invocation, context: ToolExecutionContext) {
    try {
      if (invocation.functionName === 'get_current_weather_for_current_location') {
        const position = await getCurrentPosition();
        const weather = await fetchCurrentWeather(position.latitude, position.longitude, context.signal);
        const locationLabel = buildCoordinateLocationLabel(position.latitude, position.longitude);

        return buildWeatherResult(invocation.toolId, invocation.functionName, weather, locationLabel, {
          accuracy: position.accuracy,
          latitude: position.latitude,
          longitude: position.longitude,
          timestamp: position.timestamp,
        });
      }

      const query = asString(invocation.args.query);
      if (!query) {
        return buildError(invocation.functionName, 'Weather lookup requires a non-empty `query` argument.');
      }

      const location = await geocodeWeatherQuery(query, context.signal);
      if (!location) {
        return buildError(invocation.functionName, `No weather location matched "${query}".`);
      }

      const weather = await fetchCurrentWeather(location.latitude, location.longitude, context.signal);
      return buildWeatherResult(invocation.toolId, invocation.functionName, weather, buildLocationLabel(location), {
        latitude: location.latitude,
        longitude: location.longitude,
      });
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Weather lookup failed.';
      return buildError(invocation.functionName, message);
    }
  },
};
