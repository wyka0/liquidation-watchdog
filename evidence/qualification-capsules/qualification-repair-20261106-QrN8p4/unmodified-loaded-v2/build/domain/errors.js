export class DataError extends Error {
    code;
    scope;
    quality;
    constructor(code, message, scope = "snapshot", quality = "INVALID") {
        super(message);
        this.code = code;
        this.scope = scope;
        this.quality = quality;
        this.name = "DataError";
    }
}
export class TransientReadError extends Error {
    code;
    retryAfterMs;
    constructor(code, retryAfterMs = null) {
        super(code);
        this.code = code;
        this.retryAfterMs = retryAfterMs;
        this.name = "TransientReadError";
    }
}
//# sourceMappingURL=errors.js.map