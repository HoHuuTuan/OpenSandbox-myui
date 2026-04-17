# Copyright 2026 Alibaba Group Holding Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import time
from datetime import timedelta

import requests
from opensandbox import SandboxSync
from opensandbox.config import ConnectionConfigSync
from opensandbox.models.sandboxes import NetworkPolicy, NetworkRule


DEFAULT_SERVER = os.getenv("OPENCLAW_SERVER", "http://localhost:8090")
DEFAULT_IMAGE = os.getenv("OPENCLAW_IMAGE", "opensandbox/openclaw-broker:latest")
DEFAULT_TIMEOUT = int(os.getenv("OPENCLAW_TIMEOUT", "3600"))
DEFAULT_GATEWAY_TOKEN = os.getenv("OPENCLAW_TOKEN", "dummy-token-for-sandbox")
DEFAULT_GATEWAY_PORT = int(os.getenv("OPENCLAW_PORT", "8080"))
DEFAULT_DATA_BROKER_URL = os.getenv(
    "OPENCLAW_DATA_BROKER_URL",
    "http://host.docker.internal:3302",
)
DEFAULT_DATA_BROKER_TOKEN = os.getenv(
    "OPENCLAW_DATA_BROKER_TOKEN",
    "broker-secret",
)
DEFAULT_ALLOWED_EGRESS = [
    "host.docker.internal",
    "api.openai.com",
    "api.anthropic.com",
    "openrouter.ai",
    "github.com",
    "api.github.com",
]


def parse_allowed_egress() -> list[str]:
    raw_value = os.getenv("OPENCLAW_ALLOWED_EGRESS", "")
    if not raw_value.strip():
        return DEFAULT_ALLOWED_EGRESS

    hosts = [host.strip() for host in raw_value.split(",") if host.strip()]
    return hosts or DEFAULT_ALLOWED_EGRESS


def check_openclaw(sbx: SandboxSync, port: int) -> bool:
    try:
        endpoint = sbx.get_endpoint(port)
        start = time.perf_counter()
        base_url = f"http://{endpoint.endpoint}"
        probe_urls = [f"{base_url}/healthz", base_url]

        for _ in range(150):
            for url in probe_urls:
                try:
                    response = requests.get(url, timeout=1)
                    if response.ok:
                        elapsed = time.perf_counter() - start
                        print(f"[check] sandbox ready after {elapsed:.1f}s")
                        return True
                except requests.RequestException:
                    continue
            time.sleep(0.2)
        return False
    except Exception as exc:
        print(f"[check] failed: {exc}")
        return False


def build_network_policy() -> NetworkPolicy:
    rules = [NetworkRule(action="allow", target=host) for host in parse_allowed_egress()]
    return NetworkPolicy(defaultAction="deny", egress=rules)


def main() -> None:
    server = DEFAULT_SERVER
    image = DEFAULT_IMAGE
    timeout_seconds = DEFAULT_TIMEOUT
    gateway_token = os.getenv("OPENCLAW_GATEWAY_TOKEN", DEFAULT_GATEWAY_TOKEN)
    gateway_port = DEFAULT_GATEWAY_PORT
    broker_url = DEFAULT_DATA_BROKER_URL
    broker_token = DEFAULT_DATA_BROKER_TOKEN

    print(f"Creating broker-first OpenClaw sandbox with image={image} on {server}...")
    print(f"  Gateway port: {gateway_port}")
    print(f"  Timeout: {timeout_seconds}s")
    print(f"  Data Broker: {broker_url}")
    print(
        f"  Gateway token: {gateway_token[:16]}..."
        if len(gateway_token) > 16
        else f"  Gateway token: {gateway_token}"
    )

    sandbox = SandboxSync.create(
        image=image,
        timeout=timedelta(seconds=timeout_seconds),
        entrypoint=["/opt/opensandbox/openclaw-entrypoint.sh"],
        metadata={
            "example": "openclaw",
            "data-access": "broker-only",
        },
        connection_config=ConnectionConfigSync(domain=server),
        health_check=lambda sbx: check_openclaw(sbx, gateway_port),
        env={
            "OPENCLAW_GATEWAY_PORT": str(gateway_port),
            "OPENCLAW_GATEWAY_TOKEN": gateway_token,
            "OPENCLAW_DATA_BROKER_URL": broker_url,
            "OPENCLAW_DATA_BROKER_TOKEN": broker_token,
        },
        network_policy=build_network_policy(),
    )

    endpoint = sandbox.get_endpoint(gateway_port)
    print("OpenClaw is ready.")
    print(f"  Gateway endpoint: http://{endpoint.endpoint}")
    print("  Sandbox data access mode: broker-only")


if __name__ == "__main__":
    main()
