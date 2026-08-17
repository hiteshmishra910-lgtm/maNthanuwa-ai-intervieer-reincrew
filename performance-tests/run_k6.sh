#!/usr/bin/env bash
# =============================================================================
# Reicrew AI — Progressive k6 Load Test Runner
# =============================================================================
# Runs k6 at progressive concurrency levels: smoke → 10 → 25 → 50 → 100
#
# Usage:
#   bash performance-tests/run_k6.sh
#
# Prerequisites:
#   1. Install k6: https://grafana.com/docs/k6/latest/get-started/installation/
#   2. Create performance-tests/config.env (see config.env.example)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/config.env"
RESULTS_DIR="${SCRIPT_DIR}/results/k6"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Load environment config
if [ -f "$CONFIG_FILE" ]; then
    echo "📄 Loading config from ${CONFIG_FILE}"
    export $(grep -v '^\s*#' "$CONFIG_FILE" | grep -v '^\s*$' | xargs)
else
    echo "❌ Config file not found: ${CONFIG_FILE}"
    echo "   Copy config.env.example to config.env and fill in your values."
    exit 1
fi

# Validate required vars
if [ -z "$SUPABASE_SERVICE_KEY" ] && [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY must be set in config.env"
    exit 1
fi

# Check k6 installation
if ! command -v k6 &> /dev/null; then
    echo "❌ k6 is not installed. Install it first:"
    echo "   Windows: winget install k6"
    echo "   macOS:   brew install k6"
    echo "   Linux:   sudo apt install k6"
    echo "   Or download from: https://grafana.com/docs/k6/latest/get-started/installation/"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   Reicrew AI — Database & Backend Load Test Suite   ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Stages: smoke → 10 → 25 → 50 → 100 concurrent VUs ║"
echo "║  Results: ${RESULTS_DIR}/${TIMESTAMP}/           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Create results directory
mkdir -p "${RESULTS_DIR}/${TIMESTAMP}"

# Define stages to run
STAGES=("smoke" "10" "25" "50" "100")

for STAGE in "${STAGES[@]}"; do
    echo ""
    echo "──────────────────────────────────────────────────────"
    echo "  ▶ Stage: ${STAGE} concurrent virtual users"
    echo "──────────────────────────────────────────────────────"
    echo ""

    k6 run \
        --out json="${RESULTS_DIR}/${TIMESTAMP}/stage_${STAGE}.json" \
        --summary-export="${RESULTS_DIR}/${TIMESTAMP}/stage_${STAGE}_summary.json" \
        -e "STAGE=${STAGE}" \
        -e "SUPABASE_URL=${SUPABASE_URL}" \
        -e "SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}" \
        -e "SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}" \
        "${SCRIPT_DIR}/k6_load_test.js" 2>&1 | tee "${RESULTS_DIR}/${TIMESTAMP}/stage_${STAGE}.log"

    echo ""
    echo "  ✓ Stage ${STAGE} complete. Log: stage_${STAGE}.log"
    echo ""
done

# Print summary table
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    SUMMARY TABLE                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  All results saved to: ${RESULTS_DIR}/${TIMESTAMP}/  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Individual stage logs:"
for STAGE in "${STAGES[@]}"; do
    LOG="${RESULTS_DIR}/${TIMESTAMP}/stage_${STAGE}.log"
    LAST_LINE=$(tail -1 "$LOG" 2>/dev/null || echo "no data")
    echo "  ${STAGE} VUs → ${LAST_LINE:0:80}"
done
echo ""
echo "✅ Load testing complete."
