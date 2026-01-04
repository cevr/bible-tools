# Bible Tools CLI Command Reference

## Command Structure

```
bible-tools <command> <subcommand> [options]
```

## Messages Command

### `messages generate`
Generate a new sermon message on a given topic.

```bash
bible-tools messages generate --topic "Topic text" [--model gemini|openai|anthropic]
```

**Options:**
- `--topic, -t` (required): The topic for the message
- `--model, -m` (optional): AI model provider to use

**Output:** Creates `outputs/messages/YYYY-MM-DD-slug.md`

### `messages revise`
Revise an existing message with specific instructions.

```bash
bible-tools messages revise --file <path> --instructions "Revision text" [--model]
```

**Options:**
- `--file, -f` (required): Path to the message file
- `--instructions, -i` (required): Revision instructions
- `--model, -m` (optional): AI model provider

### `messages list`
List all existing messages.

```bash
bible-tools messages list [--json]
```

**Options:**
- `--json`: Output as JSON array of paths

### `messages from-note`
Generate a message from an Apple Note.

```bash
bible-tools messages from-note --note-id <id> [--model]
```

**Options:**
- `--note-id, -n` (required): Apple Note ID
- `--model, -m` (optional): AI model provider

### `messages generate-topic`
Auto-generate a topic suggestion based on previous messages.

```bash
bible-tools messages generate-topic [--model]
```

## Sabbath School Command

### `sabbath-school process`
Download and process Sabbath School lesson.

```bash
bible-tools sabbath-school process --year 2025 --quarter 2 [--week 5] [--model]
```

**Options:**
- `--year, -y` (required): Year (e.g., 2025)
- `--quarter, -q` (required): Quarter (1-4)
- `--week, -w` (optional): Specific week (1-13), or processes current week
- `--model, -m` (optional): AI model provider

**Output:** Creates `outputs/sabbath-school/YYYY-QX-WY.md`

### `sabbath-school revise`
Revise Sabbath School outline.

```bash
bible-tools sabbath-school revise --year 2025 --quarter 2 --week 5 [--model]
```

### `sabbath-school export`
Export Sabbath School outline to Apple Notes.

```bash
bible-tools sabbath-school export --year 2025 --quarter 2 [--week 5]
```

## Studies Command

### `studies generate`
Generate a new Bible study on a given topic.

```bash
bible-tools studies generate --topic "Topic text" [--model]
```

**Options:**
- `--topic, -t` (required): The study topic
- `--model, -m` (optional): AI model provider

**Output:** Creates `outputs/studies/YYYY-MM-DD-slug.md`

### `studies revise`
Revise an existing study.

```bash
bible-tools studies revise --file <path> --instructions "Revision text" [--model]
```

**Options:**
- `--file, -f` (required): Path to the study file
- `--instructions, -i` (required): Revision instructions

### `studies list`
List all existing studies.

```bash
bible-tools studies list [--json]
```

### `studies from-note`
Generate a study from an Apple Note.

```bash
bible-tools studies from-note --note-id <id> [--model]
```

## Readings Command

### `readings process`
Process chapter readings.

```bash
bible-tools readings process [chapter] [--target study|slides|speaker-notes] [--model]
```

**Options:**
- `chapter` (optional): Specific chapter number
- `--target, -t` (optional): Target output types (can be repeated)
- `--model, -m` (optional): AI model provider

### `readings revise`
Revise a reading file.

```bash
bible-tools readings revise --file <path> --instructions "text" [--model]
```

### `readings list`
List all readings.

```bash
bible-tools readings list [--json]
```

## Export Command

### `export`
Export files to Apple Notes.

```bash
bible-tools export --files <path1> --files <path2> ...
```

**Options:**
- `--files, -f` (required, repeatable): Files to export

## Model Options

Available model providers (via `--model` flag):
- `gemini` - Google Gemini
- `openai` - OpenAI GPT
- `anthropic` - Anthropic Claude
- `groq` - Groq

Models are configured via environment variables:
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GROQ_API_KEY`

## Output Directory Structure

```
projects/cli/outputs/
├── messages/
│   └── 2025-01-04-hope-in-christ.md
├── sabbath-school/
│   └── 2025-Q2-W5.md
├── studies/
│   └── 2025-01-04-faith-and-works.md
└── readings/
    ├── chapter-1-study.md
    ├── chapter-1-slides.md
    └── chapter-1-speaker-notes.md
```
