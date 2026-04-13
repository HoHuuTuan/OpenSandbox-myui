# Copyright 2025 Alibaba Group Holding Ltd.
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

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LANGUAGE=en_US:en

RUN apt-get update \
    && apt-get install -y locales \
    && locale-gen en_US.UTF-8 \
    && update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 LANGUAGE=en_US:en \
    && apt-get install -y \
        python3 \
        python3-pip \
        python3-websockify \
        xvfb \
        x11vnc \
        xfce4 \
        xfce4-terminal \
        dbus-x11 \
        xterm \
        novnc \
        fonts-dejavu-core \
        net-tools \
        ca-certificates \
        iputils-ping \
        curl \
        wget \
        git \
        sudo \
        unzip \
        xdg-utils \
        libgtk-3-0 \
        libnss3 \
        libasound2 \
        libxss1 \
        libxtst6 \
        libx11-xcb1 \
        libxcb-dri3-0 \
        libgbm1 \
        --no-install-recommends \
    && sed -i 's/DEFAULT_LOCALE = null;/DEFAULT_LOCALE = "en";/' /usr/share/novnc/app/localization.js \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /tmp/.X11-unix /dev/shm \
    && chmod 1777 /tmp/.X11-unix /dev/shm

RUN groupadd -r desktop && useradd -r -g desktop -G audio,video desktop \
    && mkdir -p /home/desktop \
    && chown -R desktop:desktop /home/desktop

RUN wget "https://download-chromium.appspot.com/dl/Linux_x64?type=snapshots" -O chromium.zip \
    && unzip chromium.zip \
    && mv chrome-linux /opt/chromium \
    && rm chromium.zip

RUN ln -s /opt/chromium/chrome /usr/local/bin/chromium \
    && printf '#!/usr/bin/env bash\nexport DISPLAY=${DISPLAY:-:1}\nmkdir -p /tmp/chromium-profile\nexec /opt/chromium/chrome --no-sandbox --disable-dev-shm-usage --disable-gpu --user-data-dir=/tmp/chromium-profile \"$@\"\n' > /usr/local/bin/chromium-browser \
    && printf '#!/usr/bin/env bash\nset -euo pipefail\nexport DISPLAY=\"${DISPLAY:-:1}\"\nurl=\"${1:-${START_URL:-https://example.com}}\"\nmkdir -p /tmp/chromium-profile\nsetsid /usr/local/bin/chromium-browser \"$url\" >/tmp/chromium-browser.log 2>&1 < /dev/null &\n' > /usr/local/bin/desktop-open-url \
    && ln -sf /usr/local/bin/chromium-browser /usr/local/bin/x-www-browser \
    && chmod +x /usr/local/bin/chromium-browser /usr/local/bin/desktop-open-url

WORKDIR /home/desktop

COPY --chown=desktop:desktop start-desktop.sh /home/desktop/start-desktop.sh
RUN chmod +x /home/desktop/start-desktop.sh

USER root
EXPOSE 44772 5900 6080

CMD ["/home/desktop/start-desktop.sh"]
