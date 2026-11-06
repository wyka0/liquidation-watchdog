import { DataError } from "../domain/errors.js";

export interface OracleCommandOptions {
  command: "oracle-audit" | "oracle-status"; json: boolean; saveEvidence: boolean;
  block: bigint | undefined; database: string | undefined; localMaxAgeSeconds: bigint | undefined;
}
export function parseOracleOptions(command: OracleCommandOptions["command"], input: readonly string[]): OracleCommandOptions {
  const args = [...input], seen = new Set<string>();
  const result: OracleCommandOptions = { command, json: false, saveEvidence: false, block: undefined, database: undefined, localMaxAgeSeconds: undefined };
  const value = () => { const text = args.shift(); if (!text || text.startsWith("--") || text.length > 2_048) throw new DataError("CLI_ARGUMENT", "An explicit option value is required."); return text; };
  while (args.length) {
    const flag = args.shift()!;
    if (seen.has(flag)) throw new DataError("CLI_ARGUMENT", "Duplicate oracle command argument.");
    seen.add(flag);
    if (flag === "--json") result.json = true;
    else if (flag === "--database") result.database = value();
    else if (command === "oracle-audit" && flag === "--save-evidence") result.saveEvidence = true;
    else if (command === "oracle-audit" && ["--block", "--local-max-age-seconds"].includes(flag)) {
      const text = value();
      if (!/^[1-9][0-9]{0,19}$/.test(text)) throw new DataError("CLI_ARGUMENT", "Oracle block and local age options require positive decimal integers.");
      if (flag === "--block") result.block = BigInt(text); else result.localMaxAgeSeconds = BigInt(text);
    } else throw new DataError("CLI_ARGUMENT", "Unknown argument for this oracle command.");
  }
  return result;
}
