# Design System & UI/UX Guidelines

> This document defines the visual language, component rules, and interaction patterns for
> Account Control. Every UI element **must** follow these guidelines. If you need to deviate,
> you MUST document WHY in a code comment and get explicit approval. No exceptions.
>
> When building any UI component, **CHECK THIS DOCUMENT FIRST**. If this document has a rule
> for what you're building, follow it exactly. If it doesn't cover your case, find the
> closest pattern here and extend it consistently.
>
> **Visual benchmark:** Vercel, Linear, Apple. If your UI doesn't feel like it belongs
> alongside these products, it's not ready.

---

## 1. Design Philosophy

### Reference Products

We design with four reference products in mind. Every screen should feel like it belongs
in one of these:

| Product      | What we take                                                                 |
|-------------|-----------------------------------------------------------------------------|
| **Vercel**  | Monochrome palette, Geist font, sharp precision, dark primary buttons, generous whitespace balanced with density |
| **Linear**  | Minimal sidebar, low-contrast grays, subtle accent color, keyboard-first interactions, smooth micro-transitions |
| **Apple**   | Pixel-perfect alignment, optical balance over mathematical balance, crafted empty states, every detail intentional |
| **Supabase**| Readable data tables, clear status hierarchy, dark mode done right, developer-friendly aesthetic |

### Core Principles

1. **Clarity over cleverness** — Accountants need to trust the numbers. Every piece of data must be unambiguous. No decorative elements that could be confused with data.

2. **Density done right** — Users work with large data sets. Show as much relevant data as possible without feeling cramped. Use whitespace strategically, not generously. Every pixel earns its place.

3. **Consistency is king** — Every table, button, form, and interaction must feel like part of the same app. If it looks different, users assume it works differently. Zero visual surprises.

4. **Speed of use** — Minimize clicks. Keyboard shortcuts for power users. No unnecessary confirmation dialogs for reversible actions. The fastest interface is the one users don't have to think about.

5. **Professional, not flashy** — This is a financial tool. It should feel trustworthy and solid, like a precision instrument. No animations for the sake of animations. No trendy gradients. No glassmorphism. No decoration that doesn't serve a purpose.

6. **Subtraction over addition** — When in doubt, remove. A screen with fewer elements is almost always better. If you're adding something, justify what problem it solves.

---

## 2. Color System

We use **oklch** for all color definitions (perceptually uniform, consistent lightness across hues). Colors are defined as CSS custom properties in `src/app/globals.css` and consumed through Tailwind's `bg-primary`, `text-muted-foreground`, etc.

### 2.1 Core Palette (Light Mode)

```
Background layers:
  --background:   oklch(0.99  0    0)      near-white page background
  --card:         oklch(1     0    0)      pure white cards/surfaces
  --muted:        oklch(0.965 0    0)      subtle surface (table headers, toolbar bg)
  --accent:       oklch(0.965 0    0)      hover/focus backgrounds

Text hierarchy:
  --foreground:          oklch(0.13  0    0)      primary text, headings, amounts
  --muted-foreground:    oklch(0.45  0    0)      secondary labels, descriptions
  (placeholder/disabled: ~oklch(0.60 0    0))     via Tailwind placeholder classes

Borders:
  --border:       oklch(0.91  0    0)      standard borders, dividers
  --input:        oklch(0.91  0    0)      input borders

Interactive:
  --primary:              oklch(0.15  0    0)      buttons, active states (near-black)
  --primary-foreground:   oklch(0.99  0    0)      text on primary
  --ring:                 oklch(0.55  0    0)      focus rings

Semantic:
  --destructive:  oklch(0.55  0.2  25)     errors, negative amounts, danger actions
```

### 2.2 Core Palette (Dark Mode)

Dark mode is supported. All variables remap automatically via the `.dark` class.
See `globals.css` for exact values. When building components, always use the
CSS variable classes (`bg-background`, `text-foreground`, `border-border`) — never
hardcode hex or oklch values directly.

### 2.3 Brand Accent — Orange

Orange is our brand identity color. It is **deliberately limited** in use to create
a distinctive but professional impression. Orange has inherent WCAG challenges on
light backgrounds, so we follow strict rules.

```css
/* Brand accent — add these to globals.css */
--brand:            oklch(0.70 0.17 55);    /* Vibrant orange — decorative only */
--brand-emphasis:   oklch(0.55 0.16 50);    /* Darker orange — passes 4.5:1 on white for text */
--brand-subtle:     oklch(0.95 0.03 55);    /* Barely-there tint — backgrounds */
--brand-muted:      oklch(0.85 0.08 55);    /* Soft orange — borders, progress indicators */
```

#### Where to Use Orange

| Context | Token | Example |
|---------|-------|---------|
| Brand mark / logo accent | `--brand` | Sidebar logo icon, favicon accent |
| Active navigation dot | `--brand` | Small 6px dot next to active sidebar item |
| Notification badges (count) | `--brand` | "3 nye" badge on bell icon |
| Progress indicators | `--brand-muted` | Import progress bar fill |
| Hover glow on brand elements | `--brand` at 10% opacity | Subtle ring on logo hover |
| Text that must be readable | `--brand-emphasis` | Only when AA contrast is verified |
| Subtle tint backgrounds | `--brand-subtle` | "Ny funksjon" announcement banner |

#### Where to NEVER Use Orange

- Primary action buttons — those are near-black (`--primary`)
- Body text — fails WCAG AA on light backgrounds
- Large filled areas — becomes overwhelming and unprofessional
- Status indicators — matched/error/warning have dedicated semantic colors
- Links — keep standard text color or underlined treatment
- Borders on inputs — confusing with error states

#### WCAG Orange Safety Reference

| Background | Orange token | Contrast | WCAG |
|-----------|-------------|----------|------|
| White `#fff` | `--brand` (oklch 0.70) | ~3.2:1 | **Fails** AA text — OK for large decorative |
| White `#fff` | `--brand-emphasis` (oklch 0.55) | ~5.0:1 | **Passes** AA for normal text |
| Dark `#1a1a1a` | `--brand` (oklch 0.70) | ~7.5:1 | **Passes** AA/AAA |
| `--muted` bg | `--brand-emphasis` (oklch 0.55) | ~4.7:1 | **Passes** AA for normal text |

**Rule:** If orange text must be readable, use `--brand-emphasis`. For decorative elements
(dots, icons, borders), `--brand` is fine.

### 2.4 Semantic Colors

These are used for data-driven status and must never change meaning:

| Meaning | Color | Usage |
|---------|-------|-------|
| **Success / Matched** | Green (emerald-600 / oklch 0.55 0.17 155) | Matched badges, balanced sums, confirmation |
| **Warning / Pending** | Amber (amber-600 / oklch 0.60 0.15 85) | Needs attention, partial matches |
| **Error / Danger** | Red (`--destructive`) | Errors, negative amounts, destructive actions |
| **Info** | Blue (blue-600 / oklch 0.55 0.15 250) | Informational, selection highlights, tips |

### 2.5 Color Usage Rules

- **NEVER use color as the only indicator** — always pair with text, icon, or position
- **Amounts:** Positive = `text-foreground`. Negative = `text-destructive`. Zero = `text-muted-foreground`
- **Interactive elements:** `bg-primary text-primary-foreground` for CTAs. Gray for secondary
- **Maximum 3 background tones per screen:** `--background`, `--muted`, and one semantic light
- **NEVER use raw hex/oklch in components** — always go through CSS variables or Tailwind classes
- **Dark mode:** Every color decision must work in both modes. Test both. Always.

---

## 3. Typography

### Font

**Geist** — Vercel's typeface. Clean, geometric, excellent for both UI text and monospace data.

```tsx
// Already configured in src/app/layout.tsx via next/font
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
```

- `--font-sans: var(--font-geist-sans)` — all UI text
- `--font-mono: var(--font-geist-mono)` — amounts, code, technical values

### Type Scale

| Use case | Size | Weight | Tailwind | When to use |
|----------|------|--------|----------|-------------|
| Page title | 24px | 600 | `text-2xl font-semibold` | One per page, top of content |
| Section heading | 18px | 600 | `text-lg font-semibold` | Group related content |
| Card/panel title | 14px | 500 | `text-sm font-medium` | Card headers, panel titles |
| Body text | 14px | 400 | `text-sm` | Default for all UI text |
| Table cell data | 14px | 400 | `text-sm` | Table cells |
| Table header | 12px | 500 | `text-xs font-medium` | Column headers |
| Caption / metadata | 12px | 400 | `text-xs text-muted-foreground` | Timestamps, help text, counts |
| KPI / large number | 20px | 600 | `text-xl font-semibold font-mono tabular-nums` | Saldo, totals |

### Typography Rules

- **ALWAYS use `font-mono tabular-nums` for financial amounts** — ensures digit alignment in columns. Non-negotiable for accounting data:
  ```html
  <span class="font-mono tabular-nums">1 234 567,89</span>
  ```
- **Number formatting:** Norwegian standard — space as thousands separator, comma as decimal: `1 234 567,89`
- **Never use more than 3 font sizes per screen.** Typically: heading + body + caption.
- **Never use bold for emphasis in running text** — only for headings and labels.
- **Line height:** `leading-relaxed` (1.625) for body text, `leading-tight` (1.25) for headings, `leading-none` (1.0) for dense table rows.
- **Letter spacing:** Default for body. Headings can use slight negative tracking (`tracking-tight`) for large titles.

---

## 4. Spacing & Layout

### Spacing Scale

Use **only** these Tailwind spacing tokens. Arbitrary values (`px-[13px]`) are forbidden
unless physically required for alignment.

| Token | Size | Use for |
|-------|------|---------|
| `1` (4px) | Micro | Inside tight components (badges, inline icons) |
| `1.5` (6px) | Compact | Dense panel headers, compact padding |
| `2` (8px) | Small | Table cell padding, inline gaps, icon spacing |
| `3` (12px) | Medium | Card padding (compact), form spacing, panel padding |
| `4` (16px) | Standard | Card padding (normal), section gaps |
| `6` (24px) | Large | Page section spacing, modal padding |
| `8` (32px) | Extra | Page top/bottom padding, hero spacing |

### Layout Rules

- **Sidebar:** Collapsible. Full width: `w-64` (256px). Collapsed: `w-16` (64px) icon-only.
- **Content area:** Flexible, fills remaining space. Uses `flex-1 min-h-0` for proper overflow.
- **Cards/panels:** `rounded-md border bg-card`. Small radius (our `--radius: 0.5rem` = 8px). Never `rounded-xl` or larger.
- **Shadows:** `shadow-sm` only where necessary for elevation (dropdowns, popovers). Never `shadow-md` or `shadow-lg` on inline content. The UI should feel flat, not layered.
- **No nested cards** — if you need hierarchy within a card, use spacing and subtle borders, not card-in-card.
- **Grid:** Use `grid` for dashboard KPIs and equal-width layouts. Use `flex` for toolbars, inline controls, and variable-width layouts.
- **Overflow:** Content areas with unknown height must use `overflow-auto` with `min-h-0` on flex parents. Tables must scroll, never wrap.

### Page Template

Every page follows this structure:

```
┌──────────────────────────────────────────────┐
│ Header: Breadcrumb / navigation context       │
├──────────────────────────────────────────────┤
│ Page title + primary action (top right)       │
├──────────────────────────────────────────────┤
│ Toolbar / filters (if applicable)             │
├──────────────────────────────────────────────┤
│                                              │
│ Main content (tables, panels, forms)          │
│                                              │
├──────────────────────────────────────────────┤
│ Status bar / pagination / summary             │
└──────────────────────────────────────────────┘
```

---

## 5. Components

We use **shadcn/ui** (New York variant) as the component base. All components are
customized through CSS variables — never override shadcn component internals directly.

### 5.1 Buttons

| Type | Use | Tailwind / variant |
|------|-----|--------------------|
| **Primary** | Main action per section (1 max) | `<Button>` default — `bg-primary text-primary-foreground` |
| **Secondary** | Supporting actions | `<Button variant="outline">` — border + background on hover |
| **Ghost** | Tertiary, toolbar actions | `<Button variant="ghost">` — no border, subtle hover |
| **Destructive** | Delete, remove, irreversible | `<Button variant="destructive">` — red |
| **Icon button** | Icon-only actions | `<Button variant="ghost" size="icon">` + `aria-label` required |

**Button Rules:**
- **Maximum ONE primary button per visual section.** Two equally important actions? One becomes secondary.
- **Always include loading state** — spinner icon + `disabled` during async operations.
- **Button text is always a verb:** "Match", "Importer", "Eksporter", "Lagre". Never "OK" or "Ja".
- **Destructive buttons require confirmation** only for irreversible actions. Reversible actions (unmatch) need no confirmation.
- **Minimum touch target:** 36px height (`h-9`). Never smaller.
- **Icon + text layout:** Icon left, text right, `gap-1.5` between.
- **Keyboard hints:** Show keyboard shortcut as subtle `text-xs text-muted-foreground` inside the button when applicable.

### 5.2 Tables

Tables are the **most critical component** in this app. They display financial data
that users make decisions from. Precision is paramount.

**Structure:**
```
┌────┬──────────┬────────────┬─────────────────────┬──────────────┐
│ ☐  │ Dato     │ Referanse  │ Tekst               │       Beløp  │
├────┼──────────┼────────────┼─────────────────────┼──────────────┤
│ ☐  │ 01.01.25 │ 12345      │ Betaling fra Ola AS │   12 500,00  │
│ ☐  │ 02.01.25 │ 12346      │ Husleie januar      │  −25 000,00  │
│ ☐  │ 03.01.25 │ 12347      │ Refusjon            │    3 750,50  │
└────┴──────────┴────────────┴─────────────────────┴──────────────┘
```

**Table Rules:**
- **Header:** `bg-muted/95 text-xs font-medium text-muted-foreground sticky top-0 z-10`
- **Rows:** `border-t hover:bg-muted/50 text-sm` — height 36px for density
- **Selected row:** `bg-blue-50 dark:bg-blue-950/40` — clear but not overwhelming
- **Amounts ALWAYS right-aligned:** `text-right font-mono tabular-nums`
- **Dates left-aligned.** Text columns left-aligned. Number columns right-aligned. No exceptions.
- **Negative amounts in red:** `text-destructive`
- **Minus sign:** Use typographic minus `−` (U+2212), not hyphen `-`, for negative amounts
- **Sticky header:** Always. Users must see column names when scrolling.
- **Virtualization:** Use `@tanstack/react-virtual` for lists > 100 rows. Never render thousands of DOM nodes.
- **Column resizing:** Supported via drag handles on column borders.
- **Empty state:** Never show an empty table. Centered message + icon + optional action button.
- **Zebra striping:** Do NOT use. Rely on hover and borders for separation.
- **Footer row:** Show count + sum. Format: `"{n} transaksjoner totalt  Sum: {formatted}"`

### 5.3 Forms & Inputs

- **Label above input**, never beside or floating.
- **Label:** `text-sm font-medium` with `<Label>` from shadcn.
- **Input:** Use `<Input>` from shadcn. Default styling via CSS variables.
- **Error state:** `border-destructive` on input + `text-xs text-destructive` message below.
- **Required fields:** Mark with `*` after label text. Never mark optional fields.
- **Help text:** Below input, `text-xs text-muted-foreground`.
- **Input width matches expected content** — dates are narrow, descriptions are wide.
- **Financial input:** `font-mono text-right` with appropriate decimal formatting.

### 5.4 Status Badges

```tsx
// Matched / Avstemt
<Badge variant="success">Avstemt</Badge>  // green bg, green text

// Unmatched / Uavstemt
<Badge variant="warning">Uavstemt</Badge>  // amber bg, amber text

// Error
<Badge variant="destructive">Feil</Badge>  // red bg, red text
```

- **Same size and shape** everywhere — never mix badge styles on the same page.
- **Maximum 5 distinct statuses per context.** More than that means the data model needs rethinking.
- **Use rounded-full pill shape** for status. `rounded-md` for category/type labels.

### 5.5 Modals & Dialogs

- Use `<Dialog>` from shadcn.
- **Max width:** `max-w-sm` (384px) for confirmations, `max-w-lg` (512px) for forms, custom for complex content.
- **Always have a clear `<DialogTitle>`**.
- **Close with X button** (top right) and **Escape key**.
- **Actions at bottom-right:** Primary right, cancel left.
- **Overlay:** Default shadcn overlay.
- **NEVER stack modals** — if modal needs another modal, redesign the flow.
- **Prefer inline editing or slide-over panels** for quick actions.

### 5.6 Toast / Notifications

- **Position:** Top-right, stacked.
- **Duration:** 4s for success, persistent (with dismiss) for errors.
- **Types:** Success (green), Error (red), Warning (amber), Info (blue).
- **Max 3 visible** — queue the rest.
- **Keep messages short:** "3 poster matchet" — not "Du har nå matchet 3 transaksjoner".

### 5.7 Smart Panel (Contextual Help)

The Smart Panel is our contextual intelligence overlay. It appears on right-click anywhere
in the app.

- **On interactive elements:** Shows description of what the element does.
- **On transaction cells:** Shows smart functions (find matches, filter).
- **Draggable** — user can reposition it.
- **Two-step flow:** Options list → result view with back navigation.
- **Add `data-smart-info="..."` to all significant UI elements** to provide contextual help.

---

## 6. Interaction Patterns

### 6.1 Selection & Matching (Core Interaction)

This is the most important interaction in the entire application.

- **Click to select:** Single click toggles row selection. Selected = `bg-blue-50 dark:bg-blue-950/40`.
- **Multi-select:** Click additional rows to add/remove. No Ctrl/Cmd needed.
- **Running total:** Always visible in the status bar at the bottom showing sum of selected.
- **Match readiness:** When selections from both sets sum to 0, the Match button enables and the sum turns green (`text-green-600`).
- **Keyboard shortcut:** `M` to match when ready. `Escape` to clear selection.

### 6.2 Right-Click / Context Menu

The native browser context menu is replaced by the Smart Panel throughout the app.
Every interactive element provides contextual information or actions via right-click.

- **Transaction cells:** Smart functions (find similar, match).
- **Buttons/controls:** Descriptive help about what the button does.
- **Non-interactive areas:** No panel (native context menu shows).

### 6.3 Drag & Drop (File Import)

- **Drop zone:** `border-2 border-dashed border-border rounded-lg p-8` with centered icon + label.
- **Active drop state:** `ring-2 ring-primary ring-inset` with `bg-primary/5` overlay.
- **After drop:** Show filename immediately, then begin parsing.
- **In-table drop:** Transaction panels accept file drops directly for quick import.

### 6.4 Loading States

- **Button loading:** Spinner icon + "Laster…" text, button disabled.
- **Table loading:** Skeleton rows matching real data dimensions. Use `animate-pulse`.
- **Page loading:** Skeleton layout matching page structure — header, sidebar, content areas.
- **NEVER use a full-page spinner** — always show page structure with placeholders.

### 6.5 Empty States

Every view must handle the empty case gracefully:

- **No transactions:** Icon (`FileText`) + "Ingen transaksjoner ennå" + "Importer fil" action.
- **No matches:** "Ingen matchede poster" + guidance on how to match.
- **No search results:** "Ingen treff" + suggestion to broaden search.
- **Empty states must feel intentional, not broken.** Centered, subtle icon, clear next step.

---

## 7. Responsive Behavior

### Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Desktop (default) | ≥1280px | Full layout with sidebar, two-panel matching view |
| Tablet | 768–1279px | Sidebar collapsed to icons, tables scroll horizontally |
| Mobile | <768px | Sidebar hidden (hamburger), stacked layout, simplified views |

### Rules

- **Primary design target: 1280px+** — accountant with a standard laptop.
- **Tables never wrap** — horizontal scroll on small screens.
- **Matching two-panel view** stacks vertically below 768px.
- **Critical actions accessible on all sizes.**
- **Test at 1280px before anything else.**

---

## 8. Icons

**Lucide React** exclusively. Never mix icon libraries. Never use emoji as icons.

### Standard Icon Mapping

| Action | Icon | Context |
|--------|------|---------|
| Import / Upload | `Upload` | File import |
| Export / Download | `Download` | Data export |
| Search | `Search` | Search fields |
| Filter | `Filter` | Filter controls |
| Settings / Gear | `Settings` | Configuration |
| Delete | `Trash2` | Destructive (with confirmation for irreversible) |
| Edit | `Pencil` | Edit mode, inline editing |
| Close | `X` | Close modal, panel, dismiss |
| Success | `CheckCircle2` | Confirmed, matched |
| Warning | `AlertTriangle` | Warning state |
| Error | `AlertCircle` | Error state |
| Info | `Info` | Informational, help |
| Match / Link | `Link2` | Match action |
| Unmatch | `Unlink` | Unmatch action |
| Smart / AI | `Sparkles` | Smart functions, AI features |
| File | `FileText` | Documents, imported files |
| Folder | `FolderOpen` | File manager |

### Icon Rules

- **Sizes:** `h-3.5 w-3.5` in buttons with text, `h-4 w-4` in icon-only buttons, `h-5 w-5` standalone.
- **Color:** Inherit from parent `text-*`. Never set explicit color on icons unless they are status indicators.
- **ALWAYS pair with text** in buttons and menus. Icon-only allowed only for universally recognized actions (close, search, settings) — and must have `aria-label`.
- **Consistency:** If an icon is used for an action in one place, it must mean the same thing everywhere.

---

## 9. Animation & Motion

### Allowed

- **Hover transitions:** `transition-colors duration-150` — fast, subtle.
- **Toast enter/exit:** Slide in from right, fade out.
- **Modal:** Fade overlay + slight scale on content, `duration-200`.
- **Skeleton pulse:** `animate-pulse` on loading placeholders.
- **Panel drag:** Immediate response, no easing lag.

### Forbidden

- Bouncing, spring, or elastic animations
- Page/route transitions
- Parallax effects
- Auto-playing looping animations
- Any animation > 300ms
- Counting/incrementing number animations — show the final value immediately
- Decorative motion that doesn't serve a functional purpose

---

## 10. Dark Mode

Dark mode is supported. The `.dark` class on `<html>` activates it.

### Rules

- **Always use Tailwind's `dark:` variants** when a component needs different styling.
- **Use semantic CSS variables** (`bg-background`, `text-foreground`, `border-border`) — they automatically adapt.
- **Test every component in both modes** before considering it done.
- **Avoid hardcoded colors** — `bg-white` becomes invisible in dark mode. Use `bg-background` or `bg-card`.
- **Selection highlight:** `bg-blue-50 dark:bg-blue-950/40` — note the dark variant.
- **Status light backgrounds:** Must have corresponding dark variants (e.g., `bg-green-50 dark:bg-green-950/20`).
- **Brand orange in dark mode:** `--brand` (oklch 0.70) works well on dark backgrounds. Higher contrast than on white.

---

## 11. Accessibility

Every component must meet these requirements:

- [ ] Keyboard navigable: `Tab`, `Escape`, `Enter`, arrow keys where relevant
- [ ] Visible focus indicator: `ring-2 ring-ring` (via shadcn defaults)
- [ ] Color contrast: minimum 4.5:1 for text, 3:1 for large text and UI components
- [ ] All icon-only buttons have `aria-label`
- [ ] Form inputs linked to `<Label>` via `htmlFor`
- [ ] Error messages linked via `aria-describedby`
- [ ] No information conveyed by color alone — always pair with text/icon
- [ ] Interactive elements have minimum 36px touch target
- [ ] Use semantic HTML: `<button>` for actions, `<a>` for navigation, proper heading hierarchy (`h1` → `h2` → `h3`, never skip)

---

## 12. Language

| Context | Language | Example |
|---------|----------|---------|
| UI text (buttons, labels, menus) | **Norsk (bokmål)** | "Importer", "Lagre", "Avbryt" |
| Error messages shown to users | **Norsk** | "Import feilet — ugyldig filformat" |
| Variable names, functions, code | **English** | `handleMatch`, `selectedIds` |
| Code comments | **English** | `// Calculate running balance` |
| Console/log messages | **English** | `console.error("Match failed:", error)` |
| Commit messages | **English** | `fix: resolve balance calculation for negative amounts` |
| Documentation (this file, etc.) | **English** (technical), **Norsk** (user-facing sections) | — |

### Tone

- **Direct and clear.** "Importer fil" — not "Klikk her for å importere en fil".
- **No jargon** the user wouldn't understand. "Avstem" is fine (domain term). "Reconciliation engine" is not.
- **Short labels.** Button text should be 1-2 words. Descriptions max one sentence.

---

## 13. File & Code Conventions

### Component Files

- Filename: `kebab-case.tsx`
- Component name: `PascalCase`
- Hook files: `camelCase`, starting with `use` (e.g., `useMatchSelection.ts`)
- One primary export per file

### Styling

- **Tailwind only** — no inline styles except for dynamic values (width, position).
- **`cn()` utility** for conditional classes (from `@/lib/utils`).
- **Never use `@apply`** in component CSS — defeats the purpose of utility classes.
- **Never use arbitrary Tailwind values** (`w-[347px]`) unless mathematically necessary.
- **Class order:** Layout (`flex`, `grid`) → Sizing (`w-`, `h-`) → Spacing (`p-`, `m-`, `gap-`) → Visual (`bg-`, `border-`, `rounded-`) → Typography (`text-`, `font-`) → State (`hover:`, `focus:`, `disabled:`) → Dark mode (`dark:`).

### Component Structure

```tsx
"use client"; // only if needed

import { ... } from "react";
import { ... } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MyComponentProps { ... }

export function MyComponent({ ... }: MyComponentProps) {
  // hooks first
  // handlers second
  // computed values third
  // early returns for edge cases

  return (
    <div data-smart-info="Description for Smart Panel">
      {/* JSX */}
    </div>
  );
}
```

---

## 14. Brand Orange — Implementation Reference

To add the brand orange tokens, add these lines to `src/app/globals.css`:

```css
/* Inside :root { ... } */
--brand: oklch(0.70 0.17 55);
--brand-emphasis: oklch(0.55 0.16 50);
--brand-subtle: oklch(0.95 0.03 55);
--brand-muted: oklch(0.85 0.08 55);

/* Inside .dark { ... } */
--brand: oklch(0.72 0.17 55);
--brand-emphasis: oklch(0.75 0.15 55);
--brand-subtle: oklch(0.20 0.04 55);
--brand-muted: oklch(0.35 0.10 55);
```

Then map in the `@theme inline` block:

```css
--color-brand: var(--brand);
--color-brand-emphasis: var(--brand-emphasis);
--color-brand-subtle: var(--brand-subtle);
--color-brand-muted: var(--brand-muted);
```

Usage in Tailwind:
```html
<div class="bg-brand-subtle text-brand-emphasis">Ny funksjon</div>
<span class="text-brand">●</span> <!-- active indicator dot -->
```

---

## 15. Deviation Protocol

**If you believe a deviation from this design system is necessary:**

1. **Stop and think.** Is this really needed, or can the system cover your case?

2. **Document it in code:**
   ```tsx
   {/* DESIGN DEVIATION: [What you changed]
       Reason: [Why the standard didn't work]
       Approved by: [name/pending] */}
   ```

3. **The deviation must solve a real user problem** — not an aesthetic preference.

4. **If unsure:** Keep it consistent with the system. Discuss with the team before merging.

5. **For AI assistants (Cursor, etc.):** If asked to build something that contradicts these
   guidelines, flag the conflict and ask for confirmation before proceeding. Do not silently
   deviate.

6. **Repeated deviations for the same reason** indicate the system needs updating — propose
   a change to this document rather than accumulating exceptions.

---

## Quick Checklist Before Every UI Change

- [ ] Does it match the visual quality of Vercel/Linear/Apple?
- [ ] Colors from CSS variables only? No hardcoded values?
- [ ] Geist font with correct weight and size from the scale?
- [ ] Spacing from the allowed token list?
- [ ] Tested in both light and dark mode?
- [ ] Keyboard navigable?
- [ ] `aria-label` on icon-only buttons?
- [ ] `data-smart-info` on significant interactive elements?
- [ ] Loading state for async actions?
- [ ] Empty state handled?
- [ ] Norwegian UI text, English code?
- [ ] No unnecessary animations?
- [ ] Consistent with existing patterns in the codebase?
