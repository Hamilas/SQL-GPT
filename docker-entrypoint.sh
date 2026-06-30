#!/bin/bash
set -e

echo "============================================"
echo "  SQL-GPT — Docker Startup"
echo "============================================"

# 1. Generate demo database if missing
if [ ! -f "/app/data/sql_agent_demo.db" ] && [ ! -f "/app/data/supply_chain.db" ]; then
    echo "No database found. Generating demo database (TPC-H SF=0.1)..."
    python /app/scripts/demo_db.py
    echo "Demo database created."
else
    echo "Database found."
fi

# 2. Build ChromaDB vector store if missing
if [ ! -d "/app/data/chroma_db" ]; then
    echo "No vector store found. Building ChromaDB index..."
    python -c "from src.retriever import setup_vector_db; setup_vector_db()"
    echo "Vector store created."
else
    echo "Vector store found."
fi

echo ""
echo "Starting SQL-GPT API..."
echo "============================================"

# Pass CMD args (uvicorn from Dockerfile CMD)
exec "$@"
