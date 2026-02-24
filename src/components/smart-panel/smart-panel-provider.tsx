"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const PINNED_STORAGE_KEY = "smart-panel-pinned";
import { SmartPanel } from "./smart-panel";
import { Info } from "lucide-react";
import {
  DesignPanelContent,
  SmartPanelInnstillingerSection,
  SmartPanelSectionLabel,
  SmartPanelTipsSection,
} from "./smart-panel-standard";

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
    const desc = getElementDescription(e.target);
    if (!desc) return;

    e.preventDefault();
    setDescription(desc);
    setPos({ x: e.clientX, y: e.clientY });
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
    ) : undefined;

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
      <div onContextMenu={handleContextMenu} className="contents">
        {children}
      </div>
      <SmartPanel
        open={open}
        onClose={handleClose}
        position={pos}
        title={activeOptionId === "design" ? "Design" : "Smart panel"}
        options={[]}
        onOptionSelect={handleOptionSelect}
        activeOptionId={activeOptionId}
        resultContent={resultContent}
        sectionAboveFooter={sectionAboveFooter}
        footerContent={<SmartPanelTipsSection />}
        useStandardLayout
        pinned={pinned}
        onPinChange={handlePinChange}
      />
    </SmartPanelContext.Provider>
  );
}
