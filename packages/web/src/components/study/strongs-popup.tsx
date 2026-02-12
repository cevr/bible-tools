import { useState, useEffect } from 'react';
import { useApp } from '@/providers/db-provider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { StrongsEntry } from '@/data/study/service';

export interface StrongsPopupProps {
  strongsNumber: string | null;
  onClose: () => void;
}

export function StrongsPopup({ strongsNumber, onClose }: StrongsPopupProps) {
  const app = useApp();
  const [entry, setEntry] = useState<StrongsEntry | null>(null);
  const [loading, setLoading] = useState(false);

  const isOpen = strongsNumber !== null;

  useEffect(() => {
    if (!strongsNumber) {
      setEntry(null);
      return;
    }
    setLoading(true);
    app.getStrongsEntry(strongsNumber).then((e) => {
      setEntry(e);
      setLoading(false);
    });
  }, [strongsNumber, app]);

  const languageColor = (lang: 'hebrew' | 'greek') =>
    lang === 'hebrew'
      ? 'text-[--color-strongs-hebrew] dark:text-[--color-strongs-hebrew-dark]'
      : 'text-[--color-strongs-greek] dark:text-[--color-strongs-greek-dark]';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-[480px] rounded-xl bg-[--color-paper] dark:bg-[--color-paper-dark] border border-[--color-border] dark:border-[--color-border-dark] overflow-hidden"
        showCloseButton={false}
      >
        {loading ? (
          <div className="p-6 text-center text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            Loading...
          </div>
        ) : !entry ? (
          <div className="p-6 text-center text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
            No entry found
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="flex items-baseline gap-3">
              <span className={`font-mono text-lg font-bold ${languageColor(entry.language)}`}>
                {entry.number}
              </span>
              <span className="font-serif text-xl text-[--color-ink] dark:text-[--color-ink-dark]">
                {entry.lemma}
              </span>
            </div>

            {(entry.transliteration || entry.pronunciation) && (
              <div className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                {entry.transliteration && (
                  <span className="font-serif italic">{entry.transliteration}</span>
                )}
                {entry.pronunciation && <span className="ml-2">({entry.pronunciation})</span>}
              </div>
            )}

            <div className="border-t border-[--color-border] dark:border-[--color-border-dark] pt-3">
              <p className="text-sm text-[--color-ink] dark:text-[--color-ink-dark] leading-relaxed">
                {entry.definition}
              </p>
            </div>

            {entry.kjvDefinition && (
              <div className="text-xs text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                <span className="font-semibold">KJV:</span> {entry.kjvDefinition}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-[--color-border] dark:border-[--color-border-dark] px-5 py-3 flex justify-end">
          <button
            className="px-3 py-1.5 text-sm font-medium text-[--color-accent] dark:text-[--color-accent-dark] hover:bg-[--color-highlight] dark:hover:bg-[--color-highlight-dark] rounded transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
