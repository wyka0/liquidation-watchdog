import { createHash, timingSafeEqual } from "node:crypto";
import { DataError } from "../domain/errors.js";
const digest = (value) => createHash("sha256").update(value).digest();
/** Only an explicitly supplied credential is read. Construction never inspects the environment. */
export function readAuthenticator(value) {
    if (!value || !/^[A-Za-z0-9_-]{32,256}$/.test(value)) {
        throw new DataError("READ_AUTH_CONFIG", "A valid read-access credential is required.");
    }
    const expected = digest(value);
    return header => {
        if (!header || header.length > 1_024)
            return false;
        let candidate;
        if (/^Bearer /i.test(header))
            candidate = header.slice(7);
        else if (/^Basic /i.test(header)) {
            const encoded = header.slice(6);
            if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
                return false;
            const bytes = Buffer.from(encoded, "base64");
            if (bytes.toString("base64") !== encoded)
                return false;
            const decoded = bytes.toString("utf8");
            if (!decoded.startsWith("watchdog:"))
                return false;
            candidate = decoded.slice(9);
        }
        else
            return false;
        return timingSafeEqual(expected, digest(candidate));
    };
}
//# sourceMappingURL=auth.js.map