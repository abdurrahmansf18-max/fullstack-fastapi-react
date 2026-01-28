"use client";

// src/user/components/ContentBody.tsx
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { slugify } from "../../shared/utils/slug";
import { cx } from "../../shared/utils/cx";
import { PublicApi } from "../../shared/api/public";

export default function ContentBody({
  md,
  linkClass,
  highlightText,
  contentId,
}: {
  md: string;
  linkClass: string;
  highlightText?: string;
  contentId?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [processedMarkdown, setProcessedMarkdown] = useState(md);

  type HProps = React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLHeadingElement>,
    HTMLHeadingElement
  >;

  useEffect(() => {
    if (!contentId) {
      setProcessedMarkdown(md);
      return;
    }

    PublicApi.contentImages(contentId)
      .then((images) => {
        let processed = md;
        images.forEach((image, index) => {
          const imageMarkdown = `![${image.alt || "Image"}](${image.url}${
            image.width && image.height ? ` "${image.width}x${image.height}"` : ""
          })`;

          // İlk bulunan <--image--> placeholder'ını bu resimle değiştir
          processed = processed.replace("<--image-->", imageMarkdown);
        });

        setProcessedMarkdown(processed);
      })
      .catch((error) => {
        setProcessedMarkdown(md);
      });
  }, [md, contentId]);

  // Metin içinde arama terimini vurgula
  useEffect(() => {
    if (!highlightText || !contentRef.current) return;

    const searchTerm = highlightText.toLowerCase();
    const textNodes: Node[] = [];

    // Tüm metin düğümlerini bul
    const findTextNodes = (node: Node) => {
      if (
        node.nodeType === Node.TEXT_NODE &&
        node.textContent &&
        node.textContent.trim().length > 0
      ) {
        textNodes.push(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Kod bloklarında arama yapma
        if ((node as Element).closest("pre, code")) return;

        node.childNodes.forEach(findTextNodes);
      }
    };

    contentRef.current.childNodes.forEach(findTextNodes);

    // Vurgulamayı temizle
    const highlights = contentRef.current.querySelectorAll(".search-highlight");
    highlights.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });

    // Yeni vurgulamaları ekle
    textNodes.forEach((node) => {
      const text = node.textContent || "";
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(searchTerm);

      if (index !== -1) {
        const parent = node.parentNode;
        if (!parent) return;

        const before = text.substring(0, index);
        const match = text.substring(index, index + searchTerm.length);
        const after = text.substring(index + searchTerm.length);

        const fragment = document.createDocumentFragment();
        if (before) fragment.appendChild(document.createTextNode(before));

        const highlightSpan = document.createElement("span");
        highlightSpan.className =
          "search-highlight bg-yellow-300 dark:bg-yellow-500 text-black dark:text-black px-0.5 rounded";
        highlightSpan.textContent = match;
        fragment.appendChild(highlightSpan);

        if (after) fragment.appendChild(document.createTextNode(after));

        parent.replaceChild(fragment, node);
      }
    });

    // Vurgulanan öğeyi bul ve görünür yap
    const firstHighlight =
      contentRef.current.querySelector(".search-highlight");
    if (firstHighlight) {
      firstHighlight.scrollIntoView({ behavior: "smooth", block: "center" });

      // Geçici olarak vurguyu belirginleştir
      firstHighlight.classList.add("animate-pulse");
      setTimeout(() => {
        firstHighlight.classList.remove("animate-pulse");
      }, 2000);
    }
  }, [highlightText, processedMarkdown]);

  const makeHeading = (Tag: "h1" | "h2" | "h3" | "h4") => (props: HProps) => {
    const text = React.Children.toArray(props.children)
      .map((c) => (typeof c === "string" ? c : ""))
      .join(" ")
      .trim();
    const id = slugify(text || Tag);
    return (
      <Tag id={id} className="group scroll-mt-24" {...props}>
        <a href={`#${id}`} className="no-underline">
          <span className="mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            #
          </span>
        </a>
        {props.children}
      </Tag>
    );
  };

  type CodeProps = React.DetailedHTMLProps<
    React.HTMLAttributes<HTMLElement>,
    HTMLElement
  > & {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  };

  const Code = ({ inline, className, children, ...props }: CodeProps) =>
    inline ? (
      <code className={cx("rounded px-1", className)} {...props}>
        {children}
      </code>
    ) : (
      <pre className="overflow-auto">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    );

  return (
    <div ref={contentRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        className={cx(
          "prose prose-gray dark:prose-invert max-w-none prose-headings:font-semibold",
          "prose-code:bg-neutral-100 dark:prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
          "prose-pre:bg-neutral-50 dark:prose-pre:bg-neutral-900 prose-pre:border prose-pre:border-neutral-200 dark:prose-pre:border-neutral-800",
          "prose-a:no-underline hover:prose-a:underline",
          "prose-img:rounded-xl prose-img:shadow-lg prose-img:border prose-img:border-gray-200 dark:prose-img:border-gray-700",
          "prose-img:max-w-full prose-img:h-auto prose-img:mx-auto prose-img:my-6",
          `prose-a:${linkClass.split(" ").join(":")}`
        )}
        components={{
          h1: makeHeading("h1"),
          h2: makeHeading("h2"),
          h3: makeHeading("h3"),
          code: Code,
          a({ href, children, ...props }) {
            return (
              <a href={href} className={linkClass} {...props}>
                {children}
              </a>
            );
          },
          img({ src, alt, title, width, height, ...props }) {
            let finalWidth = width;
            let finalHeight = height;

            if (!width && !height && title) {
              const dimensionMatch = title.match(/(\d+)x(\d+)/);
              if (dimensionMatch) {
                finalWidth = dimensionMatch[1];
                finalHeight = dimensionMatch[2];
              }
            }

            return (
              <img
                src={src || "/placeholder.svg"}
                alt={alt}
                title={alt}
                width={finalWidth}
                height={finalHeight}
                className="rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mx-auto my-6 transition-all duration-300 hover:shadow-xl"
                style={{
                  width: finalWidth ? `${finalWidth}px` : "auto",
                  height: finalHeight ? `${finalHeight}px` : "auto",
                  maxWidth: "100%",
                  // Boyut verilmişse letterbox/şeffaf kenarları engelle
                  objectFit: finalWidth || finalHeight ? "cover" : "contain",
                }}
                loading="lazy"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "/broken-image.jpg";
                  target.alt = "Image could not be loaded";
                }}
                onLoad={() => {}}
                {...props}
              />
            );
          },
        }}
      >
        {processedMarkdown}
      </ReactMarkdown>
    </div>
  );
}
