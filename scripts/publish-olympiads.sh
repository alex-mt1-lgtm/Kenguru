#!/usr/bin/env bash
# Publish the checked dist snapshot while retaining compatibility with the original hosting cron.
set -euo pipefail

source_commit=$(git rev-parse --verify 'HEAD^{commit}')
git fetch --no-tags origin main
if [[ "$(git rev-parse FETCH_HEAD)" != "$source_commit" ]]; then
    echo 'main has advanced. Its workflow will publish the newer revision.'
    exit 0
fi

release_ref=refs/heads/olympiads
release_id=$(git rev-parse --verify "$source_commit:dist")
release_path="_releases/$release_id"
for file in index.html archive.html app.js api/auth.php api/rating-catalog.json .htaccess; do
    git cat-file -e "$release_id:$file"
done

release_parent=''
release_remote=$(git ls-remote origin "$release_ref")
if [[ -n "$release_remote" ]]; then
    git fetch --no-tags origin "$release_ref"
    release_parent=$(git rev-parse FETCH_HEAD)
fi

# Shell functions below use a temporary index. The working tree and the site's .htaccess are untouched.
work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT
export GIT_INDEX_FILE="$work/index"
git read-tree "${release_parent:-$release_id}"
# Keep original unversioned resources for already-open legacy HTML and old cron validation.
git ls-files -z -- _releases/ api/ | git update-index --force-remove -z --stdin
git update-index --force-remove -- .htaccess
git read-tree --prefix=api/ "$release_id:api"
git read-tree --prefix="$release_path/" "$release_id"
# Only the stable root API is installed by the original cron.
git ls-files -z -- "$release_path/api/" | git update-index --force-remove -z --stdin

# Older sync scripts publish root HTML last. Each HTML page refers only to its own resource set.
# meta supports the loading policy on those servers. frame-ancestors requires a response header.
policy=$(git show "$release_id:.htaccess" | sed -n 's/^ *Header always set Content-Security-Policy "\([^"]*\); frame-ancestors '\''none'\''"$/\1/p')
if [[ -z "$policy" || "$policy" == *$'\n'* ]]; then
    echo 'Expected one HTML CSP declaration in dist/.htaccess.' >&2
    exit 1
fi
for page in index.html archive.html; do
    git show "$release_id:$page" > "$work/source.html"
    if ! grep -Fq '<head>' "$work/source.html" || grep -Eq '<base[[:space:]]' "$work/source.html"; then
        printf 'Cannot set the release base in %s.\n' "$page" >&2
        exit 1
    fi
    sed -e "s|<head>|<head><meta http-equiv=\"Content-Security-Policy\" content=\"$policy\"><base href=\"/$release_path/\">|" \
        -e 's|href="\./|href="/|g' \
        -e 's|href="archive\.html|href="/archive.html|g' \
        -e 's|href="#grades-|href="/archive.html#grades-|g' \
        "$work/source.html" > "$work/$page"
    blob=$(git hash-object -w "$work/$page")
    git update-index --cacheinfo "100644,$blob,$page" --cacheinfo "100644,$blob,$release_path/$page"
done
release_tree=$(git write-tree)

parents=()
if [[ -n "$release_parent" ]]; then
    if [[ "$(git rev-parse "$release_parent^{tree}")" == "$release_tree" ]]; then
        echo 'The published files already match main.'
        exit 0
    fi
    parents=(-p "$release_parent")
fi

release_commit=$(git commit-tree "$release_tree" "${parents[@]}" -m "Publish site from $source_commit")
git push origin "$release_commit:$release_ref"
