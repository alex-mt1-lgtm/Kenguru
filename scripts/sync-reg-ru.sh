#!/usr/bin/env bash
# Install a complete site release and switch the Apache routes from the Reg.ru user cron.
set -euo pipefail
umask 022

site_root=${1:-"$HOME/www/olympiads.pro"}
state_dir=${2:-"$(dirname -- "$(dirname -- "$site_root")")/.olympiads-deploy"}
action=${3:-sync}
repo_url=${OLYMPIADS_REPO_URL:-https://github.com/alex-mt1-lgtm/Kenguru.git}
release_ref=refs/heads/olympiads
begin='# BEGIN olympiads.pro managed release'
end='# END olympiads.pro managed release'
stage=''
selector=''
state_file=''

fail() { printf '%s\n' "$*" >&2; exit 1; }
is_sha() { [[ "$1" =~ ^[a-f0-9]{40}$ ]]; }
cleanup() {
    if [[ -n "$stage" ]]; then rm -rf -- "$stage"; fi
    if [[ -n "$selector" ]]; then rm -f -- "$selector"; fi
    if [[ -n "$state_file" ]]; then rm -f -- "$state_file"; fi
}
trap cleanup EXIT

case "$action" in
    sync|resume|list|prune) [[ $# -le 3 ]] || fail 'No release ID is expected.' ;;
    rollback) [[ $# -eq 4 ]] || fail 'Usage: sync-reg-ru.sh SITE_ROOT STATE_DIR rollback RELEASE_ID|legacy' ;;
    *) fail "Unknown action: $action" ;;
esac
[[ -d "$site_root" ]] || fail "Site directory does not exist: $site_root"
site_root=$(cd -- "$site_root" && pwd -P)
state_parent=$(realpath -m -- "$state_dir")
[[ "$state_parent/" != "$site_root/"* ]] || fail 'The deployment state must stay outside the public directory.'
mkdir -p -m 700 -- "$state_dir"
exec 9>"$state_dir/lock"
if ! flock -n 9; then
    [[ "$action" == sync ]] && exit 0
    fail 'Another site operation is in progress.'
fi
releases="$site_root/_releases"
[[ ! -L "$releases" ]] || fail 'Release directory cannot be a symbolic link.'
mkdir -p -- "$releases"

write_state() {
    local name=$1 value=$2
    if [[ "$(read_state "$name")" == "$value" ]]; then return; fi
    state_file=$(mktemp "$state_dir/.$name.XXXXXXXX")
    printf '%s\n' "$value" > "$state_file"
    mv -fT -- "$state_file" "$state_dir/$name"
    state_file=''
}

read_state() { cat -- "$state_dir/$1" 2>/dev/null || true; }

check_release() {
    local release=$1 directory="$releases/$1" marker file
    is_sha "$release" || return 1
    marker="$directory/.olympiads-ready"
    [[ -d "$directory" && ! -L "$directory" && -f "$marker" && ! -L "$marker" ]] || return 1
    [[ "$(head -n 1 -- "$marker")" == "$release" ]] || return 1
    for file in index.html archive.html app.js api/auth.php api/rating-catalog.json .htaccess; do
        [[ -s "$directory/$file" && ! -L "$directory/$file" ]] || return 1
    done
    [[ -d "$directory/assets" && ! -L "$directory/assets" && ! -L "$directory/api" ]]
}

fingerprint() (
    cd -- "$1"
    {
        find . -mindepth 1 ! -path './.olympiads-ready' -printf '%y %p\0' | LC_ALL=C sort -z
        find . -type f ! -path './.olympiads-ready' -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum --
    } | sha256sum | cut -d ' ' -f1
)

manage_retention() {
    local directory release marker recorded status
    local active previous pinned
    active=$(read_state published)
    previous=$(read_state previous)
    pinned=$(read_state pinned)
    for directory in "$releases"/*; do
        release=${directory##*/}
        check_release "$release" || continue
        marker="$directory/.olympiads-ready"
        recorded=$(sed -n '2p' "$marker")
        if [[ "$release" == "$active" || "$release" == "$previous" || "$release" == "$pinned" ]] ||
           grep -Fq "/_releases/$release/" "$site_root/.htaccess" 2>/dev/null; then
            status='protected (active, previous, pinned or referenced by .htaccess)'
        elif [[ -z "$(find "$marker" -maxdepth 0 -mtime +29 -print)" ]]; then
            status='retained for at least 30 days'
        elif [[ "$action" == list ]]; then
            status='eligible for integrity check and pruning'
        elif [[ "$recorded" =~ ^[a-f0-9]{64}$ && "$recorded" == "$(fingerprint "$directory")" ]]; then
            rm -r -- "$directory"
            status='pruned'
        else
            status='retained because its contents changed'
        fi
        printf '%s %s\n' "$release" "$status"
    done
}

activate() {
    local release=$1 target="$site_root/.htaccess" rules prior
    if [[ "$release" == legacy ]]; then
        [[ -s "$site_root/index.html" && -s "$site_root/archive.html" ]] || fail 'The legacy HTML is unavailable.'
    else
        check_release "$release" || fail "No complete managed release: $release"
    fi
    [[ ! -L "$target" && ( ! -e "$target" || -f "$target" ) ]] || fail 'Cannot manage the existing .htaccess file.'
    selector=$(mktemp "$site_root/.olympiads-selector.XXXXXXXX")
    if [[ -f "$target" ]]; then
        # Preserve hosting rules. Reject damaged or repeated markers before modifying the file.
        awk -v begin="$begin" -v end="$end" '
            $0 == begin { if (seen++) exit 1; inside = 1; next }
            $0 == end { if (!inside) exit 1; inside = 0; next }
            !inside { print }
            END { if (inside) exit 1 }
        ' "$target" > "$selector" || fail 'Malformed olympiads.pro selector block in .htaccess.'
        chmod --reference="$target" -- "$selector"
    else
        chmod 644 -- "$selector"
    fi
    if [[ "$release" != legacy ]]; then
        rules="/_releases/$release"
        cat >> "$selector" <<RULES
$begin
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^_releases/?\$ - [R=404,L]
    RewriteRule ^_releases/\\. - [R=404,L]
    RewriteRule ^_releases/[a-f0-9]{40}/api(?:/|\$) - [R=404,L]
    RewriteRule ^(?:index\\.html)?\$ $rules/index.html [END]
    RewriteRule ^archive\\.html\$ $rules/archive.html [END]
    RewriteRule ^api/auth\\.php\$ $rules/api/auth.php [END]
</IfModule>
$end
RULES
    fi
    if [[ -f "$target" ]] && cmp -s -- "$selector" "$target"; then
        rm -f -- "$selector"
    else
        mv -fT -- "$selector" "$target"
    fi
    selector=''
    prior=$(read_state published)
    if [[ "$prior" != "$release" ]] && check_release "$prior"; then
        # Users can still request that release from a tab opened immediately before the switch.
        touch -- "$releases/$prior/.olympiads-ready"
        write_state previous "$prior"
    fi
    write_state published "$release"
}

if [[ "$action" == list || "$action" == prune ]]; then
    manage_retention
    exit 0
fi
if [[ "$action" == rollback ]]; then
    release=$4
    if [[ "$release" != legacy ]]; then
        check_release "$release" || fail "No complete managed release: $release"
    fi
    activate "$release"
    write_state pinned "$release"
    printf 'Pinned olympiads.pro release %s\n' "$release"
    exit 0
fi
if [[ "$action" == resume ]]; then
    rm -f -- "$state_dir/pinned"
elif [[ -f "$state_dir/pinned" ]]; then
    activate "$(cat -- "$state_dir/pinned")"
    exit 0
fi

repo="$state_dir/repository"
# Shared hosting can limit the virtual address space below the size of a single pack.
release_git() {
    git --git-dir="$repo" -c core.packedGitWindowSize=1m -c core.packedGitLimit=8m \
        -c core.deltaBaseCacheLimit=2m -c pack.threads=1 "$@"
}
if [[ ! -d "$repo/objects" ]]; then
    git init --bare --quiet "$repo"
fi
# Interrupted fetches on shared hosting can leave an entire incoming pack on disk.
# All fetches in this private deployment repository run under the lock above.
if [[ -d "$repo/objects/pack" ]]; then
    find "$repo/objects/pack" -maxdepth 1 -type f -name 'tmp_pack_??????' -mmin +60 -delete
fi
release_git fetch --quiet --no-tags "$repo_url" "$release_ref:$release_ref"
release=$(release_git rev-parse --verify "$release_ref^{commit}")
if ! check_release "$release"; then
    if ! packaged=$(release_git ls-tree --name-only "$release:_releases" 2>/dev/null); then
        echo 'Waiting for the first packaged olympiads.pro release. The existing site is serving.'
        exit 0
    fi
    is_sha "$packaged" || fail 'Expected exactly one versioned resource set.'
    tree="$release:_releases/$packaged"
    modes=$({ release_git ls-tree -r "$tree"; release_git ls-tree -r "$release:api"; } | cut -d ' ' -f1 | LC_ALL=C sort -u)
    [[ "$modes" == 100644 || "$modes" == 100755 || "$modes" == $'100644\n100755' ]] || fail 'The release may contain only regular files.'
    [[ ! -e "$releases/$release" && ! -L "$releases/$release" ]] || fail "Existing release directory is incomplete: $release"
    stage=$(mktemp -d "$releases/.stage.XXXXXXXX")
    release_git archive "$tree" | tar -xf - -C "$stage"
    mkdir -- "$stage/api"
    release_git archive "$release:api" | tar -xf - -C "$stage/api"
    for file in index.html archive.html app.js api/auth.php api/rating-catalog.json .htaccess; do
        [[ -s "$stage/$file" ]] || fail "Release $release is missing $file."
    done
    [[ -d "$stage/assets" ]] || fail "Release $release is missing its assets."
    for page in index.html archive.html; do
        grep -Fq "<base href=\"/_releases/$packaged/\">" "$stage/$page" || fail "Release base missing in $page."
        sed -i "s|<base href=\"/_releases/$packaged/\">|<base href=\"/_releases/$release/\">|" "$stage/$page"
    done
    { printf '%s\n' "$release"; fingerprint "$stage"; } > "$stage/.olympiads-ready"
    chmod 755 -- "$stage"
    mv -T -- "$stage" "$releases/$release"
    stage=''
fi

was_published=$(read_state published)
activate "$release"
if [[ "$was_published" != "$release" ]]; then
    printf 'Published olympiads.pro release %s\n' "$release"
fi
