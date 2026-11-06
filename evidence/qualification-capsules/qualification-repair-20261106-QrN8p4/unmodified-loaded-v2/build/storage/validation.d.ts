import { DatabaseSync } from "node:sqlite";
export declare function validateDatabaseSchema(db: DatabaseSync, allowEmpty?: boolean, full?: boolean): number;
