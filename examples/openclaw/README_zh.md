# OpenClaw Broker-First 示例

这个示例把 OpenClaw 运行在 OpenSandbox 中，并强制采用下面的标准数据链路：

`OpenClaw 沙箱 -> Data Broker -> 私有数据源`

沙箱本身不直接拿数据库凭证，也不直连原始数据源。Data Broker 使用自己的上游凭证读取数据，然后只返回过滤、格式化、脱敏后的结果。

## 本地端到端运行

### 1. 构建 broker-first OpenClaw 镜像

```shell
docker build -t opensandbox/openclaw-broker:latest sandboxes/openclaw-broker
```

### 2. 启动 OpenSandbox、mock source 和 Data Broker

```shell
cd server
docker compose up --build
```

这套 compose 会启动：

- `opensandbox-server`，地址 `http://localhost:8090`
- `mock-source`，仅在 compose 内网可见
- `data-broker`，地址 `http://localhost:3302`

### 3. 安装 Python 依赖

```shell
uv pip install opensandbox requests
```

### 4. 运行示例

```shell
uv run python examples/openclaw/main.py
```

预期输出：

```text
Creating broker-first OpenClaw sandbox with image=opensandbox/openclaw-broker:latest on http://localhost:8090...
[check] sandbox ready after 7.1s
OpenClaw is ready.
  Gateway endpoint: http://127.0.0.1:56123
  Sandbox data access mode: broker-only
```

## 默认配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCLAW_SERVER` | `http://localhost:8090` | 本仓库 compose 的 OpenSandbox 服务地址 |
| `OPENCLAW_IMAGE` | `opensandbox/openclaw-broker:latest` | broker-first 沙箱镜像 |
| `OPENCLAW_TIMEOUT` | `3600` | 沙箱超时时间（秒） |
| `OPENCLAW_TOKEN` | `dummy-token-for-sandbox` | Gateway token 的默认回退值 |
| `OPENCLAW_GATEWAY_TOKEN` | `dummy-token-for-sandbox` | 传入沙箱的 Gateway token |
| `OPENCLAW_PORT` | `8080` | 沙箱内 OpenClaw Gateway 端口 |
| `OPENCLAW_DATA_BROKER_URL` | `http://host.docker.internal:3302` | bridge 模式沙箱访问 broker 的地址 |
| `OPENCLAW_DATA_BROKER_TOKEN` | `broker-secret` | 沙箱 helper 使用的 Bearer token |
| `OPENCLAW_ALLOWED_EGRESS` | 内置 allowlist | 如果模型供应方不同，可自行追加主机列表 |

如果你使用的是仓库外单独启动的 `opensandbox-server`，并且端口是 `http://localhost:8080`，请在运行前覆盖 `OPENCLAW_SERVER`。

## 网络策略

示例默认采用拒绝所有出站流量，然后只允许 OpenClaw 常用目标：

- `host.docker.internal`，用于访问 Data Broker
- `api.openai.com`
- `api.anthropic.com`
- `openrouter.ai`
- `github.com`
- `api.github.com`

如需调整 allowlist：

```shell
export OPENCLAW_ALLOWED_EGRESS="host.docker.internal,api.openai.com,my-model-gateway.internal"
```

## Broker 约束

镜像会预置 `/workspace/AGENTS.md` 和 `/workspace/TOOLS.md`，明确要求 OpenClaw agent：

- 先执行 `broker-query schema`
- 通过 broker 路由获取客户和账户数据
- 如果字段缺失，报告契约缺口，而不是绕过 broker

由于这个仓库当前的 lifecycle API 仍然要求显式传入 `entrypoint`，示例会传：

```shell
/opt/opensandbox/openclaw-entrypoint.sh
```

沙箱内可用 helper：

```shell
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```

## 参考

- [OpenClaw](https://github.com/openclaw/openclaw)
- [OpenSandbox Python SDK](https://pypi.org/project/opensandbox/)
- [Broker 沙箱镜像](../../sandboxes/openclaw-broker/README.md)
