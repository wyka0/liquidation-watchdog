import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { saveOracleBundle, sha256, verifyOracleBundle } from "../src/oracle-assurance/evidence.js";
import { redactPublicText } from "../src/oracle-assurance/model.js";
import { AUDIT_FIXTURE_BUNDLE } from "./fixtures/assurance.js";
import { temporaryMonitorDirectory, testClock } from "./fixtures/phase4.js";

const root = temporaryMonitorDirectory();
afterAll(async () => { await rm(root, { recursive: true, force: true }); });
const save = () => saveOracleBundle({ "source.json": "{\"readOnly\":true}\n", "report.txt": "FIXTURE: not live evidence.\n" }, { root, now: testClock() });
describe("FIXTURE: immutable oracle evidence and redaction", () => {
  it("exclusively creates different directories at the same timestamp and hashes every exact artifact byte", async () => {
    const first = await save(), second = await save(); expect(first.directory).not.toBe(second.directory);
    expect(await verifyOracleBundle(first.directory)).toEqual({ passed: true, artifactCount: 2, manifestSha256: first.manifestSha256 });
    expect(await readFile(join(first.directory, "source.json"), "utf8")).toBe("{\"readOnly\":true}\n");
    expect(first.manifestSha256).toBe(sha256(await readFile(join(first.directory, "manifest.json"))));
  });
  it.each(["artifact", "manifest", "manifest-hash", "missing", "extra", "duplicate", "directory"])("detects %s tampering or inventory loss", async kind => {
    const { directory } = await save();
    if (kind === "artifact") await writeFile(join(directory, "report.txt"), "changed");
    if (kind === "manifest") await writeFile(join(directory, "manifest.json"), "{}");
    if (kind === "manifest-hash") await writeFile(join(directory, "manifest.sha256"), "0".repeat(64));
    if (kind === "missing") await rm(join(directory, "source.json"));
    if (kind === "extra") await writeFile(join(directory, "extra.txt"), "unexpected");
    if (kind === "directory") await mkdir(join(directory, "nested"));
    if (kind === "duplicate") {
      const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")) as { files: unknown[] };
      manifest.files.push(manifest.files[0]); await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest));
    }
    await expect(verifyOracleBundle(directory)).rejects.toThrow();
  });
  it("rejects traversal, archive destinations and reserved manifest names before writing", async () => {
    for (const file of ["../source.json", "nested/source.json", "manifest.json", "manifest.sha256"]) await expect(saveOracleBundle({ [file]: "fixture" }, { root })).rejects.toThrow();
    await expect(saveOracleBundle({}, { root })).rejects.toMatchObject({ code: "EVIDENCE_EMPTY" });
    await expect(saveOracleBundle({ "x.txt": "fixture" }, { root: "evidence/phase3" })).rejects.toMatchObject({ code: "EVIDENCE_PATH" });
    await expect(saveOracleBundle({ "x.txt": "fixture" }, { root, prefix: "../escape" })).rejects.toMatchObject({ code: "EVIDENCE_PATH" });
  });
  it("rejects linked bundles and linked parents for both creation and verification", async () => {
    const capture = await save(), link = join(root, "linked-bundle"); await symlink(capture.directory, link, "junction");
    await expect(verifyOracleBundle(link)).rejects.toMatchObject({ code: "EVIDENCE_LINK" });
    await expect(saveOracleBundle({ "x.txt": "fixture" }, { root: join(link, "child") })).rejects.toMatchObject({ code: "EVIDENCE_PATH" });
  });
  it("verifies the unchanged captured audit bundle offline", async () => {
    expect(await verifyOracleBundle(AUDIT_FIXTURE_BUNDLE)).toMatchObject({ passed: true, manifestSha256: "108ab27c33230e3acd2de403dca2c413a02d7d8bead7470106acb27470927488" });
  });
  it("redacts credential-bearing URLs, authorization, scalar secrets and terminal controls", () => {
    const url = ["https:", "", "name:synthetic@example.test/path"].join("/");
    const output = redactPublicText(`${url} https://example.test/?key=synthetic Bearer synthetic private_key=synthetic\u001b[1m\n`);
    expect(output).not.toContain("synthetic"); expect(output).not.toContain("\u001b"); expect(output).not.toContain("\n");
    expect(output).toContain("REDACTED");
  });
});
