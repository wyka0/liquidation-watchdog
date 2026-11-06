/** Only an explicitly supplied credential is read. Construction never inspects the environment. */
export declare function readAuthenticator(value: string | undefined): (header: string | undefined) => boolean;
