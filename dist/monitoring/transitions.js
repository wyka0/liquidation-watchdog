import { alertSchema, hashParts, observationSchema, stateSchema } from "./model.js";
import { DIMENSIONS } from "../oracle-assurance/model.js";
import { deriveSuggestedAction } from "../actions/derive.js";
const ranks = { ABOVE_WARNING: 0, WARNING: 1, CRITICAL: 2, LIQUIDATION_BOUNDARY: 3, NO_DEBT: -1 };
const qualityRanks = { VALID: 0, UNVERIFIED: 1, STALE: 2, UNAVAILABLE: 3, INVALID: 4 };
const severity = (state) => state === "LIQUIDATION_BOUNDARY" ? "BOUNDARY" : state === "CRITICAL" ? "CRITICAL" : state === "WARNING" ? "WARNING" : "INFO";
/** Pure transition logic. Revision/episode counters are committed with alerts, never before them. */
export function transition(previous, input, policy, scope) {
    const current = observationSchema.parse(input);
    const state = stateSchema.parse(previous);
    const alerts = [];
    const add = (dimension, code, level, category, before, repeat = false) => {
        const fingerprint = hashParts(["alert-v1", scope, dimension, state.episodes[dimension], code,
            repeat ? current.cycleId : null]);
        alerts.push(alertSchema.parse({ id: `alert_${fingerprint}`, fingerprint, scope, cycleId: current.cycleId,
            createdAt: current.observedAt, severity: level, category, code, previous: before, current,
            suggestedAction: deriveSuggestedAction(code, current) }));
    };
    const oldMath = previous.lastAccepted?.risk.mathematicalRiskState ?? null;
    const math = current.risk.mathematicalRiskState;
    if (current.accepted && math !== null) {
        if (oldMath !== math) {
            state.episodes.risk += 1;
            let code = oldMath === null ? "INITIAL_RISK" : math === "NO_DEBT" ? "NO_DEBT_OBSERVED"
                : oldMath === "NO_DEBT" ? "DEBT_OBSERVED" : ranks[math] > ranks[oldMath] ? "RISK_WORSENED"
                    : math === "ABOVE_WARNING" ? "RISK_RECOVERY" : "RISK_IMPROVED";
            if (math === "NO_DEBT")
                code = "NO_DEBT_OBSERVED";
            if (!["RISK_RECOVERY", "RISK_IMPROVED"].includes(code) || policy.alertOnRecovery) {
                add("risk", code, severity(math), "RISK", previous.lastAccepted);
                if (ranks[math] >= 2)
                    state.lastCriticalAlertAt = current.observedAt;
            }
        }
        else if (ranks[math] >= 2 && (policy.alertOnEveryCriticalCheck || (policy.criticalReminderSeconds !== null
            && (previous.lastCriticalAlertAt === null || Date.parse(current.observedAt) - Date.parse(previous.lastCriticalAlertAt) >= policy.criticalReminderSeconds * 1_000)))) {
            add("risk", "CRITICAL_REMINDER", severity(math), "RISK", previous.lastAccepted, true);
            state.lastCriticalAlertAt = current.observedAt;
        }
        state.lastAccepted = current;
    }
    for (const dimension of ["data", "oracle"]) {
        const key = dimension === "data" ? "dataQuality" : "oracleQuality";
        const before = previous.latest?.risk[key] ?? null;
        const after = current.risk[key];
        if (before === after)
            continue;
        state.episodes[dimension] = (state.episodes[dimension] ?? 0) + 1;
        const worsened = before === null ? after !== "VALID" : qualityRanks[after] > qualityRanks[before];
        // Optional notices may suppress only non-warning restoration. Bad/unknown data always remains visible.
        if (!worsened && after === "VALID" && !policy.alertOnDataQualityChanges)
            continue;
        const restored = dimension === "data" && current.accepted && before !== null && ["UNAVAILABLE", "INVALID", "STALE"].includes(before)
            && ["VALID", "UNVERIFIED"].includes(after);
        add(dimension, dimension === "oracle" ? "ORACLE_QUALITY_CHANGED" : restored ? "DATA_RESTORED" : "DATA_QUALITY_CHANGED", ["INVALID", "UNAVAILABLE", "STALE"].includes(after) ? "CRITICAL" : after === "UNVERIFIED" ? "WARNING" : "INFO", dimension === "oracle" ? "ORACLE" : "DATA_QUALITY", previous.latest);
    }
    state.consecutiveFailures = current.accepted ? 0 : previous.consecutiveFailures + 1;
    if (!current.accepted && previous.consecutiveFailures === 0)
        state.episodes.failures += 1;
    if (state.consecutiveFailures >= policy.maxConsecutiveFailures && previous.consecutiveFailures < policy.maxConsecutiveFailures) {
        add("failures", "PERSISTENT_READ_FAILURE", "CRITICAL", "MONITOR_HEALTH", previous.latest);
    }
    const assurance = current.assurance, beforeAssurance = previous.latest?.assurance;
    if (assurance) {
        const codes = new Set();
        const before = previous.assuranceBaseline ?? beforeAssurance;
        if (before && assurance.configuration && assurance.block && (!before.block || (BigInt(assurance.block.number) >= BigInt(before.block.number)
            && (assurance.block.number !== before.block.number || assurance.block.hash === before.block.hash)))) {
            if (assurance.configurationFingerprint !== before.configurationFingerprint || JSON.stringify(assurance.changes) !== JSON.stringify(before.changes))
                assurance.changes.forEach(code => codes.add(code));
        }
        if (assurance.evidenceInvalidated && !before?.evidenceInvalidated)
            codes.add("ORACLE_ASSURANCE_INVALIDATED");
        if (assurance.freshness.anomalies.length && JSON.stringify(assurance.freshness.anomalies) !== JSON.stringify(beforeAssurance?.freshness.anomalies))
            codes.add("ORACLE_TIMESTAMP_ANOMALY");
        if (assurance.independent.disagrees && !beforeAssurance?.independent.disagrees)
            codes.add("INDEPENDENT_PRICE_DISAGREEMENT");
        if (beforeAssurance) {
            const rank = { VERIFIED: 0, PARTIALLY_VERIFIED: 1, UNVERIFIED: 2, UNKNOWN: 2, FAILED: 3 };
            const delta = DIMENSIONS.map(dimension => rank[assurance.dimensions[dimension].state] - rank[beforeAssurance.dimensions[dimension].state]);
            const gateRank = { ASSURANCE_REQUIREMENTS_MET: 0, DATA_UNVERIFIED: 1, DATA_UNAVAILABLE: 2, DATA_INVALID: 3 };
            if (delta.some(value => value > 0) || gateRank[assurance.gate] > gateRank[beforeAssurance.gate])
                codes.add("ORACLE_ASSURANCE_DETERIORATED");
            else if (delta.some(value => value < 0) || gateRank[assurance.gate] < gateRank[beforeAssurance.gate])
                codes.add("ORACLE_ASSURANCE_IMPROVED");
        }
        if (codes.size) {
            state.episodes.assurance = (state.episodes.assurance ?? 0) + 1;
            for (const code of codes)
                add("assurance", code, code === "ORACLE_ASSURANCE_IMPROVED" ? "INFO" : "CRITICAL", "ORACLE", previous.latest);
        }
        // The result contains a separately block-bound last complete configuration and a sticky invalidation latch.
        state.assuranceBaseline = assurance;
    }
    state.revision += 1;
    state.latest = current;
    return { state, alerts };
}
//# sourceMappingURL=transitions.js.map