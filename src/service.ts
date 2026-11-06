import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRuntimeConfiguration } from "./config/runtime.js";
import { DataError } from "./domain/errors.js";
import { RenderRuntime, installSignals } from "./runtime/service.js";

export interface ServiceInput { port: string | undefined; credential: string | undefined }
export interface ServiceArguments { config: string; runtimeRoot: string; database: string; riskConfig?: string | undefined; positionConfig?: string | undefined }
export function serviceArguments(args: readonly string[]): ServiceArguments {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]!, value = args[index + 1];
    if (!["--config", "--runtime-root", "--database", "--risk-config", "--position-config"].includes(flag) || values.has(flag) || !value || value.startsWith("--")) {
      throw new DataError("RUNTIME_ARGUMENTS", "Use explicit --config, --runtime-root and --database options only.");
    }
    values.set(flag, value);
  }
  for (const required of ["--config", "--runtime-root", "--database"] as const) {
    if (!values.has(required)) throw new DataError("RUNTIME_ARGUMENTS", "All three runtime options are required.");
  }
  return { config: values.get("--config")!, runtimeRoot: values.get("--runtime-root")!, database: values.get("--database")!,
    ...(values.has("--risk-config") ? { riskConfig: values.get("--risk-config") } : {}),
    ...(values.has("--position-config") ? { positionConfig: values.get("--position-config") } : {}) };
}

/** Import-safe executable wrapper; only this explicit call consumes its named inputs. */
export async function runService(args: readonly string[], input: ServiceInput, write: (text: string) => void = text => { process.stdout.write(text); }): Promise<number> {
  let removeSignals: (() => void) | undefined;
  try {
    const options = serviceArguments(args), releaseRoot = fileURLToPath(new URL("..", import.meta.url));
    if (!input.port || !/^[1-9][0-9]{0,4}$/.test(input.port) || Number(input.port) > 65_535) throw new DataError("RUNTIME_PORT", "A valid explicit platform listener port is required.");
    // One resolved runtime configuration (monitoring + thresholds + fingerprint) for the whole SQLite runtime.
    const runtime = await loadRuntimeConfiguration({
      monitoringPath: isAbsolute(options.config) ? options.config : resolve(releaseRoot, options.config),
      thresholdPath: options.riskConfig === undefined ? undefined : isAbsolute(options.riskConfig) ? options.riskConfig : resolve(releaseRoot, options.riskConfig),
      positionPath: options.positionConfig === undefined ? undefined : isAbsolute(options.positionConfig) ? options.positionConfig : resolve(releaseRoot, options.positionConfig)
    });
    const instance = new RenderRuntime({ releaseRoot, runtimeRoot: options.runtimeRoot, database: options.database, configuration: runtime.monitoring,
      thresholds: runtime.thresholds, position: runtime.position, credential: input.credential, port: Number(input.port), write });
    removeSignals = installSignals(instance, () => {
      write('{"event":"runtime_failed","error":"PROCESS_SHUTDOWN_DEADLINE"}\n'); process.exit(1);
    });
    await instance.start(); return await instance.done;
  } catch {
    write('{"event":"runtime_failed","error":"RUNTIME_STARTUP_OR_SHUTDOWN"}\n'); return 1;
  } finally { removeSignals?.(); }
}

// CLI dispatch is guarded; importing the runtime must never open sockets, storage or start a loop.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.exitCode = await runService(process.argv.slice(2), { port: process.env.PORT, credential: process.env.WATCHDOG_READ_API_TOKEN });
}
