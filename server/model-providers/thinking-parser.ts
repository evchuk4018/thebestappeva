const OPEN_TAGS = ['<think>', '<thought>'];
const CLOSE_TAGS = ['</think>', '</thought>'];
const MAX_TAG_LENGTH = Math.max(...[...OPEN_TAGS, ...CLOSE_TAGS].map((tag) => tag.length));

function findEarliestIndex(value: string, tags: string[]) {
  const indexes = tags
    .map((tag) => ({ tag, index: value.indexOf(tag) }))
    .filter((entry) => entry.index >= 0)
    .sort((left, right) => left.index - right.index);
  return indexes[0] ?? null;
}

function splitStablePrefix(value: string) {
  if (!value) {
    return { stable: '', remainder: '' };
  }

  const minIndex = [...OPEN_TAGS, ...CLOSE_TAGS]
    .flatMap((tag) => {
      const candidates = Array.from({ length: Math.min(MAX_TAG_LENGTH - 1, value.length) }, (_, offset) => value.length - offset - 1)
        .filter((start) => start >= 0 && tag.startsWith(value.slice(start)));
      return candidates.length ? [Math.min(...candidates)] : [];
    })
    .sort((left, right) => left - right)[0];

  if (typeof minIndex === 'number') {
    return { stable: value.slice(0, minIndex), remainder: value.slice(minIndex) };
  }

  return { stable: value, remainder: '' };
}

export function createThinkingDeltaParser() {
  let buffer = '';
  let mode: 'content' | 'thinking' = 'content';

  function consume(flush = false) {
    const thinking: string[] = [];
    const content: string[] = [];

    while (buffer) {
      const marker = mode === 'content' ? findEarliestIndex(buffer, OPEN_TAGS) : findEarliestIndex(buffer, CLOSE_TAGS);
      if (!marker) {
        if (flush) {
          (mode === 'content' ? content : thinking).push(buffer);
          buffer = '';
          break;
        }

        const { stable, remainder } = splitStablePrefix(buffer);
        if (!stable) {
          break;
        }
        (mode === 'content' ? content : thinking).push(stable);
        buffer = remainder;
        break;
      }

      if (marker.index > 0) {
        (mode === 'content' ? content : thinking).push(buffer.slice(0, marker.index));
      }
      buffer = buffer.slice(marker.index + marker.tag.length);
      mode = mode === 'content' ? 'thinking' : 'content';
    }

    return {
      content: content.join(''),
      thinking: thinking.join(''),
    };
  }

  return {
    push(value: string) {
      buffer += value;
      return consume(false);
    },
    finish() {
      return consume(true);
    },
  };
}

export function normalizeThinkingOutput(content: string, thinking = '') {
  const parser = createThinkingDeltaParser();
  const extracted = parser.push(content ?? '');
  const remainder = parser.finish();
  const finalContent = `${extracted.content}${remainder.content}`.trim();
  const mergedThinking = [thinking, extracted.thinking, remainder.thinking].map((value) => value.trim()).filter(Boolean).join('\n\n');
  return {
    content: finalContent,
    thinking: mergedThinking.trim(),
  };
}
