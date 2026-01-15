import { beforeEach, describe, expect, it } from 'vitest';

import { studies } from '../../src/commands/studies.js';
import {
  expectContains,
  expectNoCalls,
  expectSequence,
  runCli,
} from '../lib/run-cli.js';

describe('studies commands', () => {
  beforeEach(() => {
    // Reset test state
  });

  describe('generate command', () => {
    it('should generate a study from topic', async () => {
      const result = await runCli(
        studies,
        ['generate', '--topic', 'The Sanctuary', '--model', 'gemini'],
        {
          files: {
            files: {
              [`${process.cwd()}/src/prompts/studies/generate.md`]:
                'You are a Bible study generator...',
            },
            directories: [],
          },
          model: {
            responses: {
              high: [
                '# The Sanctuary\n\nA comprehensive study on the sanctuary...',
              ],
              low: ['the-sanctuary-study'],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' }, // system prompt
        { _tag: 'Model.generateText', model: 'high' }, // generate content
        { _tag: 'Model.generateText', model: 'low' }, // generate filename
        { _tag: 'Chime.play' }, // done chime
        { _tag: 'FileSystem.makeDirectory' }, // ensure dir exists
        { _tag: 'FileSystem.writeFile' }, // write study
        { _tag: 'AppleScript.exec' }, // export to Apple Notes
      ]);
    });

    it('should create studies directory if it does not exist', async () => {
      const result = await runCli(
        studies,
        ['generate', '--topic', 'Prophecy', '--model', 'gemini'],
        {
          files: {
            files: {
              [`${process.cwd()}/src/prompts/studies/generate.md`]:
                'System prompt...',
            },
            directories: [],
          },
          model: {
            responses: {
              high: ['# Prophecy\n\nContent about prophecy...'],
              low: ['prophecy-study'],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.makeDirectory' },
        { _tag: 'FileSystem.writeFile' },
      ]);
    });
  });

  describe('revise command', () => {
    it('should revise an existing study', async () => {
      const result = await runCli(
        studies,
        [
          'revise',
          '--file',
          '/path/to/study.md',
          '--instructions',
          'Make it more interactive',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              '/path/to/study.md': '# Original Study\n\nOriginal content...',
              [`${process.cwd()}/src/prompts/studies/generate.md`]:
                'System prompt...',
            },
          },
          model: {
            responses: {
              high: [
                '# Interactive Study\n\nImproved content with questions...',
              ],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' }, // read study
        { _tag: 'FileSystem.readFile' }, // read system prompt
        { _tag: 'Model.generateText' }, // revise
        { _tag: 'Chime.play' }, // done chime
        { _tag: 'FileSystem.writeFile' }, // write revised
      ]);
    });

    it('should fail when study file does not exist', async () => {
      const result = await runCli(
        studies,
        [
          'revise',
          '--file',
          '/path/to/nonexistent.md',
          '--instructions',
          'Improve it',
          '--model',
          'gemini',
        ],
        {
          files: {
            files: {
              [`${process.cwd()}/src/prompts/studies/generate.md`]:
                'System prompt...',
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
    it('should list all studies', async () => {
      const result = await runCli(studies, ['list'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/studies/2024-01-01-sanctuary.md`]:
              'content',
            [`${process.cwd()}/outputs/studies/2024-01-02-prophecy.md`]:
              'content',
          },
          directories: [`${process.cwd()}/outputs/studies`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });

    it('should handle empty studies directory', async () => {
      const result = await runCli(studies, ['list'], {
        files: {
          files: {},
          directories: [`${process.cwd()}/outputs/studies`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });

    it('should output JSON when --json flag is used', async () => {
      const result = await runCli(studies, ['list', '--json'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/studies/2024-01-01-study.md`]: 'content',
          },
          directories: [`${process.cwd()}/outputs/studies`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });
  });
});
