const TAG_BREAKS = /<\/(article|blockquote|div|h1|h2|h3|h4|h5|h6|li|main|ol|p|section|table|tbody|td|th|thead|tr|ul)>|<br\s*\/?>/gi;
const DROP_TAGS = /<(script|style|svg|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi;
const STRIP_TAGS = /<[^>]+>/g;
const SPACE_RUNS = /[^\S\r\n]+/g;
const BLANK_LINES = /\n{3,}/g;

function decodeNamedEntity(entity: string) {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return named[entity] ?? `&${entity};`;
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    }

    return decodeNamedEntity(entity.toLowerCase());
  });
}

function parseAttributes(tag: string) {
  return Object.fromEntries(
    Array.from(tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)).map((match) => [
      match[1].toLowerCase(),
      decodeHtmlEntities(match[3] ?? match[4] ?? match[5] ?? ''),
    ]),
  );
}

function getMetaContent(html: string, names: string[]) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.name ?? attrs.property ?? '').toLowerCase();
    if (names.includes(key) && attrs.content) {
      return attrs.content.trim();
    }
  }

  return '';
}

function getCanonicalUrl(html: string) {
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0]);
    if ((attrs.rel ?? '').toLowerCase() === 'canonical' && attrs.href) {
      return attrs.href.trim();
    }
  }

  return '';
}

function getTitle(html: string) {
  const directTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const ogTitle = getMetaContent(html, ['og:title', 'twitter:title']);
  return decodeHtmlEntities((directTitle || ogTitle).replace(SPACE_RUNS, ' ').trim());
}

function getBodyText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(DROP_TAGS, ' ')
      .replace(TAG_BREAKS, '\n')
      .replace(STRIP_TAGS, ' ')
      .replace(/\r/g, '')
      .replace(SPACE_RUNS, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(BLANK_LINES, '\n\n')
      .trim(),
  );
}

export function extractHtmlDocument(html: string, maxChars: number) {
  const title = getTitle(html);
  const description = getMetaContent(html, ['description', 'og:description', 'twitter:description']);
  const canonicalUrl = getCanonicalUrl(html);
  const body = getBodyText(html);

  return {
    title,
    description,
    canonicalUrl,
    content: body.slice(0, maxChars),
    truncated: body.length > maxChars,
  };
}
