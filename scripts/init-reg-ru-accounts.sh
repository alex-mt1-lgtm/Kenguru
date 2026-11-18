#!/usr/bin/env bash
set -euo pipefail
umask 077

hosting_root=${1:-"$HOME"}
config="$hosting_root/olympiads-config.php"
if [[ ! -d "$hosting_root/www/olympiads.pro" ]]; then
    echo 'The hosting directory for olympiads.pro could not be found.' >&2
    exit 1
fi
if [[ -e "$config" || -L "$config" ]]; then
    echo 'The account configuration already exists.'
    exit 0
fi

temporary=$(mktemp "$hosting_root/.olympiads-config.XXXXXXXX")
trap 'rm -f -- "$temporary"' EXIT
cat > "$temporary" <<'PHP'
<?php
return ['mail_from' => 'noreply@olympiads.pro'];
PHP
ln -- "$temporary" "$config"
echo 'The private account configuration was created.'
