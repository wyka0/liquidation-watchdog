const priority = {
    VALID: 0, UNVERIFIED: 1, STALE: 2, UNAVAILABLE: 3, INVALID: 4
};
export function worstQuality(statuses) {
    return statuses.reduce((worst, item) => priority[item] > priority[worst] ? item : worst, "VALID");
}
export function summarizeQuality(findings) {
    const scopes = ["network", "contracts", "market", "position", "tokens", "oracle", "accounting", "consistency", "snapshot"];
    const byScope = Object.fromEntries(scopes.map(scope => [
        scope, worstQuality(findings.filter(item => item.scope === scope).map(item => item.status))
    ]));
    return { overall: worstQuality(findings.map(item => item.status)), byScope, findings };
}
export function canCalculate(status) {
    return status === "VALID" || status === "UNVERIFIED";
}
//# sourceMappingURL=quality.js.map