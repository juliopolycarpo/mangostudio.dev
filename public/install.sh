#!/usr/bin/env bash
#
# MangoStudio installer — PLACEHOLDER
#
# The production install script is produced by the MangoStudio application's
# release pipeline (https://github.com/juliopolycarpo/mangostudio). This stub
# only reserves the future `curl ... | bash` endpoint until that pipeline
# publishes the real script. It performs no installation.
#
set -euo pipefail

cat <<'EOF'
MangoStudio installer (placeholder)

This endpoint will serve the real installer once the app release pipeline ships it.
For now, install with Bun:

    bun add -g @mangostudio/cli

Or grab a prebuilt binary from the releases page:

    https://github.com/juliopolycarpo/mangostudio/releases
EOF

exit 0
