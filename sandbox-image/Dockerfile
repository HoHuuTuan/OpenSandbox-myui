FROM opensandbox/code-interpreter:v1.0.2

RUN apt-get update && apt-get install -y python3-pip && rm -rf /var/lib/apt/lists/*
RUN python3 -m pip install --break-system-packages --no-cache-dir \
    requests \
    numpy \
    pandas \
    matplotlib \
    openpyxl