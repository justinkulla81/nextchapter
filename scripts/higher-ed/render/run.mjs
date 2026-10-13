// npm run check:he-screens [-- <slug> [<tab prefix>]]: bundle, run, clean up.
import { execFileSync } from 'child_process'
import { rmSync } from 'fs'

const out = 'scripts/higher-ed/render/.out.cjs'
let code = 0
try {
  execFileSync('node', ['scripts/higher-ed/render/build.mjs', 'scripts/higher-ed/render/screens.tsx'], { stdio: 'inherit' })
  execFileSync('node', ['--env-file=.env.local', out, ...process.argv.slice(2)], { stdio: 'inherit' })
} catch (e) {
  code = e.status ?? 1
} finally {
  rmSync(out, { force: true })
}
process.exit(code)
