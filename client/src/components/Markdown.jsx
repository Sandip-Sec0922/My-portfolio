import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// SAFE MARKDOWN, used by the public blog AND the admin preview. react-markdown never renders raw HTML
// (no rehype-raw), strips javascript: URLs and builds React elements, so a post cannot inject script
// even if the admin account were compromised. Images are also blocked by the CSP (img-src 'self').
const CLS =
  "space-y-4 leading-7 [&_a]:underline [&_a]:accent [&_code]:rounded [&_code]:bg-slate-200 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm dark:[&_code]:bg-white/10 [&_h2]:mt-8 [&_h2]:text-2xl [&_h3]:mt-6 [&_h3]:text-xl [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:text-slate-100 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:px-2 [&_th]:border [&_th]:px-2 [&_ul]:list-disc";

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
