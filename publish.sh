#!/usr/bin/env bash
set -euo pipefail

RELEASE_FILE="new-release.yaml"
NOTES_FILE=""

cleanup() {
    [[ -n "${NOTES_FILE}" && -f "${NOTES_FILE}" ]] && rm -f "${NOTES_FILE}"
}
trap cleanup EXIT

# ── Colors ────────────────────────────────────────────────────────────────────
BOLD='\033[1m'
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
DIM='\033[2m'
NC='\033[0m'

log()  { echo -e "\n${BOLD}${BLUE}==>${NC} ${BOLD}$1${NC}"; }
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
err()  { echo -e "\n${RED}Error:${NC} $1" >&2; exit 1; }

usage() {
    echo ""
    echo -e "${BOLD}Usage:${NC} ./publish.sh"
    echo ""
    echo "  Reads release config from ${RELEASE_FILE}."
    echo "  Edit that file, then run this script."
    echo ""
    echo -e "  ${BOLD}Options:${NC}"
    echo "    -h    Show this help"
    echo ""
    exit 1
}

for arg in "$@"; do
    case "$arg" in
        -h|--help) usage ;;
        *) err "Unexpected argument '${arg}'. Configure the release in ${RELEASE_FILE}." ;;
    esac
done

# ── Helpers ───────────────────────────────────────────────────────────────────
bump_version() {
    local current=$1 bump=$2
    IFS='.' read -r maj min pat <<< "$current"
    case "$bump" in
        major) echo "$((maj + 1)).0.0" ;;
        minor) echo "${maj}.$((min + 1)).0" ;;
        patch) echo "${maj}.${min}.$((pat + 1))" ;;
        *)     echo "$bump" ;;
    esac
}

is_semver() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; }

# Substitute {version} and {tag} placeholders in a string.
fill() { printf '%s\n' "$1" | sed "s/{version}/${NEW_VERSION}/g; s/{tag}/${TAG}/g"; }

# Read a field from new-release.yaml via bun + js-yaml.
# Returns empty string if the field is absent or null.
field() {
    bun -e "
const yaml = require('js-yaml');
const fs   = require('fs');
const cfg  = yaml.load(fs.readFileSync('${RELEASE_FILE}', 'utf8')) || {};
const val  = cfg['$1'];
if (val === null || val === undefined || val === '') process.exit(0);
process.stdout.write(String(val).trim());
" 2>/dev/null || true
}

# True when notes are empty or only the stock template (headings / bare bullets).
notes_are_empty() {
    local filtered
    filtered=$(printf '%s\n' "$1" | sed -E \
        -e '/^[[:space:]]*$/d' \
        -e '/^[[:space:]]*#/d' \
        -e '/^[[:space:]]*[-*][[:space:]]*$/d')
    [[ -z "$filtered" ]]
}

# ── Preflight checks ──────────────────────────────────────────────────────────
log "Preflight checks"

[[ -f "$RELEASE_FILE" ]] || err "${RELEASE_FILE} not found. Create it before running this script."
ok "${RELEASE_FILE} found"

command -v bun &>/dev/null || err "bun is not installed."
ok "bun available"

gh auth status &>/dev/null || err "gh CLI is not authenticated. Run: gh auth login"
ok "gh CLI authenticated"

[[ -n "$(git status --porcelain)" ]] && err "Working tree is not clean. Commit or stash changes first."
ok "Working tree is clean"

# ── Read release config ───────────────────────────────────────────────────────
log "Reading ${RELEASE_FILE}"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

VERSION_INPUT=$(field "version")
RELEASE_BRANCH=$(field "branch")
COMMIT_MSG_RAW=$(field "commit_message")
RELEASE_TITLE_RAW=$(field "title")
RELEASE_NOTES=$(field "notes")
PRE_RELEASE=$(field "pre_release")
UPLOAD_R2=$(field "upload_r2")

# Apply defaults for optional fields
VERSION_INPUT="${VERSION_INPUT:-patch}"
RELEASE_BRANCH="${RELEASE_BRANCH:-$CURRENT_BRANCH}"
PRE_RELEASE="${PRE_RELEASE:-false}"
UPLOAD_R2="${UPLOAD_R2:-false}"

ok "Config loaded"

# ── Validate branch ───────────────────────────────────────────────────────────
git show-ref --verify --quiet "refs/heads/${RELEASE_BRANCH}" \
    || err "Branch '${RELEASE_BRANCH}' does not exist locally."

# Version must come from the release branch, not the currently checked-out branch.
CURRENT_VERSION=$(
    git show "${RELEASE_BRANCH}:package.json" \
        | bun -e "console.log(JSON.parse(await Bun.stdin.text()).version)"
)
[[ -n "$CURRENT_VERSION" ]] || err "Could not read version from ${RELEASE_BRANCH}:package.json."
is_semver "$CURRENT_VERSION" \
    || err "Current version '${CURRENT_VERSION}' on ${RELEASE_BRANCH} is not valid semver (x.y.z)."

# ── Resolve version ───────────────────────────────────────────────────────────
if [[ "$VERSION_INPUT" =~ ^(patch|minor|major)$ ]]; then
    NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$VERSION_INPUT")
elif is_semver "$VERSION_INPUT"; then
    NEW_VERSION="$VERSION_INPUT"
else
    err "Invalid version '${VERSION_INPUT}' in ${RELEASE_FILE}. Use patch/minor/major or x.y.z."
fi

[[ "$NEW_VERSION" == "$CURRENT_VERSION" ]] \
    && err "Version ${NEW_VERSION} is already the current version on ${RELEASE_BRANCH}."

TAG="v${NEW_VERSION}"

git rev-parse "$TAG" &>/dev/null \
    && err "Tag ${TAG} already exists locally."

if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" &>/dev/null; then
    err "Tag ${TAG} already exists on origin."
fi

# Resolve placeholders now that we have the version
COMMIT_MSG=$(fill "${COMMIT_MSG_RAW:-Release {tag}}")
RELEASE_TITLE=$(fill "${RELEASE_TITLE_RAW:-{tag}}")

USE_CUSTOM_NOTES=true
if notes_are_empty "$RELEASE_NOTES"; then
    USE_CUSTOM_NOTES=false
fi

# ── Summary + confirm ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}─── Release summary ────────────────────────────────────────${NC}"
echo ""
echo -e "  Version     ${BOLD}${CURRENT_VERSION}${NC}  →  ${BOLD}${GREEN}${NEW_VERSION}${NC}"
echo -e "  Tag         ${BOLD}${TAG}${NC}"
echo -e "  Branch      ${DIM}${RELEASE_BRANCH}${NC}"
echo -e "  Commit      ${DIM}${COMMIT_MSG}${NC}"
echo -e "  Title       ${DIM}${RELEASE_TITLE}${NC}"
if [[ "$USE_CUSTOM_NOTES" == "true" ]]; then
    echo -e "  Notes       ${DIM}(custom — see ${RELEASE_FILE})${NC}"
else
    echo -e "  Notes       ${DIM}(auto-generated from commits)${NC}"
fi
echo -e "  Pre-release ${DIM}${PRE_RELEASE}${NC}"
echo -e "  R2 upload   ${DIM}${UPLOAD_R2}${NC}"
echo ""
read -rp "  Proceed? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ── Switch branch + sync ──────────────────────────────────────────────────────
if [[ "$CURRENT_BRANCH" != "$RELEASE_BRANCH" ]]; then
    log "Switching to ${RELEASE_BRANCH}"
    git checkout "$RELEASE_BRANCH"
    ok "Checked out ${RELEASE_BRANCH}"
fi

log "Syncing ${RELEASE_BRANCH}"
git pull --ff-only origin "$RELEASE_BRANCH"
ok "Up to date with origin/${RELEASE_BRANCH}"

# Re-read version after pull in case remote moved
CURRENT_VERSION=$(bun -e "console.log(require('./package.json').version)")
if [[ "$VERSION_INPUT" =~ ^(patch|minor|major)$ ]]; then
    NEW_VERSION=$(bump_version "$CURRENT_VERSION" "$VERSION_INPUT")
    TAG="v${NEW_VERSION}"
    COMMIT_MSG=$(fill "${COMMIT_MSG_RAW:-Release {tag}}")
    RELEASE_TITLE=$(fill "${RELEASE_TITLE_RAW:-{tag}}")
fi

[[ "$NEW_VERSION" == "$CURRENT_VERSION" ]] \
    && err "Version ${NEW_VERSION} is already the current version after pull."

git rev-parse "$TAG" &>/dev/null \
    && err "Tag ${TAG} already exists locally after pull."

if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" &>/dev/null; then
    err "Tag ${TAG} already exists on origin."
fi

# ── Bump package.json ─────────────────────────────────────────────────────────
log "Bumping version"
bun -e "
const fs  = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '${NEW_VERSION}';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n');
"
ok "package.json → ${NEW_VERSION}"

# ── Regenerate schema ─────────────────────────────────────────────────────────
log "Regenerating schema"
bun run schema
ok "schema/turboci.schema.json"

# ── Build ─────────────────────────────────────────────────────────────────────
log "Building"
bun run build:all
ok "bin/turboci  (standalone binary)"
ok "dist/turboci.js  (node bundle)"

# ── Commit + tag + push ───────────────────────────────────────────────────────
log "Committing release"
git add package.json schema/turboci.schema.json
git diff --cached --quiet && err "Nothing to commit after version bump (package.json unchanged?)."
git commit -m "$COMMIT_MSG"
ok "Committed"

git tag -a "$TAG" -m "$RELEASE_TITLE"
ok "Tagged ${TAG}"

git push origin "$RELEASE_BRANCH"
git push origin "$TAG"
ok "Pushed ${RELEASE_BRANCH} + ${TAG}"

# ── GitHub release ────────────────────────────────────────────────────────────
log "Creating GitHub release"

GH_ARGS=(
    "$TAG"
    "bin/turboci#turboci-linux-x64"
    "dist/turboci.js#turboci.js"
    "schema/turboci.schema.json#turboci.schema.json"
    --title "$RELEASE_TITLE"
)

if [[ "$USE_CUSTOM_NOTES" == "true" ]]; then
    NOTES_FILE=$(mktemp)
    printf '%s\n' "$RELEASE_NOTES" > "$NOTES_FILE"
    GH_ARGS+=(--notes-file "$NOTES_FILE")
else
    GH_ARGS+=(--generate-notes)
fi

[[ "$PRE_RELEASE" == "true" ]] && GH_ARGS+=(--prerelease)

gh release create "${GH_ARGS[@]}"
ok "https://github.com/Moduletrace/turboci/releases/tag/${TAG}"

# ── Optional R2 upload ────────────────────────────────────────────────────────
if [[ "$UPLOAD_R2" == "true" ]]; then
    log "Uploading to Cloudflare R2"
    bun secrets/write-binaries.ts
    ok "Uploaded to R2"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Released ${TAG} successfully.${NC}"
echo -e "  https://github.com/Moduletrace/turboci/releases/tag/${TAG}"
echo ""
