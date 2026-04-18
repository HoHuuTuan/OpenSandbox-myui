#!/bin/sh
set -eu

OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-8080}"
OPENCLAW_TOOLS_PROFILE="${OPENCLAW_TOOLS_PROFILE:-coding}"
OPENCLAW_TRUST_ROLE="${OPENCLAW_TRUST_ROLE:-private-data}"
OPENCLAW_GATEWAY_ALLOWED_ORIGINS="${OPENCLAW_GATEWAY_ALLOWED_ORIGINS:-http://127.0.0.1:8090,http://localhost:8090}"

CONFIG_DIR="${HOME}/.openclaw"
CONFIG_PATH="${CONFIG_DIR}/openclaw.json"
mkdir -p "${CONFIG_DIR}"
mkdir -p /workspace

normalize_bool() {
  case "${1:-}" in
    1|true|TRUE|True|yes|YES|on|ON)
      printf 'true'
      ;;
    0|false|FALSE|False|no|NO|off|OFF)
      printf 'false'
      ;;
    *)
      printf '%s' "${2}"
      ;;
  esac
}

require_env() {
  name="$1"
  value="${2:-}"
  if [ -z "${value}" ]; then
    echo "${name} is required." >&2
    exit 1
  fi
}

OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
require_env "OPENCLAW_GATEWAY_TOKEN" "${OPENCLAW_GATEWAY_TOKEN}"

case "${OPENCLAW_TRUST_ROLE}" in
  public-web)
    DEFAULT_BROWSER_ENABLED="true"
    ;;
  private-data)
    DEFAULT_BROWSER_ENABLED="false"
    ;;
  *)
    echo "Unsupported OPENCLAW_TRUST_ROLE: ${OPENCLAW_TRUST_ROLE}" >&2
    exit 1
    ;;
esac

PROFILE_DIR="/opt/opensandbox/profiles/${OPENCLAW_TRUST_ROLE}"
[ -d "${PROFILE_DIR}" ] || {
  echo "Missing OpenClaw profile directory: ${PROFILE_DIR}" >&2
  exit 1
}
cp "${PROFILE_DIR}/"*.md /workspace/

BROWSER_ENABLED="$(normalize_bool "${OPENCLAW_BROWSER_ENABLED:-${DEFAULT_BROWSER_ENABLED}}" "${DEFAULT_BROWSER_ENABLED}")"
MODEL_GATEWAY_URL="${OPENCLAW_MODEL_GATEWAY_URL:-}"
MODEL_GATEWAY_TOKEN="${OPENCLAW_MODEL_GATEWAY_TOKEN:-}"
MODEL_PROVIDER_ID="${OPENCLAW_MODEL_PROVIDER_ID:-internal-model}"
MODEL_ID="${OPENCLAW_MODEL_ID:-mock-gpt-oss-mini}"
MODEL_NAME="${OPENCLAW_MODEL_NAME:-Internal Mock GPT OSS Mini}"
MODEL_API="${OPENCLAW_MODEL_API:-openai-completions}"
MODEL_REASONING="$(normalize_bool "${OPENCLAW_MODEL_REASONING:-false}" "false")"
MODEL_CONTEXT_WINDOW="${OPENCLAW_MODEL_CONTEXT_WINDOW:-128000}"
MODEL_MAX_TOKENS="${OPENCLAW_MODEL_MAX_TOKENS:-16384}"
PRIMARY_MODEL="${OPENCLAW_PRIMARY_MODEL:-}"

if [ -n "${MODEL_GATEWAY_URL}" ]; then
  [ -n "${MODEL_GATEWAY_TOKEN}" ] || {
    echo "OPENCLAW_MODEL_GATEWAY_TOKEN is required when OPENCLAW_MODEL_GATEWAY_URL is set." >&2
    exit 1
  }
  if [ -z "${PRIMARY_MODEL}" ]; then
    PRIMARY_MODEL="${MODEL_PROVIDER_ID}/${MODEL_ID}"
  fi
fi

jq -n \
  --arg gatewayToken "${OPENCLAW_GATEWAY_TOKEN}" \
  --argjson gatewayPort "${OPENCLAW_GATEWAY_PORT}" \
  --arg gatewayAllowedOrigins "${OPENCLAW_GATEWAY_ALLOWED_ORIGINS}" \
  --arg workspace "/workspace" \
  --arg toolsProfile "${OPENCLAW_TOOLS_PROFILE}" \
  --argjson browserEnabled "${BROWSER_ENABLED}" \
  --arg primaryModel "${PRIMARY_MODEL}" \
  --arg modelGatewayUrl "${MODEL_GATEWAY_URL}" \
  --arg modelGatewayToken "${MODEL_GATEWAY_TOKEN}" \
  --arg modelProviderId "${MODEL_PROVIDER_ID}" \
  --arg modelId "${MODEL_ID}" \
  --arg modelName "${MODEL_NAME}" \
  --arg modelApi "${MODEL_API}" \
  --argjson modelReasoning "${MODEL_REASONING}" \
  --argjson modelContextWindow "${MODEL_CONTEXT_WINDOW}" \
  --argjson modelMaxTokens "${MODEL_MAX_TOKENS}" \
  '
  {
    gateway: {
      mode: "local",
      auth: { token: $gatewayToken },
      controlUi: {
        allowedOrigins: ($gatewayAllowedOrigins | split(",") | map(gsub("^\\s+|\\s+$"; "")) | map(select(length > 0)))
      },
      port: $gatewayPort
    },
    agents: {
      defaults: {
        workspace: $workspace
      }
    },
    tools: {
      profile: $toolsProfile
    },
    browser: {
      enabled: $browserEnabled
    }
  }
  | if $primaryModel != "" then
      .agents.defaults.model = { primary: $primaryModel }
    else
      .
    end
  | if $modelGatewayUrl != "" then
      .models = {
        mode: "merge",
        providers: {
          ($modelProviderId): {
            baseUrl: $modelGatewayUrl,
            apiKey: $modelGatewayToken,
            authHeader: true,
            api: $modelApi,
            request: {
              allowPrivateNetwork: true
            },
            models: [
              {
                id: $modelId,
                name: $modelName,
                reasoning: $modelReasoning,
                input: ["text", "image"],
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0
                },
                contextWindow: $modelContextWindow,
                maxTokens: $modelMaxTokens
              }
            ]
          }
        }
      }
    else
      .
    end
  ' > "${CONFIG_PATH}"

exec node /app/openclaw.mjs gateway \
  --allow-unconfigured \
  --bind lan \
  --port "${OPENCLAW_GATEWAY_PORT}"
