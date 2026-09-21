/**
 * Joins class names, dropping falsy values.
 *
 * Uniwind does not deduplicate conflicting utilities, so a later class in the same string
 * does not reliably win over an earlier one. Keep conflicting utilities out of the same call
 * and pass overrides through the `className` prop, which is appended last.
 */
export type ClassValue = string | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
