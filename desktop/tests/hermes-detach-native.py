"""Explicit model-free check of an installed Hermes viewer and JSON emitter.

Usage: python hermes-detach-native.py NATIVE_SOURCE BRIDGE_ROOT REPORT
No gateway connection, native session, configuration write or model is used.
"""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone

native, bridge, output = map(Path, sys.argv[1:4])
sys.path.insert(0, str(native))
from hermes_cli.gateway_chat_view import GatewayChatView
from hermes_cli.stream_json import StreamJsonEmitter

files = [native / "hermes_cli" / name for name in (
    "gateway_chat_view.py", "stream_json.py", "gateway_client.py", "gateway_mutations.py"
)]
digest = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
before = {file.name: digest(file) for file in files}
stamp = json.loads((native / "install-stamp.json").read_text(encoding="utf-8"))
report = {
    "date": datetime.now(timezone.utc).isoformat(),
    "environment": "Windows / installed unmodified Hermes viewer and stream-json emitter / controlled pending snapshots / production Bridge parser",
    "nativeCommit": stamp.get("commit"),
    "nativeVersion": stamp.get("displayVersion"),
    "status": "running", "checks": [], "modelCalls": 0, "gatewayConnections": 0,
    "nativeSessionsCreated": 0, "nativeInputs": before,
}
parser = """
const fs = require('node:fs');
const { createParser } = require(process.argv[1]);
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const parser = createParser({adapter: 'hermes'}, () => {});
for (const event of input.events) parser.accept(event);
process.stdout.write(JSON.stringify(parser.finish(input.code)));
"""
try:
    for kind in ("approval", "clarify", "queued"):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            emitter = StreamJsonEmitter(session_id="controlled-original-session")
            snapshot = {"stored_session_id": "controlled-original-session", "pending": [
                {"admission_id": "original-admission", "status": "queued" if kind == "queued" else "running"}
            ], "prompts": []}
            if kind == "queued":
                snapshot["pending"].append({"admission_id": "older-admission", "status": "unknown"})
            else:
                snapshot["prompts"].append({"prompt_id": "controlled-prompt", "kind": kind})
            view = GatewayChatView(None, snapshot, emitter=emitter)
            reason = view._finite_block("original-admission")
            assert reason, "Original viewer did not produce a finite blocking reason"
            code = view._detach(reason)
        events = [json.loads(line) for line in stdout.getvalue().splitlines()]
        assert code == 3 and events[-1]["exit_code"] == 3
        result = subprocess.run(
            ["node", "-e", parser, str(bridge / "desktop/electron/native-cli-protocols.cjs")],
            input=json.dumps({"events": events, "code": code}),
            text=True, encoding="utf-8", capture_output=True, check=True,
        )
        parsed = json.loads(result.stdout)
        assert parsed["uncertain"] is True and parsed["succeeded"] is False
        assert parsed["sessionId"] == "controlled-original-session"
        report["checks"].append({"scenario": kind, "nativeExitCode": code, "bridgeUncertain": True})
    assert before == {file.name: digest(file) for file in files}
    report["nativeSourceUnchanged"] = True
    report["status"] = "passed"
except Exception as error:
    report["status"] = "failed"
    report["errorType"] = type(error).__name__
    raise
finally:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))
