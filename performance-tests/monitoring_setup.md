# Server-Side Resource Monitoring Setup Guide

To get accurate capacity limits, you must measure the **host server's resource utilization** (CPU, Memory, Disk I/O, Network Bandwidth) in parallel with running the Locust load tests. This guide provides step-by-step instructions for setting up lightweight monitoring tools.

---

## 1. Monitoring via Glances (Python-based, CLI & Web)

Glances is a cross-platform monitoring tool that is lightweight and easy to set up.

### Installation
In a separate terminal or virtual environment:
```bash
pip install glances[web]
```

### Running the Web Server
Launch Glances in server mode to view metrics in your browser:
```bash
glances -w
```
Open your browser and navigate to `http://localhost:61208` to see the live resource dashboard.

### Key Metrics to Monitor During Load Tests:
- **CPU Usage**: If CPU exceeds **85%**, the server is reaching its processing limit. Look at the `System` and `User` percentages.
- **Memory Consumption**: Ensure no leaks occur during sustained hold times.
- **Network I/O**: Check for bandwidth limits. Large JSON payloads or streaming requests can saturate network interfaces.

---

## 2. Monitoring via Netdata (Linux / Docker)

If you are running the Supabase backend or Next.js server inside Docker or on a Linux host (AWS, Railway, DigitalOcean), Netdata is the recommended real-time monitoring solution.

### One-Line Docker Run
Launch Netdata as a lightweight container:
```bash
docker run -d --name=netdata \
  -p 19999:19999 \
  -v netdataconfig:/etc/netdata \
  -v netdatalib:/var/lib/netdata \
  -v netdatacache:/var/cache/netdata \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /proc:/host/proc:ro \
  -v /sys:/host/sys:ro \
  --cap-add SYS_PTRACE \
  --security-opt apparmor=unconfined \
  netdata/netdata
```
Open `http://localhost:19999` to access a high-fidelity real-time dashboard.

---

## 3. Docker Stats (Simple CLI monitoring)

If your local Supabase stack is running via Docker Compose, you can monitor container resource usage in real-time from the terminal:

```bash
docker stats
```

Look for:
- **`supabase-db` container**: Monitor CPU and Memory. CPU spikes indicate unindexed queries or heavy write locks.
- **`supabase-rest` (PostgREST) container**: POST requests from Locust hit this container. High CPU here implies request handling overhead.

---

## 4. Correlating Resource Utilization with Locust Metrics

When reviewing your generated `capacity_analysis_report.md`:
1. **Low Locust Latency but High Server CPU (>85%)**: The server is close to saturation. The capacity limit should be capped at this tier to avoid sudden crashes.
2. **High Latency but Low Server CPU (<40%)**: The bottleneck is not physical host CPU/memory. It is likely:
   - Database connection pool limits.
   - Database locking (table locks on `session_responses`).
   - OpenRouter API rate limits (HTTP 429).
