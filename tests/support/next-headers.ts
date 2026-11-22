// Test-only stand-in for next/headers: a plain cookie jar, so route handlers that set or read session cookies can run outside a request.
type Stored = { value: string; options?: unknown };

export const jar = new Map<string, Stored>();

export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: (jar.get(name) as Stored).value } : undefined),
    set: (name: string, value: string, options?: unknown) => void jar.set(name, { value, options }),
    delete: (name: string) => void jar.delete(name),
  };
}
