/**
 * EGW page view — renders paragraphs with heading detection and selection.
 *
 * Headings (h1-h6) render as styled section titles, not selectable paragraphs.
 * Body paragraphs are selectable with refcode suffix and highlight on selection.
 */
import { isChapterHeading, headingLevel } from '@bible/core/egw';
import type { EGWParagraph } from '@/data/egw/api';

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
// Component
// ---------------------------------------------------------------------------

export interface PageViewProps {
  paragraphs: readonly EGWParagraph[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function PageView({ paragraphs, selectedIndex, onSelect }: PageViewProps) {
  let bodyIndex = 0;
  const items = paragraphs.map((para) => {
    const heading = isChapterHeading(para.elementType);
    const idx = heading ? -1 : bodyIndex++;
    return { para, heading, bodyIndex: idx };
  });

  return (
    <div className="reading-text space-y-4">
      {items.map((item, i) =>
        item.heading ? (
          <HeadingElement
            key={i}
            content={item.para.content}
            level={headingLevel(item.para.elementType)}
          />
        ) : (
          <ParagraphElement
            key={item.para.puborder}
            para={item.para}
            isSelected={item.bodyIndex === selectedIndex}
            onClick={() => onSelect(item.bodyIndex)}
          />
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heading element
// ---------------------------------------------------------------------------

function HeadingElement({ content, level }: { content: string | null; level: number }) {
  const text = content ? cleanHtml(content) : '';
  if (!text) return null;

  const base = 'font-sans font-semibold text-foreground';
  const classes =
    level === 1
      ? `${base} text-2xl mt-8 mb-4`
      : level === 2
        ? `${base} text-xl mt-6 mb-3`
        : `${base} text-lg mt-4 mb-2`;

  return <div className={classes}>{text}</div>;
}

// ---------------------------------------------------------------------------
// Paragraph element
// ---------------------------------------------------------------------------

function ParagraphElement({
  para,
  isSelected,
  onClick,
}: {
  para: EGWParagraph;
  isSelected: boolean;
  onClick: () => void;
}) {
  const text = para.content ? cleanHtml(para.content) : '';

  return (
    <p
      data-para={para.puborder}
      data-selected={isSelected ? 'true' : undefined}
      className={`cursor-pointer rounded-sm px-2 py-1 transition-colors duration-100 ${
        isSelected ? 'bg-accent' : 'hover:bg-accent/50'
      }`}
      onClick={onClick}
    >
      {text}
      {para.refcodeShort && (
        <span className="ml-2 text-xs text-muted-foreground select-none">{para.refcodeShort}</span>
      )}
    </p>
  );
}
