"""
SQL safety validator for SQLCraft-Agent.
Author: Rayen Lassoued | github.com/Hamilas

Prevents destructive queries and enforces read-only mode.
Used as a standalone validation layer before DuckDB execution.

Two modes:
  readonly_mode=True  — only SELECT statements allowed (default, production)
  readonly_mode=False — blocks only explicitly destructive statements (dev/admin)
"""
import re
from dataclasses import dataclass
from enum import Enum


class RiskLevel(str, Enum):
    SAFE = "safe"
    WARNING = "warning"
    BLOCKED = "blocked"


@dataclass
class ValidationResult:
    risk_level: RiskLevel
    is_allowed: bool
    message: str
    detected_patterns: list

    def to_dict(self) -> dict:
        return {
            "risk_level": self.risk_level.value,
            "is_allowed": self.is_allowed,
            "message": self.message,
            "detected_patterns": self.detected_patterns,
        }


# Patterns that ALWAYS block the query
BLOCKED_PATTERNS = [
    (r'\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|SEQUENCE)\b', "DROP statement"),
    (r'\bTRUNCATE\b', "TRUNCATE statement"),
    (r'\bDELETE\s+FROM\b', "DELETE statement"),
    (r'\bINSERT\s+INTO\b', "INSERT statement"),
    (r'\bALTER\s+(TABLE|DATABASE|SCHEMA|SEQUENCE|COLUMN)\b', "ALTER statement"),
    (r'\bCREATE\s+(TABLE|DATABASE|SCHEMA)\b', "CREATE statement"),
    (r'\bUPDATE\s+\w+\s+SET\b', "UPDATE statement"),
    (r'\bGRANT\b', "GRANT statement"),
    (r'\bREVOKE\b', "REVOKE statement"),
    (r'\bEXEC(UTE)?\s*\(', "EXEC/EXECUTE call"),
    (r';\s*-{0,2}\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT|ALTER)', "SQL injection attempt (multi-statement)"),
    (r'/\*.*?(DROP|DELETE|TRUNCATE|UPDATE|INSERT).*?\*/', "Comment-concealed destructive query"),
    (r'\bxp_cmdshell\b', "xp_cmdshell (RCE attempt)"),
    (r'\bOPENROWSET\b', "OPENROWSET (data exfiltration risk)"),
    (r"'.*?'\s*OR\s*'.*?'\s*=\s*'.*?'", "Classic OR-based injection"),
    (r'\b(1|0)\s*=\s*(1|0)\b.*?--', "Always-true injection pattern"),
]

# Patterns that allow the query but emit a warning
WARNING_PATTERNS = [
    (r'\bSELECT\s+\*\b', "SELECT * — consider specifying columns for performance"),
    (r'\bUNION\b', "UNION — verify this is not being used for injection"),
    (r'\bINFORMATION_SCHEMA\b', "INFORMATION_SCHEMA access — schema introspection query"),
    (r'\bSYSTEM_CATALOG\b', "System catalog access"),
    (r'\bLIMIT\s+\d{5,}\b', "Very large LIMIT (10k+ rows) — may impact performance"),
]


def validate_sql(sql: str, readonly_mode: bool = True) -> ValidationResult:
    """
    Validate a SQL query for safety.

    Args:
        sql: The SQL string to validate.
        readonly_mode: If True (default), only SELECT statements are allowed.
                       If False, only explicitly destructive statements are blocked.

    Returns:
        ValidationResult with risk_level, is_allowed, message, and detected_patterns.
    """
    sql_stripped = sql.strip()

    if not sql_stripped:
        return ValidationResult(
            risk_level=RiskLevel.BLOCKED,
            is_allowed=False,
            message="Empty query rejected.",
            detected_patterns=["empty input"],
        )

    # In readonly mode, enforce SELECT-only at the statement level
    if readonly_mode:
        first_token = sql_stripped.upper().lstrip().split()[0] if sql_stripped.split() else ""
        if first_token not in ("SELECT", "WITH", "EXPLAIN"):
            return ValidationResult(
                risk_level=RiskLevel.BLOCKED,
                is_allowed=False,
                message=f"Only SELECT/WITH/EXPLAIN queries are allowed in read-only mode. Got: {first_token}",
                detected_patterns=[f"non-SELECT statement in readonly mode: {first_token}"],
            )

    # Check blocked patterns (run regardless of mode)
    detected_blocked = []
    for pattern, label in BLOCKED_PATTERNS:
        if re.search(pattern, sql_stripped, re.IGNORECASE | re.DOTALL):
            detected_blocked.append(label)

    if detected_blocked:
        return ValidationResult(
            risk_level=RiskLevel.BLOCKED,
            is_allowed=False,
            message=f"Query blocked — dangerous operation(s) detected: {', '.join(detected_blocked)}",
            detected_patterns=detected_blocked,
        )

    # Check warning patterns
    detected_warnings = []
    for pattern, label in WARNING_PATTERNS:
        if re.search(pattern, sql_stripped, re.IGNORECASE):
            detected_warnings.append(label)

    if detected_warnings:
        return ValidationResult(
            risk_level=RiskLevel.WARNING,
            is_allowed=True,
            message=f"Query allowed with warnings: {'; '.join(detected_warnings)}",
            detected_patterns=detected_warnings,
        )

    return ValidationResult(
        risk_level=RiskLevel.SAFE,
        is_allowed=True,
        message="Query passed all safety checks.",
        detected_patterns=[],
    )


def validate_sql_batch(queries: list, readonly_mode: bool = True) -> list:
    """
    Validate multiple SQL statements in one call.

    Args:
        queries: List of SQL strings to validate.
        readonly_mode: Passed to each validate_sql call.

    Returns:
        List of ValidationResult objects (same order as input).
    """
    return [validate_sql(q, readonly_mode) for q in queries]
