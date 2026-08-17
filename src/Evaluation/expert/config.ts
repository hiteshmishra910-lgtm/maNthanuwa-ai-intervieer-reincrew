/**
 * Expert-engine config flag and feature flag resolver.
 *
 * Feature flags can be enabled via:
 *   - `VITE_<FLAG_NAME>=true` in a `.env` file for Vite builds, or
 *   - `<FLAG_NAME>=true` when running under Node (load tests / CI), or
 *   - `setFeatureFlagOverride(flagName, boolean)` for runtime / test overrides.
 */

const overrides: Record<string, boolean | undefined> = {};

export function setExpertEngineEnabled(value: boolean | undefined): void {
  overrides['EXPERT_ENGINE_ENABLED'] = value;
}

export function setFeatureFlagOverride(flagName: string, value: boolean | undefined): void {
  overrides[flagName] = value;
}

export function isFeatureFlagEnabled(flagName: string): boolean {
  if (overrides[flagName] !== undefined) return overrides[flagName]!;
  const viteEnv = ((import.meta as any)?.env as Record<string, unknown> | undefined) || {};
  const nodeEnv = ((globalThis as any)?.process?.env as Record<string, unknown> | undefined) || {};
  const viteKey = flagName.startsWith('VITE_') ? flagName : `VITE_${flagName}`;
  const raw = viteEnv[viteKey] ?? viteEnv[flagName] ?? nodeEnv[viteKey] ?? nodeEnv[flagName];
  return ['true', '1'].includes(String(raw ?? '').trim().toLowerCase());
}

export function isExpertEngineEnabled(): boolean {
  return isFeatureFlagEnabled('EXPERT_ENGINE_ENABLED');
}
