"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Dish, MenuData } from "@/types";

type AppKeys = {
  openai: string;
  replicate: string;
};

type ImageQueueStatus = "pending" | "in-progress" | "done" | "error";

export type ImageQueueEntry = {
  dishId: string;
  dishName: string;
  status: ImageQueueStatus;
  error?: string;
};

export type SourceKind = "text" | "url" | "image";

export type MenuSource = {
  kind: SourceKind;
  text?: string;
  url?: string;
  imageDataUrl?: string;
};

type MenuState = {
  keys: AppKeys;
  saveToDevice: boolean;
  menu: MenuData | null;
  source: MenuSource | null;
  isProcessing: boolean;
  tickerIndex: number;
  selectedDishId: string | null;
  imageQueue: ImageQueueEntry[];
  setKeys: (keys: Partial<AppKeys>) => void;
  setSaveToDevice: (save: boolean) => void;
  setMenu: (menu: MenuData | null) => void;
  setSource: (source: MenuSource | null) => void;
  setIsProcessing: (flag: boolean) => void;
  setTickerIndex: (index: number) => void;
  setSelectedDishId: (dishId: string | null) => void;
  patchDish: (dishId: string, patch: Partial<Dish>) => void;
  setImageQueue: (queue: ImageQueueEntry[]) => void;
  updateQueueEntry: (dishId: string, patch: Partial<ImageQueueEntry>) => void;
  clearAll: () => void;
};

const initialKeys: AppKeys = {
  openai: "",
  replicate: ""
};

export const useMenuStore = create<MenuState>()(
  persist(
    (set) => ({
      keys: initialKeys,
      saveToDevice: true,
      menu: null,
      source: null,
      isProcessing: false,
      tickerIndex: 0,
      selectedDishId: null,
      imageQueue: [],
      setKeys: (keys) => set((state) => ({ keys: { ...state.keys, ...keys } })),
      setSaveToDevice: (saveToDevice) => set({ saveToDevice }),
      setMenu: (menu) => set({ menu }),
      setSource: (source) => set({ source }),
      setIsProcessing: (isProcessing) => set({ isProcessing }),
      setTickerIndex: (tickerIndex) => set({ tickerIndex }),
      setSelectedDishId: (selectedDishId) => set({ selectedDishId }),
      patchDish: (dishId, patch) =>
        set((state) => {
          if (!state.menu) return state;
          return {
            menu: {
              ...state.menu,
              dishes: state.menu.dishes.map((dish) => (dish.id === dishId ? { ...dish, ...patch } : dish))
            }
          };
        }),
      setImageQueue: (imageQueue) => set({ imageQueue }),
      updateQueueEntry: (dishId, patch) =>
        set((state) => ({
          imageQueue: state.imageQueue.map((entry) => (entry.dishId === dishId ? { ...entry, ...patch } : entry))
        })),
      clearAll: () =>
        set({
          keys: initialKeys,
          menu: null,
          source: null,
          isProcessing: false,
          tickerIndex: 0,
          selectedDishId: null,
          imageQueue: []
        })
    }),
    {
      name: "vibemenu-store",
      // Only persist lightweight preferences. Menu data (with base64 images) stays in memory
      // to avoid exceeding the ~5MB localStorage quota.
      partialize: (state) => ({
        saveToDevice: state.saveToDevice,
        keys: state.saveToDevice ? state.keys : initialKeys
      })
    }
  )
);
