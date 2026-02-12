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
    lang === 'hebrew' ? 'text-[--strongs-hebrew]' : 'text-[--strongs-greek]';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-[480px] rounded-xl bg-background border border-border overflow-hidden"
        showCloseButton={false}
      >
        {loading ? (
          <div className="p-6 text-center text-muted-foreground">Loading...</div>
        ) : !entry ? (
          <div className="p-6 text-center text-muted-foreground">No entry found</div>
        ) : (
          <div className="p-5 space-y-3">
            <div className="flex items-baseline gap-3">
              <span className={`font-mono text-lg font-bold ${languageColor(entry.language)}`}>
                {entry.number}
              </span>
              <span className="font-serif text-xl text-foreground">{entry.lemma}</span>
            </div>

            {(entry.transliteration || entry.pronunciation) && (
              <div className="text-sm text-muted-foreground">
                {entry.transliteration && (
                  <span className="font-serif italic">{entry.transliteration}</span>
                )}
                {entry.pronunciation && <span className="ml-2">({entry.pronunciation})</span>}
              </div>
            )}

            <div className="border-t border-border pt-3">
              <p className="text-sm text-foreground leading-relaxed">{entry.definition}</p>
            </div>

            {entry.kjvDefinition && (
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold">KJV:</span> {entry.kjvDefinition}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-border px-5 py-3 flex justify-end">
          <button
            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-accent rounded transition-colors"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
