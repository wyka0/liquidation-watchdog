import { requireResources } from "../operations/resources.js";
/** SQLite remains synchronous and retains its existing lock, resource checks and backup implementation. */
export function monitoringPersistence(store) {
    if ("requireResources" in store)
        return store;
    return {
        acquireMonitor: () => store.acquireMonitor(), state: scope => store.state(scope),
        beginCycle: (...args) => store.beginCycle(...args), commitObservation: (...args) => store.commitObservation(...args),
        finishCycle: (...args) => store.finishCycle(...args), latestOracleAssurance: (...args) => store.latestOracleAssurance(...args),
        unfinishedCycles: scope => store.unfinishedCycles(scope), recoverDeliveries: (...args) => store.recoverDeliveries(...args),
        due: (...args) => store.due(...args), exhaust: (...args) => store.exhaust(...args), alert: id => store.alert(id),
        startAttempt: (...args) => store.startAttempt(...args), finishAttempt: (...args) => store.finishAttempt(...args),
        nextDeliveryAt: channels => store.nextDeliveryAt(channels), prune: (...args) => store.prune(...args),
        saveRuntime: runtime => store.saveRuntime(runtime), close: () => store.close(),
        requireResources: limits => requireResources(store.storagePath, store, limits)
    };
}
//# sourceMappingURL=persistence.js.map