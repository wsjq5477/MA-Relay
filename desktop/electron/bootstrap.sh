#!/bin/bash
set -eu
bridge_host="$1"
bridge_dir="${2-}"
bridge_node=''
bridge_candidate=$(command -v node 2>/dev/null || true)
for candidate in "$bridge_candidate" "$HOME"/.local/share/fnm/node-versions/*/installation/bin/node "$HOME"/.nvm/versions/node/*/bin/node /usr/local/bin/node /usr/bin/node; do
  if [ -n "$candidate" ] && [ -x "$candidate" ] && "$candidate" -e 'const [major,minor]=process.versions.node.split(".").map(Number);process.exit(major>22 || major===22 && minor>=13 ? 0 : 1)' 2>/dev/null; then
    bridge_node="$candidate"
    break
  fi
done
if [ -z "$bridge_node" ]; then echo 'AGENTBRIDGE_NODE_MISSING' >&2; exit 78; fi
export PATH="$(dirname "$bridge_node"):$PATH"
cd "$HOME"
if [ -n "$bridge_dir" ]; then
  exec "$bridge_node" --disable-warning=ExperimentalWarning "$bridge_host" "$bridge_dir"
else
  exec "$bridge_node" --disable-warning=ExperimentalWarning "$bridge_host"
fi
