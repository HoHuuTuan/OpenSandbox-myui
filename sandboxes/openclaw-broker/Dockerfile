# syntax=docker/dockerfile:1

FROM ghcr.io/openclaw/openclaw:latest

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl jq ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /workspace /opt/opensandbox \
    && chown -R node:node /workspace /opt/opensandbox

COPY --chown=node:node scripts/broker-query /usr/local/bin/broker-query
COPY --chown=node:node scripts/openclaw-entrypoint.sh /opt/opensandbox/openclaw-entrypoint.sh
COPY --chown=node:node profiles/ /opt/opensandbox/profiles/

RUN sed -i 's/\r$//' /usr/local/bin/broker-query /opt/opensandbox/openclaw-entrypoint.sh \
    && chmod 755 /usr/local/bin/broker-query /opt/opensandbox/openclaw-entrypoint.sh

USER node

WORKDIR /workspace
HEALTHCHECK --interval=180s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz > /dev/null || exit 1
ENTRYPOINT ["/opt/opensandbox/openclaw-entrypoint.sh"]
