import type { ToolKind } from "./types";

// Keep product identity separate from native model/provider configuration.
// All images are bundled locally; rendering a node never contacts a vendor.
export const agentTools: Record<
  ToolKind,
  { name: string; fullName: string; icon: string; background: string }
> = {
  claude: {
    name: "Claude Code",
    fullName: "Claude Code",
    icon: new URL("../assets/agents/claude.png", import.meta.url).href,
    background: "#ffffff",
  },
  codex: {
    name: "Codex",
    fullName: "Codex",
    icon: new URL("../assets/agents/codex.png", import.meta.url).href,
    background: "#000000",
  },
  opencode: {
    name: "OpenCode",
    fullName: "OpenCode",
    icon: new URL("../assets/agents/opencode.svg", import.meta.url).href,
    background: "#ffffff",
  },
  hermes: {
    name: "Hermes",
    fullName: "Hermes Agent",
    icon: new URL("../assets/agents/hermes.png", import.meta.url).href,
    background: "#ffffff",
  },
  pi: {
    name: "Pi",
    fullName: "Pi coding agent",
    icon: new URL("../assets/agents/pi.svg", import.meta.url).href,
    background: "#ffffff",
  },
  "dsh-desktop": {
    name: "DSH Desktop", fullName: "DeepSeek Harness Desktop",
    icon: new URL("../assets/agents/dsh.svg", import.meta.url).href, background: "#ffffff",
  },
  "dsh-web": {
    name: "DSH Web", fullName: "DeepSeek Harness Web",
    icon: new URL("../assets/agents/dsh.svg", import.meta.url).href, background: "#ffffff",
  },
  dsh: {
    name: "DSH",
    fullName: "DeepSeek Harness",
    icon: new URL("../assets/agents/dsh.svg", import.meta.url).href,
    background: "#ffffff",
  },
};

export function agentTool(adapter?: string) {
  return adapter && Object.hasOwn(agentTools, adapter)
    ? agentTools[adapter as ToolKind]
    : undefined;
}

export const toolLabel = (adapter?: string) =>
  agentTool(adapter)?.name || adapter || "Agent";
