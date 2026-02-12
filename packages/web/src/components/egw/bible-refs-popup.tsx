/**
 * Bible references popup for EGW paragraphs.
 *
 * Extracts Bible references from paragraph text using @bible/core's parser,
 * then displays them as clickable links that navigate to the Bible reader.
 */
import { useNavigate } from 'react-router';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  extractBibleReferences,
  getBibleBook,
  formatBibleReference,
} from '@bible/core/bible-reader';

export interface BibleRefsPopupProps {
  /** Raw HTML/text content of the selected paragraph */
  content: string | null;
  /** Refcode label shown in the popup header (e.g. "PP 351.1") */
  refcode: string | null;
  open: boolean;
  onClose: () => void;
}

export function BibleRefsPopup({ content, refcode, open, onClose }: BibleRefsPopupProps) {
  const navigate = useNavigate();

  const refs = (() => {
    if (!content) return [];
    const plain = content.replace(/<[^>]*>/g, '');
    return extractBibleReferences(plain);
  })();

  const handleRefClick = (ref: { book: number; chapter: number; verse?: number }) => {
    const book = getBibleBook(ref.book);
    if (!book) return;
    const slug = book.name.toLowerCase().replace(/\s+/g, '-');
    const path = ref.verse
      ? `/bible/${slug}/${ref.chapter}/${ref.verse}`
      : `/bible/${slug}/${ref.chapter}`;
    onClose();
    navigate(path);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="top-1/4 translate-y-0 p-0 gap-0 w-full max-w-[420px] rounded-xl bg-background border border-border overflow-hidden"
        showCloseButton={false}
      >
        <div className="p-5 space-y-3">
          <h2 className="font-sans text-lg font-semibold text-foreground">Bible References</h2>

          {refcode && <p className="text-sm text-muted-foreground">Found in {refcode}</p>}

          {refs.length > 0 ? (
            <div className="border-t border-border pt-3 space-y-1">
              {refs.map((extracted, i) => (
                <button
                  key={i}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent text-primary font-medium"
                  onClick={() => handleRefClick(extracted.ref)}
                >
                  {formatBibleReference(extracted.ref)}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No Bible references found in this paragraph.
            </p>
          )}
        </div>

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
