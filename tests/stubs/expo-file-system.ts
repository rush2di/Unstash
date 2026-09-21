/**
 * Test stub for `expo-file-system`.
 *
 * The preview queue only needs the thumbnail cache to succeed or fail; the tests that use
 * this stub assert on database writes, not on file contents.
 */
export class File {
  readonly uri: string;
  readonly exists = false;
  readonly name: string;

  constructor(...segments: unknown[]) {
    this.uri = `file:///stub/${segments.map(String).join('/')}`;
    this.name = String(segments[segments.length - 1] ?? '');
  }

  delete(): void {}

  static async downloadFileAsync(_url: string, destination: File): Promise<File> {
    return destination;
  }
}

export class Directory {
  readonly exists = true;
  readonly uri: string;

  constructor(...segments: unknown[]) {
    this.uri = `file:///stub/${segments.map(String).join('/')}`;
  }

  create(): void {}

  list(): File[] {
    return [];
  }
}

export const Paths = {
  cache: 'cache',
  document: 'document',
};
