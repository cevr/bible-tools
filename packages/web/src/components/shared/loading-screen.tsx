interface LoadingScreenProps {
  stage: string;
  progress: number;
  error: string | null;
  onRetry: () => void;
}

export function LoadingScreen({ stage, progress, error, onRetry }: LoadingScreenProps) {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="w-80 space-y-4 text-center">
        {error ? (
          <>
            <div className="text-red-600 dark:text-red-400 text-lg font-medium">
              Failed to initialize
            </div>
            <p className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
              {error}
            </p>
            <button
              className="px-4 py-2 rounded-lg bg-[--color-accent] dark:bg-[--color-accent-dark] text-white font-medium hover:opacity-90 transition-opacity"
              onClick={onRetry}
            >
              Retry
            </button>
          </>
        ) : (
          <>
            <div className="text-[--color-ink] dark:text-[--color-ink-dark] text-lg font-medium">
              {stage}
            </div>
            {progress > 0 && progress < 100 ? (
              <>
                <div className="w-full bg-[--color-border] dark:bg-[--color-border-dark] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[--color-accent] dark:bg-[--color-accent-dark] h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-sm text-[--color-ink-muted] dark:text-[--color-ink-muted-dark]">
                  {progress}%
                </div>
              </>
            ) : (
              <div className="text-[--color-ink-muted] dark:text-[--color-ink-muted-dark] animate-pulse">
                Loading...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
