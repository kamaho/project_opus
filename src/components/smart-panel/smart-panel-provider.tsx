"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const PINNED_STORAGE_KEY = "smart-panel-pinned";
import { SmartPanel } from "./smart-panel";
import { Info } from "lucide-react";
import {
  DesignPanelContent,
  SmartPanelInnstillingerSection,
  SmartPanelSectionLabel,
  SmartPanelTipsSection,
  SmartPanelTutorialSection,
} from "./smart-panel-standard";
import { useTutorialMode } from "@/contexts/tutorial-mode-context";

interface PageElement {
  name: string;
  description: string;
}

/** Path pattern (prefix match) -> page elements. First match wins. */
const PAGE_ELEMENTS_BY_PATH: { pattern: string; elements: PageElement[] }[] = [
  {
    pattern: "/dashboard/matching-rules",
    elements: [
      { name: "Regelliste", description: "Viser alle matching-regler. Klikk for å redigere eller opprette ny regel." },
      { name: "Ny regel", description: "Oppretter en ny regel for Smart Match (1-til-1 eller mange-til-1)." },
      { name: "Prioritet", description: "Rekkefølgen avgjør hvilke regler som kjører først ved automatisk matching." },
    ],
  },
  {
    pattern: "/dashboard/mva-avstemming",
    elements: [
      { name: "Periode og klient", description: "Velg hvilken periode og klient du vil avstemme MVA for." },
      { name: "Avstemmingsvisning", description: "Sammenligner MVA i regnskapet med MVA-melding fra Altinn og viser avvik." },
    ],
  },
  {
    pattern: "/dashboard/settings",
    elements: [
      { name: "Profil", description: "Din brukerprofil og innstillinger knyttet til kontoen." },
      { name: "Utseende", description: "Tallformat, datoformat, språk og tabellvisning (skillelinjer m.m.)." },
      { name: "Organisasjon", description: "Organisasjonsdetaljer og invitasjon av flere brukere." },
    ],
  },
  {
    pattern: "/dashboard/clients",
    elements: [
      { name: "Klientliste", description: "Oversikt over alle avstemminger/klienter. Klikk på en klient for å åpne den." },
      { name: "Matching / Import", description: "Gå til bankavstemming, import av transaksjoner eller Smart Match for valgt klient." },
      { name: "Header og filtrering", description: "Søk og filtre klienter, eller opprett ny avstemming." },
    ],
  },
  {
    pattern: "/dashboard",
    elements: [
      { name: "Sidemeny", description: "Naviger til Dashboard, Avstemminger, Matching-regler, MVA-avstemming eller Innstillinger." },
      { name: "Oversikt / kort", description: "Snarveier, frister og status for avstemminger." },
      { name: "Header", description: "Breadcrumbs og notifikasjoner." },
    ],
  },
];

function getPageElementsForPath(pathname: string): PageElement[] {
  const normalized = pathname ?? "";
  for (const { pattern, elements } of PAGE_ELEMENTS_BY_PATH) {
    if (normalized === pattern || normalized.startsWith(pattern + "/")) {
      return elements;
    }
  }
  return [
    { name: "Sidemeny", description: "Hovednavigasjon til ulike deler av Revizo." },
    { name: "Innhold", description: "Hovedinnholdet for den siden du er på." },
  ];
}

interface SmartPanelContextValue {
  isGlobalPanelOpen: boolean;
}

const SmartPanelContext = createContext<SmartPanelContextValue>({
  isGlobalPanelOpen: false,
});

export function useGlobalSmartPanel() {
  return useContext(SmartPanelContext);
}

function getElementDescription(target: EventTarget | null): string | null {
  let el = target as HTMLElement | null;

  while (el) {
    const info = el.getAttribute("data-smart-info");
    if (info) return info;
    el = el.parentElement;
  }

  el = target as HTMLElement | null;
  while (el) {
    const tag = el.tagName?.toUpperCase();
    const role = el.getAttribute("role");
    const isInteractive =
      ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(tag) ||
      ["button", "tab", "checkbox", "switch", "link", "menuitem"].includes(role ?? "");

    if (isInteractive) {
      const title = el.getAttribute("title");
      if (title) return title;

      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel) return ariaLabel;

      const text = el.textContent?.trim();
      if (text && text.length > 0 && text.length < 80) {
        if (tag === "BUTTON" || role === "button") return `Knapp: ${text}`;
        if (tag === "A" || role === "link") return `Lenke: ${text}`;
        if (tag === "INPUT") {
          const placeholder = el.getAttribute("placeholder");
          return placeholder ? `Inndatafelt: ${placeholder}` : "Inndatafelt";
        }
        return text;
      }
    }

    el = el.parentElement;
  }

  return null;
}

export function SmartPanelProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { enabled: tutorialMode } = useTutorialMode();
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [description, setDescription] = useState<string | null>(null);
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PINNED_STORAGE_KEY);
      if (stored !== null) setPinned(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const handlePinChange = useCallback((next: boolean) => {
    setPinned(next);
    try {
      sessionStorage.setItem(PINNED_STORAGE_KEY, String(next));
    } catch {
      // ignore
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const desc = getElementDescription(e.target);
    setDescription(desc);
    // Re-activate panel on every right-click so user can click different elements without closing first
    if (typeof window !== "undefined") {
      const panelWidth = 320;
      const panelHeightEstimate = 400;
      setPos({
        x: Math.max(8, (window.innerWidth - panelWidth) / 2),
        y: Math.max(8, (window.innerHeight - panelHeightEstimate) / 2),
      });
    } else {
      setPos({ x: 0, y: 0 });
    }
    setOpen(true);
    setActiveOptionId(null);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setDescription(null);
    setActiveOptionId(null);
  }, []);

  const handleOptionSelect = useCallback((optionId: string) => {
    setActiveOptionId(optionId || null);
  }, []);

  const pageElements = getPageElementsForPath(pathname ?? "");
  const tutorialContent = (
    <div className="p-3">
      <SmartPanelSectionLabel>Elementer på denne siden</SmartPanelSectionLabel>
      <ul className="space-y-2.5 mt-2 px-3">
        {pageElements.map((el, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium text-foreground">{el.name}</span>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">{el.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );

  const resultContent =
    activeOptionId === "design" ? (
      <DesignPanelContent />
    ) : description ? (
      <div className="p-3">
        <SmartPanelSectionLabel>Om elementet</SmartPanelSectionLabel>
        <div className="flex items-start gap-2.5 mt-2">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{description}</p>
        </div>
      </div>
    ) : tutorialMode ? (
      tutorialContent
    ) : (
      <div className="p-3">
        <SmartPanelSectionLabel>Smarte funksjonaliteter</SmartPanelSectionLabel>
        <p className="text-sm text-muted-foreground mt-2">
          Høyreklikk på et element for å lese mer om det, eller bruk Assistent-fanen nedenfor.
        </p>
      </div>
    );

  const sectionAboveFooter = (
    <SmartPanelInnstillingerSection
      isActive={activeOptionId === "design"}
      onToggle={() =>
        activeOptionId === "design" ? handleOptionSelect("") : handleOptionSelect("design")
      }
    />
  );

  return (
    <SmartPanelContext.Provider value={{ isGlobalPanelOpen: open }}>
      {/* Capture phase so right-click anywhere opens smart panel before other handlers (e.g. table cell) or browser menu */}
      <div onContextMenuCapture={handleContextMenu} className="contents">
        {children}
      </div>
      <SmartPanel
        open={open}
        onClose={handleClose}
        position={pos}
        title={activeOptionId === "design" ? "Design" : "Smarte funksjonaliteter"}
        options={[]}
        onOptionSelect={handleOptionSelect}
        activeOptionId={activeOptionId}
        resultContent={resultContent}
        sectionAboveFooter={sectionAboveFooter}
        footerContent={
          <>
            <SmartPanelTipsSection />
            <div className="border-t" />
            <SmartPanelTutorialSection />
          </>
        }
        useStandardLayout
        pinned={pinned}
        onPinChange={handlePinChange}
      />
    </SmartPanelContext.Provider>
  );
}
