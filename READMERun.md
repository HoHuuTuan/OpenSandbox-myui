# Local Runbook

## 1. Start Docker

Make sure Docker Desktop or Docker Engine is running first.

Useful checks:

```powershell
docker version
docker ps
docker images
```

## 2. Build the OpenClaw trust-boundary image

```powershell
docker build -t opensandbox/openclaw-broker:latest sandboxes/openclaw-broker
```

## 3. Start the backend stack

Create a local env file first so the internal services do not boot with demo secrets:

```powershell
cd server
Copy-Item .env.example .env
```

Replace the sample values in `server/.env` with environment-specific secrets before using the stack outside local development.

Then start the stack:

```powershell
cd server
docker compose up --build
```

This starts:

- `opensandbox-server` on `http://127.0.0.1:8090`
- `ai-server` on `http://127.0.0.1:3001`
- `model-gateway` on the internal compose network
- `mock-model-provider` on the internal compose network
- `data-broker` on the internal compose network
- `mock-source` on the internal compose network

## 4. Start the admin UI

Development mode:

```powershell
cd admin-ui
npm install
npm run dev
```

Docker mode:

```powershell
cd admin-ui
docker build -t opensandbox-admin-ui:latest .
docker run -d --name opensandbox-admin-ui -p 8088:80 --restart unless-stopped opensandbox-admin-ui:latest
```

If an old UI container already exists, remove it before rerunning:

```powershell
docker rm -f opensandbox-admin-ui
```

## 5. Launch OpenClaw end-to-end

Option A: use `OpenClaw Public Web` or `OpenClaw Private Data` in the admin UI.

Before creating a sandbox from the UI templates, replace every `REPLACE_WITH_*` entry in the template env block with boundary-specific secrets.

Option B: run the SDK example:

```powershell
uv pip install opensandbox requests
OPENCLAW_ROLE=private-data uv run python examples/openclaw/main.py
```

Default local flows:

`OpenClaw public-web sandbox -> model-gateway -> mock/upstream model`

`OpenClaw private-data sandbox -> Data Broker -> mock/private source`
