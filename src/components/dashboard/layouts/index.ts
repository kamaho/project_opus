import type { ComponentType } from "react";
import type { LayoutProps, LayoutType } from "../types";
import OverviewLayout from "./overview-layout";
import CompactLayout from "./compact-layout";
import FocusLayout from "./focus-layout";

export const layouts: Record<LayoutType, ComponentType<LayoutProps>> = {
  overview: OverviewLayout,
  compact: CompactLayout,
  focus: FocusLayout,
};
