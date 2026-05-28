"use client";

import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";

type UploadZoneProps = {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
};

export function UploadZone({ onFileSelected, disabled = false }: UploadZoneProps): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/90 px-6 py-5 text-left shadow-card transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-coral/25 to-saffron/20 opacity-0 transition group-hover:opacity-100" />
        <div className="relative flex items-center gap-4">
          <span className="rounded-2xl bg-ink p-3 text-white">
            <Camera className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold text-ink">SNAP MENU</p>
            <p className="text-sm text-ink/70">Open camera or upload a photo/PDF screenshot</p>
          </div>
        </div>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl border border-dashed border-ink/35 bg-white/55 px-4 py-3 text-sm text-ink/80 transition hover:bg-white/80 disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-2">
          <ImagePlus className="h-4 w-4" />
          Choose from gallery
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label="Upload menu image"
        accept="image/*"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onFileSelected(file);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
