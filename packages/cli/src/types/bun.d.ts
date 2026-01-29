declare module 'bun' {
  interface BunMarkdown {
    /**
     * Converts markdown to HTML string.
     */
    html(content: string): string;
  }

  const markdown: BunMarkdown;
}
