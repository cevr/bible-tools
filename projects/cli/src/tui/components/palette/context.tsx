import {
  createContext,
  useContext,
  createSignal,
  createMemo,
  createEffect,
  onCleanup,
  type ParentProps,
  type Accessor,
} from 'solid-js';
import { matchSorter } from 'match-sorter';

import { useBibleData, useBibleState } from '../../context/bible.js';
import { useNavigation } from '../../context/navigation.js';
import { useTheme } from '../../context/theme.js';
import { useDisplay } from '../../context/display.js';
import { useModel } from '../../context/model.js';
import { BOOKS, formatReference, type Reference } from '../../../bible/types.js';
import { searchBibleByTopic } from '../../../bible/ai-search.js';
import { AiSearchState } from '../../types/ai-search.js';

// Types

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

export interface CommandGroup {
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

// Context Interface

interface PaletteContextValue {
  // State accessors
  query: Accessor<string>;
  selectedIndex: Accessor<number>;
  aiState: Accessor<AiSearchState>;

  // Computed state
  groups: Accessor<CommandGroup[]>;
  flatOptions: Accessor<CommandOption[]>;
  isAiSearch: Accessor<boolean>;

  // Actions
  setQuery: (q: string) => void;
  setSelectedIndex: (i: number) => void;
  moveSelection: (delta: number) => void;
  selectCurrent: () => void;
}

const PaletteContext = createContext<PaletteContextValue>();

// Provider Props

interface PaletteProviderProps extends ParentProps {
  onClose: () => void;
  onNavigateToRoute?: (route: string) => void;
  onSelectTheme: () => void;
}

// Provider Implementation

export function PaletteProvider(props: PaletteProviderProps) {
  // Dependencies from other contexts
  const { themeName } = useTheme();
  const { toggleMode, mode } = useDisplay();
  const data = useBibleData();
  const state = useBibleState();
  const model = useModel();
  const { goTo } = useNavigation();

  // Core state
  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [aiState, setAiState] = createSignal<AiSearchState>(AiSearchState.idle());

  let aiSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Derived state
  const isAiSearch = () => query().trim().startsWith('?');
  const aiQuery = () => (isAiSearch() ? query().trim().slice(1).trim() : '');

  // Cleanup timeout on unmount
  onCleanup(() => {
    if (aiSearchTimeout) {
      clearTimeout(aiSearchTimeout);
    }
  });

  // AI search effect with debounce
  createEffect(() => {
    if (aiSearchTimeout) {
      clearTimeout(aiSearchTimeout);
      aiSearchTimeout = null;
    }

    if (!isAiSearch()) {
      setAiState(AiSearchState.idle());
      return;
    }

    const currentAiQuery = aiQuery();

    if (currentAiQuery.length < 3) {
      setAiState(AiSearchState.typing(currentAiQuery));
      return;
    }

    if (!model) {
      setAiState(AiSearchState.error(currentAiQuery, 'AI search unavailable (no API key configured)'));
      return;
    }

    setAiState(AiSearchState.loading(currentAiQuery));

    aiSearchTimeout = setTimeout(async () => {
      try {
        const refs = await searchBibleByTopic(currentAiQuery, model, data, state);
        if (refs.length === 0) {
          setAiState(AiSearchState.empty(currentAiQuery));
        } else {
          setAiState(AiSearchState.success(currentAiQuery, refs));
        }
      } catch (err) {
        setAiState(AiSearchState.error(currentAiQuery, err instanceof Error ? err.message : 'AI search failed'));
      }
    }, 500);
  });

  // Compute grouped options
  const computedOptions = createMemo(() => {
    const allOptions: CommandOption[] = [];
    const q = query().trim().toLowerCase();

    // AI search mode - only show AI results
    if (isAiSearch()) {
      const currentState = aiState();

      switch (currentState._tag) {
        case 'typing':
          allOptions.push({
            type: 'ai',
            group: 'ai',
            label: 'AI Search',
            description: 'Type a topic (e.g., ?faith without works)',
            value: 'ai-hint',
          });
          break;

        case 'loading':
          allOptions.push({
            type: 'ai',
            group: 'ai',
            label: 'Searching...',
            description: `Finding verses about "${currentState.query}"`,
            value: 'ai-loading',
          });
          break;

        case 'error':
          allOptions.push({
            type: 'ai',
            group: 'ai',
            label: 'Error',
            description: currentState.error,
            value: 'ai-error',
          });
          break;

        case 'empty':
          allOptions.push({
            type: 'ai',
            group: 'ai',
            label: 'No results',
            description: 'Try a different search term',
            value: 'ai-empty',
          });
          break;

        case 'success':
          for (const ref of currentState.results) {
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
          break;
      }

      const groups: CommandGroup[] = [
        {
          type: 'ai',
          label: GROUP_CONFIG.ai.label,
          options: allOptions,
        },
      ];

      return { groups, flatOptions: allOptions };
    }

    // Default state (no query) - show tools, settings, and recent
    if (!q) {
      // Tools
      allOptions.push(
        { type: 'tool', group: 'tools', label: 'Messages', description: 'Generate sermon messages', value: 'messages' },
        {
          type: 'tool',
          group: 'tools',
          label: 'Sabbath School',
          description: 'Process lesson outlines',
          value: 'sabbath-school',
        },
        { type: 'tool', group: 'tools', label: 'Studies', description: 'Create Bible studies', value: 'studies' }
      );

      // Settings
      allOptions.push(
        { type: 'setting', group: 'settings', label: 'Theme', description: `Current: ${themeName()}`, value: 'theme' },
        {
          type: 'setting',
          group: 'settings',
          label: 'Display Mode',
          description: `Current: ${mode()}`,
          value: 'display',
        },
        { type: 'setting', group: 'settings', label: 'Bookmarks', description: 'View saved bookmarks', value: 'bookmarks' }
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
        {
          type: 'tool',
          group: 'tools',
          label: 'Sabbath School',
          description: 'Process lesson outlines',
          value: 'sabbath-school',
        },
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
        {
          type: 'setting',
          group: 'settings',
          label: 'Display Mode',
          description: `Current: ${mode()}`,
          value: 'display',
        },
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
    flatOptions().length; // track dependency
    setSelectedIndex(0);
  });

  // Actions
  const moveSelection = (delta: number) => {
    setSelectedIndex((i) => {
      const maxIndex = flatOptions().length - 1;
      const newIndex = i + delta;
      return Math.max(0, Math.min(maxIndex, newIndex));
    });
  };

  const selectCurrent = () => {
    const options = flatOptions();
    const option = options[selectedIndex()];
    if (!option) return;

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
          props.onSelectTheme();
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

  const value: PaletteContextValue = {
    query,
    selectedIndex,
    aiState,
    groups,
    flatOptions,
    isAiSearch,
    setQuery,
    setSelectedIndex,
    moveSelection,
    selectCurrent,
  };

  return <PaletteContext.Provider value={value}>{props.children}</PaletteContext.Provider>;
}

// Hook

export function usePalette(): PaletteContextValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    throw new Error('usePalette must be used within a PaletteProvider');
  }
  return ctx;
}

// Re-exports

export { GROUP_CONFIG };
