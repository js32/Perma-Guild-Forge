/** Removes the image box (the nearest [data-img-wrapper]) of any image that
 *  fails to load. One capturing listener replaces per-image onerror="…"
 *  attributes, which the Content-Security-Policy doesn't allow. Call once per page. */
export function installBrokenImageCleanup(): void {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement) img.closest('[data-img-wrapper]')?.remove();
  }, true);
}

/** Escape a string for safe interpolation into HTML markup (text/attribute context). */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]);
}

/** Small spinning-circle indicator, sized to sit inline inside a button next
 *  to its label — same visual language as the page-level loading spinners
 *  (`animate-spin` + border-trick), just small enough for a button. */
export const BUTTON_SPINNER_HTML =
  '<span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current align-[-2px]"></span>';

/** Disables a button and swaps its content for a spinner (keeping the
 *  original label visible next to it, so it's clear this button specifically
 *  is generating something) while `task` runs, then always restores the
 *  button — even if `task` throws. PDF generation especially can take a
 *  noticeable moment (rasterizing several Baumscheiben), and a plain "..."
 *  text swap is easy to miss. */
export async function withButtonSpinner<T>(btn: HTMLButtonElement, task: () => Promise<T>): Promise<T> {
  const originalHtml = btn.innerHTML;
  const originalDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = `${BUTTON_SPINNER_HTML} <span>${btn.textContent}</span>`;
  try {
    return await task();
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = originalDisabled;
  }
}

/** Full-width placeholder shown in place of a list/grid while it's (re)generating —
 *  same "sanduhr" idea as `withButtonSpinner`, but for a whole container rather
 *  than a single button (e.g. the card grid while Baumscheiben are being
 *  rendered, which awaits an SVG fetch + per-plant DOM work and can take a
 *  visible moment for more than a couple of plants). */
export function loadingPlaceholderHtml(label: string): string {
  return `<div class="col-span-full flex flex-col items-center justify-center gap-3 py-16 text-stone-400 dark:text-stone-500">
    <span class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-current/20 border-t-current"></span>
    <span class="text-sm">${escapeHtml(label)}</span>
  </div>`;
}

/** Small attribution strip laid over the bottom edge of a photo. The photo's
 *  container must be position:relative. Empty string when there's no credit.
 *  Needed for Wikimedia Commons images (CC BY / CC BY-SA require author +
 *  license wherever the image is shown). */
export function imageCreditOverlayHtml(credit: string | undefined): string {
  if (!credit) return '';
  const c = escapeHtml(credit);
  return `<div title="${c}" style="position:absolute;left:0;right:0;bottom:0;padding:1px 4px;background:rgba(0,0,0,.55);color:#fff;font-size:8px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:Arial,sans-serif;">${c}</div>`;
}
