// Strip trailing slashes and prepend `http://` when the user omits a scheme,
// so handwritten Server values like `127.0.0.1:7777` or `http://host:7777/`
// don't produce `//ping` 404s or opaque "scheme missing" fetch errors.
export function normaliseServer(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/^(?!https?:\/\/)/i, 'http://');
}
