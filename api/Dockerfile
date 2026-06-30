FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir fastapi==0.115.0 "uvicorn[standard]==0.30.6" langchain-groq==0.1.9 reportlab==4.2.5

RUN groupadd -r appuser && useradd -r -m -g appuser appuser

COPY . .

RUN chmod +x /app/docker-entrypoint.sh && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app /home/appuser

ENV HF_HOME=/app/data/hf_cache
ENV SENTENCE_TRANSFORMERS_HOME=/app/data/st_cache
ENV TRANSFORMERS_CACHE=/app/data/hf_cache

USER appuser

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl --fail http://localhost:7860/api/v1/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
