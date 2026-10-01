import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// SAFE MARKDOWN, used by the public blog AND the admin preview. react-markdown never renders raw HTML
// (no rehype-raw), strips javascript: URLs and builds React elements, so a post cannot inject script
// even if the admin account were compromised. Images are also blocked by the CSP (img-src 'self').
const CLS =
  "space-y-5 break-words leading-7 text-slate-700 dark:text-slate-300 [&_a]:font-medium [&_a]:text-teal-800 [&_a]:underline [&_a]:underline-offset-4 dark:[&_a]:text-teal-200 [&_blockquote]:border-l-2 [&_blockquote]:border-teal-600 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded-md [&_code]:bg-slate-200/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] dark:[&_code]:bg-white/10 [&_h2]:mt-10 [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:text-xl [&_hr]:border-slate-200 dark:[&_hr]:border-white/10 [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 dark:[&_td]:border-white/10 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:px-3 [&_th]:py-2 dark:[&_th]:border-white/10 dark:[&_th]:bg-white/5 [&_ul]:list-disc";

export default function Markdown({ children }) {
  return (
    <div className={CLS}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...p }) => (
            <a {...p} rel="noopener noreferrer" target="_blank" />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
