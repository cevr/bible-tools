import { beforeEach, describe, expect, it } from 'vitest';

import { messages } from '../../src/commands/messages.js';
import { expectContains, expectSequence, runCli } from '../lib/run-cli.js';

describe('messages commands', () => {
  beforeEach(() => {
    // Reset test state
  });

  describe('generate command', () => {
    it('should generate a message from topic', async () => {
      const result = await runCli(messages, ['generate', '--topic', 'Faith and Works'], {
        files: {
          files: {
            [`${process.cwd()}/src/prompts/messages/generate.md`]:
              'You are a Bible study assistant...',
          },
          directories: [],
        },
        model: {
          responses: {
            high: ['# Faith and Works\n\nA message about faith and works...'],
            low: ['faith-and-works'],
          },
        },
      });

      expect(result.success).toBe(true);
      // Check all expected calls are present (order varies due to async)
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' }, // system prompt
        { _tag: 'Model.generateText', model: 'high' }, // generate content
        { _tag: 'Model.generateText', model: 'low' }, // generate filename
        { _tag: 'Chime.play' }, // done chime
        { _tag: 'FileSystem.makeDirectory' }, // ensure dir exists
        { _tag: 'FileSystem.writeFile' }, // write message
        { _tag: 'AppleScript.exec' }, // export to Apple Notes
      ]);
    });

    it('should create messages directory if it does not exist', async () => {
      const result = await runCli(messages, ['generate', '--topic', 'Grace'], {
        files: {
          files: {
            [`${process.cwd()}/src/prompts/messages/generate.md`]: 'System prompt...',
          },
          directories: [],
        },
        model: {
          responses: {
            high: ['# Grace\n\nContent about grace...'],
            low: ['grace-message'],
          },
        },
      });

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.makeDirectory' },
        { _tag: 'FileSystem.writeFile' },
      ]);
    });
  });

  describe('revise command', () => {
    it('should revise an existing message', async () => {
      const result = await runCli(
        messages,
        [
          'revise',
          '--file',
          '/path/to/message.md',
          '--instructions',
          'Add more scripture references',
        ],
        {
          files: {
            files: {
              '/path/to/message.md': '# Original Message\n\nOriginal content...',
              [`${process.cwd()}/src/prompts/messages/generate.md`]: 'System prompt...',
            },
          },
          model: {
            responses: {
              high: ['# Revised Message\n\nImproved content with scriptures...'],
              low: [],
            },
          },
        },
      );

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readFile' }, // read message
        { _tag: 'FileSystem.readFile' }, // read system prompt
        { _tag: 'Model.generateText' }, // revise
        { _tag: 'Chime.play' }, // done chime
        { _tag: 'FileSystem.writeFile' }, // write revised
      ]);
    });

    it('should fail when message file does not exist', async () => {
      const result = await runCli(
        messages,
        ['revise', '--file', '/path/to/nonexistent.md', '--instructions', 'Fix it'],
        {
          files: {
            files: {
              [`${process.cwd()}/src/prompts/messages/generate.md`]: 'System prompt...',
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

  describe('generate-topic command', () => {
    it('should generate topic suggestions', async () => {
      const result = await runCli(messages, ['generate-topic'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/messages/2024-01-01-faith.md`]: 'content',
            [`${process.cwd()}/outputs/messages/2024-01-02-hope.md`]: 'content',
          },
          directories: [`${process.cwd()}/outputs/messages`],
        },
        model: {
          responses: {
            high: ['1. The Power of Prayer\n2. Walking in the Spirit\n3. Biblical Stewardship'],
            low: [],
          },
        },
      });

      expect(result.success).toBe(true);
      expectContains(result.calls, [
        { _tag: 'FileSystem.readDirectory' }, // list existing messages
        { _tag: 'Model.generateText' }, // generate topics
      ]);
    });
  });

  describe('list command', () => {
    it('should list all messages', async () => {
      const result = await runCli(messages, ['list'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/messages/2024-01-01-faith.md`]: 'content',
            [`${process.cwd()}/outputs/messages/2024-01-02-hope.md`]: 'content',
            [`${process.cwd()}/outputs/messages/2024-01-03-love.md`]: 'content',
          },
          directories: [`${process.cwd()}/outputs/messages`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });

    it('should handle empty messages directory', async () => {
      const result = await runCli(messages, ['list'], {
        files: {
          files: {},
          directories: [`${process.cwd()}/outputs/messages`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });

    it('should output JSON when --json flag is used', async () => {
      const result = await runCli(messages, ['list', '--json'], {
        files: {
          files: {
            [`${process.cwd()}/outputs/messages/2024-01-01-faith.md`]: 'content',
          },
          directories: [`${process.cwd()}/outputs/messages`],
        },
      });

      expect(result.success).toBe(true);
      expectSequence(result.calls, [{ _tag: 'FileSystem.readDirectory' }]);
    });
  });
});
