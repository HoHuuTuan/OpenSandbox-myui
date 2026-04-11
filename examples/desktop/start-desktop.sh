#!/usr/bin/env bash
set -e

export DISPLAY=:0
export VNC_PASSWORD="${VNC_PASSWORD:-opensandbox}"

mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix || true

Xvfb :0 -screen 0 1280x800x24 &
sleep 1

dbus-launch startxfce4 &
sleep 2

x11vnc -display :0 -passwd "$VNC_PASSWORD" -forever -shared -rfbport 5900 &
exec websockify --web=/usr/share/novnc 6080 localhost:5900