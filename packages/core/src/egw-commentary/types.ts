/**
 * EGW Commentary Types
 *
 * Types for Bible commentary from EGW writings.
 */

/**
 * A single commentary entry for a Bible verse
 */
export interface CommentaryEntry {
  /** EGW reference code (e.g., "1BC 1111.2") */
  readonly refcode: string;
  /** Book code (e.g., "1BC") */
  readonly bookCode: string;
  /** Book title (e.g., "Bible Commentary Volume 1") */
  readonly bookTitle: string;
  /** Commentary text content */
  readonly content: string;
  /** Publication order in the original book */
  readonly puborder: number;
}

/**
 * Bible verse reference for commentary lookup
 */
export interface VerseReference {
  /** Bible book number (1-66) */
  readonly book: number;
  /** Chapter number */
  readonly chapter: number;
  /** Verse number */
  readonly verse: number;
}

/**
 * Commentary lookup result
 */
export interface CommentaryResult {
  /** The verse being commented on */
  readonly verse: VerseReference;
  /** Commentary entries for this verse */
  readonly entries: readonly CommentaryEntry[];
}
