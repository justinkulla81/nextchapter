// Runs a Python pipeline script with the environment already loaded from
// .env.local (via node --env-file), so CENSUS_API_KEY / SEC_USER_AGENT reach
// Python the same way the TypeScript scripts get their secrets.
//
// Usage (through npm): node --env-file=.env.local run-python.mjs <script.py> [args…]
import { spawn } from 'node:child_process'

const [script, ...args] = process.argv.slice(2)
if (!script) {
  console.error('usage: run-python.mjs <script.py> [args…]')
  process.exit(1)
}

const py = process.env.PYTHON ?? 'python3'
const child = spawn(py, [script, ...args], { stdio: 'inherit', env: process.env })
child.on('error', (e) => {
  console.error(`Could not start ${py}:`, e.message)
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 0))
