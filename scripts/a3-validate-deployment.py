"""Read-only local validation for the unapproved A3 Render/Cloudflare drafts."""

from __future__ import annotations

import json
import pathlib
import tomllib
import urllib.request

import jsonschema
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
BLUEPRINT = ROOT / "render-a3.yaml"
WRANGLER = ROOT / "cloudflare" / "monitor-scheduler" / "wrangler.toml"
SCHEMA_URL = "https://render.com/schema/render.yaml.json"


def read_schema() -> dict[str, object]:
    request = urllib.request.Request(SCHEMA_URL, headers={"User-Agent": "liquidation-watchdog-a3-validator/1"})
    with urllib.request.urlopen(request, timeout=30) as response:  # noqa: S310 - fixed reviewed HTTPS URL
        body = response.read(2_000_001)
    if len(body) > 2_000_000:
        raise ValueError("Render schema exceeds the local validation budget")
    value = json.loads(body)
    if not isinstance(value, dict):
        raise ValueError("Render schema is not an object")
    return value


blueprint_text = BLUEPRINT.read_text("utf8")
if "DRAFT-UNAPPROVED-NOT-DEPLOYED" not in blueprint_text:
    raise ValueError("Blueprint approval marker is missing")
blueprint = yaml.safe_load(blueprint_text)
jsonschema.Draft202012Validator(read_schema()).validate(blueprint)
service = blueprint["services"][0]
if (len(blueprint["services"]) != 1 or service["type"] != "web" or service["runtime"] != "node"
        or service["plan"] != "free" or service["autoDeployTrigger"] != "off"
        or service["startCommand"] != "npm run start:postgres" or service["healthCheckPath"] != "/api/health"
        or "disk" in service or "databases" in blueprint or "preDeployCommand" in service):
    raise ValueError("Blueprint does not match the reviewed Free Web Service boundary")
environment = {item["key"]: item for item in service["envVars"]}
for name in ("WATCHDOG_POSTGRES_WRITER_URL", "WATCHDOG_POSTGRES_READER_URL", "WATCHDOG_READ_API_TOKEN", "WATCHDOG_SCHEDULER_SECRET"):
    if environment.get(name) != {"key": name, "sync": False}:
        raise ValueError(f"Secret placeholder is not value-free: {name}")
if environment["WATCHDOG_SCHEDULER_ENABLED"].get("value") != "false" or environment["WATCHDOG_SCHEDULER_SLOT_SECONDS"].get("value") != "300":
    raise ValueError("Blueprint cadence or initial disabled state is incorrect")

wrangler_text = WRANGLER.read_text("utf8")
if "DRAFT-UNAPPROVED-NOT-DEPLOYED" not in wrangler_text:
    raise ValueError("Worker approval marker is missing")
wrangler = tomllib.loads(wrangler_text)
if wrangler.get("triggers", {}).get("crons") != ["*/5 * * * *"] or wrangler.get("workers_dev") is not False:
    raise ValueError("Worker Cron or public-development route is incorrect")
if "account_id" in wrangler or "vars" in wrangler:
    raise ValueError("Worker draft must not contain account or binding values")

print(json.dumps({
    "kind": "A3_LOCAL_DEPLOYMENT_DRAFT_VALIDATION",
    "passed": True,
    "renderSchema": SCHEMA_URL,
    "renderServices": 1,
    "renderPlan": "free",
    "autoDeploy": False,
    "cron": "*/5 * * * *",
    "wranglerAvailable": False,
    "cloudResourcesCreated": False,
}, indent=2))
