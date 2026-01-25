import { Args, Command, Options } from '@effect/cli';
import { FileSystem } from '@effect/platform';
import { Effect, Option, pipe } from 'effect';
import { join } from 'path';

import { ReadingsConfig } from '~/src/lib/content/configs';
import { makeListCommand, makeReviseCommand, makeExportCommand } from '~/src/lib/content/commands';
import { ReadingFrontmatter, type ReadingType } from '~/src/lib/content/schemas';
import { stringifyFrontmatter } from '~/src/lib/frontmatter';
import { matchArrayEnum, msToMinutes, spin } from '~/src/lib/general';
import { generate } from '~/src/lib/generate';
import { getCliRoot, getOutputsPath, getPromptPath } from '~/src/lib/paths';
import { Model } from '~/src/services/model';

const targetTypes = ['study', 'slides', 'speaker-notes'] as const;
type TargetType = (typeof targetTypes)[number];

const target = Options.text('target').pipe(
  Options.withAlias('t'),
  Options.repeated,
  Options.withDefault<readonly string[]>([]),
);

const chapter = Args.integer({
  name: 'chapter',
}).pipe(Args.optional);

const processChapters = Command.make('process', { chapter, target }, (args) =>
  Effect.gen(function* () {
    const model = yield* Model;
    const fs = yield* FileSystem.FileSystem;
    const startTime = Date.now();

    // Path to extracted chapters directory
    const chaptersDir = join(getCliRoot(), '..', 'scripts', 'extracted-chapters');

    // Path to output directory
    const outputDir = getOutputsPath('readings');

    // Ensure output directory exists
    yield* spin(
      'Ensuring output directory exists',
      fs.makeDirectory(outputDir).pipe(Effect.ignore),
    );

    // Parse targets with fuzzy matching
    const targets: readonly TargetType[] =
      args.target.length === 0
        ? targetTypes
        : pipe(
            matchArrayEnum(targetTypes, [...args.target]),
            Option.getOrElse(() => [...targetTypes]),
          );

    const generateStudy = targets.includes('study');
    const generateSlides = targets.includes('slides');
    const generateSpeakerNotes = targets.includes('speaker-notes');

    yield* Effect.logDebug(`Targets: ${targets.join(', ')}`);

    // Read the system prompts
    const studyPrompt = yield* fs
      .readFile(getPromptPath('readings', 'generate-study.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const slidesPrompt = yield* fs
      .readFile(getPromptPath('readings', 'generate-slides.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const speakerNotesPrompt = yield* fs
      .readFile(getPromptPath('readings', 'generate-speaker-notes.md'))
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    // Get all chapter files
    const files = yield* fs.readDirectory(chaptersDir);

    // Filter to only chapter files and sort them
    const allChapterFiles = files
      .filter((file) => file.startsWith('chapter-') && file.endsWith('.txt'))
      .sort((a, b) => {
        // Extract chapter numbers and compare
        const numA = parseInt(a.match(/chapter-(\d+)\.txt/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/chapter-(\d+)\.txt/)?.[1] || '0', 10);
        return numA - numB;
      });

    // Filter to specific chapter if provided
    const chapterFiles = Option.match(args.chapter, {
      onSome: (num) => allChapterFiles.filter((f) => f === `chapter-${num}.txt`),
      onNone: () => allChapterFiles,
    });

    yield* Effect.logDebug(`Found ${chapterFiles.length} chapter files to process`);

    // If specific chapter requested, process it (overwrite existing)
    // Otherwise, filter to unprocessed chapters based on selected targets
    const chaptersToProcess = yield* Option.match(args.chapter, {
      onSome: () => Effect.succeed(chapterFiles),
      onNone: () =>
        Effect.filter(
          chapterFiles,
          (chapterFile) =>
            Effect.gen(function* () {
              const chapterNum = chapterFile.match(/chapter-(\d+)\.txt/)?.[1] || '0';
              const studyFile = join(outputDir, `chapter-${chapterNum}-study.md`);
              const slidesFile = join(outputDir, `chapter-${chapterNum}-slides.md`);
              const speakerNotesFile = join(outputDir, `chapter-${chapterNum}-speaker-notes.md`);
              const studyExists = yield* fs.exists(studyFile);
              const slidesExists = yield* fs.exists(slidesFile);
              const speakerNotesExists = yield* fs.exists(speakerNotesFile);

              // Only check targets that are requested
              const needsStudy = generateStudy && !studyExists;
              const needsSlides = generateSlides && !slidesExists;
              const needsSpeakerNotes = generateSpeakerNotes && !speakerNotesExists;

              return needsStudy || needsSlides || needsSpeakerNotes;
            }),
          {
            concurrency: 'unbounded',
          },
        ),
    });

    if (chaptersToProcess.length === 0) {
      yield* Effect.log('All chapters have already been processed!');
      return;
    }

    yield* Effect.log(
      `Processing ${chaptersToProcess.length} chapters (${allChapterFiles.length - chaptersToProcess.length} already completed)`,
    );

    // Helper to create frontmatter for a reading
    const makeFrontmatter = (chapterNum: number, type: ReadingType) =>
      new ReadingFrontmatter({
        created_at: new Date().toISOString(),
        chapter: chapterNum,
        type,
        apple_note_id: Option.none(),
      });

    // Helper to write content with frontmatter
    const writeWithFrontmatter = (
      filePath: string,
      content: string,
      chapterNum: number,
      type: ReadingType,
    ) =>
      Effect.gen(function* () {
        const frontmatter = makeFrontmatter(chapterNum, type);
        const finalContent = stringifyFrontmatter(
          {
            created_at: frontmatter.created_at,
            chapter: frontmatter.chapter,
            type: frontmatter.type,
          },
          content,
        );
        yield* spin(
          `Writing ${type} to ${filePath}`,
          fs.writeFile(filePath, new TextEncoder().encode(finalContent)),
        );
      });

    // Process each chapter
    yield* Effect.forEach(
      chaptersToProcess,
      (chapterFile, index) =>
        Effect.gen(function* () {
          const chapterNum = parseInt(chapterFile.match(/chapter-(\d+)\.txt/)?.[1] || '0', 10);
          const chapterPath = join(chaptersDir, chapterFile);
          const studyOutputFile = join(outputDir, `chapter-${chapterNum}-study.md`);
          const slidesOutputFile = join(outputDir, `chapter-${chapterNum}-slides.md`);
          const speakerNotesOutputFile = join(outputDir, `chapter-${chapterNum}-speaker-notes.md`);

          yield* Effect.log(
            `[${index + 1}/${chaptersToProcess.length}] Processing ${chapterFile}...`,
          );

          const forceOverwrite = Option.isSome(args.chapter);
          const studyExists = yield* fs.exists(studyOutputFile);
          let studyContent = '';

          // Study is needed if requested OR if slides/speaker-notes need it as a dependency
          const needStudyContent = generateStudy || generateSlides || generateSpeakerNotes;

          if (needStudyContent) {
            if (studyExists && !forceOverwrite && !generateStudy) {
              // Just read existing study for downstream use
              yield* Effect.logDebug(`Reading existing study for dependencies...`);
              studyContent = yield* fs
                .readFile(studyOutputFile)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));
            } else if (studyExists && !forceOverwrite) {
              yield* Effect.logDebug(`Skipping study (already exists)...`);
              studyContent = yield* fs
                .readFile(studyOutputFile)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));
            } else if (generateStudy || !studyExists) {
              // Generate study if requested OR if it doesn't exist but is needed
              const chapterContent = yield* fs
                .readFile(chapterPath)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));

              const { response } = yield* generate(studyPrompt, chapterContent, {
                skipChime: true,
              }).pipe(Effect.provideService(Model, model));
              studyContent = response;

              yield* writeWithFrontmatter(studyOutputFile, studyContent, chapterNum, 'study');
            } else {
              // Study exists, not forcing, just read it
              studyContent = yield* fs
                .readFile(studyOutputFile)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));
            }
          }

          const slidesExists = yield* fs.exists(slidesOutputFile);
          let slidesContent = '';

          // Slides are needed if requested OR if speaker-notes needs it
          const needSlidesContent = generateSlides || generateSpeakerNotes;

          if (needSlidesContent) {
            if (slidesExists && !forceOverwrite && !generateSlides) {
              // Just read existing slides for downstream use
              yield* Effect.logDebug(`Reading existing slides for dependencies...`);
              slidesContent = yield* fs
                .readFile(slidesOutputFile)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));
            } else if (slidesExists && !forceOverwrite) {
              yield* Effect.logDebug(`Skipping slides (already exists)...`);
              slidesContent = yield* fs
                .readFile(slidesOutputFile)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));
            } else if (generateSlides || !slidesExists) {
              // Generate slides if requested OR if it doesn't exist but is needed
              const { response } = yield* generate(slidesPrompt, studyContent, {
                skipChime: true,
              }).pipe(Effect.provideService(Model, model));
              slidesContent = response;

              yield* writeWithFrontmatter(slidesOutputFile, slidesContent, chapterNum, 'slides');
            } else {
              // Slides exist, not forcing, just read them
              slidesContent = yield* fs
                .readFile(slidesOutputFile)
                .pipe(Effect.map((i) => new TextDecoder().decode(i)));
            }
          }

          if (generateSpeakerNotes) {
            const speakerNotesExists = yield* fs.exists(speakerNotesOutputFile);
            if (speakerNotesExists && !forceOverwrite) {
              yield* Effect.logDebug(`Skipping speaker notes (already exists)...`);
            } else {
              const combinedInput = `## Study Notes\n\n${studyContent}\n\n## Slide Notes\n\n${slidesContent}`;
              const { response: speakerNotesContent } = yield* generate(
                speakerNotesPrompt,
                combinedInput,
                { skipChime: true },
              ).pipe(Effect.provideService(Model, model));

              yield* writeWithFrontmatter(
                speakerNotesOutputFile,
                speakerNotesContent,
                chapterNum,
                'speaker-notes',
              );
            }
          }

          yield* Effect.logDebug(
            `[${index + 1}/${chaptersToProcess.length}] Completed ${chapterFile}`,
          );
        }).pipe(
          Effect.annotateLogs({
            chapter: chapterFile,
            current: index + 1,
            total: chaptersToProcess.length,
          }),
        ),
      {
        concurrency: 1, // Process one at a time to avoid rate limits
      },
    );

    const totalTime = msToMinutes(Date.now() - startTime);
    yield* Effect.log(`\nAll chapters processed successfully! (Total time: ${totalTime})`);
  }),
);

export const readings = Command.make('readings').pipe(
  Command.withSubcommands([
    processChapters,
    makeReviseCommand(ReadingsConfig),
    makeListCommand(ReadingsConfig),
    makeExportCommand(ReadingsConfig),
  ]),
);
