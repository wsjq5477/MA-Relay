import { useState } from "react";
import { Bot } from "lucide-react";
import { agentTool, toolLabel } from "./agent-tools";

export default function AgentIcon({
  adapter,
  size = 22,
  decorative = true,
}: {
  adapter?: string;
  size?: number;
  decorative?: boolean;
}) {
  const tool = agentTool(adapter);
  const [failedSource, setFailedSource] = useState<string>();
  const showImage = tool && failedSource !== tool.icon;
  return (
    <span
      className="agent-brand-icon"
      data-agent-kind={adapter || "custom"}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : tool?.fullName || toolLabel(adapter)}
      aria-hidden={decorative || undefined}
      title={tool?.fullName || toolLabel(adapter)}
      style={{
        display: "inline-flex",
        flex: "0 0 auto",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.max(3, Math.round(size / 5)),
        background: showImage ? tool.background : "transparent",
        color: "inherit",
        colorScheme: "light",
        overflow: "hidden",
        padding: 0,
        boxSizing: "border-box",
        verticalAlign: "middle",
      }}
    >
      {showImage ? (
        <img
          src={tool.icon}
          alt=""
          width={size}
          height={size}
          draggable={false}
          onError={() => setFailedSource(tool.icon)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <Bot size={size} aria-hidden="true" />
      )}
    </span>
  );
}
