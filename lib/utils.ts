import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function keyLooksValid(key: string): boolean {
  return key.trim().startsWith("sk-") && key.trim().length > 20;
}
