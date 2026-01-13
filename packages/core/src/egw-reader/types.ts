/**
 * EGW Reader Types
 *
 * Renderer-agnostic types for the EGW reader service.
 * Used by both TUI and Web renderers.
 */

/**
 * EGW Book Info - summary info for book listing
 */
export interface EGWBookInfo {
  readonly bookId: number;
  readonly bookCode: string;
  readonly title: string;
  readonly author: string;
  readonly pageCount?: number;
}

/**
 * EGW Chapter/Section Info - for table of contents
 */
export interface EGWChapterInfo {
  readonly paraId?: string;
  readonly title?: string;
  readonly refcodeShort?: string;
  readonly level: number;
  readonly puborder: number;
}

/**
 * EGW Paragraph - content unit
 */
export interface EGWParagraph {
  readonly paraId?: string;
  readonly refcodeShort?: string;
  readonly refcodeLong?: string;
  readonly content?: string;
  readonly puborder: number;
  readonly elementType?: string;
  readonly elementSubtype?: string;
}

/**
 * EGW Reader Position - current reading position
 */
export interface EGWReaderPosition {
  readonly bookCode: string;
  readonly bookId?: number;
  /** Current paragraph puborder */
  readonly puborder?: number;
  /** Page number (from refcode) */
  readonly page?: number;
  /** Paragraph number on page */
  readonly paragraph?: number;
}

/**
 * Reader State - discriminated union for loading states
 */
export type EGWReaderState =
  | { readonly _tag: 'idle' }
  | { readonly _tag: 'loading'; readonly message: string }
  | {
      readonly _tag: 'loaded';
      readonly book: EGWBookInfo;
      readonly paragraphs: readonly EGWParagraph[];
    }
  | { readonly _tag: 'error'; readonly error: string };

/**
 * Initial reader state
 */
export const initialReaderState: EGWReaderState = { _tag: 'idle' };

/**
 * State matchers
 */
export const isReaderState = {
  idle: (
    state: EGWReaderState,
  ): state is Extract<EGWReaderState, { _tag: 'idle' }> =>
    state._tag === 'idle',
  loading: (
    state: EGWReaderState,
  ): state is Extract<EGWReaderState, { _tag: 'loading' }> =>
    state._tag === 'loading',
  loaded: (
    state: EGWReaderState,
  ): state is Extract<EGWReaderState, { _tag: 'loaded' }> =>
    state._tag === 'loaded',
  error: (
    state: EGWReaderState,
  ): state is Extract<EGWReaderState, { _tag: 'error' }> =>
    state._tag === 'error',
} as const;
