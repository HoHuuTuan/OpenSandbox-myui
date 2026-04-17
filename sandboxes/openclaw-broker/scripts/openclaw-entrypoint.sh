#!/bin/sh
set -eu

OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-8080}"
OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-123456}"
OPENCLAW_TOOLS_PROFILE="${OPENCLAW_TOOLS_PROFILE:-coding}"

CONFIG_DIR="${HOME}/.openclaw"
CONFIG_PATH="${CONFIG_DIR}/openclaw.json"
mkdir -p "${CONFIG_DIR}"

cat > "${CONFIG_PATH}" <<EOF
{
  "gateway": {
    "mode": "local",
    "auth": {
      "token": "${OPENCLAW_GATEWAY_TOKEN}"
    },
    "controlUi": {
      "allowedOrigins": ["*"]
    },
    "port": ${OPENCLAW_GATEWAY_PORT}
  },
  "agents": {
    "defaults": {
      "workspace": "/workspace"
    }
  },
  "tools": {
    "profile": "${OPENCLAW_TOOLS_PROFILE}"
  },
  "browser": {
    "enabled": true
  }
}
EOF

exec node /app/openclaw.mjs gateway \
  --allow-unconfigured \
  --bind lan \
  --port "${OPENCLAW_GATEWAY_PORT}"
