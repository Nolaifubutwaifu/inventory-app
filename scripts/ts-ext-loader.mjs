// Node's type stripper does not rewrite extensionless imports. Resolve
// relative specifiers to .ts so `node --test` can load the app modules.
export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.(?:[cm]?js|json|ts|tsx|mjs|cjs)$/.test(specifier)
  ) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // Not a TypeScript file; let the default resolver report the real error.
    }
  }
  return nextResolve(specifier, context);
}
