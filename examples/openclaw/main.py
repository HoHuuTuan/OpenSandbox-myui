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
DEFAULT_ROLE = os.getenv("OPENCLAW_ROLE", "private-data")
DEFAULT_TIMEOUT = int(os.getenv("OPENCLAW_TIMEOUT", "3600"))
DEFAULT_GATEWAY_TOKEN = os.getenv("OPENCLAW_TOKEN", "dummy-token-for-sandbox")
DEFAULT_GATEWAY_PORT = int(os.getenv("OPENCLAW_PORT", "8080"))
DEFAULT_DATA_BROKER_URL = os.getenv(
    "OPENCLAW_DATA_BROKER_URL",
    "http://data-broker:3302",
)
DEFAULT_DATA_BROKER_TOKEN = os.getenv(
    "OPENCLAW_DATA_BROKER_TOKEN",
    "broker-local-token",
)
DEFAULT_MODEL_GATEWAY_URL = os.getenv(
    "OPENCLAW_MODEL_GATEWAY_URL",
    "http://model-gateway:3401/v1",
)
DEFAULT_MODEL_GATEWAY_TOKEN = os.getenv(
    "OPENCLAW_MODEL_GATEWAY_TOKEN",
    "model-gateway-local-token",
)
DEFAULT_MODEL_PROVIDER_ID = os.getenv("OPENCLAW_MODEL_PROVIDER_ID", "internal-model")
DEFAULT_MODEL_ID = os.getenv("OPENCLAW_MODEL_ID", "gemini-2.5-flash")
DEFAULT_MODEL_NAME = os.getenv("OPENCLAW_MODEL_NAME", "Gemini 2.5 Flash")
ROLE_ALLOWED_EGRESS = {
    "public-web": [
        "model-gateway",
        "github.com",
        "api.github.com",
        "developer.mozilla.org",
        "docs.python.org",
    ],
    "private-data": [
        "model-gateway",
        "data-broker",
    ],
}


def parse_allowed_egress(role: str) -> list[str]:
    raw_value = os.getenv("OPENCLAW_ALLOWED_EGRESS", "")
    if not raw_value.strip():
        return ROLE_ALLOWED_EGRESS.get(role, ROLE_ALLOWED_EGRESS["private-data"])

    hosts = [host.strip() for host in raw_value.split(",") if host.strip()]
    return hosts or ROLE_ALLOWED_EGRESS.get(role, ROLE_ALLOWED_EGRESS["private-data"])


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


def build_network_policy(role: str) -> NetworkPolicy:
    rules = [NetworkRule(action="allow", target=host) for host in parse_allowed_egress(role)]
    return NetworkPolicy(defaultAction="deny", egress=rules)


def build_metadata(role: str) -> dict[str, str]:
    metadata = {
        "example": "openclaw",
        "trust-boundary": role,
    }
    if role == "private-data":
        metadata["data-access"] = "broker-only"
    return metadata


def build_env(role: str, gateway_port: int, gateway_token: str) -> dict[str, str]:
    env = {
        "OPENCLAW_TRUST_ROLE": role,
        "OPENCLAW_GATEWAY_PORT": str(gateway_port),
        "OPENCLAW_GATEWAY_TOKEN": gateway_token,
        "OPENCLAW_MODEL_GATEWAY_URL": DEFAULT_MODEL_GATEWAY_URL,
        "OPENCLAW_MODEL_GATEWAY_TOKEN": DEFAULT_MODEL_GATEWAY_TOKEN,
        "OPENCLAW_MODEL_PROVIDER_ID": DEFAULT_MODEL_PROVIDER_ID,
        "OPENCLAW_MODEL_ID": DEFAULT_MODEL_ID,
        "OPENCLAW_MODEL_NAME": DEFAULT_MODEL_NAME,
    }

    if role == "private-data":
        env["OPENCLAW_DATA_BROKER_URL"] = DEFAULT_DATA_BROKER_URL
        env["OPENCLAW_DATA_BROKER_TOKEN"] = DEFAULT_DATA_BROKER_TOKEN

    return env


def main() -> None:
    server = DEFAULT_SERVER
    image = DEFAULT_IMAGE
    role = DEFAULT_ROLE
    timeout_seconds = DEFAULT_TIMEOUT
    gateway_token = os.getenv("OPENCLAW_GATEWAY_TOKEN", DEFAULT_GATEWAY_TOKEN)
    gateway_port = DEFAULT_GATEWAY_PORT
    env = build_env(role, gateway_port, gateway_token)

    if role not in ROLE_ALLOWED_EGRESS:
        raise ValueError(f"Unsupported OPENCLAW_ROLE={role}")

    print(f"Creating OpenClaw sandbox with image={image} on {server}...")
    print(f"  Trust boundary: {role}")
    print(f"  Gateway port: {gateway_port}")
    print(f"  Timeout: {timeout_seconds}s")
    print(f"  Model gateway: {DEFAULT_MODEL_GATEWAY_URL}")
    if role == "private-data":
        print(f"  Data Broker: {DEFAULT_DATA_BROKER_URL}")
    print(
        f"  Gateway token: {gateway_token[:16]}..."
        if len(gateway_token) > 16
        else f"  Gateway token: {gateway_token}"
    )

    sandbox = SandboxSync.create(
        image=image,
        timeout=timedelta(seconds=timeout_seconds),
        entrypoint=["/opt/opensandbox/openclaw-entrypoint.sh"],
        metadata=build_metadata(role),
        connection_config=ConnectionConfigSync(domain=server),
        health_check=lambda sbx: check_openclaw(sbx, gateway_port),
        env=env,
        network_policy=build_network_policy(role),
    )

    endpoint = sandbox.get_endpoint(gateway_port)
    print("OpenClaw is ready.")
    print(f"  Gateway endpoint: http://{endpoint.endpoint}")
    print("  Connect flow: open the direct gateway endpoint above in your browser.")
    print("  Auth flow: paste OPENCLAW_GATEWAY_TOKEN into the Control UI when prompted.")
    print("  Avoid using /v1/sandboxes/<id>/proxy/8080 for OpenClaw Control UI unless you intend to pair that browser.")
    print(f"  Sandbox trust boundary: {role}")
    if role == "private-data":
        print("  Sandbox data access mode: broker-only")


if __name__ == "__main__":
    main()
