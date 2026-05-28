"use client";

type ProcessingCanvasProps = {
  statusText: string;
};

export function ProcessingCanvas({ statusText }: ProcessingCanvasProps): React.ReactElement {
  return (
    <div className="glass fixed inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-ink/70 p-6 text-white">
      <div className="relative flex h-36 w-36 items-center justify-center">
        <div className="absolute h-36 w-36 animate-ping rounded-full border border-coral/60" />
        <div className="h-28 w-28 animate-spin rounded-full border-4 border-transparent border-t-coral border-r-saffron shadow-glow" />
      </div>

      <div className="mx-auto max-w-sm space-y-2 text-center">
        <p className="display-font text-3xl">Crafting Your Visual Feast</p>
        <p className="shimmer rounded-lg px-4 py-2 text-sm text-white/90">{statusText}</p>
      </div>
    </div>
  );
}
