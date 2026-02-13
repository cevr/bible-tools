/**
 * Verse Study Panel — right-side panel for verse study tools.
 *
 * Plain positioned panel (no dialog/portal/focus-trap) so keyboard navigation
 * continues to work while the panel is open.
 *
 * Tabs: Notes, Cross-Refs, Words (Strong's + concordance), EGW commentary.
 * Opens on verse click, updates reactively as user navigates.
 *
 * All data reads suspend via CachedApp — no manual useEffect/useState for fetching.
 */
import { useState, useEffect, useRef, useMemo, useTransition, Suspense } from 'react';
import { useNavigate } from 'react-router';
import { XIcon, Trash2Icon } from 'lucide-react';
import { useBible } from '@/providers/bible-provider';
import { useApp } from '@/providers/db-provider';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { VerseRenderer } from '@/components/bible/verse-renderer';
import { WordModeView } from '@/components/bible/word-mode-view';
import type {
  ClassifiedCrossReference,
  CrossRefType,
  MarkerColor,
  VerseMarker,
} from '@/data/study/service';
import { toBookSlug } from '@/data/bible';

export type StudyTab = 'notes' | 'cross-refs' | 'words' | 'egw';

export interface VerseStudyPanelProps {
  book: number;
  chapter: number;
  verse: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab?: StudyTab;
  onTabChange?: (tab: StudyTab) => void;
  onOpenSecondPane?: (ref: ClassifiedCrossReference) => void;
  verseMarkers?: VerseMarker[];
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

type GroupedRefs = {
  type: CrossRefType | null;
  count: number;
  byBook: [number, ClassifiedCrossReference[]][];
}[];

const refKey = (ref: ClassifiedCrossReference, idx: number) =>
  `${ref.source}-${ref.book}-${ref.chapter}-${ref.verse}-${idx}`;

/** Width of the study panel for layout coordination. */
export const STUDY_PANEL_WIDTH = 'sm:w-[28rem]';

const MARKER_COLORS: { color: MarkerColor; bg: string; ring: string }[] = [
  { color: 'red', bg: 'bg-red-500', ring: 'ring-red-500' },
  { color: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-500' },
  { color: 'yellow', bg: 'bg-yellow-400', ring: 'ring-yellow-400' },
  { color: 'green', bg: 'bg-green-500', ring: 'ring-green-500' },
  { color: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-500' },
  { color: 'purple', bg: 'bg-purple-500', ring: 'ring-purple-500' },
];

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const MARKER_DOT_COLORS: Record<MarkerColor, string> = {
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
};

function MarkerPicker({
  activeColors,
  onToggle,
}: {
  activeColors: Set<MarkerColor>;
  onToggle: (color: MarkerColor) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {MARKER_COLORS.map(({ color, bg, ring }) => (
        <button
          key={color}
          className={`size-4 rounded-full transition-all ${bg} ${
            activeColors.has(color)
              ? `ring-2 ${ring} ring-offset-1 ring-offset-background scale-110`
              : 'opacity-40 hover:opacity-70'
          }`}
          onClick={() => onToggle(color)}
          aria-label={`Toggle ${color} marker`}
        />
      ))}
    </div>
  );
}

function CollectionChips({
  book,
  chapter,
  verse,
}: {
  book: number;
  chapter: number;
  verse: number;
}) {
  const app = useApp();
  const verseCollections = app.verseCollections(book, chapter, verse);
  const allCollections = app.collections();
  const [showPicker, setShowPicker] = useState(false);
  const [newName, setNewName] = useState('');
  const [, startTransition] = useTransition();

  const verseCollectionIds = new Set(verseCollections.map((c) => c.id));
  const availableCollections = allCollections.filter((c) => !verseCollectionIds.has(c.id));

  const handleAdd = (collectionId: string) => {
    startTransition(async () => {
      await app.addVerseToCollection(collectionId, book, chapter, verse);
      app.verseCollections.invalidate(book, chapter, verse);
    });
    setShowPicker(false);
  };

  const handleRemove = (collectionId: string) => {
    startTransition(async () => {
      await app.removeVerseFromCollection(collectionId, book, chapter, verse);
      app.verseCollections.invalidate(book, chapter, verse);
    });
  };

  const handleCreateAndAdd = () => {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const collection = await app.createCollection(name);
      await app.addVerseToCollection(collection.id, book, chapter, verse);
      app.collections.invalidateAll();
      app.verseCollections.invalidate(book, chapter, verse);
    });
    setNewName('');
    setShowPicker(false);
  };

  if (verseCollections.length === 0 && !showPicker) {
    return (
      <div className="px-4 pb-2">
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowPicker(true)}
        >
          + Add to collection
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pb-2 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {verseCollections.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-accent text-foreground"
          >
            {c.color && (
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            )}
            {c.name}
            <button
              className="text-muted-foreground hover:text-red-500 transition-colors"
              onClick={() => handleRemove(c.id)}
            >
              <XIcon className="size-3" />
            </button>
          </span>
        ))}
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          onClick={() => setShowPicker(!showPicker)}
        >
          +
        </button>
      </div>

      {showPicker && (
        <div className="flex flex-col gap-1 p-2 rounded-lg border border-border bg-background">
          {availableCollections.map((c) => (
            <button
              key={c.id}
              className="text-left text-xs px-2 py-1 rounded hover:bg-accent transition-colors"
              onClick={() => handleAdd(c.id)}
            >
              {c.name}
            </button>
          ))}
          <form
            className="flex gap-1 mt-1"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateAndAdd();
            }}
          >
            <input
              type="text"
              placeholder="New collection..."
              className="flex-1 px-2 py-1 text-xs rounded border border-border bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground disabled:opacity-50"
              disabled={!newName.trim()}
            >
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const TabFallback = <p className="text-sm text-muted-foreground italic p-4">Loading...</p>;

export function VerseStudyPanel({
  book,
  chapter,
  verse,
  open,
  onOpenChange,
  activeTab = 'notes',
  onTabChange,
  onOpenSecondPane,
  verseMarkers = [],
}: VerseStudyPanelProps) {
  const bible = useBible();
  const app = useApp();
  const bookInfo = bible.getBook(book);
  const title = bookInfo ? `${bookInfo.name} ${chapter}:${verse}` : `${book} ${chapter}:${verse}`;

  const activeColors = useMemo(() => new Set(verseMarkers.map((m) => m.color)), [verseMarkers]);
  const [, startMarkerTransition] = useTransition();

  const handleToggleMarker = (color: MarkerColor) => {
    startMarkerTransition(async () => {
      const existing = verseMarkers.find((m) => m.color === color);
      if (existing) {
        await app.removeVerseMarker(existing.id);
      } else {
        await app.addVerseMarker(book, chapter, verse, color);
      }
      app.chapterMarkers.invalidate(book, chapter);
    });
  };

  return (
    <aside
      className={`fixed top-0 right-0 h-dvh ${STUDY_PANEL_WIDTH} w-[85vw] bg-background border-l border-border shadow-lg flex flex-col z-40 transition-transform duration-200 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col border-b border-border shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <MarkerPicker activeColors={activeColors} onToggle={handleToggleMarker} />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
            <XIcon />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <Suspense fallback={null}>
          <CollectionChips book={book} chapter={chapter} verse={verse} />
        </Suspense>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange?.(v as StudyTab)}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList variant="line" className="px-4 pt-2 w-full shrink-0">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="cross-refs">Cross-Refs</TabsTrigger>
          <TabsTrigger value="words">Words</TabsTrigger>
          <TabsTrigger value="egw">EGW</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="flex flex-col flex-1 min-h-0">
          <Suspense fallback={TabFallback}>
            <NotesTab book={book} chapter={chapter} verse={verse} />
          </Suspense>
        </TabsContent>

        <TabsContent value="cross-refs" className="flex flex-col flex-1 min-h-0">
          <Suspense fallback={TabFallback}>
            <CrossRefsTab
              book={book}
              chapter={chapter}
              verse={verse}
              onClose={() => onOpenChange(false)}
              onOpenSecondPane={onOpenSecondPane}
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

        <TabsContent value="egw" className="flex flex-col flex-1 min-h-0">
          <Suspense fallback={TabFallback}>
            <EgwTab book={book} chapter={chapter} verse={verse} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Notes Tab
// ---------------------------------------------------------------------------

function NotesTab({ book, chapter, verse }: { book: number; chapter: number; verse: number }) {
  const app = useApp();
  const notes = app.verseNotes(book, chapter, verse);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  // Reset draft when verse changes
  useEffect(() => {
    setDraft('');
  }, [book, chapter, verse]);

  const handleAdd = () => {
    const content = draft.trim();
    if (!content) return;
    startTransition(async () => {
      await app.addVerseNote(book, chapter, verse, content);
      app.verseNotes.invalidate(book, chapter, verse);
    });
    setDraft('');
  };

  const handleRemove = (id: string) => {
    startTransition(async () => {
      await app.removeVerseNote(id);
      app.verseNotes.invalidate(book, chapter, verse);
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add note form */}
      <div className="px-4 pt-3 pb-2 border-b border-border shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
          className="flex flex-col gap-2"
        >
          <textarea
            placeholder="Add a note..."
            className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">⌘↵ to save</span>
            <button
              type="submit"
              className="px-3 py-1 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={!draft.trim() || isPending}
            >
              {isPending ? 'Saving\u2026' : 'Add'}
            </button>
          </div>
        </form>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 px-4 py-3">
          {notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="flex flex-col gap-1 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
              >
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(note.createdAt)}
                  </span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                    onClick={() => handleRemove(note.id)}
                    title="Delete note"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No notes yet. Add one above.
            </p>
          )}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground shrink-0">
        {notes.length > 0 && (
          <span>
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Verse Peek (popover content for cross-ref preview)
// ---------------------------------------------------------------------------

function PopoverVersePeek({
  book,
  chapter,
  verse,
  verseEnd,
}: {
  book: number;
  chapter: number;
  verse: number | null;
  verseEnd: number | null;
}) {
  const app = useApp();
  const verses = app.verses(book, chapter);

  if (verse == null) {
    return <p className="text-xs text-muted-foreground italic">Chapter-level reference</p>;
  }

  const end = verseEnd ?? verse;
  const matched = verses.filter((v) => v.verse >= verse && v.verse <= end);
  if (matched.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Verse not found</p>;
  }

  const MAX_PEEK = 2;
  const clamped = matched.slice(0, MAX_PEEK);
  const remaining = matched.length - clamped.length;

  return (
    <div className="reading-text text-sm flex flex-col gap-1.5">
      {clamped.map((v) => (
        <p key={v.verse}>
          <span className="verse-num">{v.verse}</span>
          <VerseRenderer text={v.text} />
        </p>
      ))}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground italic">
          +{remaining} more verse{remaining > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

function VersePeekSkeleton() {
  return (
    <div className="flex flex-col gap-2 animate-pulse">
      <div className="h-3 bg-muted rounded w-full" />
      <div className="h-3 bg-muted rounded w-4/5" />
      <div className="h-3 bg-muted rounded w-3/5" />
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
  onOpenSecondPane,
}: {
  book: number;
  chapter: number;
  verse: number;
  onClose: () => void;
  onOpenSecondPane?: (ref: ClassifiedCrossReference) => void;
}) {
  const navigate = useNavigate();
  const bible = useBible();
  const app = useApp();

  const crossRefs = app.crossRefs(book, chapter, verse);

  const [editingRefKey, setEditingRefKey] = useState<string | null>(null);
  const [addRefInput, setAddRefInput] = useState('');
  const [, startTransition] = useTransition();

  // Reset edit state when verse changes
  useEffect(() => {
    setEditingRefKey(null);
    setAddRefInput('');
  }, [book, chapter, verse]);

  // Preload first ~10 unique cross-ref chapters so popover feels instant
  useEffect(() => {
    const seen = new Set<string>();
    for (const ref of crossRefs) {
      if (seen.size >= 10) break;
      const key = `${ref.book}-${ref.chapter}`;
      if (!seen.has(key)) {
        seen.add(key);
        app.verses.preload(ref.book, ref.chapter);
      }
    }
  }, [crossRefs, app]);

  const navigateToRef = (ref: ClassifiedCrossReference) => {
    const refBook = bible.getBook(ref.book);
    if (refBook) {
      const versePart = ref.verse ? `/${ref.verse}` : '';
      navigate(`/bible/${toBookSlug(refBook.name)}/${ref.chapter}${versePart}`);
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

  const handleSetType = (ref: ClassifiedCrossReference, type: CrossRefType) => {
    setEditingRefKey(null);
    startTransition(async () => {
      await app.setRefType(
        { book, chapter, verse },
        { book: ref.book, chapter: ref.chapter, verse: ref.verse },
        type,
      );
      app.crossRefs.invalidate(book, chapter, verse);
    });
  };

  const handleAddUserRef = () => {
    if (!addRefInput.trim()) return;
    const parsed = bible.parseReference(addRefInput);
    if (!parsed) return;
    startTransition(async () => {
      await app.addUserCrossRef(
        { book, chapter, verse },
        { book: parsed.book, chapter: parsed.chapter, verse: parsed.verse },
      );
      app.crossRefs.invalidate(book, chapter, verse);
    });
    setAddRefInput('');
  };

  const handleRemoveUserRef = (id: string) => {
    startTransition(async () => {
      await app.removeUserCrossRef(id);
      app.crossRefs.invalidate(book, chapter, verse);
    });
  };

  const grouped = useMemo((): GroupedRefs => {
    const byType = new Map<CrossRefType | null, Map<number, ClassifiedCrossReference[]>>();
    for (const ref of crossRefs) {
      let typeMap = byType.get(ref.classification);
      if (!typeMap) {
        typeMap = new Map();
        byType.set(ref.classification, typeMap);
      }
      let bookList = typeMap.get(ref.book);
      if (!bookList) {
        bookList = [];
        typeMap.set(ref.book, bookList);
      }
      bookList.push(ref);
    }
    // Sort refs within each book by chapter:verse
    for (const [, typeMap] of byType) {
      for (const [, refs] of typeMap) {
        refs.sort((a, b) => a.chapter - b.chapter || (a.verse ?? 0) - (b.verse ?? 0));
      }
    }
    const result: GroupedRefs = [];
    for (const type of ALL_TYPES) {
      const bookMap = byType.get(type);
      if (bookMap) {
        let count = 0;
        for (const [, refs] of bookMap) count += refs.length;
        result.push({ type, count, byBook: [...bookMap] });
      }
    }
    const unclassified = byType.get(null);
    if (unclassified) {
      let count = 0;
      for (const [, refs] of unclassified) count += refs.length;
      result.push({ type: null, count, byBook: [...unclassified] });
    }
    return result;
  }, [crossRefs]);

  const showTypeHeaders = grouped.length > 1;

  const renderRef = (ref: ClassifiedCrossReference, idx: number) => {
    const key = refKey(ref, idx);
    return (
      <div
        key={key}
        className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent transition-colors group relative"
      >
        {/* Type badge */}
        {ref.classification ? (
          <button
            className={`shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded ${TYPE_BADGES[ref.classification].color} hover:opacity-80 transition-opacity`}
            onClick={() => setEditingRefKey(key)}
            title={ref.classification}
          >
            {TYPE_BADGES[ref.classification].abbr}
          </button>
        ) : (
          <button
            className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            onClick={() => setEditingRefKey(key)}
            title="Set type"
          >
            ???
          </button>
        )}

        {/* Reference with verse peek popover */}
        <Popover>
          <PopoverTrigger className="flex-1 text-left min-w-0 cursor-pointer flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {ref.source === 'user' ? '* ' : ''}
              {formatRef(ref)}
            </span>
            {ref.previewText && (
              <p className="text-xs text-muted-foreground line-clamp-1">{ref.previewText}</p>
            )}
            {ref.source === 'user' && ref.userNote && (
              <p className="text-xs italic text-muted-foreground">{ref.userNote}</p>
            )}
          </PopoverTrigger>
          <PopoverContent side="left" className="w-80 gap-2">
            <PopoverHeader>
              <PopoverTitle>{formatRef(ref)}</PopoverTitle>
            </PopoverHeader>
            <Suspense fallback={<VersePeekSkeleton />}>
              <PopoverVersePeek
                book={ref.book}
                chapter={ref.chapter}
                verse={ref.verse}
                verseEnd={ref.verseEnd}
              />
            </Suspense>
            <button
              className="w-full text-left text-sm font-medium text-primary hover:underline cursor-pointer"
              onClick={() => (onOpenSecondPane ? onOpenSecondPane(ref) : navigateToRef(ref))}
            >
              Go to {formatRef(ref)} &rarr;
            </button>
          </PopoverContent>
        </Popover>

        {/* Delete button for user refs */}
        {ref.source === 'user' && (
          <button
            className="shrink-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-opacity text-xs px-1"
            onClick={() => handleRemoveUserRef(ref.userRefId)}
            title="Remove"
          >
            x
          </button>
        )}

        {/* Type picker dropdown */}
        {editingRefKey === key && (
          <div className="absolute right-4 mt-6 z-10 bg-background border border-border rounded-lg shadow-lg p-1 flex flex-col gap-0.5">
            {ALL_TYPES.map((type) => {
              const badge = TYPE_BADGES[type];
              return (
                <button
                  key={type}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent flex items-center gap-2"
                  onClick={() => handleSetType(ref, type)}
                >
                  <span className={`px-1 py-0.5 rounded text-[10px] font-mono ${badge.color}`}>
                    {badge.abbr}
                  </span>
                  <span className="text-foreground capitalize">{type}</span>
                </button>
              );
            })}
            <button
              className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent text-muted-foreground"
              onClick={() => setEditingRefKey(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 px-4 py-3">
          {crossRefs.length > 0 ? (
            <div className="flex flex-col gap-3">
              {grouped.map((group) => (
                <div key={group.type ?? 'unclassified'} className="flex flex-col gap-1.5">
                  {/* Type section header */}
                  {showTypeHeaders && (
                    <div className="flex items-center gap-2">
                      {group.type ? (
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${TYPE_BADGES[group.type].color}`}
                        >
                          {TYPE_BADGES[group.type].abbr}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-200/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                          ???
                        </span>
                      )}
                      <span className="text-xs font-medium text-muted-foreground capitalize">
                        {group.type ?? 'Unclassified'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{group.count}</span>
                    </div>
                  )}

                  {/* Books within type */}
                  <div className="flex flex-col gap-2">
                    {group.byBook.map(([bookNum, refs]) => {
                      const bookInfo = bible.getBook(bookNum);
                      return (
                        <div key={bookNum} className="flex flex-col gap-0.5">
                          <h4 className="text-xs font-medium text-muted-foreground px-2">
                            {bookInfo?.name ?? `Book ${bookNum}`}
                          </h4>
                          <div className="flex flex-col gap-0.5">{refs.map(renderRef)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No cross-references found.</p>
          )}

          {/* Add user cross-ref */}
          <div className="pt-3 border-t border-border">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleAddUserRef();
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
      </ScrollArea>

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
  const [concordanceQuery, setConcordanceQuery] = useState('');

  // Reset when verse changes
  useEffect(() => {
    setSelectedWordIndex(0);
    setSelectedStrongs(null);
    setConcordanceQuery('');
  }, [book, chapter, verse]);

  // Derive Strong's number from concordance input
  const concordanceStrongs = (() => {
    const q = concordanceQuery.trim().toUpperCase();
    return /^[HG]\d+$/.test(q) ? q : null;
  })();

  // Use concordance input if active, otherwise word selection
  const activeStrongs = concordanceStrongs ?? selectedStrongs;

  return (
    <div className="flex flex-col gap-4 h-full">
      {words.length > 0 && (
        <div className="reading-text shrink-0">
          <WordModeView
            words={words}
            selectedIndex={selectedWordIndex}
            onSelectWord={setSelectedWordIndex}
            onOpenStrongs={(num) => {
              setSelectedStrongs(num);
              setConcordanceQuery('');
            }}
          />
        </div>
      )}

      {/* Concordance search */}
      <div className="shrink-0">
        <input
          type="text"
          value={concordanceQuery}
          onChange={(e) => {
            setConcordanceQuery(e.target.value);
            if (e.target.value.trim()) setSelectedStrongs(null);
          }}
          placeholder="Look up Strong's # (e.g. H157, G26)"
          className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
        />
      </div>

      {activeStrongs && (
        <Suspense
          fallback={
            <div className="border-t border-border pt-3">
              <p className="text-sm text-muted-foreground italic">Loading...</p>
            </div>
          }
        >
          <StrongsDetail
            strongsNumber={activeStrongs}
            currentBook={book}
            currentChapter={chapter}
            currentVerse={verse}
            onClose={onClose}
          />
        </Suspense>
      )}

      {!activeStrongs && words.length === 0 && (
        <p className="text-sm text-muted-foreground">No word data available.</p>
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
      navigate(`/bible/${toBookSlug(bookInfo.name)}/${ch}/${v}`);
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
      <div className="border-t border-border pt-3 flex flex-col gap-2 flex-1 min-h-0">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Usage
          {usage.length > 0 && (
            <span className="ml-1 normal-case tracking-normal font-normal">
              ({usage.length} verses)
            </span>
          )}
        </h4>
        {usage.length > 0 ? (
          <ScrollArea ref={usageListRef} className="flex-1 min-h-0">
            <div className="flex flex-col gap-0.5">
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
// EGW Tab
// ---------------------------------------------------------------------------

function EgwTab({ book, chapter, verse }: { book: number; chapter: number; verse: number }) {
  const app = useApp();
  const entries = app.egwCommentary(book, chapter, verse);

  // Group entries by bookCode
  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>();
    for (const entry of entries) {
      let arr = map.get(entry.bookCode);
      if (!arr) {
        arr = [];
        map.set(entry.bookCode, arr);
      }
      arr.push(entry);
    }
    return [...map];
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-sm text-muted-foreground text-center">
          No EGW commentary found for this verse.
        </p>
      </div>
    );
  }

  const volumeCount = grouped.length;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-4 px-4 py-3">
          {grouped.map(([bookCode, groupEntries]) => (
            <div key={bookCode} className="flex flex-col gap-2">
              <h3 className="text-xs font-mono font-semibold text-primary uppercase tracking-wider">
                {bookCode}
              </h3>
              {groupEntries.map((entry) => (
                <div key={`${entry.bookCode}-${entry.puborder}`} className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {entry.refcode}
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">{entry.content}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground shrink-0">
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} from {volumeCount}{' '}
        {volumeCount === 1 ? 'volume' : 'volumes'}
      </div>
    </div>
  );
}
