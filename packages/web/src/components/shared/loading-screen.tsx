import { type Component, Show } from 'solid-js';

interface LoadingScreenProps {
  stage: string;
  progress: number;
  error: string | null;
  onRetry: () => void;
}

export const LoadingScreen: Component<LoadingScreenProps> = (props) => {
  return (
    <div class="flex h-screen w-full items-center justify-center">
      <div class="w-80 space-y-4 text-center">
        <Show
          when={!props.error}
          fallback={<ErrorState error={props.error ?? ''} onRetry={props.onRetry} />}
        >
          <div class="text-[--color-ink] dark:text-[--color-ink-dark] text-lg font-medium">
            {props.stage}
          </div>
          <Show when={props.progress > 0 && props.progress < 100}>
            <div class="w-full bg-[--color-border] dark:bg-[--color-border-dark] rounded-full h-2 overflow-hidden">
              <div
                class="bg-[--color-accent] dark:bg-[--color-accent-dark] h-full rounded-full transition-[width] duration-300"
                style={{ width: `${props.progress}%` }}
              />
            </div>
            <div class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              {props.progress}%
            </div>
          </Show>
          <Show when={props.progress === 0 || props.progress >= 100}>
            <div class="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] animate-pulse">
              Loading...
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
};

const ErrorState: Component<{ error: string; onRetry: () => void }> = (props) => {
  return (
    <>
      <div class="text-red-600 dark:text-red-400 text-lg font-medium">Failed to initialize</div>
      <p class="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
        {props.error}
      </p>
      <button
        class="px-4 py-2 rounded-lg bg-[--color-accent] dark:bg-[--color-accent-dark] text-white font-medium hover:opacity-90 transition-opacity"
        onClick={props.onRetry}
      >
        Retry
      </button>
    </>
  );
};
