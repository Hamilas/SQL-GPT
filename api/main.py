import os
import sys
import warnings
import logging
import time

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['ANONYMIZED_TELEMETRY'] = 'False'
os.environ['POSTHOG_DISABLED'] = 'true'
os.environ['CHROMA_TELEMETRY'] = 'False'
logging.getLogger('chromadb').setLevel(logging.ERROR)
logging.getLogger('posthog').setLevel(logging.CRITICAL)
logging.getLogger('httpx').setLevel(logging.WARNING)
warnings.filterwarnings('ignore')

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import duckdb

import src.agent_graph as agent_graph_module

app = FastAPI(title="SQL-GPT", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TABLE_DESCRIPTIONS = {
    "customer": "Registered customers, account balances, and segments.",
    "orders": "Order headers, dates, and priority status.",
    "lineitem": "Individual order line items (price, discount, promo).",
    "nation": "Countries linked to customers and suppliers.",
    "region": "Continents and geographic regions.",
    "part": "Product catalog and specifications.",
    "supplier": "Companies that supply parts.",
    "partsupp": "Inventory linking parts to suppliers.",
}

# Runtime config — updated by sidebar, used per request
runtime_config = {
    "db_path": agent_graph_module.DB_PATH,
    "db_type": "duckdb",
    "llm_provider": "auto",
    "llm_api_key": None,
    "llm_model": None,
    "llm_label": agent_graph_module._llm_label,
}
_runtime_llm = agent_graph_module.llm  # cached LLM instance


class QueryRequest(BaseModel):
    question: str


class ConfigUpdate(BaseModel):
    db_path: Optional[str] = None
    db_type: Optional[str] = None       # "duckdb" | "postgres"
    pg_host: Optional[str] = None
    pg_port: Optional[int] = None
    pg_database: Optional[str] = None
    pg_user: Optional[str] = None
    pg_password: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None


@app.get("/api/v1/health")
def health():
    return {
        "status": "healthy",
        "app_name": "SQL-GPT",
        "app_version": "1.0.0",
        "llm": runtime_config["llm_label"],
        "db_ready": os.path.exists(runtime_config["db_path"]),
        "db_path": runtime_config["db_path"],
        "db_type": runtime_config["db_type"],
    }


@app.get("/api/v1/config")
def get_config():
    return {
        "db_path": runtime_config["db_path"],
        "db_type": runtime_config["db_type"],
        "llm_provider": runtime_config["llm_provider"],
        "llm_model": runtime_config["llm_model"],
        "llm_label": runtime_config["llm_label"],
    }


@app.get("/api/v1/db/available")
def db_available():
    """Discover DuckDB files and scan reachable PostgreSQL endpoints."""
    import socket
    import struct

    # ── DuckDB files ──────────────────────────────────────────────────────────
    db_files = []
    for d in ["/app/data", "/data", os.path.expanduser("~")]:
        if os.path.isdir(d):
            for f in sorted(os.listdir(d)):
                if f.endswith((".db", ".duckdb")):
                    db_files.append(os.path.join(d, f))

    # ── Resolve Docker gateway IP from /proc/net/route ───────────────────────
    gateway_ip = None
    try:
        with open("/proc/net/route") as fh:
            for line in fh:
                parts = line.strip().split()
                if len(parts) >= 3 and parts[1] == "00000000":  # default route
                    # Gateway field is little-endian hex
                    gw_hex = parts[2]
                    gw_bytes = bytes.fromhex(gw_hex)
                    gateway_ip = ".".join(str(b) for b in reversed(gw_bytes))
                    break
    except Exception:
        pass

    # Build candidate list: gateway (=Docker host), common service names, loopback
    hosts = []
    if gateway_ip:
        hosts.append(gateway_ip)
    hosts += ["postgres", "db", "database", "postgresql", "localhost", "127.0.0.1"]

    pg_ports = [5432, 5433, 5434]
    active_pg = []
    seen = set()
    for host in hosts:
        for port in pg_ports:
            key = (host, port)
            if key in seen:
                continue
            seen.add(key)
            try:
                s = socket.create_connection((host, port), timeout=0.5)
                s.close()
                active_pg.append({"host": host, "port": port})
            except Exception:
                pass

    return {
        "duckdb_files": db_files,
        "postgres_ports": active_pg,
        "docker_gateway": gateway_ip,
    }


@app.post("/api/v1/config")
def update_config(update: ConfigUpdate):
    global _runtime_llm
    changed = []

    db_type = update.db_type or runtime_config["db_type"]

    if db_type == "postgres" and update.pg_host:
        # Build a DuckDB connection that attaches to PostgreSQL via postgres scanner
        try:
            pg_conn_str = (
                f"host={update.pg_host} port={update.pg_port or 5432} "
                f"dbname={update.pg_database or 'postgres'} "
                f"user={update.pg_user or 'postgres'} "
                f"password={update.pg_password or ''}"
            )
            con = duckdb.connect()
            con.execute("INSTALL postgres; LOAD postgres;")
            con.execute(f"ATTACH '{pg_conn_str}' AS pg_db (TYPE POSTGRES, READ_ONLY);")
            tables = con.execute("SHOW ALL TABLES").fetchdf()
            con.close()
            runtime_config["db_type"] = "postgres"
            runtime_config["pg_conn_str"] = pg_conn_str
            runtime_config["pg_host"] = update.pg_host
            runtime_config["pg_port"] = update.pg_port or 5432
            runtime_config["db_path"] = f"postgres://{update.pg_host}:{update.pg_port or 5432}/{update.pg_database or 'postgres'}"
            changed.append("db")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PostgreSQL connection failed: {e}")

    elif update.db_path is not None:
        if not os.path.exists(update.db_path):
            raise HTTPException(status_code=400, detail=f"File not found: {update.db_path}")
        try:
            con = duckdb.connect(update.db_path, read_only=True)
            tables = con.execute("SHOW TABLES").fetchdf()
            con.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Cannot open database: {e}")
        runtime_config["db_path"] = update.db_path
        runtime_config["db_type"] = "duckdb"
        changed.append("db_path")

    if update.llm_provider is not None or update.llm_model is not None:
        provider = update.llm_provider or runtime_config["llm_provider"]
        model = update.llm_model or runtime_config["llm_model"]
        # Keys come from env vars only — never from frontend
        new_llm, label = agent_graph_module.build_llm(provider, None, model)
        _runtime_llm = new_llm
        runtime_config["llm_provider"] = provider
        runtime_config["llm_model"] = model
        runtime_config["llm_label"] = label
        changed.append("llm")

    return {"ok": True, "changed": changed, "config": get_config()}


@app.post("/api/v1/query")
def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    t0 = time.time()
    try:
        result, sql = agent_graph_module.agent_workflow(
            req.question,
            db_path=runtime_config["db_path"],
            llm_override=_runtime_llm,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    elapsed = round(time.time() - t0, 3)

    import pandas as pd

    if result is None:
        return {
            "success": False,
            "error": sql or "Failed to generate valid SQL",
            "sql": None,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "latency_s": elapsed,
            "is_simulation": False,
        }

    if isinstance(result, str):
        return {
            "success": False,
            "error": result,
            "sql": sql,
            "columns": [],
            "rows": [],
            "row_count": 0,
            "latency_s": elapsed,
            "is_simulation": False,
        }

    if isinstance(result, pd.DataFrame):
        is_sim = _is_simulation(result)
        return {
            "success": True,
            "sql": sql,
            "columns": list(result.columns),
            "rows": result.values.tolist(),
            "row_count": len(result),
            "latency_s": elapsed,
            "is_simulation": is_sim,
        }

    return {
        "success": False,
        "error": "Unexpected response type",
        "sql": sql,
        "columns": [],
        "rows": [],
        "row_count": 0,
        "latency_s": elapsed,
        "is_simulation": False,
    }


@app.get("/api/v1/schema")
def schema():
    try:
        con = duckdb.connect(runtime_config["db_path"], read_only=True)
        tables = con.execute("SHOW TABLES").fetchdf()
        result = {}
        for t in tables["name"]:
            cols = con.execute(f"DESCRIBE {t}").fetchdf()
            result[t] = {
                "description": TABLE_DESCRIPTIONS.get(t, ""),
                "columns": [
                    {"name": r["column_name"], "type": r["column_type"]}
                    for _, r in cols.iterrows()
                ],
            }
        con.close()
        return {"tables": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/metrics")
def metrics():
    m = agent_graph_module.metrics
    return {
        "summary": m.get_summary(),
        "latency_breakdown": m.get_latency_breakdown(),
        "recent_queries": m.get_recent_queries(10),
    }


class ExportRequest(BaseModel):
    question: str
    sql: str
    columns: list
    rows: list
    latency_s: float = 0.0
    is_simulation: bool = False


@app.post("/api/v1/export/pdf")
def export_pdf(req: ExportRequest):
    """Generate a PDF report for a query result and return it as a file download."""
    import io
    from datetime import datetime

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed. Add it to requirements.txt.")

    from fastapi.responses import StreamingResponse

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=2*cm, rightMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)

    styles = getSampleStyleSheet()
    story = []

    # Title
    title_style = ParagraphStyle('title', parent=styles['Heading1'], fontSize=16, textColor=colors.HexColor('#1e293b'), spaceAfter=6)
    story.append(Paragraph("SQL-GPT Query Report", title_style))

    # Meta
    meta_style = ParagraphStyle('meta', parent=styles['Normal'], fontSize=9, textColor=colors.HexColor('#64748b'), spaceAfter=12)
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    story.append(Paragraph(f"Generated: {ts} · Rows: {len(req.rows)} · Latency: {req.latency_s}s", meta_style))

    # Question
    q_style = ParagraphStyle('q', parent=styles['Normal'], fontSize=11, textColor=colors.HexColor('#1e293b'), spaceAfter=4)
    story.append(Paragraph(f"<b>Question:</b> {req.question}", q_style))
    story.append(Spacer(1, 0.3*cm))

    # SQL
    sql_style = ParagraphStyle('sql', parent=styles['Code'], fontSize=8, textColor=colors.HexColor('#1e40af'),
                                backColor=colors.HexColor('#eff6ff'), borderPadding=6, spaceAfter=12)
    safe_sql = req.sql.replace('<', '&lt;').replace('>', '&gt;')
    story.append(Paragraph(f"<b>SQL:</b><br/>{safe_sql}", sql_style))

    # Results table
    if req.columns and req.rows:
        col_count = len(req.columns)
        page_width = A4[0] - 4*cm
        col_width = page_width / col_count

        table_data = [req.columns]
        for row in req.rows[:500]:  # cap at 500 rows in PDF
            table_data.append([str(cell) if cell is not None else "" for cell in row])

        tbl = Table(table_data, colWidths=[col_width] * col_count, repeatRows=1)
        tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        story.append(tbl)

    doc.build(story)
    buf.seek(0)

    safe_name = "sql_gpt_result.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={safe_name}"},
    )


def _is_simulation(df):
    cols = [c.lower() for c in df.columns]
    signals = ["original", "simulated", "difference", "pct_change", "scenario"]
    return sum(1 for s in signals if any(s in c for c in cols)) >= 2
