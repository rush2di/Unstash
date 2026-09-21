import * as Crypto from 'expo-crypto';

/** UUID v4 identifier for every domain row. */
export function createId(): string {
  return Crypto.randomUUID();
}
