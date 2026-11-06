import { DataError } from "./domain/errors.js";
import { runCli } from "./cli/run.js";
import { publicError } from "./operations/redaction.js";

runCli(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch((error: unknown) => {
  const safe = publicError(error);
  console.error(`${safe.code}: ${safe.message}`);
  process.exitCode = 1;
  // The service has already settled/closed the database. Terminate non-cooperative transport handles on a hard deadline.
  if (error instanceof DataError && ["SHUTDOWN_TIMEOUT", "CYCLE_TIMEOUT"].includes(error.code)) process.exit(1);
});
