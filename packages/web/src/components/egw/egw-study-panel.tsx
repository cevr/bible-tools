/**
 * EGW Study Panel — floating aside for paragraph-level study tools.
 *
 * Same pattern as VerseStudyPanel: fixed right-side panel that slides in.
 * Tabs: References (Bible refs), Details (paragraph metadata).
 */
import { useMemo } from 'react';
import { XIcon } from 'lucide-react';
import { extractBibleReferences, formatBibleReference } from '@bible/core/bible-reader';
import type { EGWParagraph } from '@/data/egw/api';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cleanHtml } from '@/components/egw/page-view';

export interface EgwStudyPanelProps {
  paragraph: EGWParagraph | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefClick: (ref: { book: number; chapter: number; verse?: number }) => void;
}

export function EgwStudyPanel({ paragraph, open, onOpenChange, onRefClick }: EgwStudyPanelProps) {
  const refs = useMemo(() => {
    if (!paragraph?.content) return [];
    return extractBibleReferences(cleanHtml(paragraph.content));
  }, [paragraph?.content]);

  const title = paragraph?.refcodeShort ?? 'Study';

  return (
    <aside
      className={`fixed top-0 right-0 h-dvh sm:w-[28rem] w-[85vw] bg-background border-l border-border shadow-lg flex flex-col z-40 transition-transform duration-200 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <Button variant="ghost" size="icon-sm" onClick={() => onOpenChange(false)}>
          <XIcon />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      <Tabs defaultValue="references" className="flex-1 flex flex-col min-h-0">
        <TabsList variant="line" className="px-4 pt-2 w-full shrink-0">
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="references" className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {refs.length > 0 ? (
                refs.map((extracted, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-accent text-primary font-medium"
                    onClick={() => onRefClick(extracted.ref)}
                  >
                    {formatBibleReference(extracted.ref)}
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  No Bible references found in this paragraph.
                </p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="details" className="flex flex-col flex-1 min-h-0">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {paragraph ? (
                <dl className="space-y-4">
                  {paragraph.refcodeShort && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Refcode
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">{paragraph.refcodeShort}</dd>
                    </div>
                  )}
                  {paragraph.elementType && (
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Element Type
                      </dt>
                      <dd className="mt-1 text-sm text-foreground">{paragraph.elementType}</dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground italic">No paragraph selected.</p>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}
