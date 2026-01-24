import type { LanguageModel } from 'ai';
import { generateText } from 'ai';
import { Context, Data, Effect, Layer } from 'effect';

import { Model } from '../../services/model.js';
import { BibleData } from '../bible/data.js';
import { BibleState, type BibleStateService } from '../bible/state.js';
import type { BibleDataSyncService, Reference } from '../bible/types.js';

// Tagged error for AI search failures
export class AISearchError extends Data.TaggedError('AISearchError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// AI Search service interface
export interface AISearchService {
  readonly searchByTopic: (query: string) => Effect.Effect<Reference[], AISearchError>;
}

// Effect service tag
export class AISearch extends Context.Tag('AISearch')<AISearch, AISearchService>() {}

// System prompt for Bible verse search
const SYSTEM_PROMPT = `You are a Bible verse search assistant. Given a topic or question, return the most relevant Bible verses.

Return your response as a JSON array of verse references in this exact format:
[
  { "book": "John", "chapter": 3, "verse": 16 },
  { "book": "Romans", "chapter": 8, "verse": 28 }
]

Rules:
- Return 3-5 most relevant verses
- Use full book names (e.g., "1 Corinthians" not "1 Cor")
- Only return valid KJV Bible references
- Return ONLY the JSON array, no other text`;

// Parse AI response to references
function parseAIResponse(response: string, dataService: BibleDataSyncService): Reference[] {
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      book: string;
      chapter: number;
      verse?: number;
    }>;

    const refs: Reference[] = [];
    for (const item of parsed) {
      // Use the data service to parse and validate
      const refStr = item.verse
        ? `${item.book} ${item.chapter}:${item.verse}`
        : `${item.book} ${item.chapter}`;
      const ref = dataService.parseReference(refStr);
      if (ref) {
        refs.push(ref);
      }
    }
    return refs;
  } catch {
    return [];
  }
}

// Create the AI search service
function createAISearchService(
  modelService: { models: { low: LanguageModel } },
  dataService: BibleDataSyncService,
  stateService: BibleStateService,
): AISearchService {
  return {
    searchByTopic(query: string): Effect.Effect<Reference[], AISearchError> {
      return Effect.tryPromise({
        try: async () => {
          // Check cache first
          const cached = stateService.getCachedAISearch(query);
          if (cached) {
            return cached;
          }

          // Call AI model
          const result = await generateText({
            model: modelService.models.low,
            system: SYSTEM_PROMPT,
            prompt: `Find Bible verses about: ${query}`,
            maxOutputTokens: 500,
          });

          // Parse response
          const refs = parseAIResponse(result.text, dataService);

          // Cache results
          if (refs.length > 0) {
            stateService.setCachedAISearch(query, refs);
          }

          return refs;
        },
        catch: (error) =>
          new AISearchError({
            message: `AI search failed: ${error}`,
            cause: error,
          }),
      });
    },
  };
}

// Create a live layer (requires Model, BibleData, and BibleState)
export const AISearchLive = Layer.effect(
  AISearch,
  Effect.gen(function* () {
    const model = yield* Model;
    const data = yield* BibleData;
    const state = yield* BibleState;
    // Model service from Effect gives us { high, low } directly
    // Create sync wrapper for AI search (only needs parseReference which is sync)
    const syncData: BibleDataSyncService = {
      getBooks: () => Effect.runSync(data.getBooks()),
      getBook: (n) => Effect.runSync(data.getBook(n)),
      getChapter: (b, c) => Effect.runSync(data.getChapter(b, c)),
      getVerse: (b, c, v) => Effect.runSync(data.getVerse(b, c, v)),
      searchVerses: (q, l) => Effect.runSync(data.searchVerses(q, l)),
      parseReference: data.parseReference,
      getNextChapter: data.getNextChapter,
      getPrevChapter: data.getPrevChapter,
    };
    return createAISearchService({ models: model }, syncData, state);
  }),
);

// Standalone function for use outside Effect context
export async function searchBibleByTopic(
  query: string,
  modelService: { models: { low: LanguageModel } },
  dataService: BibleDataSyncService,
  stateService: BibleStateService,
): Promise<Reference[]> {
  // Check cache first
  const cached = stateService.getCachedAISearch(query);
  if (cached) {
    return cached;
  }

  try {
    const result = await generateText({
      model: modelService.models.low,
      system: SYSTEM_PROMPT,
      prompt: `Find Bible verses about: ${query}`,
      maxOutputTokens: 500,
    });

    const refs = parseAIResponse(result.text, dataService);

    // Cache results
    if (refs.length > 0) {
      stateService.setCachedAISearch(query, refs);
    }

    return refs;
  } catch (error) {
    console.error('AI search error:', error);
    return [];
  }
}
