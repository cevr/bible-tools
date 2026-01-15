import type { Component, ParentProps } from 'solid-js';
import { useParams, useNavigate } from '@solidjs/router';
import { createSignal, createEffect, Show } from 'solid-js';
import { useKeyboardAction } from '@/providers/keyboard-provider';
import { useOverlay } from '@/providers/overlay-provider';

const BOOK_NAMES: Record<string, string> = {
  PP: 'Patriarchs and Prophets',
  GC: 'The Great Controversy',
  DA: 'The Desire of Ages',
  SC: 'Steps to Christ',
  COL: 'Christ Object Lessons',
  MH: 'Ministry of Healing',
};

function getBookName(code: string): string {
  return BOOK_NAMES[code] ?? code;
}

/**
 * EGW reader route.
 * Handles navigation state and keyboard shortcuts for EGW reading.
 */
const EgwRoute: Component<ParentProps> = (props) => {
  const params = useParams<{ bookCode?: string; page?: string; para?: string }>();
  const navigate = useNavigate();
  const { openOverlay } = useOverlay();

  const [selectedPara, setSelectedPara] = createSignal(
    params.para ? parseInt(params.para, 10) : 1
  );

  // Update selected paragraph when URL changes
  createEffect(() => {
    if (params.para) {
      setSelectedPara(parseInt(params.para, 10));
    }
  });

  // Handle keyboard navigation
  useKeyboardAction((action) => {
    switch (action) {
      case 'nextVerse': // Using verse navigation for paragraphs
        setSelectedPara((p) => p + 1);
        break;
      case 'prevVerse':
        setSelectedPara((p) => Math.max(1, p - 1));
        break;
    }
  });

  // Show book list if no book selected
  if (!params.bookCode) {
    return (
      <div class="space-y-6">
        <header class="border-b border-[--color-border] dark:border-[--color-border-dark] pb-4">
          <h1 class="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            Ellen G. White Writings
          </h1>
          <p class="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            Select a book to begin reading
          </p>
        </header>

        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(BOOK_NAMES).map(([code, name]) => (
            <a
              href={`/egw/${code}`}
              class="group rounded-lg border border-[--color-border] dark:border-[--color-border-dark] p-4 transition-colors hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark]"
            >
              <div class="font-sans font-semibold text-[--color-ink] dark:text-[--color-ink-dark] group-hover:text-[--color-accent] dark:group-hover:text-[--color-accent-dark]">
                {code}
              </div>
              <div class="mt-1 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                {name}
              </div>
            </a>
          ))}
        </div>
      </div>
    );
  }

  // Redirect to page 1 if no page specified
  if (!params.page) {
    createEffect(() => {
      navigate(`/egw/${params.bookCode}/1`, { replace: true });
    });
    return null;
  }

  return (
    <div class="space-y-6">
      {/* Topbar with sticky chapter heading */}
      <header class="sticky top-0 z-10 bg-[--color-paper] dark:bg-[--color-paper-dark] border-b border-[--color-border] dark:border-[--color-border-dark] pb-4 pt-2">
        <div class="flex items-baseline justify-between">
          <h1 class="font-sans text-2xl font-semibold text-[--color-ink] dark:text-[--color-ink-dark]">
            {getBookName(params.bookCode)}
          </h1>
          <span class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            Page {params.page}
          </span>
        </div>
        <div
          class="mt-2 text-lg font-medium text-[--color-accent] dark:text-[--color-accent-dark]"
          data-chapter-heading
        >
          Chapter Heading Placeholder
        </div>
      </header>

      {/* Data notice */}
      <div class="rounded-lg border border-[--color-border] dark:border-[--color-border-dark] bg-[--color-highlight]/30 dark:bg-[--color-highlight-dark]/30 p-4 mb-6">
        <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
          EGW writings require syncing from the server. Use the CLI{' '}
          <code class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
            bible egw sync
          </code>{' '}
          command to download books, then connect to the API.
        </p>
      </div>

      {/* Page content placeholder */}
      <div class="reading-text space-y-4">
        {[1, 2, 3].map((paraNum) => (
          <p
            data-para={paraNum}
            class="cursor-pointer rounded-sm px-2 py-1 transition-colors duration-[--duration-fast]"
            classList={{
              'bg-[--color-highlight] dark:bg-[--color-highlight-dark]':
                selectedPara() === paraNum,
            }}
            data-selected={selectedPara() === paraNum ? 'true' : undefined}
            onClick={() => setSelectedPara(paraNum)}
          >
            <span class="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] mr-2">
              {params.bookCode} {params.page}.{paraNum}
            </span>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat.
          </p>
        ))}
      </div>

      {/* Footer */}
      <footer class="border-t border-[--color-border] dark:border-[--color-border-dark] pt-4 text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
        <div class="flex items-center justify-between">
          <span>
            {params.bookCode} {params.page}.{selectedPara()}
          </span>
          <div class="flex gap-4">
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ↑↓
              </kbd>{' '}
              navigate
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ←→
              </kbd>{' '}
              page
            </span>
            <span>
              <kbd class="rounded bg-[--color-border] dark:bg-[--color-border-dark] px-1 text-xs">
                ⌘K
              </kbd>{' '}
              books
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EgwRoute;
