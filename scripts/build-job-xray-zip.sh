#!/bin/sh
# Rebuilds public/downloads/nextchapter-job-xray.zip from extensions/job-xray.
# Run after any change to the extension, and commit the zip.
set -e
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
cp -R "$root/extensions/job-xray" "$tmp/nextchapter-job-xray"
rm -f "$root/public/downloads/nextchapter-job-xray.zip"
(cd "$tmp" && zip -qr "$root/public/downloads/nextchapter-job-xray.zip" nextchapter-job-xray -x '*.DS_Store')
rm -rf "$tmp"
