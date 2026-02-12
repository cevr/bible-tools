/**
 * DB Provider — Top-level provider that initializes SQLite.
 *
 * Blocks rendering until wa-sqlite databases are ready.
 * Shows loading/download progress during first visit.
 */
import {
  createContext,
  useContext,
  type ParentComponent,
  createSignal,
  onMount,
  Show,
} from 'solid-js';
import { getDbClient, type DbClient } from '@/workers/db-client';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { createSyncService } from '@/data/sync/service';

const DbContext = createContext<DbClient>();

export const DbProvider: ParentComponent = (props) => {
  const [ready, setReady] = createSignal(false);
  const [stage, setStage] = createSignal('Initializing...');
  const [progress, setProgress] = createSignal(0);
  const [error, setError] = createSignal<string | null>(null);

  const client = getDbClient();

  async function initialize() {
    setReady(false);
    setError(null);
    setStage('Initializing...');
    setProgress(0);

    client.onProgress((s, p) => {
      setStage(s);
      setProgress(p);
    });

    try {
      await client.init();
      const sync = createSyncService(client);
      sync.start();
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  onMount(() => {
    void initialize();
  });

  return (
    <Show
      when={ready()}
      fallback={
        <LoadingScreen
          stage={stage()}
          progress={progress()}
          error={error()}
          onRetry={() => {
            // Can't re-init same worker easily, but retry will reload page
            window.location.reload();
          }}
        />
      }
    >
      <DbContext.Provider value={client}>{props.children}</DbContext.Provider>
    </Show>
  );
};

export function useDb(): DbClient {
  const ctx = useContext(DbContext);
  if (!ctx) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return ctx;
}
