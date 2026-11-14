FROM python:3.11-slim-trixie
WORKDIR /app
COPY requirements-lock-linux.txt .
RUN python -m pip install --no-cache-dir --upgrade "pip==26.2.1" \
    && python -m pip install --no-cache-dir --timeout 120 --retries 10 --require-hashes --requirement requirements-lock-linux.txt
RUN python -m pip install --no-cache-dir --upgrade "pip==26.3"
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
COPY . .
CMD ["uvicorn","backend.app.main:app","--host","0.0.0.0","--port","8000"]
