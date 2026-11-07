#!/usr/bin/env bash
# Fixed test driver: paths are positional data, never part of bash -c source.
set -euo pipefail

[ "$#" -eq 4 ] || { printf 'expected mode, installer and two fixture paths\n' >&2; exit 1; }
case "$1" in
  install | checksum) ;;
  *) printf 'unsupported fixture mode: %s\n' "$1" >&2; exit 1 ;;
esac

source "$2"
case "$1" in
  install) install_archive "$3" fixture "$4" ;;
  checksum) verify_checksum "$3" "$4" fixture ;;
esac
