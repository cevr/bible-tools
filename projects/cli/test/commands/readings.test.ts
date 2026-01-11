import { describe, expect, beforeEach, it } from 'vitest';

import { readings } from '../../core/readings/readings.js';
import {
  runCli,
  expectSequence,
  expectContains,
  expectCallCount,
  expectNoCalls,
} from '../lib/run-cli.js';

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
              [`${process.cwd()}/core/readings/prompts/generate-study.md`]:
                'Study prompt...',
            },
          },
          model: {
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
        { _tag: 'Model.generateText' }, // revise
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
              [`${process.cwd()}/core/readings/prompts/generate-slides.md`]:
                'Slides prompt...',
            },
          },
          model: {
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
        { _tag: 'Model.generateText' },
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
              '/path/to/chapter-1-speaker-notes.md':
                '# Original Notes\n\nContent...',
              [`${process.cwd()}/core/readings/prompts/generate-speaker-notes.md`]:
                'Speaker notes prompt...',
            },
          },
          model: {
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
        { _tag: 'Model.generateText' },
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
              [`${process.cwd()}/core/readings/prompts/generate-study.md`]:
                'Prompt...',
            },
          },
          model: {
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
