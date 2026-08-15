#!/usr/bin/env bash
#
# Run Zen Journeys on the right version of Node.
#
#   ./run.sh              start the dev server
#   ./run.sh --host       ...and expose it on the network, for a phone or a TV
#   ./run.sh build        type check and bundle into dist/
#   ./run.sh preview      serve the built bundle
#   ./run.sh typecheck    type check only
#   ./run.sh icons        regenerate the app icons
#
# Picks up nvm if it is installed and switches to the version in .nvmrc.
# Without nvm it uses whatever Node is on PATH, and says so if that is too old.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

readonly MIN_MAJOR=20
readonly MIN_MINOR=19 # Vite 8 needs 20.19+ or 22+

say() { printf '\033[2m%s\033[0m\n' "$*" >&2; }
die() {
  printf '\033[31m%s\033[0m\n' "$*" >&2
  exit 1
}

# --- nvm -------------------------------------------------------------------

load_nvm() {
  local candidate
  for candidate in "${NVM_DIR:-}" "$HOME/.nvm" /opt/nvm /usr/local/nvm; do
    [ -n "$candidate" ] || continue
    [ -s "$candidate/nvm.sh" ] || continue
    export NVM_DIR="$candidate"
    # nvm.sh is not written against `set -eu`, so stand down while sourcing it.
    set +eu
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
    set -eu
    return 0
  done
  return 1
}

if load_nvm; then
  say "nvm found in $NVM_DIR, using the version in .nvmrc"
  # `nvm install` reads .nvmrc, downloads the version only if it is missing,
  # and switches to it either way.
  set +u
  nvm install
  set -u
else
  say "no nvm found, using the Node already on PATH"
fi

# --- Node version ----------------------------------------------------------

command -v node >/dev/null 2>&1 || die "No Node found. Install Node ${MIN_MAJOR}.${MIN_MINOR}+, or nvm, and try again."

node_version="$(node -v)"        # v22.22.2
node_version="${node_version#v}" # 22.22.2
node_major="${node_version%%.*}"
node_rest="${node_version#*.}"
node_minor="${node_rest%%.*}"

if [ "$node_major" -lt "$MIN_MAJOR" ] ||
  { [ "$node_major" -eq "$MIN_MAJOR" ] && [ "$node_minor" -lt "$MIN_MINOR" ]; }; then
  die "Node $node_version is too old. Vite 8 needs ${MIN_MAJOR}.${MIN_MINOR}+ or 22+.
Install nvm and re-run this script, or upgrade Node by hand."
fi

say "node $node_version"

# --- Dependencies ----------------------------------------------------------

# Reinstall when the lockfile has moved on, so a git pull cannot leave stale
# packages behind.
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules ]; then
  say "installing dependencies"
  npm install
  # Bump the directory so the check above settles until the lockfile changes.
  touch node_modules
fi

# --- Run -------------------------------------------------------------------

script="dev"
if [ "$#" -gt 0 ]; then
  case "$1" in
    dev | build | preview | typecheck | icons)
      script="$1"
      shift
      ;;
  esac
fi

say "npm run $script${*:+ -- $*}"
echo >&2
exec npm run "$script" ${*:+-- "$@"}
