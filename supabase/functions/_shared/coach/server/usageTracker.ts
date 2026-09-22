import { UsageTracker, UsageMetrics } from './types.ts';

export class InMemoryUsageTracker implements UsageTracker {
  private logs: UsageMetrics[] = [];

  trackUsage(metrics: UsageMetrics): void {
    // In production, this would async emit to a timeseries DB or Supabase RPC
    // For M3 observability and tests, we keep it in memory
    this.logs.push(metrics);
  }

  getLogs(): UsageMetrics[] {
    return this.logs;
  }
}
