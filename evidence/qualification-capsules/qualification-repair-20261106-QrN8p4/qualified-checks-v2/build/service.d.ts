export interface ServiceInput {
    port: string | undefined;
    credential: string | undefined;
}
export interface ServiceArguments {
    config: string;
    runtimeRoot: string;
    database: string;
    riskConfig?: string | undefined;
    positionConfig?: string | undefined;
}
export declare function serviceArguments(args: readonly string[]): ServiceArguments;
/** Import-safe executable wrapper; only this explicit call consumes its named inputs. */
export declare function runService(args: readonly string[], input: ServiceInput, write?: (text: string) => void): Promise<number>;
