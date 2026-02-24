"use client";

import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function ReportButton({ onClick, disabled, className }: ReportButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn("rpt-btn", className)}
      onClick={onClick}
      data-smart-info="Eksport — generer PDF- eller Excel-rapport for nedlasting."
    >
      <div className="rpt-dots" />
      <Download className="rpt-icon" />
      <span className="rpt-text">Eksport</span>
    </button>
  );
}
