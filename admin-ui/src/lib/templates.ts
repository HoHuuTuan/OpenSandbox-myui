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
    name: "Desktop Agent",
    category: "desktop",
    description: "Desktop đầy đủ với VNC/noVNC để test GUI agent hoặc quan sát thao tác trực tiếp.",
    imageUri: "opensandbox/desktop:latest",
    timeout: "3600",
    entrypoint: "/home/desktop/start-desktop.sh",
    cpu: "1000m",
    memory: "2Gi",
    envText: "PYTHON_VERSION=3.11\nVNC_PASSWORD=opensandbox",
    metadataText: "template=desktop-agent\nproject=agent-lab",
    ports: [
      { port: "44772", label: "execd", kind: "execd" },
      { port: "5900", label: "VNC", kind: "vnc" },
      { port: "6080", label: "noVNC", kind: "novnc", path: "/vnc.html" },
    ],
    bootstrapCommand:
      "Xvfb :0 -screen 0 1280x800x24 & DISPLAY=:0 dbus-launch startxfce4 & x11vnc -display :0 -passwd \"$VNC_PASSWORD\" -forever -shared -rfbport 5900 & /usr/bin/websockify --web=/usr/share/novnc 6080 localhost:5900",
    recipe: [
      "Khởi động desktop stack bằng bootstrap command.",
      "Mở noVNC trực tiếp trong UI để quan sát agent.",
      "Dùng execd shell để cài thêm app hoặc tooling nếu cần.",
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
