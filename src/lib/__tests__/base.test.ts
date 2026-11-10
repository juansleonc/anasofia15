import { describe, it, expect } from 'vitest';
import { withBase } from '../base';

describe('withBase', () => {
  // Adversarial cases first: the ways an internal link can silently 404 under a GH Pages subpath.
  it('never returns a root-absolute path when the deploy base is a subpath', () => {
    const result = withBase('/images/gallery/1.jpg', '/anasofia15/');

    expect(result).not.toBe('/images/gallery/1.jpg');
    expect(result.startsWith('/anasofia15/')).toBe(true);
  });

  it('does not double the separator when both the base and the path carry a slash', () => {
    expect(withBase('/foo.png', '/anasofia15/')).toBe('/anasofia15/foo.png');
  });

  it('normalizes a base that is missing its trailing slash', () => {
    expect(withBase('foo.png', '/anasofia15')).toBe('/anasofia15/foo.png');
  });

  it('prefixes a relative internal path with the configured base', () => {
    expect(withBase('images/og.jpg', '/anasofia15/')).toBe('/anasofia15/images/og.jpg');
  });
});
