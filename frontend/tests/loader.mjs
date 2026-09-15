export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers') {
    return nextResolve('next/headers.js', context);
  }
  if (specifier === 'next/server') {
    return nextResolve('next/server.js', context);
  }
  if (specifier === '@/lib/auth') {
    return nextResolve(new URL('../lib/auth.ts', import.meta.url).href, context);
  }
  if (specifier === '@/lib/auth-shared') {
    return nextResolve(new URL('../lib/auth-shared.ts', import.meta.url).href, context);
  }
  if (specifier.startsWith('.') && !specifier.endsWith('.js') && !specifier.endsWith('.ts') && !specifier.endsWith('.mjs') && !specifier.endsWith('.json')) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      return await nextResolve(specifier + '.js', context);
    }
  }
  return nextResolve(specifier, context);
}
