"use client";

import { useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileShell } from "./mobile-shell";

interface MobileLayoutSwitchProps {
  desktopShell: ReactNode;
}

export function MobileLayoutSwitch({ desktopShell }: MobileLayoutSwitchProps) {
  const isMobile = useIsMobile();
  const [forceDesktop, setForceDesktop] = useState(false);

  if (isMobile && !forceDesktop) {
    return <MobileShell onRequestDesktop={() => setForceDesktop(true)} />;
  }

  return <>{desktopShell}</>;
}
