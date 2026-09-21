import { describe, expect, it } from 'vitest';

import { displayCaption } from '@/features/tags/hashtags';
import { cleanInstagramCaption } from '@/services/instagram/caption';

describe('cleanInstagramCaption', () => {
  it('removes the engagement wrapper, as stored on device', () => {
    // Verbatim from a real saved item, including the U+200E mark before the colon.
    const raw =
      '50K likes, 651 comments - coach_mohamed_selem on September 17, 2026‎: "😴 مواعيد نومك ممكن تكون سبب إنك تصحى تعبان';
    expect(cleanInstagramCaption(raw)).toBe('😴 مواعيد نومك ممكن تكون سبب إنك تصحى تعبان');
  });

  it('handles a closed quote and trailing period', () => {
    expect(cleanInstagramCaption('1,234 likes, 5 comments - jane.doe on Sep 3, 2025: "Sunset run."')).toBe('Sunset run.');
  });

  it('handles the "on Instagram" form', () => {
    expect(cleanInstagramCaption('janedoe on Instagram: "New chair"')).toBe('New chair');
  });

  it('handles singular like and comment', () => {
    expect(cleanInstagramCaption('1 like, 1 comment - a_b on May 1, 2026: "hi"')).toBe('hi');
  });

  it('leaves an ordinary caption untouched', () => {
    expect(cleanInstagramCaption('What is a Permalink? A permalink (short for "permanent link")')).toBe(
      'What is a Permalink? A permalink (short for "permanent link")'
    );
  });

  it('strips invisible direction marks', () => {
    expect(cleanInstagramCaption('‎hello‏')).toBe('hello');
  });

  it('returns undefined for empty input', () => {
    expect(cleanInstagramCaption(undefined)).toBeUndefined();
    expect(cleanInstagramCaption('   ')).toBeUndefined();
  });
});

describe('displayCaption', () => {
  it('cleans the wrapper and moves hashtags out', () => {
    expect(displayCaption('10 likes, 2 comments - a on Jan 1, 2026: "Kitchen goals #interior #kitchen"')).toBe(
      'Kitchen goals'
    );
  });
});
