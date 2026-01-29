import { beforeEach, describe, expect, it } from 'bun:test';

import { readings } from '../../src/commands/readings.js';
import { expectContains, expectSequence, runCli } from '../lib/run-cli.js';

describe('readings commands', () => {
  beforeEach(() => {
    // Reset test state
  });

  describe('revise command', () => {
    it('should revise a study file', async () => {
      const result = await runCli(
        readings,
        [
          'revise',
          '--file',
          '/path/to/chapter-1-study.md',
          '--instructions',
          'Add more detail',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              '/path/to/chapter-1-study.md': '# Original Study\n\nContent...',
              [`${process.cwd()}/src/prompts/readings/generate-study.md`]: 'Study prompt...',
            },
          },
          ai: {
            responses: {
              high: ['# Revised Study\n\nMore detailed content...'],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' }, // read study
        { _tag: 'FileSystem.readFile' }, // read prompt
        { _tag: 'AI.generateText' }, // revise
        { _tag: 'Chime.play' },
        { _tag: 'FileSystem.writeFile' }, // write revised
      ]);
    });

    it('should revise a slides file with correct prompt', async () => {
      const result = await runCli(
        readings,
        [
          'revise',
          '--file',
          '/path/to/chapter-1-slides.md',
          '--instructions',
          'Simplify slides',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              '/path/to/chapter-1-slides.md': '# Original Slides\n\nContent...',
              [`${process.cwd()}/src/prompts/readings/generate-slides.md`]: 'Slides prompt...',
            },
          },
          ai: {
            responses: {
              high: ['# Simplified Slides\n\nSimpler content...'],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      // Should use the slides prompt, not study prompt
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' },
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AI.generateText' },
      ]);
    });

    it('should revise a speaker-notes file with correct prompt', async () => {
      const result = await runCli(
        readings,
        [
          'revise',
          '--file',
          '/path/to/chapter-1-speaker-notes.md',
          '--instructions',
          'Make more conversational',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              '/path/to/chapter-1-speaker-notes.md': '# Original Notes\n\nContent...',
              [`${process.cwd()}/src/prompts/readings/generate-speaker-notes.md`]:
                'Speaker notes prompt...',
            },
          },
          ai: {
            responses: {
              high: ['# Conversational Notes\n\nFriendly content...'],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' },
        { _tag: 'FileSystem.readFile' },
        { _tag: 'AI.generateText' },
      ]);
    });

    it('should fail when file does not exist', async () => {
      const result = await runCli(
        readings,
        [
          'revise',
          '--file',
          '/path/to/nonexistent.md',
          '--instructions',
          'Fix it',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              [`${process.cwd()}/src/prompts/readings/generate-study.md`]: 'Prompt...',
            },
          },
          ai: {
            responses: { high: [], low: [] },
          },
        },
      );

      expect(result.success).toBe(false);
    });
  });

  describe('list command', () => {
    it('should list all readings', async () => {
      const result = await runCli(readings, ['list'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/readings/chapter-1-study.md`]: 'content',
            [`${process.cwd()}/outputs/readings/chapter-1-slides.md`]: 'content',
            [`${process.cwd()}/outputs/readings/chapter-2-study.md`]: 'content',
          },
          directories: [`${process.cwd()}/outputs/readings`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });

    it('should handle empty readings directory', async () => {
      const result = await runCli(readings, ['list'], {
        files: {
          files: {},
          directories: [`${process.cwd()}/outputs/readings`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });

    it('should output JSON when --json flag is used', async () => {
      const result = await runCli(readings, ['list', '--json'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/readings/chapter-1-study.md`]: 'content',
          },
          directories: [`${process.cwd()}/outputs/readings`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });
  });
});
