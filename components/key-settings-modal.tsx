"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck, X } from "lucide-react";

import { keyLooksValid } from "@/lib/utils";
import { useMenuStore } from "@/store/useMenuStore";

type KeySettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

function Dot({ ok }: { ok: boolean }): React.ReactElement {
  return <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-mint" : "bg-red-500"}`} />;
}

export function KeySettingsModal({ open, onClose }: KeySettingsModalProps): React.ReactElement | null {
  const { keys, saveToDevice, setKeys, setSaveToDevice } = useMenuStore();
  const [draftOpenAi, setDraftOpenAi] = useState(keys.openai);
  const [draftReplicate, setDraftReplicate] = useState(keys.replicate);
  const [draftSave, setDraftSave] = useState(saveToDevice);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 px-4">
      <div className="glass fade-rise w-full max-w-lg rounded-3xl p-6 shadow-card">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="display-font text-3xl">BYOK Configurator</p>
            <p className="text-sm text-ink/70">Your keys stay local and are only sent as request headers.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-full border border-ink/20 p-2 text-ink/70 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink/80">OpenAI API Key</span>
            <input
              type="password"
              value={draftOpenAi}
              onChange={(event) => setDraftOpenAi(event.target.value)}
              placeholder="sk-..."
              className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral/60 focus:shadow-[0_0_0_4px_rgba(255,94,77,0.15)]"
            />
            <div className="inline-flex items-center gap-2 text-xs text-ink/70">
              <Dot ok={keyLooksValid(draftOpenAi)} />
              OpenAI key status
            </div>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-ink/80">Replicate Key (optional)</span>
            <input
              type="password"
              value={draftReplicate}
              onChange={(event) => setDraftReplicate(event.target.value)}
              placeholder="r8_..."
              className="w-full rounded-2xl border border-ink/15 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral/60 focus:shadow-[0_0_0_4px_rgba(255,94,77,0.15)]"
            />
            <div className="inline-flex items-center gap-2 text-xs text-ink/70">
              <Dot ok={draftReplicate.length === 0 || draftReplicate.length > 12} />
              Image provider key status
            </div>
          </label>

          <div className="flex items-center justify-between rounded-2xl border border-ink/15 bg-white/70 px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-mint" /> Save to device
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={draftSave ? "true" : "false"}
              aria-label="Toggle save to device"
              onClick={() => setDraftSave((value) => !value)}
              className={`relative h-7 w-12 rounded-full transition ${draftSave ? "bg-mint" : "bg-ink/25"}`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${draftSave ? "left-6" : "left-1"}`}
              />
            </button>
          </div>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3 font-medium text-white transition hover:bg-ink/90"
            onClick={() => {
              setKeys({ openai: draftOpenAi, replicate: draftReplicate });
              setSaveToDevice(draftSave);
              onClose();
            }}
          >
            <KeyRound className="h-4 w-4" />
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
