/**
 * EGW page view — renders paragraphs with heading detection and selection.
 *
 * Headings (h1–h6) render as styled section titles, not selectable paragraphs.
 * Body paragraphs are selectable with refcode suffix and highlight on selection.
 */
import { type Component, For, Show } from 'solid-js';
import type { EGWParagraph } from '@/data/egw/api';
import { isChapterHeading } from '@bible/core/egw-db';

// ---------------------------------------------------------------------------
// HTML content cleaning
// ---------------------------------------------------------------------------

const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

const ENTITY_RE = /&(?:amp|lt|gt|quot|#39|apos|nbsp);/g;
const TAG_RE = /<br\s*\/?>/gi;
const STRIP_TAGS_RE = /<[^>]*>/g;

function cleanHtml(content: string): string {
  return content
    .replace(TAG_RE, '\n')
    .replace(STRIP_TAGS_RE, '')
    .replace(ENTITY_RE, (m) => ENTITY_MAP[m] ?? m)
    .trim();
}

// ---------------------------------------------------------------------------
// Heading level detection
// ---------------------------------------------------------------------------

function headingLevel(elementType: string | null | undefined): number {
  if (!elementType) return 0;
  const match = elementType.toLowerCase().match(/^h(\d)$/);
  return match?.[1] ? parseInt(match[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface PageViewProps {
  paragraphs: readonly EGWParagraph[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export const PageView: Component<PageViewProps> = (props) => {
  // Build a flat list: body paragraphs get sequential indices, headings get -1
  const items = () => {
    let bodyIndex = 0;
    return props.paragraphs.map((para) => {
      const heading = isChapterHeading(para.elementType);
      const idx = heading ? -1 : bodyIndex++;
      return { para, heading, bodyIndex: idx };
    });
  };

  return (
    <div class="reading-text space-y-4">
      <For each={items()}>
        {(item) => (
          <Show
            when={!item.heading}
            fallback={
              <HeadingElement
                content={item.para.content}
                level={headingLevel(item.para.elementType)}
              />
            }
          >
            <ParagraphElement
              para={item.para}
              isSelected={item.bodyIndex === props.selectedIndex}
              onClick={() => props.onSelect(item.bodyIndex)}
            />
          </Show>
        )}
      </For>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Heading element
// ---------------------------------------------------------------------------

const HeadingElement: Component<{ content: string | null; level: number }> = (props) => {
  const text = () => (props.content ? cleanHtml(props.content) : '');

  const classes = () => {
    const base = 'font-sans font-semibold text-[--color-ink] dark:text-[--color-ink-dark]';
    switch (props.level) {
      case 1:
        return `${base} text-2xl mt-8 mb-4`;
      case 2:
        return `${base} text-xl mt-6 mb-3`;
      default:
        return `${base} text-lg mt-4 mb-2`;
    }
  };

  return (
    <Show when={text()}>
      <div class={classes()}>{text()}</div>
    </Show>
  );
};

// ---------------------------------------------------------------------------
// Paragraph element
// ---------------------------------------------------------------------------

const ParagraphElement: Component<{
  para: EGWParagraph;
  isSelected: boolean;
  onClick: () => void;
}> = (props) => {
  const text = () => (props.para.content ? cleanHtml(props.para.content) : '');

  return (
    <p
      data-para={props.para.puborder}
      data-selected={props.isSelected ? 'true' : undefined}
      class="cursor-pointer rounded-sm px-2 py-1 transition-colors duration-100"
      classList={{
        'bg-[--color-highlight] dark:bg-[--color-highlight-dark]': props.isSelected,
        'hover:bg-[--color-highlight]/50 dark:hover:bg-[--color-highlight-dark]/50':
          !props.isSelected,
      }}
      onClick={props.onClick}
    >
      {text()}
      <Show when={props.para.refcodeShort}>
        <span class="ml-2 text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] select-none">
          {props.para.refcodeShort}
        </span>
      </Show>
    </p>
  );
};
