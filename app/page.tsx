"use client";

import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { KeySettingsModal } from "@/components/key-settings-modal";
import { ProcessingCanvas } from "@/components/processing-canvas";
import { UploadZone } from "@/components/upload-zone";
import { useMenuStore } from "@/store/useMenuStore";
import type { MenuData } from "@/types";

type RoutePayload =
  | { inputType: "text"; text: string }
  | { inputType: "url"; url: string }
  | { inputType: "image"; imageBase64: string };

const statusTicker = [
  "Reading menu via AI...",
  "Extracting dishes and categories...",
  "Building taste profiles...",
  "Plating your visual feast..."
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      } else {
        reject(new Error("Unable to read file"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const [urlValue, setUrlValue] = useState("");
  const [textValue, setTextValue] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const { keys, setMenu, setSource, isProcessing, setIsProcessing, tickerIndex, setTickerIndex } = useMenuStore();

  const activeStatus = useMemo(() => statusTicker[tickerIndex % statusTicker.length], [tickerIndex]);

  useEffect(() => {
    if (!isProcessing) return;
    const timer = window.setInterval(() => {
      setTickerIndex((tickerIndex + 1) % statusTicker.length);
    }, 1300);

    return () => {
      window.clearInterval(timer);
    };
  }, [isProcessing, setTickerIndex, tickerIndex]);

  async function parseAndRoute(payload: RoutePayload): Promise<void> {
    setErrorText(null);
    setIsProcessing(true);
    setTickerIndex(0);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Provider-OpenAI-Key": keys.openai,
          "X-Provider-Replicate-Key": keys.replicate
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "Unable to parse menu");
      }

      const menu = (await response.json()) as MenuData;
      setMenu(menu);
      if (payload.inputType === "image") {
        setSource({ kind: "image", imageDataUrl: `data:image/jpeg;base64,${payload.imageBase64}` });
      } else if (payload.inputType === "url") {
        setSource({ kind: "url", url: payload.url });
      } else {
        setSource({ kind: "text", text: payload.text });
      }
      router.push("/menu");
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : "Failed to process menu");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => setSettingsOpen(true)}
        className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-2 text-xs font-medium text-ink shadow"
      >
        <Settings className="h-4 w-4" />
        Keys
      </button>

      <section className="fade-rise grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.22em] text-ink/60">Visual menu transformer</p>
            <h1 className="display-font text-6xl leading-[0.92] text-ink sm:text-7xl">VibeMenu</h1>
            <p className="max-w-md text-sm text-ink/80">
              Turn any text-heavy restaurant menu into an instagrammable visual feed before you order.
            </p>
          </div>

          <UploadZone
            onFileSelected={async (file) => {
              const imageBase64 = await fileToBase64(file);
              await parseAndRoute({ inputType: "image", imageBase64 });
            }}
          />
        </div>

        <div className="glass rounded-3xl p-5 shadow-card">
          <label className="mb-3 block text-xs uppercase tracking-[0.2em] text-ink/55">Paste menu URL</label>
          <div className="space-y-3">
            <input
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://restaurant.com/menu"
              className="w-full rounded-2xl border border-ink/15 bg-white/85 px-4 py-3 text-sm outline-none focus:border-coral"
            />
            <button
              type="button"
              onClick={() => parseAndRoute({ inputType: "url", url: urlValue.trim() })}
              disabled={!urlValue.trim() || isProcessing}
              className="w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Parse URL
            </button>
          </div>

          <div className="my-4 h-px bg-ink/10" />

          <label className="mb-3 block text-xs uppercase tracking-[0.2em] text-ink/55">Or paste text directly</label>
          <textarea
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder="Paste menu text here..."
            rows={6}
            className="w-full rounded-2xl border border-ink/15 bg-white/85 px-4 py-3 text-sm outline-none focus:border-coral"
          />
          <button
            type="button"
            onClick={() => parseAndRoute({ inputType: "text", text: textValue.trim() })}
            disabled={!textValue.trim() || isProcessing}
            className="mt-3 w-full rounded-2xl bg-coral px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Visual Menu
          </button>

          {errorText ? <p className="mt-3 text-sm text-red-700">{errorText}</p> : null}
        </div>
      </section>

      <KeySettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {isProcessing ? <ProcessingCanvas statusText={activeStatus} /> : null}
    </main>
  );
}
