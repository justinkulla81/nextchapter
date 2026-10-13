// Bundles the screen-render check (screens.tsx) so it runs outside Next:
// automatic JSX, '@/' paths bundled, packages left to node, server-only
// stubbed. See screens.tsx.
import { build } from 'esbuild'
import path from 'path'
const root = path.resolve('.')
await build({
  entryPoints: [process.argv[2]], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: 'scripts/higher-ed/render/.out.cjs', logLevel: 'warning',
  plugins: [{ name: 'ext', setup(b) {
    b.onResolve({ filter: /^server-only$/ }, () => ({ path: path.join(root, 'scripts/higher-ed/render/empty.js') }))
    b.onResolve({ filter: /^@\// }, () => undefined)
    b.onResolve({ filter: /^[^./@]|^@[^/]+\// }, (a) => a.path.startsWith('@/') ? undefined : ({ path: a.path, external: true }))
  } }],
  tsconfig: 'tsconfig.json',
})
