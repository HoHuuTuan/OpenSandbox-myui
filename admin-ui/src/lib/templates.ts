export type PortPreset = {
  port: string;
  label: string;
  kind: "execd" | "web" | "novnc" | "vnc" | "devtools";
  path?: string;
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
    description: "Sandbox chung để thử Codex, Claude Code, Gemini CLI, Qwen Code hoặc Kimi CLI.",
    imageUri: CODE_INTERPRETER_IMAGE,
    timeout: "3600",
    entrypoint: "/opt/opensandbox/code-interpreter.sh",
    cpu: "1000m",
    memory: "1Gi",
    envText: "PYTHON_VERSION=3.11",
    metadataText: "template=code-agent\nproject=agent-lab",
    ports: [{ port: "44772", label: "execd", kind: "execd" }],
    bootstrapCommand: "npm install -g @openai/codex@latest",
    recipe: [
      "Inject provider secrets qua env khi tạo sandbox.",
      "Dùng Shell để cài CLI và chạy prompt headless.",
      "Lưu artifacts hoặc file log trong sandbox để đọc lại ở tab Files.",
    ],
  },
  {
    id: "browser-agent",
    name: "Browser Agent",
    category: "browser",
    description: "Dành cho browser automation, Playwright MCP hoặc scraping có screenshot.",
    imageUri: "opensandbox/playwright:latest",
    timeout: "3600",
    entrypoint: "tail -f /dev/null",
    cpu: "1000m",
    memory: "2Gi",
    envText: "PYTHON_VERSION=3.11\nTARGET_URL=https://example.com",
    metadataText: "template=browser-agent\nproject=agent-lab",
    ports: [{ port: "44772", label: "execd", kind: "execd" }],
    bootstrapCommand: "python -m playwright install chromium",
    recipe: [
      "Viết script Playwright hoặc agent worker trong tab Files.",
      "Chạy job bằng foreground hoặc background command.",
      "Mở screenshots/artifacts trực tiếp từ tab Files.",
    ],
  },
  {
    id: "desktop-agent",
    name: "Desktop Dev Sandbox",
    category: "desktop",
    description: "Desktop dev sẵn sàng cho noVNC, browser testing và agent quan sát GUI mà không cần bootstrap tay mỗi lần.",
    imageUri: "opensandbox/desktop:latest",
    timeout: "3600",
    entrypoint: "/home/desktop/start-desktop.sh",
    cpu: "2000m",
    memory: "4Gi",
    envText: "DISPLAY=:1\nVNC_PASSWORD=opensandbox\nVNC_PORT=5900\nNOVNC_PORT=6080\nDESKTOP_RESOLUTION=1440x900x24\nBROWSER=/usr/local/bin/chromium-browser\nSTART_URL=https://example.com",
    metadataText: "template=desktop-agent\nproject=agent-lab\nworkload=desktop-dev\nsurface=novnc\nbrowser=chromium",
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
      "Sandbox tự khởi động desktop stack ngay từ entrypoint nên noVNC sẵn sàng nhanh hơn và ít phụ thuộc lệnh tay.",
      "Chromium được bake sẵn, không dính snap, và có helper `desktop-open-url` để mở web nhanh trong desktop.",
      "Nếu desktop bị treo hoặc chưa lên hẳn, dùng các nút Bootstrap/Restart/Verify ngay trong trang chi tiết.",
    ],
  },
  {
    id: "vscode-lab",
    name: "VS Code Lab",
    category: "desktop",
    description: "Khởi động code-server trong sandbox để debug agent runtime và chỉnh file qua trình duyệt.",
    imageUri: "opensandbox/vscode:latest",
    timeout: "3600",
    entrypoint: "tail -f /dev/null",
    cpu: "1000m",
    memory: "2Gi",
    envText: "PYTHON_VERSION=3.11\nCODE_PORT=8443",
    metadataText: "template=vscode-lab\nproject=agent-lab",
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "8443", label: "VS Code", kind: "web" },
    ],
    bootstrapCommand: "code-server --bind-addr 0.0.0.0:8443 --auth none /workspace",
    recipe: [
      "Khởi động code-server bằng background command.",
      "Mở port 8443 trực tiếp trong UI.",
      "Dùng shell session để chạy agent và quan sát file thay đổi theo thời gian thực.",
    ],
  },
  {
    id: "chrome-devtools",
    name: "Chrome DevTools",
    category: "browser",
    description: "Chromium với VNC và DevTools port để test browser agent, MCP hoặc remote debugging.",
    imageUri: "opensandbox/chrome:latest",
    timeout: "3600",
    entrypoint: "/entrypoint",
    cpu: "1000m",
    memory: "2Gi",
    envText: "",
    metadataText: "template=chrome-devtools\nproject=agent-lab",
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "5901", label: "VNC", kind: "vnc" },
      { port: "9222", label: "DevTools", kind: "devtools", path: "/json" },
    ],
    recipe: [
      "Mở endpoint 9222/json để lấy targets của Chrome.",
      "Dùng VNC để quan sát browser khi cần.",
      "Phù hợp khi cần ghép với MCP client hoặc script remote debugging.",
    ],
  },
  {
    id: "openclaw-agent",
    name: "OpenClaw Agent",
    category: "agent",
    description: "Chạy OpenClaw gateway để test agent + browser control",
    imageUri: "openclaw-local:latest",
    timeout: "3600",

   entrypoint: "sh -lc \"mkdir -p /home/node/.openclaw && printf '%s' '{\\\"gateway\\\":{\\\"mode\\\":\\\"local\\\",\\\"auth\\\":{\\\"token\\\":\\\"123456\\\"},\\\"controlUi\\\":{\\\"allowedOrigins\\\":[\\\"*\\\"]}}}' > /home/node/.openclaw/openclaw.json && exec node openclaw.mjs gateway --allow-unconfigured --bind lan --port 8080\"",
    cpu: "1000m",
    memory: "2Gi",

    envText: `
  OPENCLAW_GATEWAY_PORT=8080
  `.trim(),

    metadataText: `
  template=openclaw-agent
  project=agent-lab
  `.trim(),

    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "8080", label: "Web UI", kind: "web" },
    ],

    bootstrapCommand:
      "node openclaw.mjs gateway --allow-unconfigured --bind lan --port 8080",

    restartCommand:
      "sh -lc 'pkill -f \"openclaw.mjs gateway\" || true; node openclaw.mjs gateway --allow-unconfigured --bind lan --port 8080'",

    verifyCommand:
      "node -e \"fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1); console.log('openclaw-ready')}).catch(()=>process.exit(1))\"",

    recipe: [
      "Tạo sandbox chạy OpenClaw gateway",
      "Bấm Open để vào UI qua proxy của OpenSandbox",
      "Token mặc định là 123456",
    ],
  },
  {
    id: "custom",
    name: "Custom",
    category: "custom",
    description: "Bắt đầu từ cấu hình tối thiểu và tự điều chỉnh image, env, entrypoint.",
    imageUri: CODE_INTERPRETER_IMAGE,
    timeout: "3600",
    entrypoint: "/opt/opensandbox/code-interpreter.sh",
    cpu: "500m",
    memory: "512Mi",
    envText: "PYTHON_VERSION=3.11",
    metadataText: "project=demo",
    ports: [{ port: "44772", label: "execd", kind: "execd" }],
    recipe: [
      "Chọn image phù hợp với workload.",
      "Khai báo env/metadata để dễ lọc sandbox.",
      "Tra endpoint theo các port app thật sự lắng nghe.",
    ],
  },
];

export function getTemplateById(templateId: string) {
  return sandboxTemplates.find((template) => template.id === templateId) ?? sandboxTemplates[0];
}
