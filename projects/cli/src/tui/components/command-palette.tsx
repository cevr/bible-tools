import { createSignal, createMemo, createEffect, For, Show, onCleanup } from 'solid-js';
import { useKeyboard } from '@opentui/solid';
import type { InputRenderable } from '@opentui/core';
import { matchSorter } from 'match-sorter';

import { useBibleData, useBibleState } from '../context/bible.js';
import { useNavigation } from '../context/navigation.js';
import { useTheme } from '../context/theme.js';
import { useDisplay } from '../context/display.js';
import { useModel } from '../context/model.js';
import { BOOKS, formatReference, type Reference } from '../../bible/types.js';
import { searchBibleByTopic } from '../../bible/ai-search.js';

// Group types for organizing results
export type GroupType = 'navigation' | 'search' | 'tools' | 'settings' | 'recent' | 'ai';

export type CommandType = 'verse' | 'book' | 'search' | 'ai' | 'tool' | 'setting' | 'history';

export interface CommandOption {
  type: CommandType;
  group: GroupType;
  label: string;
  description?: string;
  value: string;
  reference?: Reference;
  action?: () => void;
}

interface CommandGroup {
  type: GroupType;
  label: string;
  options: CommandOption[];
}

// Group labels and order
const GROUP_CONFIG: Record<GroupType, { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 1 },
  search: { label: 'Search Results', order: 2 },
  ai: { label: 'AI Results', order: 3 },
  tools: { label: 'Tools', order: 4 },
  settings: { label: 'Settings', order: 5 },
  recent: { label: 'Recent', order: 6 },
};

// Sub-modes for the command palette
type PaletteMode = 'main' | 'theme';

interface CommandPaletteProps {
  onClose: () => void;
  onNavigateToRoute?: (route: string) => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const { theme, themeName, setTheme, availableThemes } = useTheme();
  const { toggleMode, mode } = useDisplay();
  const data = useBibleData();
  const state = useBibleState();
  const model = useModel();
  const { goTo } = useNavigation();

  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [aiResults, setAiResults] = createSignal<Reference[]>([]);
  const [aiLoading, setAiLoading] = createSignal(false);
  const [aiError, setAiError] = createSignal<string | null>(null);
  const [paletteMode, setPaletteMode] = createSignal<PaletteMode>('main');

  let inputRef: InputRenderable | undefined;
  let aiSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Detect AI search mode (query starts with ?)
  const isAiSearch = () => query().trim().startsWith('?');
  const aiQuery = () => isAiSearch() ? query().trim().slice(1).trim() : '';

  // Cleanup timeout on unmount
  onCleanup(() => {
    if (aiSearchTimeout) {
      clearTimeout(aiSearchTimeout);
    }
  });

  // Trigger AI search when query changes (with debounce)
  createEffect(() => {
    if (aiSearchTimeout) {
      clearTimeout(aiSearchTimeout);
      aiSearchTimeout = null;
    }

    if (!isAiSearch()) {
      setAiResults([]);
      setAiLoading(false);
      setAiError(null);
      return;
    }

    const currentAiQuery = aiQuery();
    if (!model || currentAiQuery.length < 3) {
      setAiResults([]);
      setAiLoading(false);
      if (!model && currentAiQuery.length >= 3) {
        setAiError('AI search unavailable (no API key configured)');
      } else {
        setAiError(null);
      }
      return;
    }

    setAiLoading(true);
    setAiError(null);
    aiSearchTimeout = setTimeout(async () => {
      try {
        const refs = await searchBibleByTopic(currentAiQuery, model, data, state);
        setAiResults(refs);
        setAiLoading(false);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : 'AI search failed');
        setAiLoading(false);
      }
    }, 500);
  });

  // Reset selection when mode changes
  createEffect(() => {
    paletteMode(); // track
    setSelectedIndex(0);
    setQuery('');
  });

  // Build grouped command options based on query
  const computedOptions = createMemo(() => {
    const allOptions: CommandOption[] = [];
    const q = query().trim().toLowerCase();

    // AI search mode - only show AI results
    if (isAiSearch()) {
      const currentAiQuery = aiQuery();
      if (aiLoading()) {
        allOptions.push({
          type: 'ai',
          group: 'ai',
          label: 'Searching...',
          description: `Finding verses about "${currentAiQuery}"`,
          value: 'ai-loading',
        });
      } else if (aiError()) {
        allOptions.push({
          type: 'ai',
          group: 'ai',
          label: 'Error',
          description: aiError()!,
          value: 'ai-error',
        });
      } else if (aiResults().length === 0 && currentAiQuery.length >= 3) {
        allOptions.push({
          type: 'ai',
          group: 'ai',
          label: 'No results',
          description: 'Try a different search term',
          value: 'ai-empty',
        });
      } else {
        for (const ref of aiResults()) {
          const label = formatReference(ref);
          const verse = data.getVerse(ref.book, ref.chapter, ref.verse ?? 1);
          const preview = verse ? verse.text.slice(0, 50) + (verse.text.length > 50 ? '...' : '') : '';
          allOptions.push({
            type: 'ai',
            group: 'ai',
            label,
            description: preview,
            value: `ai:${label}`,
            reference: ref,
          });
        }
      }

      if (currentAiQuery.length < 3) {
        allOptions.push({
          type: 'ai',
          group: 'ai',
          label: 'AI Search',
          description: 'Type a topic (e.g., ?faith without works)',
          value: 'ai-hint',
        });
      }

      const groups: CommandGroup[] = [{
        type: 'ai',
        label: GROUP_CONFIG.ai.label,
        options: allOptions,
      }];

      return { groups, flatOptions: allOptions };
    }

    // Default state (no query) - show tools, settings, and recent
    if (!q) {
      // Tools
      allOptions.push(
        { type: 'tool', group: 'tools', label: 'Messages', description: 'Generate sermon messages', value: 'messages' },
        { type: 'tool', group: 'tools', label: 'Sabbath School', description: 'Process lesson outlines', value: 'sabbath-school' },
        { type: 'tool', group: 'tools', label: 'Studies', description: 'Create Bible studies', value: 'studies' },
      );

      // Settings
      allOptions.push(
        { type: 'setting', group: 'settings', label: 'Theme', description: `Current: ${themeName()}`, value: 'theme' },
        { type: 'setting', group: 'settings', label: 'Display Mode', description: `Current: ${mode()}`, value: 'display' },
        { type: 'setting', group: 'settings', label: 'Bookmarks', description: 'View saved bookmarks', value: 'bookmarks' },
      );

      // AI hint
      if (model) {
        allOptions.push({
          type: 'ai',
          group: 'ai',
          label: 'AI Search',
          description: 'Type ? to search by topic',
          value: 'ai-hint',
        });
      }

      // Recent history
      const history = state.getHistory(5);
      for (const entry of history) {
        const ref = entry.reference;
        const label = formatReference(ref);
        allOptions.push({
          type: 'history',
          group: 'recent',
          label,
          description: 'Recent',
          value: `history:${label}`,
          reference: ref,
        });
      }
    } else {
      // Query mode - search everything

      // Navigation: verse references
      const ref = data.parseReference(q);
      if (ref) {
        const label = formatReference(ref);
        allOptions.push({
          type: 'verse',
          group: 'navigation',
          label,
          description: 'Go to verse',
          value: label,
          reference: ref,
        });
      }

      // Navigation: book matches
      const bookMatches = matchSorter(BOOKS, q, {
        keys: ['name'],
        threshold: matchSorter.rankings.WORD_STARTS_WITH,
      }).slice(0, 5);

      for (const book of bookMatches) {
        allOptions.push({
          type: 'book',
          group: 'navigation',
          label: book.name,
          description: `${book.chapters} chapters`,
          value: book.name,
          reference: { book: book.number, chapter: 1 },
        });
      }

      // Search: full-text search (if query is 3+ characters)
      if (q.length >= 3) {
        const searchResults = data.searchVerses(q, 8);
        for (const result of searchResults) {
          const label = formatReference(result.reference);
          const preview = result.verse.text.slice(0, 50) + (result.verse.text.length > 50 ? '...' : '');
          allOptions.push({
            type: 'search',
            group: 'search',
            label,
            description: preview,
            value: `search:${label}`,
            reference: result.reference,
          });
        }
      }

      // Tools
      const tools: CommandOption[] = [
        { type: 'tool', group: 'tools', label: 'Messages', description: 'Generate sermon messages', value: 'messages' },
        { type: 'tool', group: 'tools', label: 'Sabbath School', description: 'Process lesson outlines', value: 'sabbath-school' },
        { type: 'tool', group: 'tools', label: 'Studies', description: 'Create Bible studies', value: 'studies' },
      ];

      const toolMatches = matchSorter(tools, q, {
        keys: ['label', 'description'],
        threshold: matchSorter.rankings.CONTAINS,
      });
      allOptions.push(...toolMatches);

      // Settings
      const settings: CommandOption[] = [
        { type: 'setting', group: 'settings', label: 'Theme', description: `Current: ${themeName()}`, value: 'theme' },
        { type: 'setting', group: 'settings', label: 'Display Mode', description: `Current: ${mode()}`, value: 'display' },
        { type: 'setting', group: 'settings', label: 'Bookmarks', description: 'View saved bookmarks', value: 'bookmarks' },
      ];

      const settingMatches = matchSorter(settings, q, {
        keys: ['label', 'description'],
        threshold: matchSorter.rankings.CONTAINS,
      });
      allOptions.push(...settingMatches);
    }

    // Group the options
    const groupMap = new Map<GroupType, CommandOption[]>();
    for (const opt of allOptions) {
      const existing = groupMap.get(opt.group) || [];
      existing.push(opt);
      groupMap.set(opt.group, existing);
    }

    // Convert to sorted array of groups
    const groups: CommandGroup[] = Array.from(groupMap.entries())
      .map(([type, options]) => ({
        type,
        label: GROUP_CONFIG[type].label,
        options,
      }))
      .sort((a, b) => GROUP_CONFIG[a.type].order - GROUP_CONFIG[b.type].order);

    return { groups, flatOptions: allOptions };
  });

  const groups = () => computedOptions().groups;
  const flatOptions = () => computedOptions().flatOptions;

  // Reset selection when options change
  createEffect(() => {
    flatOptions().length; // track
    setSelectedIndex(0);
  });

  const selectOption = (option: CommandOption) => {
    // Skip non-selectable items
    if (option.type === 'ai' && ['ai-loading', 'ai-error', 'ai-empty', 'ai-hint'].includes(option.value)) {
      return;
    }

    if (option.reference) {
      goTo(option.reference);
      props.onClose();
    } else if (option.type === 'tool') {
      switch (option.value) {
        case 'messages':
        case 'sabbath-school':
        case 'studies':
          props.onNavigateToRoute?.(option.value);
          props.onClose();
          break;
      }
    } else if (option.type === 'setting') {
      switch (option.value) {
        case 'theme':
          setPaletteMode('theme');
          break;
        case 'display':
          toggleMode();
          props.onClose();
          break;
        case 'bookmarks':
          // TODO: implement bookmarks view
          props.onClose();
          break;
      }
    }
  };

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onClose();
      return;
    }

    if (key.name === 'return') {
      const options = flatOptions();
      const selected = options[selectedIndex()];
      if (selected) {
        selectOption(selected);
      }
      return;
    }

    if (key.name === 'up' || (key.ctrl && key.name === 'p')) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.name === 'down' || (key.ctrl && key.name === 'n')) {
      setSelectedIndex((i) => Math.min(flatOptions().length - 1, i + 1));
      return;
    }
  });

  // Build the visual list with group headers
  const renderItems = createMemo(() => {
    const items: Array<{ type: 'header' | 'option'; label: string; option?: CommandOption; flatIndex?: number }> = [];
    let flatIndex = 0;

    for (const group of groups()) {
      // Add group header
      items.push({ type: 'header', label: group.label });

      // Add options
      for (const option of group.options) {
        items.push({ type: 'option', label: option.label, option, flatIndex });
        flatIndex++;
      }
    }

    return items;
  });

  // Limit visible items
  const maxVisible = 12;
  const visibleItems = () => renderItems().slice(0, maxVisible);

  // Theme picker mode
  return (
    <Show
      when={paletteMode() === 'main'}
      fallback={
        <ThemePicker
          theme={theme}
          currentTheme={themeName()}
          availableThemes={availableThemes()}
          onSelect={(name) => {
            setTheme(name);
            props.onClose();
          }}
          onBack={() => setPaletteMode('main')}
          onClose={props.onClose}
        />
      }
    >
      <box
        flexDirection="column"
        border
        borderColor={theme().borderFocused}
        backgroundColor={theme().backgroundPanel}
        padding={1}
        minWidth={60}
        maxHeight={22}
      >
        {/* Search input */}
        <box height={3} border borderColor={theme().border} marginBottom={1}>
          <input
            ref={inputRef}
            placeholder="Search verses, books, or commands..."
            focused
            onInput={setQuery}
          />
        </box>

        {/* Results with groups */}
        <box flexDirection="column" flexGrow={1}>
          <Show
            when={visibleItems().length > 0}
            fallback={
              <text fg={theme().textMuted} style={{ padding: 1 }}>
                No results found
              </text>
            }
          >
            <For each={visibleItems()}>
              {(item, idx) => (
                <Show
                  when={item.type === 'option'}
                  fallback={
                    <box paddingLeft={1} marginTop={idx() > 0 ? 1 : 0}>
                      <text fg={theme().textMuted}>
                        <strong>{item.label}</strong>
                      </text>
                    </box>
                  }
                >
                  {(() => {
                    const option = item.option!;
                    const isSelected = () => item.flatIndex === selectedIndex();

                    return (
                      <box
                        flexDirection="row"
                        justifyContent="space-between"
                        paddingLeft={2}
                        paddingRight={1}
                        backgroundColor={isSelected() ? theme().accent : undefined}
                      >
                        <text fg={isSelected() ? theme().background : theme().text}>
                          {option.label}
                        </text>
                        <Show when={option.description}>
                          <text fg={isSelected() ? theme().background : theme().textMuted}>
                            {option.description!.slice(0, 35)}
                          </text>
                        </Show>
                      </box>
                    );
                  })()}
                </Show>
              )}
            </For>
          </Show>
        </box>

        {/* Footer hints */}
        <box height={1} marginTop={1}>
          <text fg={theme().textMuted}>
            <span style={{ fg: theme().accent }}>Enter</span> select
            <span>  </span>
            <span style={{ fg: theme().accent }}>↑↓</span> navigate
            <span>  </span>
            <Show when={model}>
              <span style={{ fg: theme().accent }}>?</span> AI search
              <span>  </span>
            </Show>
            <span style={{ fg: theme().accent }}>Esc</span> close
          </text>
        </box>
      </box>
    </Show>
  );
}

// Theme picker component
interface ThemePickerProps {
  theme: () => ReturnType<typeof useTheme>['theme'] extends () => infer T ? T : never;
  currentTheme: string;
  availableThemes: string[];
  onSelect: (name: string) => void;
  onBack: () => void;
  onClose: () => void;
}

function ThemePicker(props: ThemePickerProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(() => {
    const idx = props.availableThemes.indexOf(props.currentTheme);
    return idx >= 0 ? idx : 0;
  });

  useKeyboard((key) => {
    if (key.name === 'escape') {
      props.onBack();
      return;
    }

    if (key.name === 'return') {
      const selected = props.availableThemes[selectedIndex()()];
      if (selected) {
        props.onSelect(selected);
      }
      return;
    }

    if (key.name === 'up' || key.name === 'k') {
      setSelectedIndex(() => () => Math.max(0, selectedIndex()() - 1));
      return;
    }

    if (key.name === 'down' || key.name === 'j') {
      setSelectedIndex(() => () => Math.min(props.availableThemes.length - 1, selectedIndex()() + 1));
      return;
    }
  });

  return (
    <box
      flexDirection="column"
      border
      borderColor={props.theme().borderFocused}
      backgroundColor={props.theme().backgroundPanel}
      padding={1}
      minWidth={40}
      maxHeight={18}
    >
      {/* Header */}
      <box paddingLeft={1} marginBottom={1}>
        <text fg={props.theme().textHighlight}>
          <strong>Select Theme</strong>
        </text>
      </box>

      {/* Theme list */}
      <box flexDirection="column" flexGrow={1}>
        <For each={props.availableThemes}>
          {(name, index) => {
            const isSelected = () => index() === selectedIndex()();
            const isCurrent = name === props.currentTheme;

            return (
              <box
                flexDirection="row"
                justifyContent="space-between"
                paddingLeft={2}
                paddingRight={1}
                backgroundColor={isSelected() ? props.theme().accent : undefined}
              >
                <text fg={isSelected() ? props.theme().background : props.theme().text}>
                  {name}
                </text>
                <Show when={isCurrent}>
                  <text fg={isSelected() ? props.theme().background : props.theme().textMuted}>
                    (current)
                  </text>
                </Show>
              </box>
            );
          }}
        </For>
      </box>

      {/* Footer hints */}
      <box height={1} marginTop={1}>
        <text fg={props.theme().textMuted}>
          <span style={{ fg: props.theme().accent }}>Enter</span> select
          <span>  </span>
          <span style={{ fg: props.theme().accent }}>↑↓</span> navigate
          <span>  </span>
          <span style={{ fg: props.theme().accent }}>Esc</span> back
        </text>
      </box>
    </box>
  );
}
