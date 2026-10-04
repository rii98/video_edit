// Maps a click or drag on the preview to the layer ids rendered there.
// Geometric (bounding boxes) rather than elementsFromPoint, so layers with
// pointer-events: none and drag regions work the same way.

interface ClientRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MAX_LAYERS = 6;

function effectivelyVisible(el: Element, root: Element): boolean {
  let opacity = 1;
  for (let node: Element | null = el; node && node !== root; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    opacity *= Number(style.opacity);
  }
  return opacity > 0.05;
}

const intersects = (a: ClientRect, b: ClientRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Layers under `area` (a point is a zero-size rect), most specific first. "Most specific"
 * means smallest on screen: when you click a word you mean the text, not the background.
 */
export function hitTest(root: Element, area: ClientRect): string[] {
  const probe = area.right - area.left < 1 ? { ...area, right: area.left + 1, bottom: area.top + 1 } : area;
  const hits: { id: string; size: number }[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-layer]')) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || !intersects(rect, probe)) continue;
    if (!effectivelyVisible(el, root)) continue;
    hits.push({ id: el.dataset.layer!, size: rect.width * rect.height });
  }
  const unique = new Map<string, number>();
  for (const h of hits) unique.set(h.id, Math.min(unique.get(h.id) ?? Infinity, h.size));
  return [...unique.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, MAX_LAYERS)
    .map(([id]) => id);
}
