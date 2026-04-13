#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:1}"
export VNC_PASSWORD="${VNC_PASSWORD:-opensandbox}"
export VNC_PORT="${VNC_PORT:-5900}"
export NOVNC_PORT="${NOVNC_PORT:-6080}"
export DESKTOP_RESOLUTION="${DESKTOP_RESOLUTION:-1280x800x24}"

mkdir -p /tmp/.X11-unix /tmp/chromium-profile
chmod 1777 /tmp/.X11-unix || true

# cleanup old processes
pkill -f "Xvfb ${DISPLAY}" || true
pkill -f "x11vnc .* -rfbport ${VNC_PORT}" || true
pkill -f "/usr/bin/websockify --web=/usr/share/novnc ${NOVNC_PORT} localhost:${VNC_PORT}" || true
rm -f "/tmp/.X11-unix/X${DISPLAY#:}" "/tmp/.X${DISPLAY#:}-lock"

# start X
Xvfb "${DISPLAY}" -screen 0 "${DESKTOP_RESOLUTION}" >/tmp/xvfb.log 2>&1 &
sleep 2

# start XFCE
DISPLAY="${DISPLAY}" dbus-launch startxfce4 >/tmp/xfce.log 2>&1 &
sleep 3

# start VNC
x11vnc -display "${DISPLAY}" -listen 0.0.0.0 -passwd "${VNC_PASSWORD}" -forever -shared -rfbport "${VNC_PORT}" >/tmp/x11vnc.log 2>&1 &
sleep 2

# start noVNC bridge exactly like manual command, but detached
nohup /usr/bin/websockify --web=/usr/share/novnc "${NOVNC_PORT}" "localhost:${VNC_PORT}" \
  >/tmp/websockify.log 2>&1 </dev/null &
sleep 2

echo "=== PORTS ==="
netstat -ltnp | grep -E "${VNC_PORT}|${NOVNC_PORT}" || true

# keep container alive
exec tail -f /dev/null