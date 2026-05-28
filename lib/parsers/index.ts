import type { MenuData } from "@/types";
import { matchesEatoes, parseEatoesUrl } from "./eatoes";

type DomainParser = {
  name: string;
  matches: (url: string) => boolean;
  parse: (url: string) => Promise<MenuData>;
};

const PARSERS: DomainParser[] = [
  { name: "eatoes", matches: matchesEatoes, parse: parseEatoesUrl }
];

export function getKnownDomainParser(url: string): DomainParser | null {
  for (const p of PARSERS) {
    if (p.matches(url)) return p;
  }
  return null;
}
