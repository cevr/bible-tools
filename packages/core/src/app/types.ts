/**
 * App Router Types
 *
 * Renderer-agnostic types for the application router state machine.
 * Used by both TUI and Web renderers.
 */

import { Schema } from 'effect';

/**
 * Bible Reference - identifies a location in the Bible
 */
export const BibleReference = Schema.Struct({
  book: Schema.Number,
  chapter: Schema.Number,
  verse: Schema.optionalWith(Schema.Number, { nullable: true }),
});

export type BibleReference = Schema.Schema.Type<typeof BibleReference>;

/**
 * EGW Reference - identifies a location in EGW writings
 * Uses refcode format like "PP 351.1"
 */
export const EGWReference = Schema.Struct({
  bookCode: Schema.String,
  page: Schema.optionalWith(Schema.Number, { nullable: true }),
  paragraph: Schema.optionalWith(Schema.Number, { nullable: true }),
});

export type EGWReference = Schema.Schema.Type<typeof EGWReference>;

/**
 * App Route - discriminated union for all app routes
 */
export type AppRoute =
  | { readonly _tag: 'bible'; readonly ref?: BibleReference }
  | { readonly _tag: 'egw'; readonly ref?: EGWReference }
  | { readonly _tag: 'messages' }
  | { readonly _tag: 'sabbath-school' }
  | { readonly _tag: 'studies' };

/**
 * App Router State
 */
export interface AppRouterState {
  readonly current: AppRoute;
  readonly history: readonly AppRoute[];
}

/**
 * Initial router state - starts at Bible view
 */
export const initialRouterState: AppRouterState = {
  current: { _tag: 'bible' },
  history: [],
};

/**
 * Route constructors for type-safe navigation
 */
export const Route = {
  bible: (ref?: BibleReference): AppRoute => ({ _tag: 'bible', ref }),
  egw: (ref?: EGWReference): AppRoute => ({ _tag: 'egw', ref }),
  messages: (): AppRoute => ({ _tag: 'messages' }),
  sabbathSchool: (): AppRoute => ({ _tag: 'sabbath-school' }),
  studies: (): AppRoute => ({ _tag: 'studies' }),
} as const;

/**
 * Route matchers for type-safe pattern matching
 */
export const isRoute = {
  bible: (route: AppRoute): route is Extract<AppRoute, { _tag: 'bible' }> =>
    route._tag === 'bible',
  egw: (route: AppRoute): route is Extract<AppRoute, { _tag: 'egw' }> =>
    route._tag === 'egw',
  messages: (
    route: AppRoute,
  ): route is Extract<AppRoute, { _tag: 'messages' }> =>
    route._tag === 'messages',
  sabbathSchool: (
    route: AppRoute,
  ): route is Extract<AppRoute, { _tag: 'sabbath-school' }> =>
    route._tag === 'sabbath-school',
  studies: (route: AppRoute): route is Extract<AppRoute, { _tag: 'studies' }> =>
    route._tag === 'studies',
} as const;
