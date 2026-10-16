import React, { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

function plainText(children: ReactNode): string {
  return Children.toArray(children).map((child) => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    return isValidElement<{ children?: ReactNode }>(child) ? plainText(child.props.children) : "";
  }).join("");
}

function heading(level: number, children: ReactNode) {
  return React.createElement(`h${level}`, { id: plainText(children).trim().replace(/ /g, "-") }, children);
}

interface Props {
  content: string;
  assetBaseUrl?: string;
  onImageClick?: (image: { src: string; alt: string }) => void;
}

export default function MarkdownPreview({ content, assetBaseUrl = "", onImageClick }: Props) {
  if (!content.trim()) return <p className="text-text-muted text-sm p-8">暂无 Markdown 内容。</p>;
  return (
    <article className="markdown-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml
        urlTransform={(url, key) => {
          const safe = defaultUrlTransform(url);
          return key === "src" && safe.startsWith("/api/snapshots/")
            ? `${assetBaseUrl.replace(/\/+$/, "")}${safe}` : safe;
        }}
        components={{
          h1: ({ children }) => heading(1, children),
          h2: ({ children }) => heading(2, children),
          h3: ({ children }) => heading(3, children),
          h4: ({ children }) => heading(4, children),
          h5: ({ children }) => heading(5, children),
          h6: ({ children }) => heading(6, children),
          a: ({ href, children }) => <a href={href} target={href?.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer">{children}</a>,
          table: ({ children }) => <div className="markdown-table-scroll"><table>{children}</table></div>,
          img: ({ src, alt }) => <img src={src} alt={alt || "文章配图"} loading="lazy"
            onClick={() => { if (src && onImageClick) onImageClick({ src, alt: alt || "文章配图" }); }} />,
        }}
      >{content}</ReactMarkdown>
    </article>
  );
}
