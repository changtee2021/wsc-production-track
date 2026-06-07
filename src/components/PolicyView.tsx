// Shared markdown renderer for policy/terms pages.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function PolicyView({ content }: { content: string }) {
  return (
    <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-2 prose-p:leading-7 prose-li:my-0.5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "_(ยังไม่มีเนื้อหา)_"}</ReactMarkdown>
    </article>
  );
}
