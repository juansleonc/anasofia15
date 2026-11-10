import { describe, it, expect, vi } from 'vitest';
import { publicAssetExists } from '../assets';

describe('publicAssetExists', () => {
  // Adversarial cases first: the ways this could wrongly report an asset as present.

  it('returns false without ever calling exists() when the path tries to escape publicDir', () => {
    const exists = vi.fn(() => true);

    const result = publicAssetExists('/../secrets.env', '/project/public', exists);

    expect(result).toBe(false);
    expect(exists).not.toHaveBeenCalled();
  });

  it('returns false for a path containing ".." anywhere, even nested', () => {
    const exists = vi.fn(() => true);

    const result = publicAssetExists('/images/../../etc/passwd', '/project/public', exists);

    expect(result).toBe(false);
    expect(exists).not.toHaveBeenCalled();
  });

  it('strips a leading slash before joining under publicDir', () => {
    const exists = vi.fn(() => true);

    publicAssetExists('/music/song.mp3', '/project/public', exists);

    expect(exists).toHaveBeenCalledWith('/project/public/music/song.mp3');
  });

  it('joins a path with no leading slash the same way', () => {
    const exists = vi.fn(() => true);

    publicAssetExists('images/portrait.jpg', '/project/public', exists);

    expect(exists).toHaveBeenCalledWith('/project/public/images/portrait.jpg');
  });

  it('returns true when the injected exists() reports the file present', () => {
    expect(publicAssetExists('/music/song.mp3', '/project/public', () => true)).toBe(true);
  });

  it('returns false when the injected exists() reports the file missing', () => {
    expect(publicAssetExists('/music/song.mp3', '/project/public', () => false)).toBe(false);
  });

  it('defaults to false-safe behavior with no injected exists (real filesystem, missing file)', () => {
    expect(publicAssetExists('/this-file-does-not-exist-anywhere.xyz')).toBe(false);
  });
});
