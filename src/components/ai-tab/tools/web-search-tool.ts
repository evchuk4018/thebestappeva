import { ToolExecutionContext, ToolRegistryEntry, ToolResult } from './types';
import { fetchUrl, searchWeb } from './web-search-service';

function asOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asRequiredString(value: unknown, message: string) {
  const normalized = asOptionalString(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function asOptionalCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
}

function buildError(invocationToolId: string, functionName: string, summary: string): ToolResult {
  return {
    toolId: invocationToolId,
    functionName,
    ok: false,
    summary,
    error: summary,
  };
}

export const webSearchTool: ToolRegistryEntry = {
  definition: {
    id: 'web-search',
    label: 'Web Search',
    alias: '/web-search',
    description: 'Searches the web through local SearXNG and can fetch readable text from a chosen URL.',
    enabledByDefault: false,
    functions: [
      {
        name: 'search_web',
        description: 'Search the web and return normalized result titles, links, snippets, and source engines.',
        parameters: [
          { name: 'query', type: 'string', description: 'Search query to send to SearXNG.', required: true },
          { name: 'categories', type: 'string', description: 'Optional SearXNG categories, such as "general" or "news".' },
          { name: 'timeRange', type: 'string', description: 'Optional time range filter, such as "day", "month", or "year".' },
          { name: 'maxResults', type: 'number', description: 'Optional number of top results to return, from 1 to 10.' },
        ],
      },
      {
        name: 'fetch_url',
        description: 'Fetch a specific HTML page and return its title, description, canonical URL, and readable body text.',
        parameters: [{ name: 'url', type: 'string', description: 'Absolute http or https URL to fetch.', required: true }],
      },
    ],
  },
  async execute(invocation, context: ToolExecutionContext) {
    try {
      if (invocation.functionName === 'fetch_url') {
        const url = asRequiredString(invocation.args.url, 'fetch_url requires a non-empty `url` argument.');
        const payload = await fetchUrl({ signal: context.signal, url });
        const title = payload.title || payload.finalUrl;

        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `Fetched "${title}" from ${new URL(payload.finalUrl).host}.`,
          data: payload,
        };
      }

      const query = asRequiredString(invocation.args.query, 'search_web requires a non-empty `query` argument.');
      const payload = await searchWeb({
        signal: context.signal,
        query,
        categories: asOptionalString(invocation.args.categories),
        timeRange: asOptionalString(invocation.args.timeRange),
        maxResults: asOptionalCount(invocation.args.maxResults),
      });

      if (!payload.results.length) {
        return {
          toolId: invocation.toolId,
          functionName: invocation.functionName,
          ok: true,
          summary: `No web results matched "${payload.query}".`,
          data: payload,
        };
      }

      return {
        toolId: invocation.toolId,
        functionName: invocation.functionName,
        ok: true,
        summary: `Found ${payload.resultCount} web result${payload.resultCount === 1 ? '' : 's'} for "${payload.query}".`,
        data: payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Web search failed.';
      return buildError(invocation.toolId, invocation.functionName, message);
    }
  },
};
