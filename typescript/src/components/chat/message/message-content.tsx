"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { parseDiscordMarkdown, type MarkdownNode } from "@/lib/parse-markdown";
import type { User } from "@/types/user";
import { UserMention, ChannelMention, EveryoneMention, HereMention } from "./mention";
import { CodeBlock } from "./code-block";

interface MessageContentProps {
  content: string;
  mentions?: User[];
  channelNames?: Record<string, string>;
}

export function MessageContent({ content, mentions = [], channelNames = {} }: MessageContentProps) {
  const nodes = parseDiscordMarkdown(content);

  return (
    <div className="text-[16px] leading-[1.375rem] text-discord-text-normal break-words">
      {nodes.map((node, i) => (
        <MarkdownRenderer key={i} node={node} mentions={mentions} channelNames={channelNames} />
      ))}
    </div>
  );
}

function MarkdownRenderer({
  node,
  mentions,
  channelNames,
}: {
  node: MarkdownNode;
  mentions: User[];
  channelNames: Record<string, string>;
}) {
  switch (node.type) {
    case "text":
      return <>{node.content}</>;

    case "newline":
      return <br />;

    case "bold":
      return (
        <strong className="font-bold">
          <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
        </strong>
      );

    case "italic":
      return (
        <em>
          <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
        </em>
      );

    case "underline":
      return (
        <u>
          <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
        </u>
      );

    case "strikethrough":
      return (
        <s>
          <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
        </s>
      );

    case "inlineCode":
      return (
        <code className="rounded-[3px] bg-discord-bg-tertiary px-1 py-0.5 text-[0.875em] text-discord-header-secondary">
          {node.content}
        </code>
      );

    case "codeBlock":
      return <CodeBlock language={node.language} content={node.content} />;

    case "blockquote":
      return (
        <div className="flex">
          <div className="mr-2 w-1 shrink-0 rounded-sm bg-discord-interactive-muted" />
          <div className="whitespace-pre-wrap">
            <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
          </div>
        </div>
      );

    case "spoiler":
      return <SpoilerText node={node} mentions={mentions} channelNames={channelNames} />;

    case "heading": {
      const sizes = {
        1: "text-2xl font-bold mt-2 mb-1",
        2: "text-xl font-bold mt-2 mb-1",
        3: "text-base font-bold mt-1 mb-0.5",
      };
      return (
        <div className={sizes[node.level]}>
          <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
        </div>
      );
    }

    case "link":
      return (
        <a
          href={node.url}
          className="text-discord-text-link hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
        </a>
      );

    case "userMention": {
      const user = mentions.find((u) => u.id === node.userId);
      return <UserMention userId={node.userId} displayName={user?.displayName} />;
    }

    case "channelMention":
      return (
        <ChannelMention channelId={node.channelId} channelName={channelNames[node.channelId]} />
      );

    case "everyoneMention":
      return <EveryoneMention />;

    case "hereMention":
      return <HereMention />;

    default:
      return null;
  }
}

function RenderChildren({
  nodes,
  mentions,
  channelNames,
}: {
  nodes: MarkdownNode[];
  mentions: User[];
  channelNames: Record<string, string>;
}) {
  return (
    <>
      {nodes.map((child, i) => (
        <MarkdownRenderer key={i} node={child} mentions={mentions} channelNames={channelNames} />
      ))}
    </>
  );
}

function SpoilerText({
  node,
  mentions,
  channelNames,
}: {
  node: Extract<MarkdownNode, { type: "spoiler" }>;
  mentions: User[];
  channelNames: Record<string, string>;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      className={cn(
        "cursor-pointer rounded-[3px] px-0.5",
        revealed ? "bg-discord-bg-accent/40" : "bg-discord-bg-accent text-transparent",
      )}
      onClick={() => setRevealed((r) => !r)}
      role="button"
      tabIndex={0}
    >
      <RenderChildren nodes={node.children} mentions={mentions} channelNames={channelNames} />
    </span>
  );
}
