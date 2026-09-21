/**
 * Caption clean-up. Pure module shared by the API route and the app.
 *
 * Instagram's description metadata often wraps the caption in engagement text:
 *   50K likes, 651 comments - coach_mohamed_selem on September 17, 2026‎: "caption…"
 *   janedoe on Instagram: "caption…"
 * Note the invisible left-to-right mark before the colon in the first form. The wrapper is
 * metadata, not the caption, so it is removed. Previews are often truncated, so the closing
 * quote may be missing.
 */

const COUNT = String.raw`[\d.,]+\s*[KkMm]?`;

const ENGAGEMENT_WRAPPER = new RegExp(
  String.raw`^\s*${COUNT}\s+likes?,\s*${COUNT}\s+comments?\s*[-–—]\s*[\p{L}\p{N}._]+\s+on\s+[^:]{3,80}:\s*["“]([\s\S]*?)["”]?\s*\.?\s*$`,
  'u'
);

const ON_INSTAGRAM_WRAPPER = /^\s*@?[\p{L}\p{N}._]{1,30}\s+on\s+Instagram\s*:\s*["“]([\s\S]*?)["”]?\s*\.?\s*$/u;

/** Directional marks and similar invisible characters Instagram inserts. */
const INVISIBLE = /[‎‏‪-‮⁦-⁩]/g;

export function cleanInstagramCaption(text: string | undefined | null): string | undefined {
  if (!text) {
    return undefined;
  }

  const visible = text.replace(INVISIBLE, '');
  const match = visible.match(ENGAGEMENT_WRAPPER) ?? visible.match(ON_INSTAGRAM_WRAPPER);
  const caption = (match ? match[1] : visible).trim();

  return caption.length > 0 ? caption : undefined;
}
