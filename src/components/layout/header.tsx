"use client";

import { useEffect, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";

const env = process.env.NEXT_PUBLIC_ENV;
const isNonProd = env && env !== "production";
const envLabel = env === "staging" ? "STAGING" : env === "development" ? "DEV" : env?.toUpperCase();

export function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3">
      <SidebarTrigger data-smart-info="Åpne eller lukke sidepanelet med navigasjon." />
      <Separator orientation="vertical" className="h-6" />
      {mounted ? <AppBreadcrumb /> : <div className="flex flex-1 min-w-0" aria-hidden />}
      {isNonProd && (
        <span className="ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold leading-none tracking-widest text-[oklch(0.72_0.2_142)] ring-1 ring-[oklch(0.72_0.2_142)/40]">
          {envLabel}
        </span>
      )}
    </header>
  );
}
