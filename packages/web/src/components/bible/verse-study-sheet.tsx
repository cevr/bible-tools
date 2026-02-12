/**
 * Verse Study Panel — right-side panel for verse study tools.
 *
 * Plain positioned panel (no dialog/portal/focus-trap) so keyboard navigation
 * continues to work while the panel is open.
 *
 * Tabs: Verse (text + margin notes), Cross-Refs, Words (Strong's), Concordance.
 * Opens on verse click, updates reactively as user navigates.
 *
 * All data reads suspend via CachedApp — no manual useEffect/useState for fetching.
 */
import { useState, useEffect, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { XIcon } from 'lucide-react';
import { useBible } from '@/providers/bible-provider';
import { useApp } from '@/providers/db-provider';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VerseRenderer } from '@/components/bible/verse-renderer';
import { WordModeView } from '@/components/bible/word-mode-view';
import type { ClassifiedCrossReference, CrossRefType } from '@/data/study/service';

export type StudyTab = 'verse' | 'cross-refs' | 'words' | 'concordance';

export interface VerseStudyPanelProps {
  book: number;
  chapter: number;
  verse: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab?: StudyTab;
  onTabChange?: (tab: StudyTab) => void;
}

// --- Cross-ref type badges ---

const TYPE_BADGES: Record<CrossRefType, { abbr: string; color: string }> = {
  quotation: { abbr: 'QUO', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' },
  allusion: { abbr: 'ALL', color: 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300' },
  parallel: { abbr: 'PAR', color: 'bg-green-500/20 text-green-700 dark:text-green-300' },
  typological: { abbr: 'TYP', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300' },
  prophecy: { abbr: 'PRO', color: 'bg-purple-500/20 text-purple-700 dark:text-purple-300' },
  sanctuary: { abbr: 'SAN', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300' },
  recapitulation: { abbr: 'REC', color: 'bg-pink-500/20 text-pink-700 dark:text-pink-300' },
  thematic: { abbr: 'THM', color: 'bg-gray-500/20 text-gray-700 dark:text-gray-300' },
};

const ALL_TYPES: CrossRefType[] = [
  'quotation',
  'allusion',
  'parallel',
  'typological',
  'prophecy',
  'sanctuary',
  'recapitulation',
  'thematic',
];

/** Width of the study panel for layout coordination. */
export const STUDY_PANEL_WIDTH = 'sm:w-[28rem]';

const TabFallback = <p className="text-sm text-muted-foreground italic p-4">Loading...</p>;

export function VerseStudyPanel({
  book,
  chapter,
  verse,
  open,
  onOpenChange,
  activeTab = 'verse',
  onTabChange,
}: VerseStudyPanelProps) {
  const bible = useBible();
  const bookInfo = bible.getBook(book);
  const title = bookInfo ? `${bookInfo.name} ${chapter}:${verse}` : `${book} ${chapter}:${verse}`;

  return (
    <aside
      className={`fixed top-0 right-0 h-dvh ${STUDY_PANEL_WIDTH} w-[85vw] bg-background border-l border-border shadow-lg flex flex-col z-40 transition-transform duration-200 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange?.(v as StudyTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList variant="line" className="px-4 pt-2 w-full shrink-0">
          <TabsTrigger value="verse">Verse</TabsTrigger>
          <TabsTrigger value="cross-refs">Cross-Refs</TabsTrigger>
          <TabsTrigger value="words">Words</TabsTrigger>
          <TabsTrigger value="concordance">Concordance</TabsTrigger>
        </TabsList>

        <TabsContent value="verse" className="overflow-y-auto p-4">
          <Suspense fallback={TabFallback}>
            <VerseTab book={book} chapter={chapter} verse={verse} />
          </Suspense>
        </TabsContent>

        <TabsContent value="cross-refs" className="overflow-y-auto flex-1 min-h-0">
          <Suspense fallback={TabFallback}>
            <CrossRefsTab
              book={book}
              chapter={chapter}
              verse={verse}
              onClose={() => onOpenChange(false)}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="words" className="flex flex-col flex-1 min-h-0 p-4">
          <Suspense fallback={TabFallback}>
            <WordsTab
              book={book}
              chapter={chapter}
              verse={verse}
              onClose={() => onOpenChange(false)}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="concordance" className="flex flex-col flex-1 min-h-0">
          <ConcordanceTab onClose={() => onOpenChange(false)} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Verse Tab
// ---------------------------------------------------------------------------

function VerseTab({ book, chapter, verse }: { book: number; chapter: number; verse: number }) {
  const app = useApp();
  const verses = app.verses(book, chapter);
  const marginNotes = app.marginNotes(book, chapter, verse);

  const verseText = verses.find((v) => v.verse === verse)?.text;
  if (!verseText) return <p className="text-sm text-muted-foreground">No verse found.</p>;

  return (
    <div className="space-y-4">
      <div className="reading-text">
        <VerseRenderer text={verseText} marginNotes={marginNotes} />
      </div>

      {marginNotes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Margin Notes
          </h3>
          {marginNotes.map((note) => (
            <div key={note.noteIndex} className="text-sm space-y-0.5">
              <span className="font-medium text-foreground">{note.phrase}</span>
              <p className="text-muted-foreground">{note.noteText}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cross-Refs Tab
// ---------------------------------------------------------------------------

function CrossRefsTab({
  book,
  chapter,
  verse,
  onClose,
}: {
  book: number;
  chapter: number;
  verse: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const bible = useBible();
  const app = useApp();

  const crossRefs = app.crossRefs(book, chapter, verse);

  const [editingRefIdx, setEditingRefIdx] = useState<number | null>(null);
  const [addRefInput, setAddRefInput] = useState('');

  // Reset edit state when verse changes
  useEffect(() => {
    setEditingRefIdx(null);
    setAddRefInput('');
  }, [book, chapter, verse]);

  const navigateToRef = (ref: ClassifiedCrossReference) => {
    const refBook = bible.getBook(ref.book);
    if (refBook) {
      const bookSlug = refBook.name.toLowerCase().replace(/\s+/g, '-');
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${bookSlug}/${ref.chapter}${versePart}`);
      onClose();
    }
  };

  const formatRef = (ref: ClassifiedCrossReference) => {
    const refBook = bible.getBook(ref.book);
    if (!refBook) return `${ref.book}:${ref.chapter}:${ref.verse ?? ''}`;
    const versePart = ref.verse
      ? ref.verseEnd
        ? `:${ref.verse}-${ref.verseEnd}`
        : `:${ref.verse}`
      : '';
    return `${refBook.name} ${ref.chapter}${versePart}`;
  };

  const handleSetType = async (ref: ClassifiedCrossReference, type: CrossRefType) => {
    await app.setRefType(
      { book, chapter, verse },
      { book: ref.book, chapter: ref.chapter, verse: ref.verse },
      type,
    );
    setEditingRefIdx(null);
    app.crossRefs.invalidate(book, chapter, verse);
  };

  const handleAddUserRef = async () => {
    if (!addRefInput.trim()) return;
    const parsed = bible.parseReference(addRefInput);
    if (!parsed) return;
    await app.addUserCrossRef(
      { book, chapter, verse },
      { book: parsed.book, chapter: parsed.chapter, verse: parsed.verse },
    );
    setAddRefInput('');
    app.crossRefs.invalidate(book, chapter, verse);
  };

  const handleRemoveUserRef = async (id: string) => {
    await app.removeUserCrossRef(id);
    app.crossRefs.invalidate(book, chapter, verse);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 overflow-y-auto min-h-0 flex-1">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Cross-References
        </h3>
        {crossRefs.length > 0 ? (
          <div className="space-y-1">
            {crossRefs.map((ref, idx) => (
              <div
                key={`${ref.book}-${ref.chapter}-${ref.verse}-${idx}`}
                className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent transition-colors group relative"
              >
                {/* Type badge */}
                {ref.classification ? (
                  <button
                    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded ${TYPE_BADGES[ref.classification].color} hover:opacity-80 transition-opacity`}
                    onClick={() => setEditingRefIdx(idx)}
                    title={ref.classification}
                  >
                    {TYPE_BADGES[ref.classification].abbr}
                  </button>
                ) : (
                  <button
                    className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => setEditingRefIdx(idx)}
                    title="Set type"
                  >
                    ???
                  </button>
                )}

                {/* Reference */}
                <button className="flex-1 text-left min-w-0" onClick={() => navigateToRef(ref)}>
                  <span className="text-sm font-medium text-foreground">
                    {ref.source === 'user' ? '* ' : ''}
                    {formatRef(ref)}
                  </span>
                  {ref.previewText && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {ref.previewText}
                    </p>
                  )}
                  {ref.source === 'user' && ref.userNote && (
                    <p className="text-xs italic text-muted-foreground mt-0.5">{ref.userNote}</p>
                  )}
                </button>

                {/* Delete button for user refs */}
                {ref.source === 'user' && (
                  <button
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-opacity text-xs px-1"
                    onClick={() => {
                      if (ref.source === 'user') handleRemoveUserRef(ref.userRefId);
                    }}
                    title="Remove"
                  >
                    x
                  </button>
                )}

                {/* Type picker dropdown */}
                {editingRefIdx === idx && (
                  <div className="absolute right-4 mt-6 z-10 bg-background border border-border rounded-lg shadow-lg p-1 space-y-0.5">
                    {ALL_TYPES.map((type) => {
                      const badge = TYPE_BADGES[type];
                      return (
                        <button
                          key={type}
                          className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent flex items-center gap-2"
                          onClick={() => handleSetType(ref, type)}
                        >
                          <span
                            className={`px-1 py-0.5 rounded text-[10px] font-mono ${badge.color}`}
                          >
                            {badge.abbr}
                          </span>
                          <span className="text-foreground capitalize">{type}</span>
                        </button>
                      );
                    })}
                    <button
                      className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground"
                      onClick={() => setEditingRefIdx(null)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No cross-references found.</p>
        )}

        {/* Add user cross-ref */}
        <div className="mt-3 pt-3 border-t border-border">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAddUserRef();
            }}
          >
            <input
              type="text"
              placeholder="Add cross-ref (e.g. John 3:16)"
              className="flex-1 px-2 py-1.5 text-sm rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={addRefInput}
              onChange={(e) => setAddRefInput(e.target.value)}
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={!addRefInput.trim()}
            >
              Add
            </button>
          </form>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground shrink-0">
        {crossRefs.length > 0 && <span>{crossRefs.length} cross-references</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Words Tab
// ---------------------------------------------------------------------------

function WordsTab({
  book,
  chapter,
  verse,
  onClose,
}: {
  book: number;
  chapter: number;
  verse: number;
  onClose: () => void;
}) {
  const app = useApp();
  const words = app.verseWords(book, chapter, verse);

  const [selectedWordIndex, setSelectedWordIndex] = useState(0);
  const [selectedStrongs, setSelectedStrongs] = useState<string | null>(null);

  // Reset when verse changes
  useEffect(() => {
    setSelectedWordIndex(0);
    setSelectedStrongs(null);
  }, [book, chapter, verse]);

  if (words.length === 0) {
    return <p className="text-sm text-muted-foreground">No word data available.</p>;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="reading-text shrink-0">
        <WordModeView
          words={words}
          selectedIndex={selectedWordIndex}
          onSelectWord={setSelectedWordIndex}
          onOpenStrongs={(num) => setSelectedStrongs(num)}
        />
      </div>

      {selectedStrongs && (
        <Suspense
          fallback={
            <div className="border-t border-border pt-3">
              <p className="text-sm text-muted-foreground italic">Loading...</p>
            </div>
          }
        >
          <StrongsDetail
            strongsNumber={selectedStrongs}
            currentBook={book}
            currentChapter={chapter}
            currentVerse={verse}
            onClose={onClose}
          />
        </Suspense>
      )}
    </div>
  );
}

function StrongsDetail({
  strongsNumber,
  currentBook,
  currentChapter,
  currentVerse,
  onClose,
}: {
  strongsNumber: string;
  currentBook: number;
  currentChapter: number;
  currentVerse: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const bible = useBible();
  const app = useApp();

  const entry = app.strongsEntry(strongsNumber);
  const usage = app.searchByStrongs(strongsNumber);

  const usageListRef = useRef<HTMLDivElement>(null);

  // Scroll current verse into view
  useEffect(() => {
    const viewport = usageListRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    const current = usageListRef.current?.querySelector('[data-current="true"]');
    if (!viewport || !current) return;
    const viewportRect = viewport.getBoundingClientRect();
    const currentRect = current.getBoundingClientRect();
    const offset =
      currentRect.top - viewportRect.top - viewportRect.height / 2 + currentRect.height / 2;
    viewport.scrollTop += offset;
  }, [strongsNumber]);

  if (!entry) return null;

  const navigateToVerse = (b: number, ch: number, v: number) => {
    const bookInfo = bible.getBook(b);
    if (bookInfo) {
      const slug = bookInfo.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${slug}/${ch}/${v}`);
      onClose();
    }
  };

  const formatRef = (b: number, ch: number, v: number) => {
    const bookInfo = bible.getBook(b);
    return bookInfo ? `${bookInfo.name} ${ch}:${v}` : `${b}:${ch}:${v}`;
  };

  const languageColor =
    entry.language === 'hebrew' ? 'text-[--strongs-hebrew]' : 'text-[--strongs-greek]';

  return (
    <div className="border-t border-border pt-3 flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex items-baseline gap-3">
        <span className={`font-mono text-lg font-bold ${languageColor}`}>{entry.number}</span>
        <span className="font-serif text-xl text-foreground">{entry.lemma}</span>
      </div>

      {(entry.transliteration || entry.pronunciation) && (
        <div className="text-sm text-muted-foreground">
          {entry.transliteration && (
            <span className="font-serif italic">{entry.transliteration}</span>
          )}
          {entry.pronunciation && <span className="ml-2">({entry.pronunciation})</span>}
        </div>
      )}

      <p className="text-sm text-foreground leading-relaxed">{entry.definition}</p>

      {entry.kjvDefinition && (
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold">KJV:</span> {entry.kjvDefinition}
        </div>
      )}

      {/* Usage */}
      <div className="border-t border-border pt-3 flex flex-col flex-1 min-h-0">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Usage
          {usage.length > 0 && (
            <span className="ml-1 normal-case tracking-normal font-normal">
              ({usage.length} verses)
            </span>
          )}
        </h4>
        {usage.length > 0 ? (
          <ScrollArea ref={usageListRef} className="flex-1 min-h-0">
            <div className="space-y-0.5">
              {usage.map((result, i) => {
                const isCurrent =
                  result.book === currentBook &&
                  result.chapter === currentChapter &&
                  result.verse === currentVerse;
                return (
                  <button
                    key={`${result.book}-${result.chapter}-${result.verse}-${i}`}
                    data-current={isCurrent || undefined}
                    className={`w-full text-left px-2 py-1 rounded hover:bg-accent transition-colors flex items-baseline gap-2 ${
                      isCurrent ? 'bg-accent/50' : ''
                    }`}
                    onClick={() => navigateToVerse(result.book, result.chapter, result.verse)}
                  >
                    <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">
                      {formatRef(result.book, result.chapter, result.verse)}
                    </span>
                    {result.wordText && (
                      <span className="text-xs text-foreground">{result.wordText}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-xs text-muted-foreground">No other uses found.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concordance Tab
// ---------------------------------------------------------------------------

function ConcordanceTab({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');

  const strongsNumber = (() => {
    const q = query.trim().toUpperCase();
    return /^[HG]\d+$/.test(q) ? q : null;
  })();

  return (
    <>
      <div className="px-4 pt-3 pb-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Strong's number (e.g. H157, G26)"
          className="w-full bg-transparent text-lg text-foreground placeholder:text-muted-foreground outline-none font-mono"
        />
      </div>

      {strongsNumber ? (
        <Suspense
          fallback={
            <>
              <div className="border-t border-border" />
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Searching...</p>
            </>
          }
        >
          <ConcordanceResults strongsNumber={strongsNumber} onClose={onClose} />
        </Suspense>
      ) : (
        <>
          <div className="border-t border-border" />
          <div className="overflow-y-auto min-h-0 flex-1">
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Enter a Strong's number (H for Hebrew, G for Greek)
            </p>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground shrink-0" />
        </>
      )}
    </>
  );
}

function ConcordanceResults({
  strongsNumber,
  onClose,
}: {
  strongsNumber: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const bible = useBible();
  const app = useApp();

  const entry = app.strongsEntry(strongsNumber);
  const results = app.searchByStrongs(strongsNumber);

  const navigateToVerse = (b: number, ch: number, v: number) => {
    const bookInfo = bible.getBook(b);
    if (bookInfo) {
      const slug = bookInfo.name.toLowerCase().replace(/\s+/g, '-');
      navigate(`/bible/${slug}/${ch}/${v}`);
      onClose();
    }
  };

  const formatRef = (b: number, ch: number, v: number) => {
    const bookInfo = bible.getBook(b);
    return bookInfo ? `${bookInfo.name} ${ch}:${v}` : `${b}:${ch}:${v}`;
  };

  const languageColor = entry
    ? entry.language === 'hebrew'
      ? 'text-[--strongs-hebrew]'
      : 'text-[--strongs-greek]'
    : '';

  return (
    <>
      {entry && (
        <div className="px-4 py-2 bg-accent/50 shrink-0">
          <span className={`font-mono font-bold ${languageColor}`}>{entry.number}</span>
          <span className="ml-2 font-serif text-foreground">{entry.lemma}</span>
          {entry.transliteration && (
            <span className="ml-2 text-sm italic text-muted-foreground">
              {entry.transliteration}
            </span>
          )}
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{entry.definition}</p>
        </div>
      )}

      <div className="border-t border-border" />

      <div className="overflow-y-auto min-h-0 flex-1">
        {results.length > 0 ? (
          <div className="p-2 space-y-0.5">
            {results.map((result, i) => (
              <button
                key={`${result.book}-${result.chapter}-${result.verse}-${i}`}
                className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-accent transition-colors flex items-baseline gap-3"
                onClick={() => navigateToVerse(result.book, result.chapter, result.verse)}
              >
                <span className="text-xs font-medium text-muted-foreground w-36 shrink-0">
                  {formatRef(result.book, result.chapter, result.verse)}
                </span>
                {result.wordText && (
                  <span className="text-sm text-foreground">{result.wordText}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No verses found</p>
        )}
      </div>

      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground shrink-0">
        {results.length > 0 && <span>{results.length} verses</span>}
      </div>
    </>
  );
}
