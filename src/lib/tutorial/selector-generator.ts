/**
 * Generate a resilient CSS selector for a DOM element.
 *
 * Priority order:
 *   1. id
 *   2. data-tutorial-target
 *   3. Stable attribute combos (role + aria-label, name, data-testid, etc.)
 *   4. Shortest unique path from nearest anchored ancestor
 *
 * Avoids fragile positional selectors (nth-of-type) whenever possible.
 */
export function generateSelector(el: Element): string {
  // 1. Direct id
  if (el.id && isUniqueSelector(`#${CSS.escape(el.id)}`)) {
    return `#${CSS.escape(el.id)}`;
  }

  // 2. data-tutorial-target
  const tutorialTarget = el.getAttribute("data-tutorial-target");
  if (tutorialTarget) {
    return `[data-tutorial-target="${CSS.escape(tutorialTarget)}"]`;
  }

  // 3. Try to build a single-level unique selector using stable attributes
  const single = buildStableSelector(el);
  if (single && isUniqueSelector(single)) {
    return single;
  }

  // 4. Walk up to find an anchored ancestor (id or data-tutorial-target),
  //    then build the shortest unique path from there
  const anchored = buildAnchoredPath(el);
  if (anchored) return anchored;

  // 5. Fallback: nth-of-type chain from root (fragile, but guaranteed unique)
  return buildNthPath(el);
}

const STABLE_ATTRS = [
  "data-testid",
  "data-test-id",
  "data-cy",
  "data-smart-info",
  "name",
  "href",
  "for",
  "htmlFor",
] as const;

function buildStableSelector(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  const candidates: string[] = [];

  // data-testid and similar
  for (const attr of STABLE_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) {
      candidates.push(`${tag}[${attr}="${CSS.escape(val)}"]`);
      candidates.push(`[${attr}="${CSS.escape(val)}"]`);
    }
  }

  // role + aria-label (very stable for interactive elements)
  const role = el.getAttribute("role");
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) {
    if (role) {
      candidates.push(`[role="${role}"][aria-label="${CSS.escape(ariaLabel)}"]`);
    }
    candidates.push(`${tag}[aria-label="${CSS.escape(ariaLabel)}"]`);
  }

  // title attribute
  const title = el.getAttribute("title");
  if (title) {
    candidates.push(`${tag}[title="${CSS.escape(title)}"]`);
  }

  // type for inputs/buttons
  const type = el.getAttribute("type");
  if (type && ["input", "button"].includes(tag)) {
    const name = el.getAttribute("name");
    if (name) {
      candidates.push(`${tag}[type="${type}"][name="${CSS.escape(name)}"]`);
    }
  }

  // placeholder for inputs
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) {
    candidates.push(`${tag}[placeholder="${CSS.escape(placeholder)}"]`);
  }

  // Return first unique candidate
  for (const sel of candidates) {
    if (isUniqueSelector(sel)) return sel;
  }

  return null;
}

function buildAnchoredPath(target: Element): string | null {
  let current: Element | null = target.parentElement;
  const pathFromTarget: Element[] = [target];

  while (current && current !== document.documentElement) {
    let anchorSelector: string | null = null;

    if (current.id) {
      anchorSelector = `#${CSS.escape(current.id)}`;
    } else {
      const dt = current.getAttribute("data-tutorial-target");
      if (dt) {
        anchorSelector = `[data-tutorial-target="${CSS.escape(dt)}"]`;
      } else {
        const stable = buildStableSelector(current);
        if (stable && isUniqueSelector(stable)) {
          anchorSelector = stable;
        }
      }
    }

    if (anchorSelector) {
      // Build a path from anchor down to target
      const descendant = buildDescendantSelector(anchorSelector, pathFromTarget);
      if (descendant) return descendant;
    }

    pathFromTarget.unshift(current);
    current = current.parentElement;
  }

  return null;
}

function buildDescendantSelector(
  anchorSel: string,
  path: Element[]
): string | null {
  const target = path[path.length - 1];
  const tag = target.tagName.toLowerCase();

  // Try direct: anchor > ... target with stable attributes
  const stableTarget = buildStableSelector(target);
  if (stableTarget) {
    const sel = `${anchorSel} ${stableTarget}`;
    if (isUniqueSelector(sel)) return sel;
  }

  // Try: anchor tag (simple descendant)
  const simpleSel = `${anchorSel} ${tag}`;
  if (isUniqueSelector(simpleSel)) return simpleSel;

  // Try with classes (only stable-looking ones — skip hashed/utility classes)
  const stableClasses = getStableClasses(target);
  for (const cls of stableClasses) {
    const sel = `${anchorSel} ${tag}.${CSS.escape(cls)}`;
    if (isUniqueSelector(sel)) return sel;
  }

  // Try with nth-of-type just from the anchor (much shorter than full path)
  const parent = target.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(
      (c) => c.tagName === target.tagName
    );
    if (siblings.length > 1) {
      const idx = siblings.indexOf(target) + 1;
      const sel = `${anchorSel} ${tag}:nth-of-type(${idx})`;
      if (isUniqueSelector(sel)) return sel;
    }
  }

  return null;
}

function getStableClasses(el: Element): string[] {
  const classes = Array.from(el.classList);
  return classes.filter((cls) => {
    if (/^[a-z]{1,8}$/.test(cls)) return false; // hashed Tailwind/CSS module classes
    if (/^_/.test(cls)) return false;
    if (/[A-Z].*__/.test(cls)) return false; // CSS modules with hash
    if (cls.length > 40) return false;
    return true;
  });
}

function buildNthPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    let segment = current.tagName.toLowerCase();
    const parent = current.parentElement;

    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(segment);
    current = parent;
  }

  return parts.join(" > ");
}

function isUniqueSelector(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}
