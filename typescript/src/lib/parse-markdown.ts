export type MarkdownNode =
  | { type: "text"; content: string }
  | { type: "bold"; children: MarkdownNode[] }
  | { type: "italic"; children: MarkdownNode[] }
  | { type: "underline"; children: MarkdownNode[] }
  | { type: "strikethrough"; children: MarkdownNode[] }
  | { type: "inlineCode"; content: string }
  | { type: "codeBlock"; language: string; content: string }
  | { type: "blockquote"; children: MarkdownNode[] }
  | { type: "spoiler"; children: MarkdownNode[] }
  | { type: "heading"; level: 1 | 2 | 3; children: MarkdownNode[] }
  | { type: "link"; url: string; children: MarkdownNode[] }
  | { type: "userMention"; userId: string }
  | { type: "channelMention"; channelId: string }
  | { type: "everyoneMention" }
  | { type: "hereMention" }
  | { type: "newline" };

/**
 * Parse Discord-flavored markdown into an AST.
 * This is a pure function with no React dependencies.
 */
export function parseDiscordMarkdown(input: string): MarkdownNode[] {
  if (!input) return [];

  const lines = input.split("\n");
  const result: MarkdownNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block (```)
    const codeBlockMatch = line.match(/^```(\w*)\s*$/);
    if (codeBlockMatch) {
      const language = codeBlockMatch[1] || "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].match(/^```\s*$/)) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push({ type: "codeBlock", language, content: codeLines.join("\n") });
      i++; // skip closing ```
      continue;
    }

    // Heading (# / ## / ###) - must be at start of line
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      result.push({ type: "heading", level, children: parseInline(headingMatch[2]) });
      if (i < lines.length - 1) {
        result.push({ type: "newline" });
      }
      i++;
      continue;
    }

    // Blockquote (> )
    if (line.startsWith("> ") || line === ">") {
      const quoteContent = line === ">" ? "" : line.slice(2);
      const quoteLines = [quoteContent];
      i++;
      while (i < lines.length && (lines[i].startsWith("> ") || lines[i] === ">")) {
        quoteLines.push(lines[i] === ">" ? "" : lines[i].slice(2));
        i++;
      }
      result.push({
        type: "blockquote",
        children: parseInline(quoteLines.join("\n")),
      });
      continue;
    }

    // Regular line - parse inline elements
    if (line.length > 0) {
      result.push(...parseInline(line));
    }

    // Add newline between lines (but not after the last line)
    if (i < lines.length - 1) {
      result.push({ type: "newline" });
    }
    i++;
  }

  return result;
}

// Inline parsing patterns, ordered by priority
interface InlinePattern {
  regex: RegExp;
  parse: (match: RegExpMatchArray) => { node: MarkdownNode; consumed: number };
}

const INLINE_PATTERNS: InlinePattern[] = [
  // Inline code (highest priority - no nesting)
  {
    regex: /^`([^`]+)`/,
    parse: (m) => ({ node: { type: "inlineCode", content: m[1] }, consumed: m[0].length }),
  },
  // Spoiler ||text||
  {
    regex: /^\|\|(.+?)\|\|/,
    parse: (m) => ({
      node: { type: "spoiler", children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  // Bold **text**
  {
    regex: /^\*\*(.+?)\*\*/,
    parse: (m) => ({
      node: { type: "bold", children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  // Underline __text__
  {
    regex: /^__(.+?)__/,
    parse: (m) => ({
      node: { type: "underline", children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  // Italic *text* or _text_
  {
    regex: /^\*([^*]+?)\*(?!\*)/,
    parse: (m) => ({
      node: { type: "italic", children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  {
    regex: /^_([^_]+?)_(?!_)/,
    parse: (m) => ({
      node: { type: "italic", children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  // Strikethrough ~~text~~
  {
    regex: /^~~(.+?)~~/,
    parse: (m) => ({
      node: { type: "strikethrough", children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  // User mention <@userId> or <@!userId>
  {
    regex: /^<@!?(\d+)>/,
    parse: (m) => ({
      node: { type: "userMention", userId: m[1] },
      consumed: m[0].length,
    }),
  },
  // Channel mention <#channelId>
  {
    regex: /^<#(\d+)>/,
    parse: (m) => ({
      node: { type: "channelMention", channelId: m[1] },
      consumed: m[0].length,
    }),
  },
  // @everyone
  {
    regex: /^@everyone/,
    parse: (m) => ({
      node: { type: "everyoneMention" },
      consumed: m[0].length,
    }),
  },
  // @here
  {
    regex: /^@here/,
    parse: (m) => ({
      node: { type: "hereMention" },
      consumed: m[0].length,
    }),
  },
  // Markdown link [text](url)
  {
    regex: /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/,
    parse: (m) => ({
      node: { type: "link", url: m[2], children: parseInline(m[1]) },
      consumed: m[0].length,
    }),
  },
  // Bare URL auto-link
  {
    regex: /^(https?:\/\/[^\s<>]+)/,
    parse: (m) => ({
      node: { type: "link", url: m[1], children: [{ type: "text", content: m[1] }] },
      consumed: m[0].length,
    }),
  },
];

function parseInline(input: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let pos = 0;
  let textBuf = "";

  const flushText = () => {
    if (textBuf) {
      nodes.push({ type: "text", content: textBuf });
      textBuf = "";
    }
  };

  while (pos < input.length) {
    const remaining = input.slice(pos);
    let matched = false;

    for (const pattern of INLINE_PATTERNS) {
      const match = remaining.match(pattern.regex);
      if (match) {
        flushText();
        const { node, consumed } = pattern.parse(match);
        nodes.push(node);
        pos += consumed;
        matched = true;
        break;
      }
    }

    if (!matched) {
      textBuf += input[pos];
      pos++;
    }
  }

  flushText();
  return nodes;
}
