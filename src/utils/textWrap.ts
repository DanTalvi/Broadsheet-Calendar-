let sharedMeasureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (sharedMeasureCtx) return sharedMeasureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  sharedMeasureCtx = canvas.getContext('2d');
  return sharedMeasureCtx;
}

export function measureTextWidthPx(text: string, fontSpec: string): number {
  const ctx = getMeasureContext();
  if (!ctx) return text.length * 6;
  ctx.font = fontSpec;
  return ctx.measureText(text).width;
}

/**
 * Wraps text by words to fit within maxWidth up to maxLines.
 * Never truncates mid-word unless a single word itself exceeds maxWidth.
 */
export function wrapTextToLines(
  text: string,
  maxWidth: number,
  maxLines: number,
  measureFn: (candidate: string) => number
): string[] {
  const clean = text.trim();
  if (!clean || maxWidth <= 2 || maxLines <= 0) return [];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  const truncateTail = (str: string): string => {
    if (measureFn(str) <= maxWidth) return str;
    let lo = 0;
    let hi = str.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (measureFn(str.slice(0, mid) + '…') <= maxWidth) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo > 0 ? str.slice(0, lo) + '…' : str.slice(0, 1);
  };

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (measureFn(candidate) <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      if (lines.length + 1 >= maxLines) {
        // Out of vertical lines; append remaining words and truncate cleanly
        const remainder = [currentLine, ...words.slice(i)].join(' ');
        lines.push(truncateTail(remainder));
        return lines;
      }
      lines.push(currentLine);
      currentLine = '';
    }

    // Check if single word itself fits on a fresh line
    if (measureFn(word) <= maxWidth) {
      currentLine = word;
    } else {
      // Single long word exceeds width — break or truncate cleanly
      if (lines.length + 1 >= maxLines) {
        lines.push(truncateTail(word));
        return lines;
      }
      // Split long word cleanly across remaining space
      let remainingWord = word;
      while (remainingWord.length > 0) {
        if (measureFn(remainingWord) <= maxWidth) {
          currentLine = remainingWord;
          break;
        }
        let lo = 1;
        let hi = remainingWord.length;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (measureFn(remainingWord.slice(0, mid)) <= maxWidth) {
            lo = mid;
          } else {
            hi = mid - 1;
          }
        }
        const chunk = remainingWord.slice(0, Math.max(1, lo));
        remainingWord = remainingWord.slice(chunk.length);
        if (lines.length + 1 >= maxLines && remainingWord.length > 0) {
          lines.push(truncateTail(chunk + remainingWord));
          return lines;
        }
        lines.push(chunk);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}
