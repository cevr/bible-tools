import { Cause, Inspectable, Logger } from 'effect';

type LevelStyle = {
  label: string;
  prefix: string;
  color: string;
};

type LogLevelTag = 'None' | 'All' | 'Trace' | 'Debug' | 'Info' | 'Warning' | 'Error' | 'Fatal';

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
} as const;

const hasProcess = typeof process === 'object' && process !== null;
const hasStdout = hasProcess && typeof process.stdout === 'object' && process.stdout !== null;
const isTty = hasStdout && process.stdout.isTTY === true;
const hasEnv = hasProcess && typeof process.env === 'object' && process.env !== null;
const noColor = hasEnv && 'NO_COLOR' in process.env;
const colorsEnabled = isTty && !noColor;

const colorize = (text: string, color: string) =>
  colorsEnabled ? `${color}${text}${ANSI.reset}` : text;
const dim = (text: string) => (colorsEnabled ? `${ANSI.dim}${text}${ANSI.reset}` : text);

const levelStyles = {
  None: { label: 'log', prefix: '-', color: ANSI.gray },
  All: { label: 'log', prefix: '-', color: ANSI.gray },
  Trace: { label: 'trace', prefix: '.', color: ANSI.gray },
  Debug: { label: 'debug', prefix: '.', color: ANSI.blue },
  Info: { label: 'info', prefix: '>', color: ANSI.cyan },
  Warning: { label: 'warn', prefix: '!', color: ANSI.yellow },
  Error: { label: 'error', prefix: 'x', color: ANSI.red },
  Fatal: { label: 'fatal', prefix: 'x', color: ANSI.red },
} satisfies Record<LogLevelTag, LevelStyle>;

const toMessages = (message: unknown): ReadonlyArray<unknown> =>
  Array.isArray(message) ? message : [message];

const formatValue = (value: unknown): string =>
  typeof value === 'string' ? value : Inspectable.toStringUnknown(value, 0);

const formatMessages = (messages: ReadonlyArray<unknown>): string =>
  messages.map(formatValue).join(' ');

const formatAnnotations = (annotations: Iterable<[string, unknown]>): string => {
  const entries: string[] = [];
  for (const [key, value] of annotations) {
    entries.push(`${key}=${formatValue(value)}`);
  }
  return entries.length > 0 ? `(${entries.join(' ')})` : '';
};

const isJsonLike = (value: string): boolean => {
  const trimmed = value.trim();
  if (trimmed.length < 2) return false;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if (!((first === '{' && last === '}') || (first === '[' && last === ']'))) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};

const shouldRenderRaw = (
  logLevel: { _tag: LogLevelTag },
  messages: ReadonlyArray<unknown>,
  annotationsText: string,
  cause: Cause.Cause<unknown>,
): boolean => {
  if (messages.length !== 1) return false;

  const message = messages[0];
  if (typeof message !== 'string') return false;
  if (message.trim().length === 0) return true;
  if (/^\s/.test(message)) return logLevel._tag === 'Info';

  if (annotationsText.length > 0 || !Cause.isEmpty(cause)) return false;
  if (logLevel._tag !== 'Info') return false;

  return isJsonLike(message);
};

const cliLogger = Logger.make<unknown, string>(({ annotations, cause, logLevel, message }) => {
  const messages = toMessages(message);
  const annotationsText = formatAnnotations(annotations);

  if (shouldRenderRaw(logLevel, messages, annotationsText, cause)) {
    return String(messages[0] ?? '');
  }

  const style = levelStyles[logLevel._tag] ?? levelStyles.Info;
  const prefix = colorsEnabled ? colorize(style.prefix, style.color) : `[${style.label}]`;
  const formattedMessage = formatMessages(messages);

  const parts: string[] = [];
  parts.push(`${prefix} ${formattedMessage}`);

  if (annotationsText.length > 0) {
    parts.push(dim(annotationsText));
  }

  let out = parts.join(' ');

  if (!Cause.isEmpty(cause)) {
    const causeText = Cause.pretty(cause, { renderErrorCause: true });
    out += `\n${dim(causeText)}`;
  }

  return out;
});

export const CliLoggerLive = Logger.replace(
  Logger.defaultLogger,
  Logger.withLeveledConsole(cliLogger),
);
