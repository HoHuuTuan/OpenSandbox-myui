# Local Runbook

## 1. Start Docker

Make sure Docker Desktop or Docker Engine is running first.

Useful checks:

```powershell
docker version
docker ps
docker images
```

## 2. Build the broker-first OpenClaw image

```powershell
docker build -t opensandbox/openclaw-broker:latest sandboxes/openclaw-broker
```

## 3. Start the backend stack

```powershell
cd server
docker compose up --build
```

This starts:

- `opensandbox-server` on `http://127.0.0.1:8090`
- `ai-server` on `http://127.0.0.1:3001`
- `data-broker` on `http://127.0.0.1:3302`
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

Option A: use the `OpenClaw Agent` template in the admin UI.

Option B: run the SDK example:

```powershell
uv pip install opensandbox requests
uv run python examples/openclaw/main.py
```

Default local flow:

`OpenClaw sandbox -> Data Broker -> mock/private source`
