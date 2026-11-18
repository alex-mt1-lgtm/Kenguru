#!/usr/bin/env bash
# Publish the already-checked static site from the current main revision.
set -euo pipefail

source_commit=$(git rev-parse --verify 'HEAD^{commit}')
git fetch --no-tags origin main
if [[ "$(git rev-parse FETCH_HEAD)" != "$source_commit" ]]; then
    echo 'main has advanced. Its workflow will publish the newer revision.'
    exit 0
fi

release_ref=refs/heads/olympiads
release_tree=$(git rev-parse --verify "$source_commit:dist")
git cat-file -e "$release_tree:index.html"
git cat-file -e "$release_tree:archive.html"

parents=()
release_remote=$(git ls-remote origin "$release_ref")
if [[ -n "$release_remote" ]]; then
    git fetch --no-tags origin "$release_ref"
    release_parent=$(git rev-parse FETCH_HEAD)
    if [[ "$(git rev-parse "$release_parent^{tree}")" == "$release_tree" ]]; then
        echo 'The published files already match main.'
        exit 0
    fi
    parents=(-p "$release_parent")
fi

release_commit=$(git commit-tree "$release_tree" "${parents[@]}" -m "Publish site from $source_commit")
git push origin "$release_commit:$release_ref"
