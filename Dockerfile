FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (cached layer — only rebuilds if requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create non-root user for security (with home dir for model caches)
RUN groupadd -r appuser && useradd -r -m -g appuser appuser

# Copy project files
COPY . .

# Make entrypoint executable and create data directory
RUN chmod +x /app/docker-entrypoint.sh && \
    mkdir -p /app/data && \
    chown -R appuser:appuser /app /home/appuser

# Point HuggingFace/sentence-transformers cache to /app/data (persisted volume)
ENV HF_HOME=/app/data/hf_cache
ENV SENTENCE_TRANSFORMERS_HOME=/app/data/st_cache
ENV TRANSFORMERS_CACHE=/app/data/hf_cache

USER appuser

# Expose Streamlit default port
EXPOSE 8501

# Health check with interval and start period to allow model loading
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl --fail http://localhost:8501/_stcore/health || exit 1

# Use entrypoint script (handles DB + vector store auto-generation)
ENTRYPOINT ["/app/docker-entrypoint.sh"]
