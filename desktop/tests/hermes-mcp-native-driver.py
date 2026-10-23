"""Explicit model-free fixture using unmodified Hermes config and MCP modules."""
import asyncio
import json
import sys

sys.path.insert(0, sys.argv[1])
from hermes_cli.config import get_config_path, load_config, load_config_readonly, save_config
from hermes_cli.mcp_config import _remove_mcp_server
from tools import mcp_tool
from tools.mcp_tool_discovery import _connect_server


async def main():
    server = None
    try:
        while raw := await asyncio.to_thread(sys.stdin.readline):
            request = json.loads(raw)
            try:
                action = request["action"]
                if action == "connect":
                    if not mcp_tool._ensure_mcp_sdk():
                        raise RuntimeError("Original Hermes MCP SDK unavailable")
                    cfg = load_config_readonly().get("mcp_servers", {}).get("agentbridge")
                    server = await asyncio.wait_for(_connect_server("agentbridge", cfg), 25)
                    result = {"tools": len(server._tools), "configPath": str(get_config_path())}
                elif action == "call":
                    reply = await asyncio.wait_for(server.session.call_tool("list_agents", arguments=request.get("args", {})), 25)
                    result = reply.model_dump(by_alias=True, exclude_none=True)
                elif action == "disable":
                    config = load_config()
                    config["mcp_servers"]["agentbridge"]["enabled"] = False
                    save_config(config)
                    result = {"enabled": load_config_readonly()["mcp_servers"]["agentbridge"]["enabled"]}
                elif action == "remove":
                    result = {"removed": _remove_mcp_server("agentbridge")}
                elif action == "close":
                    if server:
                        await server.shutdown()
                        server = None
                    print(json.dumps({"id": request["id"], "result": {}}), flush=True)
                    return
                else:
                    raise ValueError("Unknown fixture operation")
                print(json.dumps({"id": request["id"], "result": result}), flush=True)
            except Exception as error:
                print(json.dumps({"id": request["id"], "error": type(error).__name__}), flush=True)
    finally:
        if server:
            await server.shutdown()


asyncio.run(main())
