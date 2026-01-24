/**
 * View state pattern for route-level views.
 *
 * This provides a consistent pattern for views that have:
 * - A main menu
 * - Sub-views accessible from the menu
 *
 * Use this instead of simple string union types to enable
 * type-safe transitions and better pattern matching.
 */

// Generic view state for menu-based routes
export type MenuViewState<TSubView extends string> =
  | { _tag: 'menu' }
  | { _tag: 'subview'; view: TSubView };

// Constructor helpers
export function menuState<T extends string>(): MenuViewState<T> {
  return { _tag: 'menu' };
}

export function subviewState<T extends string>(view: T): MenuViewState<T> {
  return { _tag: 'subview', view };
}

// Specific view state types for each route
export type MessagesViewState = MenuViewState<'generate' | 'list'>;
export type SabbathSchoolViewState = MenuViewState<'process' | 'list'>;
export type StudiesViewState = MenuViewState<'generate' | 'list'>;

// Namespaced constructors for each route
export const MessagesViewState = {
  menu: (): MessagesViewState => menuState(),
  generate: (): MessagesViewState => subviewState('generate'),
  list: (): MessagesViewState => subviewState('list'),
} as const;

export const SabbathSchoolViewState = {
  menu: (): SabbathSchoolViewState => menuState(),
  process: (): SabbathSchoolViewState => subviewState('process'),
  list: (): SabbathSchoolViewState => subviewState('list'),
} as const;

export const StudiesViewState = {
  menu: (): StudiesViewState => menuState(),
  generate: (): StudiesViewState => subviewState('generate'),
  list: (): StudiesViewState => subviewState('list'),
} as const;

// Helper predicates
export function isMenu<T extends string>(state: MenuViewState<T>): state is { _tag: 'menu' } {
  return state._tag === 'menu';
}

export function isSubview<T extends string>(
  state: MenuViewState<T>,
): state is { _tag: 'subview'; view: T } {
  return state._tag === 'subview';
}

export function getSubview<T extends string>(state: MenuViewState<T>): T | null {
  return state._tag === 'subview' ? state.view : null;
}
