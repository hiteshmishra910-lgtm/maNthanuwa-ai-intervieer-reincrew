import os
import sys
import json
import getpass
import psycopg2  # type: ignore
from psycopg2 import sql  # type: ignore

def load_env(filepath):
    env_vars = {}
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip("'\"")
    return env_vars

# Load configs
local_env = load_env(".env.local")
config_env = load_env("performance-tests/config.env")

# Try to resolve DATABASE_URL
database_url = os.getenv("DATABASE_URL")
if not database_url:
    database_url = config_env.get("DATABASE_URL") or local_env.get("DATABASE_URL")

if not database_url:
    print("DATABASE_URL not found in environment or config files.")
    # Attempt to construct from Supabase URL if possible
    supabase_url = config_env.get("SUPABASE_URL") or local_env.get("VITE_SUPABASE_URL")
    admin_pw = local_env.get("VITE_ADMIN_PASSWORD") or os.getenv("VITE_ADMIN_PASSWORD", "")
    
    if supabase_url and "supabase.co" in supabase_url:
        proj_ref = supabase_url.replace("https://", "").split(".")[0]
        suggested_host = f"db.{proj_ref}.supabase.co"
        print(f"Constructed host: {suggested_host}")
        
        prompt_msg = "Enter PostgreSQL password for user 'postgres': " if not admin_pw else f"Enter PostgreSQL password for user 'postgres' (press Enter to use env VITE_ADMIN_PASSWORD): "
        pw = input(prompt_msg).strip()
        if not pw:
            pw = admin_pw
            
        if not pw:
            print("Error: No PostgreSQL password provided.")
            sys.exit(1)
            
        database_url = f"postgresql://postgres:{pw}@{suggested_host}:6543/postgres"
    else:
        database_url = input("Please enter your PostgreSQL connection string: ").strip()

if not database_url:
    print("Error: No connection string provided. Exiting.")
    sys.exit(1)

print("Connecting to PostgreSQL database...")
try:
    conn = psycopg2.connect(database_url)
    conn.autocommit = False # Keep manual transactions for rollback safety
    cursor = conn.cursor()
    print("Connected successfully!")
except Exception as e:
    print(f"Failed to connect to database: {e}")
    sys.exit(1)

report_sections = []
report_sections.append("# Reincrew AI Database Schema & Query Performance Audit Report\n")
report_sections.append("This report contains a detailed audit of the database tables, existing indexes, foreign keys, table sizes, pg_stat_statements profile, and execution plan benchmarks for critical interview queries.\n")

# --- 1. Tables ---
print("Auditing tables...")
report_sections.append("## 1. Public Schema Tables\n")
cursor.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
""")
tables = [row[0] for row in cursor.fetchall()]
if tables:
    report_sections.append("| Table Name |\n|---|\n" + "\n".join([f"| {t} |" for t in tables]) + "\n")
else:
    report_sections.append("No base tables found in public schema.\n")

# --- 2. Table Sizes & Row Counts ---
print("Auditing table sizes and row counts...")
report_sections.append("\n## 2. Table Sizes & Live Row Counts\n")
cursor.execute("""
    SELECT
        relname AS table_name,
        n_live_tup AS estimated_rows,
        pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
        pg_size_pretty(pg_relation_size(relid)) AS table_size,
        pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS index_size
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(relid) DESC;
""")
sizes = cursor.fetchall()
report_sections.append("| Table Name | Estimated Live Rows | Table Size | Index Size | Total Size |\n|---|---|---|---|---|\n")
for row in sizes:
    report_sections.append(f"| {row[0]} | {row[1]:,} | {row[2]} | {row[3]} | {row[4]} |\n")

# --- 3. Existing Indexes ---
print("Auditing existing indexes...")
report_sections.append("\n## 3. Existing Database Indexes\n")
cursor.execute("""
    SELECT
        tablename,
        indexname,
        indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
""")
indexes = cursor.fetchall()
report_sections.append("| Table | Index Name | Index Definition |\n|---|---|---|\n")
for row in indexes:
    # Escape index definition to avoid markdown table breaks
    idef = row[2].replace("|", "\\|")
    report_sections.append(f"| {row[0]} | {row[1]} | `{idef}` |\n")

# --- 4. Foreign Keys & Index Status ---
print("Auditing foreign key indexes...")
report_sections.append("\n## 4. Foreign Key Constraints & Index Status\n")
fk_query = """
WITH fk_columns AS (
    SELECT
        tc.table_name AS table_name,
        kcu.column_name AS column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
),
indexed_columns AS (
    SELECT
        t.relname AS table_name,
        a.attname AS column_name,
        i.relname AS index_name
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
)
SELECT
    fk.table_name,
    fk.column_name,
    fk.foreign_table_name,
    fk.foreign_column_name,
    fk.constraint_name,
    COALESCE(idx.index_name, '🚨 UNINDEXED') AS index_name
FROM fk_columns fk
LEFT JOIN indexed_columns idx
  ON fk.table_name = idx.table_name AND fk.column_name = idx.column_name
ORDER BY fk.table_name, fk.column_name;
"""
cursor.execute(fk_query)
fkeys = cursor.fetchall()
report_sections.append("| Table | Column | Foreign Table | Foreign Column | Constraint Name | Index Status |\n|---|---|---|---|---|---|\n")
unindexed_fks = []
for row in fkeys:
    status_label = row[5]
    if "UNINDEXED" in status_label:
        unindexed_fks.append((row[0], row[1]))
    report_sections.append(f"| {row[0]} | {row[1]} | {row[2]} | {row[3]} | {row[4]} | {status_label} |\n")

# --- 5. pg_stat_statements Profiles ---
print("Checking pg_stat_statements...")
report_sections.append("\n## 5. Slowest & Most Frequent Queries (pg_stat_statements)\n")
cursor.execute("SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements');")
res = cursor.fetchone()
pg_stat_enabled = res[0] if res else False

if pg_stat_enabled:
    report_sections.append("> [!NOTE]\n> `pg_stat_statements` is enabled. Below are the top slowest and most frequent queries recorded.\n\n")
    
    # Slowest
    report_sections.append("### Top 5 Slowest Queries (By Cumulative Run Time)\n")
    cursor.execute("""
        SELECT
            query,
            calls,
            round(total_exec_time::numeric, 2) as total_time_ms,
            round(mean_exec_time::numeric, 2) as mean_time_ms,
            round((100 * total_exec_time / sum(total_exec_time) OVER())::numeric, 2) as percent_time
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%' AND query NOT LIKE '%information_schema%'
        ORDER BY total_exec_time DESC
        LIMIT 5;
    """)
    slowest = cursor.fetchall()
    report_sections.append("| Query | Call Count | Total Time (ms) | Mean Time (ms) | % DB Time |\n|---|---|---|---|---|\n")
    for row in slowest:
        q_escaped = row[0].replace("\n", " ").replace("|", "\\|")[:120] + "..." if len(row[0]) > 120 else row[0]
        report_sections.append(f"| `{q_escaped}` | {row[1]:,} | {row[2]} | {row[3]} | {row[4]}% |\n")
        
    # Frequent
    report_sections.append("\n### Top 5 Most Frequent Queries\n")
    cursor.execute("""
        SELECT
            query,
            calls,
            round(total_exec_time::numeric, 2) as total_time_ms,
            round(mean_exec_time::numeric, 2) as mean_time_ms
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%' AND query NOT LIKE '%information_schema%'
        ORDER BY calls DESC
        LIMIT 5;
    """)
    frequent = cursor.fetchall()
    report_sections.append("| Query | Call Count | Total Time (ms) | Mean Time (ms) |\n|---|---|---|---|\n")
    for row in frequent:
        q_escaped = row[0].replace("\n", " ").replace("|", "\\|")[:120] + "..." if len(row[0]) > 120 else row[0]
        report_sections.append(f"| `{q_escaped}` | {row[1]:,} | {row[2]} | {row[3]} |\n")
else:
    report_sections.append("> [!WARNING]\n> `pg_stat_statements` is not enabled in this database. Enable it by running `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;` to track live query metrics.\n")

# --- 6. EXPLAIN ANALYZE Benchmarking ---
print("Running query explain plans...")
report_sections.append("\n## 6. Execution Plan Benchmarks (EXPLAIN ANALYZE)\n")
report_sections.append("> [!IMPORTANT]\n> For empty or very small tables, the PostgreSQL Query Planner will default to Sequential Scans (Seq Scan) instead of Index Scans because loading the index table overhead is more expensive than scanning a few rows. In production-sized tables, these automatically switch to Index Scans as rows scale, provided the index is present.\n\n")

# Query definitions to analyze
# We use dummy UUIDs/emails to test structure
queries_to_test = [
    {
        "name": "Candidate Lookup (Login)",
        "sql": "SELECT * FROM candidates WHERE email = 'locust_test_nonexistent@example.com';"
    },
    {
        "name": "Fetch Job Posts",
        "sql": "SELECT id, title FROM job_posts WHERE status = 'ACTIVE';"
    },
    {
        "name": "Create Session",
        "sql": "INSERT INTO interview_sessions (candidate_id, job_post_id, status, candidate_name) VALUES ('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'CREATED', 'Locust Audit') RETURNING id;",
        "is_write": True
    },
    {
        "name": "Answer Question (Write)",
        "sql": "INSERT INTO session_responses (session_id, question_index, question_text, candidate_answer) VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 1, 'Question 1', 'Answer 1') RETURNING id;",
        "is_write": True
    },
    {
        "name": "Answer Evaluation (Read & Order)",
        "sql": "SELECT * FROM session_responses WHERE session_id = '00000000-0000-0000-0000-000000000000'::uuid ORDER BY question_index ASC;"
    },
    {
        "name": "Proctoring Log",
        "sql": "INSERT INTO proctoring_events (session_id, event_type, severity, message) VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 'TAB_SWITCH', 'Low', 'Switched Tab') RETURNING id;",
        "is_write": True
    },
    {
        "name": "Report Creation",
        "sql": "INSERT INTO evaluation_reports (session_id, total_score, technical_score, candidate_name) VALUES ('00000000-0000-0000-0000-000000000000'::uuid, 80, 85.0, 'Locust Audit') ON CONFLICT (session_id) DO UPDATE SET total_score = 80 RETURNING id;",
        "is_write": True
    },
    {
        "name": "View Dashboard (vw_candidate_master)",
        "sql": "SELECT * FROM vw_candidate_master LIMIT 10;"
    }
]

sequential_scans_detected = []

for q in queries_to_test:
    name = q["name"]
    query_text = q["sql"]
    is_write = q.get("is_write", False)
    
    report_sections.append(f"### Query: {name}\n")
    report_sections.append(f"```sql\n{query_text}\n```\n")
    
    try:
        # Run explain plan
        explain_sql = f"EXPLAIN (ANALYZE, BUFFERS, VERBOSE) {query_text}"
        
        cursor.execute("BEGIN;")
        cursor.execute(explain_sql)
        plan_rows = [row[0] for row in cursor.fetchall()]
        cursor.execute("ROLLBACK;") # Keep it clean
        
        plan_str = "\n".join(plan_rows)
        report_sections.append(f"**Execution Plan Output:**\n```text\n{plan_str}\n```\n")
        
        # Analyze for Seq Scan
        if "Seq Scan" in plan_str:
            # Extract target table name
            for line in plan_rows:
                if "Seq Scan" in line:
                    tbl = line.split("on")[-1].strip().split()[0]
                    sequential_scans_detected.append((name, tbl, line.strip()))
                    
    except Exception as e:
        # Rollback transaction in case of error
        try:
            cursor.execute("ROLLBACK;")
        except:
            pass
        report_sections.append(f"🚨 **Execution Plan Failed**: {e}\n\n")

# --- 7. Summary of Bottlenecks & Scans ---
print("Summarizing bottlenecks...")
report_sections.append("\n## 7. Sequential Scans & Bottlenecks Identified\n")
if sequential_scans_detected:
    report_sections.append("| Query Name | Target Table | Plan Step Details |\n|---|---|---|\n")
    for item in sequential_scans_detected:
        report_sections.append(f"| {item[0]} | {item[1]} | `{item[2]}` |\n")
    report_sections.append("\n> [!CAUTION]\n> Sequential Scans read every row of the table. In a large production system (e.g. 100k+ session responses or candidates), this will saturate CPU and crash database performance. These tables must be indexed immediately.\n")
else:
    report_sections.append("No sequential scans were found. All queries are fully indexed and using index scans!\n")

# --- 8. Recommendations & Index Migration SQL ---
print("Generating recommendations and migration SQL...")
report_sections.append("\n## 8. Missing Index Recommendations & Migration SQL\n")

migration_queries = []
recommendations = []

# Recommend indexes for unindexed foreign keys
if unindexed_fks:
    recommendations.append("### Unindexed Foreign Key Recommendations\n")
    recommendations.append("Foreign keys are heavily used in JOINS. Unindexed foreign keys slow down query lookups and cascade deletes.\n")
    
    for tbl, col in unindexed_fks:
        idx_name = f"idx_{tbl}_{col}"
        sql_cmd = f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl}({col});"
        migration_queries.append(sql_cmd)
        recommendations.append(f"* **Table `{tbl}`**: Column `{col}` is a foreign key but lacks an index.\n  - **Recommendation**: Create index `{idx_name}`.\n")

# Recommend composite index on session_responses
composite_idx_name = "idx_session_responses_session_question"
composite_sql = f"CREATE INDEX IF NOT EXISTS {composite_idx_name} ON session_responses(session_id, question_index);"
migration_queries.append(composite_sql)

recommendations.append("### Hot Path Composite Index Recommendation\n")
recommendations.append(f"The candidate answer evaluation read query (`SELECT * FROM session_responses WHERE session_id = ? ORDER BY question_index ASC`) is executed frequently for every candidate question.\n")
recommendations.append(f"- **Recommendation**: Create a **composite index** on `{composite_idx_name}`. This speeds up the lookup and avoids a separate sorting operation (`ORDER BY`) inside PostgreSQL because the index pages are pre-sorted by `question_index`.\n")

report_sections.append("".join(recommendations))

report_sections.append("\n### Database Migration SQL\n")
report_sections.append("Run this script in your Supabase SQL Editor to apply all indexing performance improvements:\n")
report_sections.append("```sql\n" + "\n".join(migration_queries) + "\n```\n")

# Write report file
os.makedirs("performance-tests/results", exist_ok=True)
report_path = "performance-tests/results/database_audit_report.md"
with open(report_path, "w", encoding="utf-8") as f:
    f.writelines(report_sections)

# Write migration file
migration_path = "performance-tests/migration_indexes.sql"
with open(migration_path, "w", encoding="utf-8") as f:
    f.write("\n".join(migration_queries) + "\n")

print(f"\nAudit complete! Report written to: {report_path}")
print(f"Migration SQL written to: {migration_path}")

# Close connections
cursor.close()
conn.close()
