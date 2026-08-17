import os
import sys
import psycopg2  # type: ignore

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

def main():
    local_env = load_env(".env.local")
    admin_pw = os.getenv("VITE_ADMIN_PASSWORD") or local_env.get("VITE_ADMIN_PASSWORD") or os.getenv("PGPASSWORD")
    if not admin_pw:
        admin_pw = input("Enter PostgreSQL admin password: ").strip()
    if not admin_pw:
        print("Error: VITE_ADMIN_PASSWORD environment variable or password input required.")
        sys.exit(1)
        
    supabase_url = os.getenv("VITE_SUPABASE_URL") or local_env.get("VITE_SUPABASE_URL")
    if not supabase_url:
        print("Error: VITE_SUPABASE_URL environment variable required.")
        sys.exit(1)
    
    proj_ref = str(supabase_url).replace("https://", "").split(".")[0]
    host = f"db.{proj_ref}.supabase.co"
    
    # Try port 6543 (transaction pooler) first, if not 5432 (direct)
    for port in [6543, 5432]:
        db_url = f"postgresql://postgres:{admin_pw}@{host}:{port}/postgres"
        print(f"Attempting connection on port {port}...")
        try:
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            print("Connected successfully!")
            
            # 1. Apply migration_indexes.sql
            migration_path = "performance-tests/migration_indexes.sql"
            if os.path.exists(migration_path):
                print(f"Applying indexes from {migration_path}...")
                with open(migration_path, "r", encoding="utf-8") as f:
                    migration_sql = f.read()
                with conn.cursor() as cur:
                    cur.execute(migration_sql)
                print("Indexes applied successfully!")
            
            # 2. Apply create_buckets.sql
            buckets_path = "performance-tests/create_buckets.sql"
            if os.path.exists(buckets_path):
                print(f"Applying storage buckets from {buckets_path}...")
                with open(buckets_path, "r", encoding="utf-8") as f:
                    buckets_sql = f.read()
                # Run the INSERTs and POLICY drops
                with conn.cursor() as cur:
                    cur.execute(buckets_sql)
                print("Storage buckets and policies applied successfully!")
                
            conn.close()
            return
        except Exception as e:
            print(f"Failed on port {port}: {e}")
            
    print("Could not connect to database on either port.")

if __name__ == "__main__":
    main()
