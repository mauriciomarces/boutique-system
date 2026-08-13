#!/usr/bin/env bash
set -e

echo "Bootstrapping Boutique System microservices..."
for dir in backend/services/*; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing dependencies in $dir"
    (cd "$dir" && npm install >/dev/null 2>&1 || true)
  fi
done

echo "Bootstrap complete."
