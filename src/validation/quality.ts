import type { Finding, QualityStatus, Scope } from "../domain/types.js";

const priority: Record<QualityStatus, number> = {
  VALID: 0, UNVERIFIED: 1, STALE: 2, UNAVAILABLE: 3, INVALID: 4
};

export function worstQuality(statuses: readonly QualityStatus[]): QualityStatus {
  return statuses.reduce<QualityStatus>((worst, item) => priority[item] > priority[worst] ? item : worst, "VALID");
}

export function summarizeQuality(findings: Finding[]) {
  const scopes: Scope[] = ["network", "contracts", "market", "position", "tokens", "oracle", "accounting", "consistency", "snapshot"];
  const byScope = Object.fromEntries(scopes.map(scope => [
    scope, worstQuality(findings.filter(item => item.scope === scope).map(item => item.status))
  ])) as Record<Scope, QualityStatus>;
  return { overall: worstQuality(findings.map(item => item.status)), byScope, findings };
}

export function canCalculate(status: QualityStatus): boolean {
  return status === "VALID" || status === "UNVERIFIED";
}
