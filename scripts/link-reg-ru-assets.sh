#!/usr/bin/env bash
# Run from the hosting account's data directory. The default is a read-only preview of release files.
set -euo pipefail
export LC_ALL=C
umask 077

mode=${1:---dry-run}
case "$mode" in --dry-run|--apply) ;; *) echo 'Expected --dry-run or --apply.' >&2; exit 2 ;; esac
[[ $# -le 1 ]] || { echo 'Too many arguments.' >&2; exit 2; }
state=.olympiads-deploy
releases=www/olympiads.pro/_releases
[[ -d "$state" && -d "$releases" && ! -L "$releases" ]] || { echo 'Run from the hosting data directory.' >&2; exit 1; }
exec 9>>"$state/lock"
flock -w 120 9 || { echo 'The deployment lock is busy. Retry later.' >&2; exit 1; }

shopt -s nullglob
roots=()
for release in "$releases"/*; do
    if [[ ${release##*/} =~ ^[0-9a-f]{40}$ && ! -L "$release" && -d "$release/assets" && ! -L "$release/assets" ]]; then
        roots+=("$release/assets")
    fi
done
if (( ${#roots[@]} < 2 )); then echo 'Saved: 0 MiB (fewer than two asset directories)'; exit 0; fi

manifest=$(mktemp "$state/asset-list.XXXXXXXX")
stage=''
cleanup() {
    rm -f -- "$manifest"
    if [[ -n "$stage" ]]; then rm -f -- "$stage/link"; rmdir -- "$stage"; fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM

# Already-linked files come first so an existing shared inode can serve as the reference.
find "${roots[@]}" -xdev -type f ! -empty -printf '%n:%D:%b:%m:%U:%G:%s/%p\0' |
    sort -z -nr -S 2M -T "$state" > "$manifest"
device=$(stat -c %d -- "$releases")
declare -A references
saved=0
files=0
while IFS= read -r -d '' entry; do
    path=${entry#*/}
    relative=${path#"$releases"/}
    relative=${relative#*/assets/}
    IFS=: read -r links dev blocks permissions owner group size <<< "${entry%%/*}"
    [[ "$dev" == "$device" ]] || continue
    version=0
    while :; do
        key="$version:$permissions:$owner:$group:$size:$relative"
        reference=${references["$key"]-}
        if [[ -z "$reference" ]]; then
            references["$key"]=$path
            break
        fi
        [[ "$reference" -ef "$path" ]] && break
        if cmp -s -- "$reference" "$path"; then
            # Replacing a path to a multiply linked inode may free no space.
            (( links == 1 )) || break
            if [[ "$mode" == --apply ]]; then
                if [[ -z "$stage" ]]; then stage=$(mktemp -d "$releases/.link-assets.XXXXXXXX"); fi
                ln -- "$reference" "$stage/link"
                mv -fT -- "$stage/link" "$path"
            fi
            files=$((files + 1))
            saved=$((saved + blocks))
            break
        else
            status=$?
            if (( status != 1 )); then printf 'Cannot compare %s and %s\n' "$reference" "$path" >&2; exit "$status"; fi
        fi
        (( version += 1 ))
    done
done < "$manifest"
printf 'Mode: %s\nFiles: %s\n' "$mode" "$files"
awk -v blocks="$saved" 'BEGIN { printf "Saved: %.2f MiB\n", blocks / 2048 }'
