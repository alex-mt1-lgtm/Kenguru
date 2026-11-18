#!/usr/bin/env bash
# Pull and publish the static release from a Reg.ru user cron job.
set -euo pipefail
umask 022

site_root=${1:-"$HOME/www/olympiads.pro"}
state_dir="$HOME/.olympiads-deploy"
repo_url=https://github.com/alex-mt1-lgtm/Kenguru.git
release_ref=refs/heads/olympiads

if [[ ! -d "$site_root" ]]; then
    printf 'Site directory does not exist: %s\n' "$site_root" >&2
    exit 1
fi
command -v flock >/dev/null
mkdir -p -m 700 "$state_dir"
exec 9>"$state_dir/lock"
if ! flock -n 9; then exit 0; fi

repo="$state_dir/repository"
if [[ ! -d "$repo/objects" ]]; then
    git init --bare --quiet "$repo"
fi
git --git-dir="$repo" fetch --quiet --no-tags "$repo_url" "$release_ref:$release_ref"
release=$(git --git-dir="$repo" rev-parse "$release_ref")
if [[ -s "$site_root/index.html" && -s "$site_root/archive.html" && -f "$state_dir/published" ]] &&
   [[ "$(cat "$state_dir/published")" == "$release" ]]; then
    exit 0
fi

stage=$(mktemp -d "$state_dir/release.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
git --git-dir="$repo" archive "$release" | tar -xf - -C "$stage"
if [[ ! -s "$stage/index.html" || ! -s "$stage/archive.html" ||
      ! -s "$stage/app.js" || ! -d "$stage/assets" ]]; then
    printf 'Release %s is missing public site files.\n' "$release" >&2
    exit 1
fi
find "$stage" -type f -print0 > "$state_dir/pending"
while IFS= read -r -d '' file; do
    relative=${file#"$stage/"}
    if [[ "$relative" == index.html || "$relative" == archive.html ]]; then continue; fi
    target="$site_root/$relative"
    mkdir -p -- "${target%/*}"
    mv -f -- "$file" "$target"
done < "$state_dir/pending"
mv -f -- "$stage/archive.html" "$site_root/archive.html"
mv -f -- "$stage/index.html" "$site_root/index.html"
printf '%s\n' "$release" > "$state_dir/published"
printf 'Published olympiads.pro release %s\n' "$release"
