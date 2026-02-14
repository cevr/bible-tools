import { useEffect } from 'react';
import { usePreferences } from '@/providers/state-provider';

const FONT_FALLBACKS: Record<string, string> = {
  'Crimson Pro': "'Crimson Pro', Georgia, serif",
  Lora: "'Lora', Georgia, serif",
  Literata: "'Literata', Georgia, serif",
  'EB Garamond': "'EB Garamond', Georgia, serif",
  'Source Sans 3': "'Source Sans 3', system-ui, sans-serif",
  Georgia: 'Georgia, serif',
};

export function ReadingStyleProvider() {
  const { preferences } = usePreferences();

  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty(
      '--reading-font-family',
      FONT_FALLBACKS[preferences.fontFamily] ?? `'${preferences.fontFamily}', Georgia, serif`,
    );
    style.setProperty('--reading-font-size', `${preferences.fontSize}px`);
    style.setProperty('--reading-line-height', String(preferences.lineHeight));
    style.setProperty('--reading-letter-spacing', `${preferences.letterSpacing}em`);
  }, [
    preferences.fontFamily,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.letterSpacing,
  ]);

  return null;
}
