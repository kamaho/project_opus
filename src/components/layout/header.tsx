"use client";

import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";

export function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger data-smart-info="Åpne eller lukke sidepanelet med navigasjon." />
      <Separator orientation="vertical" className="h-6" />
      {mounted ? <AppBreadcrumb /> : <div className="flex flex-1 min-w-0" aria-hidden />}
    </header>
  );
}
