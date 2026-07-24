#!/bin/bash
export PATH="/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"
exec node node_modules/next/dist/bin/next dev -p 3000
