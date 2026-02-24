"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, CheckCircle2, PartyPopper } from "lucide-react";
import type { AutoMatchStats } from "@/lib/matching/engine";

const SM_GRADIENT =
  "linear-gradient(90deg, oklch(0.52 0.24 285), oklch(0.58 0.22 300), oklch(0.52 0.24 285))";

const PEGTOP_PATH =
  "M63,37c-6.7-4-4-27-13-27s-6.3,23-13,27-27,4-27,13,20.3,9,27,13,4,27,13,27,6.3-23,13-27,27-4,27-13-20.3-9-27-13Z";

function PegtopSvg({ id }: { id: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <filter id={`${id}-shine`}>
          <feGaussianBlur stdDeviation={3} />
        </filter>
        <mask id={`${id}-mask`}>
          <path d={PEGTOP_PATH} fill="white" />
        </mask>
        <radialGradient id={`${id}-g1`} cx={50} cy={66} fx={50} fy={66} r={30} gradientTransform="translate(0 35) scale(1 0.5)" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="black" stopOpacity={0.3} />
          <stop offset="50%" stopColor="black" stopOpacity={0.1} />
          <stop offset="100%" stopColor="black" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-g2`} cx={55} cy={20} fx={55} fy={20} r={30} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity={0.3} />
          <stop offset="50%" stopColor="white" stopOpacity={0.1} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-g3`} cx={85} cy={50} fx={85} fy={50} r={30} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity={0.3} />
          <stop offset="50%" stopColor="white" stopOpacity={0.1} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-g4`} cx={50} cy={58} fx={50} fy={58} r={60} gradientTransform="translate(0 47) scale(1 0.2)" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity={0.3} />
          <stop offset="50%" stopColor="white" stopOpacity={0.1} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={`${id}-g5`} x1={50} y1={90} x2={50} y2={10} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="black" stopOpacity={0.2} />
          <stop offset="40%" stopColor="black" stopOpacity={0} />
        </linearGradient>
      </defs>
      <g>
        <path d={PEGTOP_PATH} fill="currentColor" />
        <path d={PEGTOP_PATH} fill={`url(#${id}-g1)`} />
        <path d={PEGTOP_PATH} fill="none" stroke="white" opacity={0.3} strokeWidth={3} filter={`url(#${id}-shine)`} mask={`url(#${id}-mask)`} />
        <path d={PEGTOP_PATH} fill={`url(#${id}-g2)`} />
        <path d={PEGTOP_PATH} fill={`url(#${id}-g3)`} />
        <path d={PEGTOP_PATH} fill={`url(#${id}-g4)`} />
        <path d={PEGTOP_PATH} fill={`url(#${id}-g5)`} />
      </g>
    </svg>
  );
}

function SmartMatchLoader() {
  return (
    <div className="sm-loader">
      <div className="sm-loader__one"><PegtopSvg id="sml1" /></div>
      <div className="sm-loader__two"><PegtopSvg id="sml2" /></div>
      <div className="sm-loader__three"><PegtopSvg id="sml3" /></div>
    </div>
  );
}

interface AutoMatchPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: AutoMatchStats | null;
  loading: boolean;
  committing: boolean;
  onConfirm: () => void;
  /** Target progress 0–100. Bar uses CSS transition at barTransitionMs for smooth fill. */
  animationProgress: number;
  /** CSS transition duration for the bar in ms. Long for 0→95, short for 95→100. */
  barTransitionMs: number;
  /** How many transactions have been animated so far */
  animatedCount: number;
  /** True when all waves are done and user can dismiss */
  completed: boolean;
  /** Total matched transaction count */
  matchedTransactionCount: number;
}

export function AutoMatchPreview({
  open,
  onOpenChange,
  stats,
  loading,
  committing,
  onConfirm,
  animationProgress,
  barTransitionMs,
  animatedCount,
  completed,
  matchedTransactionCount,
}: AutoMatchPreviewProps) {
  const isActive = committing || completed;

  return (
    <Dialog open={open} onOpenChange={isActive ? undefined : onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={isActive ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={completed ? () => onOpenChange(false) : isActive ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {completed ? (
              <CheckCircle2 className="h-4 w-4 sm-text" />
            ) : (
              <Zap className="h-4 w-4 sm-text" />
            )}
            {completed ? "Smart Match fullført" : "Smart Match"}
          </DialogTitle>
        </DialogHeader>

        {completed ? (
          <div className="py-4 space-y-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center justify-center h-14 w-14 rounded-full sm-bg-subtle">
                <PartyPopper className="h-7 w-7 sm-text" />
              </div>
              <div>
                <p className="text-base font-semibold">
                  {matchedTransactionCount > 0 && stats
                    ? `${stats.totalMatches} grupper matchet`
                    : "Alle poster er matchet!"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {matchedTransactionCount} transaksjoner ble avstemt
                </p>
              </div>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full w-full"
                style={{ background: SM_GRADIENT }}
              />
            </div>

            <div className="flex justify-center pt-1">
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Lukk
              </Button>
            </div>
          </div>
        ) : committing ? (
          <div className="py-4 space-y-3">
            <div className="flex flex-col items-center gap-1">
              <SmartMatchLoader />
              <p className="text-sm font-medium">Matcher poster&hellip;</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {animatedCount} av {matchedTransactionCount} transaksjoner
              </p>
            </div>

            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${animationProgress}%`,
                  background: SM_GRADIENT,
                  transition: `width ${barTransitionMs}ms linear`,
                }}
              />
            </div>
          </div>
        ) : loading ? (
          <div className="py-6 text-center">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 sm-border border-t-transparent" />
            <p className="text-sm text-muted-foreground mt-3">Smart Match analyserer&hellip;</p>
          </div>
        ) : stats && stats.totalMatches === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Ingen matchkandidater funnet med gjeldende regler.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Prøv å justere reglene eller legg til flere transaksjoner.
            </p>
            <div className="flex justify-end pt-4">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Lukk
              </Button>
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-4 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Matcher funnet</span>
                <span className="font-medium tabular-nums">{stats.totalMatches}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaksjoner</span>
                <span className="font-medium tabular-nums">{stats.totalTransactions}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Analysetid</span>
                <span className="font-mono text-xs tabular-nums">{stats.durationMs}ms</span>
              </div>
            </div>

            {stats.byRule.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">Fordeling per regel</p>
                {stats.byRule.map((r) => (
                  <div key={r.ruleId} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate mr-2">{r.ruleName}</span>
                    <span className="tabular-nums shrink-0">{r.matchCount} matcher</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Avbryt
              </Button>
              <Button size="sm" disabled={committing} onClick={onConfirm} className="sm-btn-solid">
                Bekreft matching
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
