import type { AccountingSystemAdapter, PeriodParams } from "@/lib/accounting/types";
import type { ControlResult, ControlType } from "./types";
import type { ControlDefinition } from "./registry";
import { getControlDefinition, getDefaultParameters } from "./registry";

// ---------------------------------------------------------------------------
// ControlRunner — pluggbart interface for kontrollmotorer
// ---------------------------------------------------------------------------

export interface ControlContext {
  tenantId: string;
  companyId: string;
  clientId?: string;
  period: PeriodParams | { asOfDate: Date };
  adapter: AccountingSystemAdapter;
  /** Merged parameters: defaults from registry + overrides from control_configs */
  parameters: Record<string, unknown>;
  /** Optional: filter to specific GL accounts (e.g. ["1500"] for a single AR account) */
  accountNumbers?: string[];
}

export interface ControlRunner {
  readonly controlType: ControlType;
  execute(ctx: ControlContext): Promise<ControlResult>;
}

// ---------------------------------------------------------------------------
// Runner registry — map controlType → runner implementation
// ---------------------------------------------------------------------------

const runners = new Map<ControlType, ControlRunner>();

export function registerRunner(runner: ControlRunner): void {
  runners.set(runner.controlType, runner);
}

export function getRunner(controlType: ControlType): ControlRunner | undefined {
  return runners.get(controlType);
}

export function getAvailableRunners(): ControlType[] {
  return Array.from(runners.keys());
}

// ---------------------------------------------------------------------------
// mergeParameters — registry defaults + user overrides
// ---------------------------------------------------------------------------

export function mergeParameters(
  controlType: ControlType,
  overrides?: Record<string, unknown> | null
): Record<string, unknown> {
  const defaults = getDefaultParameters(controlType);
  if (!overrides) return defaults;
  return { ...defaults, ...overrides };
}

// ---------------------------------------------------------------------------
// runControl — single control execution
// ---------------------------------------------------------------------------

export async function runControl(
  controlType: ControlType,
  ctx: ControlContext
): Promise<ControlResult> {
  const runner = getRunner(controlType);
  if (!runner) {
    throw new ControlNotImplementedError(controlType);
  }

  const definition = getControlDefinition(controlType);
  if (!definition) {
    throw new Error(`No registry definition for control: ${controlType}`);
  }

  return runner.execute(ctx);
}

// ---------------------------------------------------------------------------
// runControls — batch execution of multiple controls
// ---------------------------------------------------------------------------

export interface RunControlsOptions {
  tenantId: string;
  companyId: string;
  clientId?: string;
  period: PeriodParams | { asOfDate: Date };
  adapter: AccountingSystemAdapter;
  controlTypes: ControlType[];
  parameterOverrides?: Record<ControlType, Record<string, unknown>>;
}

export interface RunControlsResult {
  controlsRun: number;
  results: ControlResult[];
  errors: { controlType: ControlType; error: string }[];
}

export async function runControls(
  options: RunControlsOptions
): Promise<RunControlsResult> {
  const results: ControlResult[] = [];
  const errors: { controlType: ControlType; error: string }[] = [];

  for (const controlType of options.controlTypes) {
    const parameters = mergeParameters(
      controlType,
      options.parameterOverrides?.[controlType]
    );

    const ctx: ControlContext = {
      tenantId: options.tenantId,
      companyId: options.companyId,
      clientId: options.clientId,
      period: options.period,
      adapter: options.adapter,
      parameters,
    };

    try {
      const result = await runControl(controlType, ctx);
      results.push(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Ukjent feil";
      errors.push({ controlType, error: message });
    }
  }

  return {
    controlsRun: results.length,
    results,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ControlNotImplementedError extends Error {
  constructor(public readonly controlType: string) {
    super(`Kontroll ikke implementert: ${controlType}`);
    this.name = "ControlNotImplementedError";
  }
}
