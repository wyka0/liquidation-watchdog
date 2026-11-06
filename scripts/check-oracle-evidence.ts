import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { keccak256, stringToHex, toHex } from "viem";
import { z } from "zod";
import { RequestPacer } from "../src/chain/transport.js";
import { DEPLOYMENT, NETWORK } from "../src/config/deployment.js";
import { CURRENT_EVIDENCE } from "../src/config/evidence.js";
import { stringify } from "../src/domain/serialize.js";
import { AUDIT_READ_METHODS, AuditRpc, normalizeAuditParameters } from "../src/oracle-assurance/audit-rpc.js";
import { IDENTITY_PINS } from "../src/oracle-assurance/configuration.js";
import { sha256, verifyOracleBundle } from "../src/oracle-assurance/evidence.js";
import { assuranceSchema, blockRefSchema, digestSchema, unsignedSchema } from "../src/oracle-assurance/model.js";
import { dependencyGraph, renderOracleStatus } from "../src/oracle-assurance/report.js";
import { ISSUER_IDENTITY_EVIDENCE, RESEARCH_BUNDLE, REVIEWED_RECOMPILATION, REVIEWED_SOURCES } from "../src/oracle-assurance/reviewed.js";
import { CONFIGS_STORAGE_SLOT, inspectSupplemental, supplementalResultSchema } from "../src/oracle-assurance/supplemental.js";
import { riskSnapshotSchema } from "../src/risk/snapshot-schema.js";
import { addressSchema, bytesSchema, hashSchema } from "../src/validation/schemas.js";
import { root } from "./phase4-files.js";

const ARCHIVED_RESEARCH = "evidence/phase4";
const collateralBundle = `${ARCHIVED_RESEARCH}/collateral-proof-2026-11-01T17-28-39-523Z-2726e5be-5979-42ba-9fbb-c29342e4be09`;
const independentBundle = `${ARCHIVED_RESEARCH}/independent-research-2026-11-01T17-30-38-572Z-cf7ce161-e80a-412c-aad3-79f1f03a8d15`;
// Exact hashes are required even for retained incomplete/superseded captures. They are never repaired in place.
const retained = new Map([
  [`${ARCHIVED_RESEARCH}/oracle-research-2026-11-01T17-18-42-620Z-a3287621-5c9c-4828-b169-638ac3f62f96`, { hash: "ba4e97894abe48abf8a2c233fe7513067e8a40c743a4f637d523809834f448bf", disposition: "RETAINED_INCOMPLETE_RESEARCH" }],
  [`${ARCHIVED_RESEARCH}/oracle-audit-2026-11-01T17-31-19-568Z-26fe152a-a99b-4c2b-8f61-8e95a73b58c8`, { hash: "48a1cf5229f4a30a5a7ef813ab233a1136c613ab73f15bbb9d899022612acd50", disposition: "SUPERSEDED_SCHEMA_AND_SNAPSHOT_SERIALIZATION" }],
  [`${ARCHIVED_RESEARCH}/oracle-audit-2026-11-01T17-47-35-687Z-5078c30b-6b3f-4325-ad6c-abae354e3d97`, { hash: "108ab27c33230e3acd2de403dca2c413a02d7d8bead7470106acb27470927488", disposition: "SUPERSEDED_SNAPSHOT_SERIALIZATION_RETAINED_FOR_OFFLINE_REPLAY" }]
]);
const pins = new Map([
  [RESEARCH_BUNDLE, "8f435f593e1ba6d24eb287c1459eb20d944f6b27ecca6796d26e3e1abff87521"],
  [collateralBundle, "c932baf8113819948c531fd51e31214ae017978d1c4e5aa8fc62615d1d289acb"],
  [independentBundle, "9aa625a5e3896777d91762abc3a4a48ca346cbfa67aad2c5eb24525521e98a97"],
  ...[...retained].map(([path, item]) => [path, item.hash] as const)
]);
const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(join(root, path), "utf8")) as unknown;
const block = blockRefSchema.extend({ parentHash: hashSchema.optional() });
const positions = z.array(z.object({ start: z.number().int().nonnegative(), length: z.literal(32) }));
const binding = z.object({ id: unsignedSchema, name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/), raw: hashSchema, value: unsignedSchema, positions });
const proofSchema = z.object({ label: z.string(), address: addressSchema, block, compilerVersion: z.string(), inputSha256: digestSchema,
  compiler: z.object({ url: z.url(), sha256: digestSchema, retrievedAt: z.iso.datetime() }),
  deployedSha256: digestSchema, reproducedSha256: digestSchema.nullable(), fullRuntimeMatch: z.boolean(), allImmutablesBound: z.boolean(), immutableReads: z.array(binding) });
const rpcReadsSchema = z.array(z.object({ source: z.literal("rpc"), endpoint: z.url(), method: z.string(), blockNumber: unsignedSchema.nullable(),
  params: z.array(z.unknown()), result: z.unknown(), retrievedAt: z.iso.datetime() }));
const sourceSchema = z.object({ path: z.string(), url: z.url(), retrievedAt: z.iso.datetime(), sha256: digestSchema, bytes: z.number().int().nonnegative() });
const metadataSchema = z.object({ chain_id: z.literal(NETWORK.chainId), address: addressSchema, contract_name: z.string(), compiler_version: z.string(),
  deployed_code_hash: digestSchema, settings: z.record(z.string(), z.unknown()), sourceRecords: z.array(sourceSchema), url: z.url(), retrievedAt: z.iso.datetime() });
const inputSchema = z.object({ language: z.literal("Solidity"), sources: z.record(z.string(), z.object({ content: z.string() })), settings: z.record(z.string(), z.unknown()) });
const outputSchema = z.object({ errors: z.array(z.object({ severity: z.string() })).optional(), sources: z.record(z.string(), z.object({ ast: z.unknown() })),
  contracts: z.record(z.string(), z.record(z.string(), z.object({ metadata: z.string(), storageLayout: z.unknown(),
    evm: z.object({ deployedBytecode: z.object({ object: z.string().regex(/^(?:[a-fA-F0-9]{2})*$/), immutableReferences: z.record(z.string(), positions) }) }) }))) });
const settingsWithoutSelection = (settings: Record<string, unknown>) => Object.fromEntries(Object.entries(settings).filter(([key]) => key !== "outputSelection"));
function immutableNames(ast: unknown, into = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(ast)) ast.forEach(node => immutableNames(node, into));
  else if (ast !== null && typeof ast === "object") {
    const node = ast as Record<string, unknown>;
    if (node.nodeType === "VariableDeclaration" && node.mutability === "immutable" && typeof node.id === "number" && typeof node.name === "string") into.set(String(node.id), node.name);
    Object.values(node).forEach(child => immutableNames(child, into));
  }
  return into;
}

const bundles: unknown[] = [], reproductions: unknown[] = [], audits: unknown[] = [];
let stage = "BUNDLE_INTEGRITY", failedAt: string | null = null;
try {
  const paths: string[] = [];
  for (const archive of new Set([ARCHIVED_RESEARCH, CURRENT_EVIDENCE])) {
    const entries = await readdir(join(root, archive), { withFileTypes: true });
    paths.push(...entries.filter(entry => /^(?:oracle-(?:audit|research)|collateral-proof|independent-research)-/.test(entry.name)).map(entry => `${archive}/${entry.name}`));
  }
  paths.sort();
  for (const path of pins.keys()) assert.ok(paths.includes(path), "Pinned capture is missing.");
  for (const path of paths) {
    const result = await verifyOracleBundle(join(root, path));
    if (pins.has(path)) assert.equal(result.manifestSha256, pins.get(path));
    bundles.push({ path, ...result, disposition: retained.get(path)?.disposition ?? "CURRENT_EVIDENCE" });
  }
  for (const path of paths.filter(path => path.includes("/oracle-research-"))) {
    const completion = z.object({ completed: z.boolean() }).parse(await json(`${path}/capture-completion.json`));
    assert.equal(completion.completed, retained.get(path)?.disposition !== "RETAINED_INCOMPLETE_RESEARCH");
  }
  stage = "REVIEWED_SOURCE_REFERENCES";
  for (const ref of [...REVIEWED_SOURCES, ...REVIEWED_RECOMPILATION, ISSUER_IDENTITY_EVIDENCE]) assert.equal(sha256(await readFile(join(root, ref.source))), ref.artifactSha256);

  stage = "COMPILER_SOURCE_AND_RUNTIME_RECONSTRUCTION";
  const proofs = z.array(proofSchema).length(6).parse(await json(`${RESEARCH_BUNDLE}/independent-recompilation.json`));
  const releases = z.object({ manifest: z.object({ builds: z.array(z.object({ path: z.string(), longVersion: z.string(), sha256: hashSchema, keccak256: hashSchema })) }) })
    .parse(await json(`${RESEARCH_BUNDLE}/compiler-manifest.json`));
  const reads = rpcReadsSchema.parse(await json(`${RESEARCH_BUNDLE}/supplemental-rpc-reads.json`));
  const collateralReads = rpcReadsSchema.parse(await json(`${collateralBundle}/rpc-reads.json`));
  const collateral = z.object({ chainId: z.literal(NETWORK.chainId), subjectAddress: addressSchema, block: blockRefSchema, sourceBundle: z.string(),
    compilerInputSha256: digestSchema, compilerOutputSha256: digestSchema, bindings: z.array(binding), fullRuntimeMatch: z.literal(true), runtimeSha256: digestSchema })
    .parse(await json(`${collateralBundle}/collateral-proof.json`));
  for (const proof of proofs) {
    const label = proof.label;
    stage = `COMPILER_SOURCE_AND_RUNTIME_RECONSTRUCTION_${label.toUpperCase()}`;
    assert.ok(["oracle", "proxy", "cache", "forwarder", "morpho", "collateral"].includes(label));
    const meta = metadataSchema.parse(await json(`${RESEARCH_BUNDLE}/${label}-metadata.json`));
    const inputBytes = await readFile(join(root, RESEARCH_BUNDLE, `${label}-compiler-input.json`));
    const outputBytes = await readFile(join(root, RESEARCH_BUNDLE, `${label}-compiler-output.json`));
    const input = inputSchema.parse(JSON.parse(inputBytes.toString("utf8"))), output = outputSchema.parse(JSON.parse(outputBytes.toString("utf8")));
    const runtime = z.object({ chainId: z.literal(NETWORK.chainId), address: addressSchema, block, code: bytesSchema, sha256: digestSchema, keccak256: hashSchema })
      .parse(await json(`${RESEARCH_BUNDLE}/${label}-runtime.json`));
    assert.equal(meta.address, proof.address); assert.equal(runtime.address, proof.address); assert.deepEqual(runtime.block, proof.block);
    assert.equal(meta.compiler_version, proof.compilerVersion); assert.equal(sha256(inputBytes), proof.inputSha256);
    assert.deepEqual(settingsWithoutSelection(input.settings), settingsWithoutSelection(meta.settings));
    assert.equal(new Set(meta.sourceRecords.map(source => source.path)).size, meta.sourceRecords.length);
    assert.deepEqual(Object.keys(input.sources).sort(), meta.sourceRecords.map(source => source.path).sort());
    for (const source of meta.sourceRecords) {
      const text = input.sources[source.path]!.content;
      assert.equal(sha256(text), source.sha256); assert.equal(Buffer.byteLength(text), source.bytes);
      assert.ok(source.url.startsWith(`https://smart-contract-verify-service-4lladlc2eq-uc.a.run.app/v1/contract_verify/files/1672/${proof.address.toLowerCase()}/`));
    }
    const release = releases.manifest.builds.find(item => `v${item.longVersion}` === proof.compilerVersion);
    assert.ok(release); assert.equal(proof.compiler.url, `https://binaries.soliditylang.org/windows-amd64/${release.path}`);
    assert.equal(`0x${proof.compiler.sha256}`, release.sha256);
    assert.ok(!output.errors?.some(error => error.severity === "error"));
    const matches = Object.values(output.contracts).flatMap(group => group[meta.contract_name] ? [group[meta.contract_name]!] : []);
    assert.equal(matches.length, 1); const contract = matches[0]!;
    const emitted = z.object({ compiler: z.object({ version: z.string() }), sources: z.record(z.string(), z.object({ keccak256: hashSchema, content: z.string().optional() })) })
      .parse(JSON.parse(contract.metadata));
    assert.equal(`v${emitted.compiler.version}`, proof.compilerVersion);
    for (const [path, source] of Object.entries(emitted.sources)) {
      assert.ok(input.sources[path]); assert.equal(keccak256(stringToHex(input.sources[path]!.content)), source.keccak256);
      if (source.content !== undefined) assert.equal(source.content, input.sources[path]!.content);
    }
    const bindings = label === "collateral" ? collateral.bindings : proof.immutableReads;
    const rpcReads = label === "collateral" ? collateralReads : reads;
    if (label === "collateral") {
      assert.equal(collateral.subjectAddress, proof.address); assert.equal(collateral.sourceBundle, RESEARCH_BUNDLE);
      assert.deepEqual(collateral.block, blockRefSchema.parse({ number: proof.block.number, hash: proof.block.hash, timestamp: proof.block.timestamp }));
      assert.equal(collateral.compilerInputSha256, sha256(inputBytes)); assert.equal(collateral.compilerOutputSha256, sha256(outputBytes));
    } else { assert.equal(proof.fullRuntimeMatch, true); assert.equal(proof.allImmutablesBound, true); }
    const bytecode = contract.evm.deployedBytecode, names = immutableNames(Object.values(output.sources).map(source => source.ast));
    assert.ok(bytecode.object.length > 0);
    assert.deepEqual(bindings.map(item => item.id).sort(), Object.keys(bytecode.immutableReferences).sort());
    let reconstructed = bytecode.object;
    for (const item of bindings) {
      assert.equal(names.get(item.id), item.name); assert.deepEqual(item.positions, bytecode.immutableReferences[item.id]);
      assert.equal(BigInt(item.raw).toString(), item.value);
      const params = [{ to: proof.address, data: keccak256(stringToHex(`${item.name}()`)).slice(0, 10) }, toHex(BigInt(proof.block.number))];
      assert.ok(rpcReads.some(read => read.method === "eth_call" && read.blockNumber === proof.block.number && new URL(read.endpoint).href === new URL(NETWORK.rpc).href
        && stringify(read.params) === stringify(params) && read.result === item.raw), "Immutable binding has no exact pinned getter read.");
      for (const position of item.positions) {
        assert.ok(position.start + position.length <= reconstructed.length / 2);
        assert.equal(bytecode.object.slice(position.start * 2, (position.start + position.length) * 2), "0".repeat(64));
        reconstructed = reconstructed.slice(0, position.start * 2) + item.raw.slice(2) + reconstructed.slice((position.start + position.length) * 2);
      }
    }
    assert.equal(`0x${reconstructed}`, runtime.code); assert.equal(sha256(Buffer.from(reconstructed, "hex")), runtime.sha256);
    assert.equal(keccak256(runtime.code), runtime.keccak256); assert.equal(meta.deployed_code_hash, runtime.sha256); assert.equal(proof.deployedSha256, runtime.sha256);
    assert.equal(label === "collateral" ? collateral.runtimeSha256 : proof.reproducedSha256, runtime.sha256);
    const identityPin = IDENTITY_PINS.find(pin => pin.address === proof.address);
    if (identityPin) { assert.equal(identityPin.sha256, runtime.sha256); assert.equal(identityPin.keccak256, runtime.keccak256); }
    if (label === "forwarder") {
      const layout = z.object({ storage: z.array(z.object({ label: z.string(), slot: unsignedSchema, type: z.string() })),
        types: z.record(z.string(), z.object({ value: z.string().optional(), members: z.array(z.object({ label: z.string(), slot: unsignedSchema, offset: z.number() })).optional() })) }).parse(contract.storageLayout);
      for (const [name, slot] of [["s_owner", 0], ["s_pendingOwner", 1], ["s_configs", 2], ["s_forwarders", 3], ["s_transmissions", 4]] as const) {
        assert.equal(layout.storage.find(item => item.label === name)?.slot, String(slot));
      }
      const configs = layout.storage.find(item => item.label === "s_configs")!;
      assert.equal(BigInt(configs.slot), CONFIGS_STORAGE_SLOT);
      const members = layout.types[layout.types[configs.type]!.value!]!.members!;
      assert.deepEqual(members.map(item => [item.label, item.slot, item.offset]), [["f", "0", 0], ["signers", "1", 0], ["_positions", "2", 0]]);
    }
    reproductions.push({ label, address: proof.address, block: proof.block, compilerVersion: proof.compilerVersion, sourceCount: meta.sourceRecords.length,
      emittedMetadataSourceCount: Object.keys(emitted.sources).length, compilerInputSha256: sha256(inputBytes), compilerOutputSha256: sha256(outputBytes),
      runtimeSha256: runtime.sha256, runtimeKeccak256: runtime.keccak256, immutableBindings: bindings.length, fullRuntimeMatch: true });
  }
  assert.equal(new Set(proofs.map(proof => proof.address)).size, 6);

  stage = "INDEPENDENT_SOURCE_DISPOSITIONS";
  const documentSchema = z.object({ subjectAddress: z.literal(DEPLOYMENT.collateralToken), subjectChainId: z.literal(NETWORK.chainId),
    status: z.number(), retrievedAt: z.iso.datetime(), independentComparatorEligible: z.literal(false), retainedText: z.string(), exactRelevantRows: z.array(z.string()) });
  const registry = documentSchema.parse(await json(`${independentBundle}/reservoir-addresses.json`));
  assert.equal(registry.status, 200);
  assert.ok(registry.exactRelevantRows.some(row => row.includes("wsrUSD") && row.includes("Pharos") && row.includes(DEPLOYMENT.collateralToken)));
  documentSchema.parse(await json(`${independentBundle}/reservoir-savings.json`));
  const dex = documentSchema.parse(await json(`${independentBundle}/dexscreener-exact-address.json`));
  assert.equal(dex.status, 200); assert.deepEqual(JSON.parse(dex.retainedText), []);
  assert.equal(documentSchema.parse(await json(`${independentBundle}/chainlink-megaeth.json`)).status, 429);

  stage = "AUDIT_SCHEMA_PROVENANCE_AND_OFFLINE_REPLAY";
  for (const path of paths.filter(path => path.includes("/oracle-audit-"))) {
    if (retained.has(path)) { audits.push({ path, usableAsCurrentAudit: false, disposition: retained.get(path)!.disposition }); continue; }
    const assurance = assuranceSchema.parse(await json(`${path}/assurance.json`));
    const snapshotBytes = await readFile(join(root, path, "snapshot.json"));
    const wire = z.object({ network: z.object({ chainId: z.literal(NETWORK.chainId) }), marketId: z.literal(DEPLOYMENT.marketId), block: block.nullable(),
      evidenceKind: z.string(), retrievedAt: z.iso.datetime(), oracle: z.object({ price: unsignedSchema.nullable(), round: z.object({ updatedAt: unsignedSchema }).nullable() }) })
      .parse(JSON.parse(snapshotBytes.toString("utf8")));
    assert.deepEqual(assurance.block, wire.block ? { number: wire.block.number, hash: wire.block.hash, timestamp: wire.block.timestamp } : null);
    assert.equal(assurance.retrievedAt, wire.retrievedAt); assert.equal(assurance.evidenceKind, wire.evidenceKind);
    assert.equal(assurance.independent.morphoPrice, wire.oracle.price); assert.equal(assurance.freshness.observationTimestamp, wire.oracle.round?.updatedAt ?? null);
    const refs = assurance.findings.flatMap(finding => finding.evidence).filter(ref => ref.sourceKind === "SNAPSHOT");
    assert.ok(refs.length > 0);
    for (const ref of refs) { assert.equal(ref.source, assurance.snapshotIdentifier); assert.equal(ref.artifactSha256, sha256(snapshotBytes)); assert.deepEqual(ref.block, assurance.block); }
    assert.deepEqual(await json(`${path}/dependency-graph.json`), dependencyGraph(assurance));
    assert.equal(await readFile(join(root, path, "audit-report.txt"), "utf8"), renderOracleStatus(assurance));
    const supplementalBytes = await readFile(join(root, path, "supplemental.json"));
    const supplemental = supplementalResultSchema.parse(JSON.parse(supplementalBytes.toString("utf8")));
    assert.deepEqual(supplemental.block, assurance.block);
    assert.equal(assurance.findings.find(finding => finding.id === "BOUNDED_HISTORY")!.evidence[0]!.artifactSha256, sha256(supplementalBytes));
    const trace = z.array(z.object({ method: z.enum(AUDIT_READ_METHODS), params: z.array(z.unknown()), result: z.unknown(), outcome: z.enum(["VALIDATED", "UNAVAILABLE"]), retrievedAt: z.iso.datetime() }).strict()).parse(supplemental.trace);
    for (const read of trace) assert.deepEqual(normalizeAuditParameters(read.method, read.params), read.params);
    let replayed = false;
    if (supplemental.status === "BOUNDED_READ_COMPLETE") {
      // JSON cannot reproduce the original unknown-field bigint tags. This replay is explicitly FIXTURE;
      // only the saved artifact SHA-256, not a reconstructed canonical snapshot ID, is asserted above.
      const snapshot = riskSnapshotSchema.parse(JSON.parse(snapshotBytes.toString("utf8"), (_key, value: unknown) =>
        typeof value === "string" && /^-?(?:0|[1-9][0-9]*)$/.test(value) ? BigInt(value) : value));
      snapshot.evidenceKind = "FIXTURE";
      let cursor = 0;
      const rpc = new AuditRpc(async (_url, init) => {
        const request = z.object({ id: z.number(), method: z.string(), params: z.array(z.unknown()) }).parse(JSON.parse(String(init?.body)));
        const recorded = trace[cursor++]; assert.ok(recorded); assert.equal(recorded.outcome, "VALIDATED");
        assert.equal(request.method, recorded.method); assert.deepEqual(request.params, recorded.params);
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, result: recorded.result }));
      }, new RequestPacer(0));
      const replay = await inspectSupplemental(snapshot, rpc);
      assert.equal(replay.status, "BOUNDED_READ_COMPLETE"); assert.equal(cursor, trace.length);
      for (const key of ["configuration", "events", "samples", "observations", "signerSets", "workflowIds"] as const) assert.deepEqual(JSON.parse(stringify(replay[key])), supplemental[key]);
      replayed = true;
    }
    audits.push({ path, usableAsCurrentAudit: true, block: assurance.block, retrievedAt: assurance.retrievedAt, evidenceKind: assurance.evidenceKind,
      snapshotIdentifier: assurance.snapshotIdentifier, snapshotArtifactSha256: sha256(snapshotBytes), supplementalArtifactSha256: sha256(supplementalBytes),
      overall: assurance.overall, gate: assurance.gate, supplementalStatus: supplemental.status, fixtureReplayOfArchivedReads: replayed });
  }
} catch { failedAt = stage; }
const passed = failedAt === null;
await writeFile(join(root, CURRENT_EVIDENCE, "oracle-evidence-verification.json"), stringify({
  evidenceKind: "OFFLINE_PHASE4_EVIDENCE_INTEGRITY_AND_RECONSTRUCTION", checkedAt: new Date().toISOString(), passed, failedAt,
  bundles, reviewedReferenceCount: REVIEWED_SOURCES.length + REVIEWED_RECOMPILATION.length + 1, reproductions, audits,
  method: "Exact artifact/manifest hashes; source-input and emitted-source hashes; release-manifest links; reconstruct recorded compiler outputs using only AST-bound pinned getter reads; audit schema, artifact references and offline RPC replay.",
  limitations: ["No new compiler execution or chain read occurs in this checker. Native compiler execution and binary SHA-256/Keccak validation were performed by the archived research capture.",
    "Successful integrity verification does not establish source economics, heartbeat, operator identities or provider independence.",
    "Superseded audits retain their original bytes, including their historical schema/serialization limitations, and are not counted as current audit evidence."]
}) + "\n");
console.log(`Phase 4 oracle evidence: ${passed ? "PASS" : `FAIL at ${failedAt}`}; ${bundles.length} immutable bundles; ${reproductions.length}/6 reconstructed runtimes; ${audits.length} audit dispositions.`);
if (!passed) process.exitCode = 1;
