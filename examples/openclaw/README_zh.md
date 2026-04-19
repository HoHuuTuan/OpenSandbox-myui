# OpenClaw 双边界示例

这个示例把 [OpenClaw](https://github.com/openclaw/openclaw) 运行在 OpenSandbox 中，并拆成两个明确的 trust boundary：

- `public-web`：只做公网 / Web 任务
- `private-data`：只通过 `data-broker` 访问内部报表数据

标准数据链路：

`OpenClaw private-data sandbox -> Data Broker -> private source`

标准模型链路：

`OpenClaw sandbox -> model-gateway -> upstream model provider`

任何 OpenClaw sandbox 都不会直接拿到数据库凭证，也不会直连原始数据源。

## 本地端到端运行

### 1. 构建 OpenClaw 镜像

```shell
docker build -t opensandbox/openclaw-broker:latest sandboxes/openclaw-broker
```

### 2. 启动 OpenSandbox 和内部服务

```shell
cd server
docker compose up --build
```

这套 compose 会启动：

- `opensandbox-server`：`http://localhost:8090`
- `model-gateway`：仅内部 Docker 网络可见
- `mock-model-provider`：仅内部 Docker 网络可见
- `data-broker`：仅内部 Docker 网络可见
- `mock-source`：仅内部 Docker 网络可见

### 3. 安装 Python 依赖

```shell
uv pip install opensandbox requests
```

### 4. 按 boundary 启动示例

private-data：

```shell
OPENCLAW_ROLE=private-data uv run python examples/openclaw/main.py
```

public-web：

```shell
OPENCLAW_ROLE=public-web uv run python examples/openclaw/main.py
```

## 默认配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `OPENCLAW_SERVER` | `http://localhost:8090` | 本仓库 compose 启动的 OpenSandbox 地址 |
| `OPENCLAW_IMAGE` | `opensandbox/openclaw-broker:latest` | trust-boundary 沙箱镜像 |
| `OPENCLAW_ROLE` | `private-data` | boundary 角色：`public-web` 或 `private-data` |
| `OPENCLAW_MODEL_GATEWAY_URL` | `http://model-gateway:3401/v1` | 内部模型网关 |
| `OPENCLAW_MODEL_GATEWAY_TOKEN` | `model-gateway-local-token` | 沙箱访问模型网关的 Bearer token |
| `OPENCLAW_DATA_BROKER_URL` | `http://data-broker:3302` | private-data boundary 使用的 broker 地址 |
| `OPENCLAW_DATA_BROKER_TOKEN` | `broker-local-token` | `broker-query` 使用的 Bearer token |

## Boundary 默认出站策略

`public-web`：

- `model-gateway`
- `github.com`
- `api.github.com`
- `developer.mozilla.org`
- `docs.python.org`

`private-data`：

- `model-gateway`
- `data-broker`

## Broker 约束

private-data profile 会预置 `/workspace/AGENTS.md` 和 `/workspace/TOOLS.md`，明确要求 OpenClaw agent：

- 先执行 `broker-query schema`
- 通过 broker 路由获取客户 / 账户 / 订单数据
- 如果字段缺失，就报告 contract gap，而不是绕过 broker

可用 helper：

```shell
broker-query schema
broker-query customer-profile cust_acme_001
broker-query customer-orders cust_acme_001 5
broker-query account-summary acct_apac_001
```
