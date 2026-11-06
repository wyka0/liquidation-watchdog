// Phases 1–4 are sealed archives. New captures belong to Phase 5.
export const PHASE2_EVIDENCE = "evidence/phase2";
export const CURRENT_EVIDENCE = "evidence/phase5";
export const PHASE1_REGRESSION_EVIDENCE = `${CURRENT_EVIDENCE}/phase1-regression`;
export function captureDirectory(command, block) {
    return `${CURRENT_EVIDENCE}/${command}/${block === undefined ? "live" : `historical-${block}`}`;
}
//# sourceMappingURL=evidence.js.map