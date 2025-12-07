import { Args, Command, Options } from '@effect/cli';
import { select } from '@effect/cli/Prompt';
import { FileSystem, Path } from '@effect/platform';
import { Effect, Option, pipe } from 'effect';

import { generate } from '~/lib/generate';
import { revise } from '~/lib/revise';

import { matchArrayEnum, msToMinutes, spin } from '../../lib/general';
import { Model, model } from '../model';

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

const processChapters = Command.make(
  'process',
  { model, chapter, target },
  (args) =>
    Effect.gen(function* (_) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const startTime = Date.now();

      // Path to extracted chapters directory
      const chaptersDir = path.join(
        process.cwd(),
        '..',
        'scripts',
        'extracted-chapters',
      );

      // Path to output directory
      const outputDir = path.join(process.cwd(), 'outputs', 'readings');

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

      yield* Effect.log(`Targets: ${targets.join(', ')}`);

      // Read the system prompts
      const studyPrompt = yield* fs
        .readFile(
          path.join(
            process.cwd(),
            'core',
            'readings',
            'prompts',
            'generate-study.md',
          ),
        )
        .pipe(Effect.map((i) => new TextDecoder().decode(i)));

      const slidesPrompt = yield* fs
        .readFile(
          path.join(
            process.cwd(),
            'core',
            'readings',
            'prompts',
            'generate-slides.md',
          ),
        )
        .pipe(Effect.map((i) => new TextDecoder().decode(i)));

      const speakerNotesPrompt = yield* fs
        .readFile(
          path.join(
            process.cwd(),
            'core',
            'readings',
            'prompts',
            'generate-speaker-notes.md',
          ),
        )
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
        onSome: (num) =>
          allChapterFiles.filter((f) => f === `chapter-${num}.txt`),
        onNone: () => allChapterFiles,
      });

      yield* Effect.log(
        `Found ${chapterFiles.length} chapter files to process`,
      );

      // If specific chapter requested, process it (overwrite existing)
      // Otherwise, filter to unprocessed chapters based on selected targets
      const chaptersToProcess = yield* Option.match(args.chapter, {
        onSome: () => Effect.succeed(chapterFiles),
        onNone: () =>
          Effect.filter(
            chapterFiles,
            (chapterFile) =>
              Effect.gen(function* () {
                const chapterNum =
                  chapterFile.match(/chapter-(\d+)\.txt/)?.[1] || '0';
                const studyFile = path.join(
                  outputDir,
                  `chapter-${chapterNum}-study.md`,
                );
                const slidesFile = path.join(
                  outputDir,
                  `chapter-${chapterNum}-slides.md`,
                );
                const speakerNotesFile = path.join(
                  outputDir,
                  `chapter-${chapterNum}-speaker-notes.md`,
                );
                const studyExists = yield* fs.exists(studyFile);
                const slidesExists = yield* fs.exists(slidesFile);
                const speakerNotesExists = yield* fs.exists(speakerNotesFile);

                // Only check targets that are requested
                const needsStudy = generateStudy && !studyExists;
                const needsSlides = generateSlides && !slidesExists;
                const needsSpeakerNotes =
                  generateSpeakerNotes && !speakerNotesExists;

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

      // Process each chapter
      yield* Effect.forEach(
        chaptersToProcess,
        (chapterFile, index) =>
          Effect.gen(function* () {
            const chapterNum =
              chapterFile.match(/chapter-(\d+)\.txt/)?.[1] || '0';
            const chapterPath = path.join(chaptersDir, chapterFile);
            const studyOutputFile = path.join(
              outputDir,
              `chapter-${chapterNum}-study.md`,
            );
            const slidesOutputFile = path.join(
              outputDir,
              `chapter-${chapterNum}-slides.md`,
            );
            const speakerNotesOutputFile = path.join(
              outputDir,
              `chapter-${chapterNum}-speaker-notes.md`,
            );

            yield* Effect.log(
              `[${index + 1}/${chaptersToProcess.length}] Processing ${chapterFile}...`,
            );

            const forceOverwrite = Option.isSome(args.chapter);
            const studyExists = yield* fs.exists(studyOutputFile);
            let studyContent = '';

            // Study is needed if requested OR if slides/speaker-notes need it as a dependency
            const needStudyContent =
              generateStudy || generateSlides || generateSpeakerNotes;

            if (needStudyContent) {
              if (studyExists && !forceOverwrite && !generateStudy) {
                // Just read existing study for downstream use
                yield* Effect.log(`Reading existing study for dependencies...`);
                studyContent = yield* fs
                  .readFile(studyOutputFile)
                  .pipe(Effect.map((i) => new TextDecoder().decode(i)));
              } else if (studyExists && !forceOverwrite) {
                yield* Effect.log(`Skipping study (already exists)...`);
                studyContent = yield* fs
                  .readFile(studyOutputFile)
                  .pipe(Effect.map((i) => new TextDecoder().decode(i)));
              } else if (generateStudy || !studyExists) {
                // Generate study if requested OR if it doesn't exist but is needed
                const chapterContent = yield* fs
                  .readFile(chapterPath)
                  .pipe(Effect.map((i) => new TextDecoder().decode(i)));

                const { response } = yield* generate(
                  studyPrompt,
                  chapterContent,
                  {
                    skipRevisions: true,
                    skipChime: true,
                  },
                ).pipe(Effect.provideService(Model, args.model));
                studyContent = response;

                yield* spin(
                  `Writing study to ${studyOutputFile}`,
                  fs.writeFile(
                    studyOutputFile,
                    new TextEncoder().encode(studyContent),
                  ),
                );
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
                yield* Effect.log(
                  `Reading existing slides for dependencies...`,
                );
                slidesContent = yield* fs
                  .readFile(slidesOutputFile)
                  .pipe(Effect.map((i) => new TextDecoder().decode(i)));
              } else if (slidesExists && !forceOverwrite) {
                yield* Effect.log(`Skipping slides (already exists)...`);
                slidesContent = yield* fs
                  .readFile(slidesOutputFile)
                  .pipe(Effect.map((i) => new TextDecoder().decode(i)));
              } else if (generateSlides || !slidesExists) {
                // Generate slides if requested OR if it doesn't exist but is needed
                const { response } = yield* generate(
                  slidesPrompt,
                  studyContent,
                  { skipRevisions: true, skipChime: true },
                ).pipe(Effect.provideService(Model, args.model));
                slidesContent = response;

                yield* spin(
                  `Writing slides to ${slidesOutputFile}`,
                  fs.writeFile(
                    slidesOutputFile,
                    new TextEncoder().encode(slidesContent),
                  ),
                );
              } else {
                // Slides exist, not forcing, just read them
                slidesContent = yield* fs
                  .readFile(slidesOutputFile)
                  .pipe(Effect.map((i) => new TextDecoder().decode(i)));
              }
            }

            if (generateSpeakerNotes) {
              const speakerNotesExists = yield* fs.exists(
                speakerNotesOutputFile,
              );
              if (speakerNotesExists && !forceOverwrite) {
                yield* Effect.log(`Skipping speaker notes (already exists)...`);
              } else {
                const combinedInput = `## Study Notes\n\n${studyContent}\n\n## Slide Notes\n\n${slidesContent}`;
                const { response: speakerNotesContent } = yield* generate(
                  speakerNotesPrompt,
                  combinedInput,
                  { skipRevisions: true, skipChime: true },
                ).pipe(Effect.provideService(Model, args.model));

                yield* spin(
                  `Writing speaker notes to ${speakerNotesOutputFile}`,
                  fs.writeFile(
                    speakerNotesOutputFile,
                    new TextEncoder().encode(speakerNotesContent),
                  ),
                );
              }
            }

            yield* Effect.log(
              `[${index + 1}/${chaptersToProcess.length}] ✓ Completed ${chapterFile}`,
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
      yield* Effect.log(
        `\n✅ All chapters processed successfully! (Total time: ${totalTime})`,
      );
    }),
);

const reviseReading = Command.make('revise', { model }, (args) =>
  Effect.gen(function* (_) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const outputDir = path.join(process.cwd(), 'outputs', 'readings');
    const files = yield* fs.readDirectory(outputDir);

    // Filter to only markdown files and sort them
    const readingFiles = files
      .filter((file) => file.endsWith('.md'))
      .sort((a, b) => {
        // Extract chapter numbers and compare
        const numA = parseInt(a.match(/chapter-(\d+)/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/chapter-(\d+)/)?.[1] || '0', 10);
        return numA - numB;
      });

    const filePath = yield* select({
      message: 'Which reading would you like to revise?',
      choices: readingFiles.map((file) => ({
        title: file,
        value: path.join(outputDir, file),
      })),
      maxPerPage: 10,
    });

    const reading = yield* fs
      .readFile(filePath)
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    // Determine which prompt to use based on file type
    const isSlides = filePath.includes('-slides');
    const isSpeakerNotes = filePath.includes('-speaker-notes');
    const promptFile = isSpeakerNotes
      ? 'generate-speaker-notes.md'
      : isSlides
        ? 'generate-slides.md'
        : 'generate-study.md';

    const systemPrompt = yield* fs
      .readFile(
        path.join(process.cwd(), 'core', 'readings', 'prompts', promptFile),
      )
      .pipe(Effect.map((i) => new TextDecoder().decode(i)));

    const revisedReading = yield* revise({
      cycles: [
        {
          prompt: '',
          response: reading,
        },
      ],
      systemPrompt,
    }).pipe(Effect.provideService(Model, args.model));

    if (Option.isNone(revisedReading)) {
      return;
    }

    yield* fs.writeFile(
      filePath,
      new TextEncoder().encode(revisedReading.value),
    );

    yield* Effect.log(`Reading revised successfully!`);
  }),
);

export const readings = Command.make('readings').pipe(
  Command.withSubcommands([processChapters, reviseReading]),
);
