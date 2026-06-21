import katex from 'katex';

interface Segment {
  value: string;
  formula: boolean;
  displayMode: boolean;
}

const isEscaped = (value: string, index: number) => {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
};

export const splitFormulaText = (value: string): Segment[] => {
  const segments: Segment[] = [];
  const pushSegment = (segment: Segment) => {
    if (segment.value.length === 0) return;
    const previous = segments.at(-1);
    if (previous && !previous.formula && !segment.formula) {
      previous.value += segment.value;
      return;
    }
    segments.push(segment);
  };
  let cursor = 0;

  while (cursor < value.length) {
    const start = value.indexOf('$', cursor);
    if (start === -1) {
      pushSegment({ value: value.slice(cursor), formula: false, displayMode: false });
      break;
    }

    if (isEscaped(value, start)) {
      pushSegment({ value: value.slice(cursor, start - 1) + '$', formula: false, displayMode: false });
      cursor = start + 1;
      continue;
    }

    const displayMode = value[start + 1] === '$';
    const delimiter = displayMode ? '$$' : '$';
    const contentStart = start + delimiter.length;
    let end = value.indexOf(delimiter, contentStart);

    while (end !== -1 && isEscaped(value, end)) {
      end = value.indexOf(delimiter, end + delimiter.length);
    }

    if (end === -1) {
      pushSegment({ value: value.slice(cursor), formula: false, displayMode: false });
      break;
    }

    if (start > cursor) {
      pushSegment({ value: value.slice(cursor, start), formula: false, displayMode: false });
    }

    pushSegment({ value: value.slice(contentStart, end), formula: true, displayMode });
    cursor = end + delimiter.length;
  }

  return segments;
};

export function FormulaText({ text }: { text: string }) {
  return (
    <>
      {splitFormulaText(text).map((segment, index) => {
        if (!segment.formula) {
          return <span key={index}>{segment.value}</span>;
        }

        try {
          return (
            <span
              className={segment.displayMode ? 'formula formula-block' : 'formula'}
              key={index}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(segment.value, {
                  displayMode: segment.displayMode,
                  throwOnError: false,
                  strict: false
                })
              }}
            />
          );
        } catch {
          return <span key={index}>{segment.displayMode ? `$$${segment.value}$$` : `$${segment.value}$`}</span>;
        }
      })}
    </>
  );
}
