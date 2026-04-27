import { describe, it, expect } from 'vitest';
import { normaliseServer } from '../src/ui/normalise-server';

describe('normaliseServer', () => {
  it('passes canonical URL through unchanged', () => {
    expect(normaliseServer('http://127.0.0.1:7777')).toBe('http://127.0.0.1:7777');
    expect(normaliseServer('https://example.com')).toBe('https://example.com');
  });

  it('strips trailing slashes', () => {
    expect(normaliseServer('http://127.0.0.1:7777/')).toBe('http://127.0.0.1:7777');
    expect(normaliseServer('http://127.0.0.1:7777///')).toBe('http://127.0.0.1:7777');
  });

  it('prepends http:// when scheme is missing', () => {
    expect(normaliseServer('127.0.0.1:7777')).toBe('http://127.0.0.1:7777');
    expect(normaliseServer('localhost:7777')).toBe('http://localhost:7777');
  });

  it('preserves https:// (case-insensitive)', () => {
    expect(normaliseServer('https://example.com')).toBe('https://example.com');
    expect(normaliseServer('HTTP://host:7777')).toBe('HTTP://host:7777');
    expect(normaliseServer('HTTPS://host')).toBe('HTTPS://host');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseServer('  http://host:7777  ')).toBe('http://host:7777');
    expect(normaliseServer('\thttp://host\n')).toBe('http://host');
  });

  it('returns a degenerate string for empty input the caller can detect', () => {
    // Empty input collapses to just the prepended scheme — the caller checks
    // for `'http://'` to surface a friendly "Server URL is empty" error
    // instead of letting `fetch('http:///ping')` fail opaquely.
    expect(normaliseServer('')).toBe('http://');
    expect(normaliseServer('   ')).toBe('http://');
  });

  it('preserves protocol-relative-looking input by treating it as schemeless', () => {
    // `//example.com` has no `https?://` prefix, so it gets `http://` prepended.
    // This is intentional: the Server field expects an absolute URL, and
    // protocol-relative references are not meaningful from a plugin iframe.
    expect(normaliseServer('//example.com')).toBe('http:////example.com');
  });
});
