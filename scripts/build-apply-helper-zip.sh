#!/bin/sh
# Rebuilds public/downloads/nextchapter-apply-helper.zip from extensions/apply-helper.
# Run after any change to the extension, and commit the zip.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
cp -R "$root/extensions/apply-helper" "$tmp/nextchapter-apply-helper"
rm -f "$root/public/downloads/nextchapter-apply-helper.zip"
(cd "$tmp" && zip -qr "$root/public/downloads/nextchapter-apply-helper.zip" nextchapter-apply-helper -x '*.DS_Store')
rm -rf "$tmp"
