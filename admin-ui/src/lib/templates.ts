export type PortPreset = {
  port: string;
  label: string;
  kind: "execd" | "web" | "novnc" | "vnc" | "devtools";
  path?: string;
  embeddable?: boolean;
};

export type SandboxTemplate = {
  id: string;
  name: string;
  category: "agent" | "browser" | "desktop" | "custom";
  description: string;
  imageUri: string;
  timeout: string;
  entrypoint: string;
  cpu: string;
  memory: string;
  envText: string;
  metadataText: string;
  networkPolicyText?: string;
  ports: PortPreset[];
  bootstrapCommand?: string;
  restartCommand?: string;
  verifyCommand?: string;
  openBrowserCommand?: string;
  recipe: string[];
};

const CODE_INTERPRETER_IMAGE = "opensandbox/code-interpreter:v1.0.2";

export const sandboxTemplates: SandboxTemplate[] = [
  {
    id: "code-agent",
    name: "Code Agent",
    category: "agent",
    description: "Sandbox chung de thu Codex, Claude Code, Gemini CLI, Qwen Code hoac Kimi CLI.",
    imageUri: CODE_INTERPRETER_IMAGE,
    timeout: "3600",
    entrypoint: "/opt/opensandbox/code-interpreter.sh",
    cpu: "1000m",
    memory: "1Gi",
    envText: "PYTHON_VERSION=3.11",
    metadataText: "template=code-agent\nproject=agent-lab",
    networkPolicyText: "",
    ports: [{ port: "44772", label: "execd", kind: "execd" }],
    bootstrapCommand: "npm install -g @openai/codex@latest",
    recipe: [
      "Inject provider secrets qua env khi tao sandbox.",
      "Dung Shell de cai CLI va chay prompt headless.",
      "Luu artifacts hoac file log trong sandbox de doc lai o tab Files.",
    ],
  },
  {
    id: "browser-agent",
    name: "Browser Agent",
    category: "browser",
    description: "Danh cho browser automation, Playwright MCP hoac scraping co screenshot.",
    imageUri: "opensandbox/playwright:latest",
    timeout: "3600",
    entrypoint: "tail -f /dev/null",
    cpu: "1000m",
    memory: "2Gi",
    envText: "PYTHON_VERSION=3.11\nTARGET_URL=https://example.com",
    metadataText: "template=browser-agent\nproject=agent-lab",
    networkPolicyText: "",
    ports: [{ port: "44772", label: "execd", kind: "execd" }],
    bootstrapCommand: "python -m playwright install chromium",
    recipe: [
      "Viet script Playwright hoac agent worker trong tab Files.",
      "Chay job bang foreground hoac background command.",
      "Mo screenshots va artifacts truc tiep tu tab Files.",
    ],
  },
  {
    id: "desktop-agent",
    name: "Desktop Dev Sandbox",
    category: "desktop",
    description: "Desktop dev san sang cho noVNC, browser testing va agent quan sat GUI ma khong can bootstrap tay moi lan.",
    imageUri: "opensandbox/desktop:latest",
    timeout: "3600",
    entrypoint: "/home/desktop/start-desktop.sh",
    cpu: "2000m",
    memory: "4Gi",
    envText:
      "DISPLAY=:1\nVNC_PASSWORD=opensandbox\nVNC_PORT=5900\nNOVNC_PORT=6080\nDESKTOP_RESOLUTION=1440x900x24\nBROWSER=/usr/local/bin/chromium-browser\nSTART_URL=https://example.com",
    metadataText: "template=desktop-agent\nproject=agent-lab\nworkload=desktop-dev\nsurface=novnc\nbrowser=chromium",
    networkPolicyText: "",
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "5900", label: "VNC", kind: "vnc" },
      { port: "6080", label: "noVNC", kind: "novnc", path: "/vnc.html" },
    ],
    bootstrapCommand: "/home/desktop/start-desktop.sh",
    restartCommand: "/home/desktop/start-desktop.sh",
    verifyCommand:
      "sh -lc 'curl -fsS http://127.0.0.1:44772/ping >/dev/null && (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q \":5900 \" && (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q \":6080 \" && echo \"desktop-ready\"'",
    openBrowserCommand: "desktop-open-url \"${START_URL:-https://example.com}\"",
    recipe: [
      "Sandbox tu khoi dong desktop stack ngay tu entrypoint nen noVNC san sang nhanh hon va it phu thuoc lenh tay.",
      "Chromium duoc bake san va co helper desktop-open-url de mo web nhanh trong desktop.",
      "Neu desktop bi treo hoac chua len han, dung cac nut Bootstrap, Restart va Verify ngay trong trang chi tiet.",
    ],
  },
  {
    id: "vscode-lab",
    name: "VS Code Lab",
    category: "desktop",
    description: "Khoi dong code-server trong sandbox de debug agent runtime va chinh file qua trinh duyet.",
    imageUri: "opensandbox/vscode:latest",
    timeout: "3600",
    entrypoint: "tail -f /dev/null",
    cpu: "1000m",
    memory: "2Gi",
    envText: "PYTHON_VERSION=3.11\nCODE_PORT=8443",
    metadataText: "template=vscode-lab\nproject=agent-lab",
    networkPolicyText: "",
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "8443", label: "VS Code", kind: "web" },
    ],
    bootstrapCommand: "code-server --bind-addr 0.0.0.0:8443 --auth none /workspace",
    recipe: [
      "Khoi dong code-server bang background command.",
      "Mo port 8443 truc tiep trong UI.",
      "Dung shell session de chay agent va quan sat file thay doi theo thoi gian thuc.",
    ],
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    category: "browser",
    description: "Chromium voi VNC va DevTools port de test browser agent, MCP hoac remote debugging.",
    imageUri: "opensandbox/chrome:latest",
    timeout: "3600",
    entrypoint: "/entrypoint",
    cpu: "1000m",
    memory: "2Gi",
    envText: "",
    metadataText: "template=chrome-devtools\nproject=agent-lab",
    networkPolicyText: "",
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "5901", label: "VNC", kind: "vnc" },
      { port: "9222", label: "DevTools", kind: "devtools", path: "/json" },
    ],
    recipe: [
      "Mo endpoint 9222/json de lay targets cua Chrome.",
      "Dung VNC de quan sat browser khi can.",
      "Phu hop khi can ghep voi MCP client hoac script remote debugging.",
    ],
  },
  {
    id: "openclaw-public-web",
    name: "OpenClaw Public Web",
    category: "browser",
    description:
      "Boundary A: OpenClaw cho web/public research. Duoc vao web theo allowlist, dung model-gateway noi bo, khong duoc cham vao Data Broker.",
    imageUri: "opensandbox/openclaw-broker:latest",
    timeout: "3600",
    entrypoint: "/opt/opensandbox/openclaw-entrypoint.sh",
    cpu: "1000m",
    memory: "2Gi",
    envText: [
      "OPENCLAW_TRUST_ROLE=public-web",
      "OPENCLAW_GATEWAY_PORT=8080",
      "OPENCLAW_GATEWAY_TOKEN=REPLACE_WITH_UNIQUE_GATEWAY_TOKEN",
      "OPENCLAW_GATEWAY_ALLOWED_ORIGINS=http://127.0.0.1:8090,http://localhost:8090",
      "OPENCLAW_MODEL_GATEWAY_URL=http://model-gateway:3401/v1",
      "OPENCLAW_MODEL_GATEWAY_TOKEN=REPLACE_WITH_MODEL_GATEWAY_TOKEN",
      "OPENCLAW_MODEL_PROVIDER_ID=internal-model",
      "OPENCLAW_MODEL_ID=gemini-2.5-flash",
      "OPENCLAW_MODEL_NAME=Gemini 2.5 Flash",
    ].join("\n"),
    metadataText: "template=openclaw-public-web\nproject=agent-lab\ntrust-boundary=public-web",
    networkPolicyText: [
      "default=deny",
      "allow=model-gateway",
      "allow=github.com",
      "allow=api.github.com",
      "allow=developer.mozilla.org",
      "allow=docs.python.org",
    ].join("\n"),
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "8080", label: "Web UI", kind: "web", embeddable: false },
    ],
    restartCommand:
      "sh -lc 'pkill -f \"openclaw.mjs gateway\" || true; /opt/opensandbox/openclaw-entrypoint.sh'",
    verifyCommand:
      "node -e \"fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1); console.log('openclaw-public-ready')}).catch(()=>process.exit(1))\"",
    recipe: [
      "Boundary nay dung browser cho tac vu web/public, nhung khong duoc phep cham vao Data Broker hoac nguon du lieu noi bo.",
      "Model requests di qua model-gateway noi bo tren Docker network rieng, khong nhung credential upstream vao sandbox.",
      "Admin UI nen resolve OpenClaw bang direct endpoint cua sandbox. Neu di qua lifecycle proxy, OpenClaw co the yeu cau pairing thay vi local-loopback connect.",
      "OpenClaw Control UI tu chan iframe bang X-Frame-Options/CSP, vi vay khung embed co the hien blocked; dung tab rieng de connect that.",
      "Allowlist web o day chi la starter set. Neu agent can them domain public, bo sung vao network policy thay vi mo rong toan bo internet.",
      "Build image opensandbox/openclaw-broker:latest tu sandboxes/openclaw-broker truoc khi tao sandbox.",
      "Truoc khi tao sandbox, thay cac gia tri REPLACE_WITH_* bang secret rieng cua moi boundary hoac inject qua secret manager noi bo.",
    ],
  },
  {
    id: "openclaw-private-data",
    name: "OpenClaw Private Data",
    category: "agent",
    description:
      "Boundary B: OpenClaw cho du lieu noi bo. Chi duoc goi Data Broker va model-gateway noi bo, browser tat, khong noi DB truc tiep.",
    imageUri: "opensandbox/openclaw-broker:latest",
    timeout: "3600",
    entrypoint: "/opt/opensandbox/openclaw-entrypoint.sh",
    cpu: "1000m",
    memory: "2Gi",
    envText: [
      "OPENCLAW_TRUST_ROLE=private-data",
      "OPENCLAW_GATEWAY_PORT=8080",
      "OPENCLAW_GATEWAY_TOKEN=REPLACE_WITH_UNIQUE_GATEWAY_TOKEN",
      "OPENCLAW_GATEWAY_ALLOWED_ORIGINS=http://127.0.0.1:8090,http://localhost:8090",
      "OPENCLAW_MODEL_GATEWAY_URL=http://model-gateway:3401/v1",
      "OPENCLAW_MODEL_GATEWAY_TOKEN=REPLACE_WITH_MODEL_GATEWAY_TOKEN",
      "OPENCLAW_MODEL_PROVIDER_ID=internal-model",
      "OPENCLAW_MODEL_ID=gemini-2.5-flash",
      "OPENCLAW_MODEL_NAME=Gemini 2.5 Flash",
      "OPENCLAW_DATA_BROKER_URL=http://data-broker:3302",
      "OPENCLAW_DATA_BROKER_TOKEN=REPLACE_WITH_DATA_BROKER_TOKEN",
    ].join("\n"),
    metadataText: "template=openclaw-private-data\nproject=agent-lab\ntrust-boundary=private-data\ndata-access=broker-only",
    networkPolicyText: ["default=deny", "allow=model-gateway", "allow=data-broker"].join("\n"),
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "8080", label: "Web UI", kind: "web", embeddable: false },
    ],
    bootstrapCommand: "broker-query schema",
    restartCommand:
      "sh -lc 'pkill -f \"openclaw.mjs gateway\" || true; /opt/opensandbox/openclaw-entrypoint.sh'",
    verifyCommand:
      "node -e \"fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1); console.log('openclaw-private-ready')}).catch(()=>process.exit(1))\"",
    recipe: [
      "Boundary nay chi thay model-gateway va Data Broker tren internal Docker network, khong nhin thay DB, raw source hay internet cong khai.",
      "Workspace duoc seed theo profile private-data de agent bat buoc dung broker-query thay vi bypass qua SQL hoac endpoint raw.",
      "Data Broker mang credential rieng de doc nguon phia sau va tra ve tap du lieu da loc, da format, da an thong tin nhay cam.",
      "Admin UI nen resolve OpenClaw bang direct endpoint cua sandbox. Neu di qua lifecycle proxy, OpenClaw co the yeu cau pairing thay vi local-loopback connect.",
      "OpenClaw Control UI tu chan iframe bang X-Frame-Options/CSP, vi vay khung embed co the hien blocked; dung tab rieng de connect that.",
      "Compose local cua repo nay da duoc refactor sang user-defined network + egress dns+nft de boundary nay chay dung end-to-end.",
      "Truoc khi tao sandbox, thay cac gia tri REPLACE_WITH_* bang secret rieng cua moi boundary hoac inject qua secret manager noi bo.",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    category: "custom",
    description: "Bat dau tu cau hinh toi thieu va tu dieu chinh image, env, entrypoint.",
    imageUri: CODE_INTERPRETER_IMAGE,
    timeout: "3600",
    entrypoint: "/opt/opensandbox/code-interpreter.sh",
    cpu: "500m",
    memory: "512Mi",
    envText: "PYTHON_VERSION=3.11",
    metadataText: "project=demo",
    networkPolicyText: "",
    ports: [{ port: "44772", label: "execd", kind: "execd" }],
    recipe: [
      "Chon image phu hop voi workload.",
      "Khai bao env va metadata de de loc sandbox.",
      "Tra endpoint theo cac port app that su lang nghe.",
    ],
  },
];

export function getTemplateById(templateId: string) {
  return sandboxTemplates.find((template) => template.id === templateId) ?? sandboxTemplates[0];
}
