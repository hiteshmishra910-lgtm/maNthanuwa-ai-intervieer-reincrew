interface InterviewLatencyMetric {
  questionId: string | number;
  sttDurationMs: number;
  llmDurationMs: number;
  ttsDurationMs: number;
  totalTransitionMs: number;
  timestamp: string;
}

const TELEMETRY_KEY = 'reicrew_latency_telemetry_v1';

export const TelemetryService = {
  recordLatency(metric: Omit<InterviewLatencyMetric, 'timestamp'>): void {
    try {
      const logsStr = localStorage.getItem(TELEMETRY_KEY);
      const logs: InterviewLatencyMetric[] = logsStr ? JSON.parse(logsStr) : [];
      
      const newMetric: InterviewLatencyMetric = {
        ...metric,
        timestamp: new Date().toISOString()
      };
      
      logs.push(newMetric);
      
      // Limit local storage size to last 500 records
      if (logs.length > 500) {
        logs.shift();
      }
      
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(logs));
      
      // Print current metric and summary statistics to console
      console.group(`📊 Latency Telemetry Recorded (Q: ${metric.questionId})`);
      console.log("Current Transition:");
      console.log(`- STT Duration:  ${metric.sttDurationMs.toFixed(1)}ms`);
      console.log(`- LLM Duration:  ${metric.llmDurationMs.toFixed(1)}ms`);
      console.log(`- TTS Duration:  ${metric.ttsDurationMs.toFixed(1)}ms`);
      console.log(`- Total Transition: ${metric.totalTransitionMs.toFixed(1)}ms`);
      
      this.printSummaryStats();
      console.groupEnd();
    } catch (e) {
      console.error("Failed to record latency metrics:", e);
    }
  },

  getMetrics(): InterviewLatencyMetric[] {
    try {
      const logsStr = localStorage.getItem(TELEMETRY_KEY);
      return logsStr ? JSON.parse(logsStr) : [];
    } catch (e) {
      return [];
    }
  },

  clearMetrics(): void {
    try {
      localStorage.removeItem(TELEMETRY_KEY);
    } catch (e) {
      console.error("Failed to clear telemetry metrics:", e);
    }
  },

  printSummaryStats(): void {
    const metrics = this.getMetrics();
    if (metrics.length === 0) return;

    const extractStats = (key: keyof Omit<InterviewLatencyMetric, 'questionId' | 'timestamp'>) => {
      const values = metrics.map(m => m[key] as number).sort((a, b) => a - b);
      const count = values.length;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / count;
      const median = values[Math.floor(count / 2)];
      
      // 95th percentile
      const p95Idx = Math.max(0, Math.min(count - 1, Math.floor(count * 0.95)));
      const p95 = values[p95Idx];
      
      const max = values[count - 1];

      return { avg, median, p95, max };
    };

    const stt = extractStats('sttDurationMs');
    const llm = extractStats('llmDurationMs');
    const tts = extractStats('ttsDurationMs');
    const total = extractStats('totalTransitionMs');

    console.log("Summary Statistics (All Recorded Transitions):");
    console.table({
      "STT Duration (ms)": { Average: Math.round(stt.avg), Median: Math.round(stt.median), "95th %": Math.round(stt.p95), Max: Math.round(stt.max) },
      "LLM Duration (ms)": { Average: Math.round(llm.avg), Median: Math.round(llm.median), "95th %": Math.round(llm.p95), Max: Math.round(llm.max) },
      "TTS Duration (ms)": { Average: Math.round(tts.avg), Median: Math.round(tts.median), "95th %": Math.round(tts.p95), Max: Math.round(tts.max) },
      "Total Transition (ms)": { Average: Math.round(total.avg), Median: Math.round(total.median), "95th %": Math.round(total.p95), Max: Math.round(total.max) }
    });
  }
};
