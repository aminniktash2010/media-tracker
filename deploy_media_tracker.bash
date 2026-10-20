#!/usr/bin/env bash
# Redirect to deploy_media_tracker.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/deploy_media_tracker.sh" "$@"