import type { ContentTypeConfig } from './types';
import {
  MessageFrontmatter,
  StudyFrontmatter,
  ReadingFrontmatter,
  SabbathSchoolFrontmatter,
} from './schemas';

export const MessagesConfig: ContentTypeConfig<typeof MessageFrontmatter> = {
  name: 'messages',
  displayName: 'Message',
  outputDir: 'messages',
  notesFolder: 'messages',
  promptResolver: { _tag: 'single', file: 'generate.md' },
  frontmatterSchema: MessageFrontmatter,
  sortStrategy: { _tag: 'date-desc' },
};

export const StudiesConfig: ContentTypeConfig<typeof StudyFrontmatter> = {
  name: 'studies',
  displayName: 'Study',
  outputDir: 'studies',
  notesFolder: 'studies',
  promptResolver: { _tag: 'single', file: 'generate.md' },
  frontmatterSchema: StudyFrontmatter,
  sortStrategy: { _tag: 'date-desc' },
};

export const ReadingsConfig: ContentTypeConfig<typeof ReadingFrontmatter> = {
  name: 'readings',
  displayName: 'Reading',
  outputDir: 'readings',
  notesFolder: 'readings',
  promptResolver: {
    _tag: 'from-filename',
    patterns: {
      'speaker-notes': 'generate-speaker-notes.md',
      slides: 'generate-slides.md',
      study: 'generate-study.md',
    },
  },
  frontmatterSchema: ReadingFrontmatter,
  sortStrategy: { _tag: 'chapter-asc' },
};

export const SabbathSchoolConfig: ContentTypeConfig<typeof SabbathSchoolFrontmatter> = {
  name: 'sabbath-school',
  displayName: 'Sabbath School',
  outputDir: 'sabbath-school',
  notesFolder: 'sabbath school',
  promptResolver: { _tag: 'single', file: 'outline.md' },
  frontmatterSchema: SabbathSchoolFrontmatter,
  sortStrategy: { _tag: 'year-quarter-week' },
};
