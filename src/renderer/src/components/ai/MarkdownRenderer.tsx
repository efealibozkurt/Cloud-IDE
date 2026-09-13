import { useState, useMemo, type ReactElement } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownRendererProps {
  content: string
}

/**
 * Chat metnindeki karakter sorunlarını, kaçış dizilerini ve C++ şablon/include
 * etiketlerinin ReactMarkdown tarafından HTML etiketi sanılıp yutulmasını çözer.
 */
export function sanitizeMarkdownContent(raw: string): string {
  if (!raw) return ''

  // Satır sonlarını ve unicode kaçışlarını normalize et
  let text = raw.replace(/\r\n/g, '\n')

  // Model bazen <explanation> veya </explanation> etiketlerini metin içine bırakmış olabilir
  text = text
    .replace(/<editor_action[\s\S]*?<\/editor_action>/gi, '') // editor action chate basılmaz
    .replace(/<\/?explanation>/gi, '')

  // Kod bloklarının (```...```) dışındaki metinlerde C++ başlıklarını ve açısal parantezleri koru
  const parts = text.split(/(```[\s\S]*?```)/g)
  for (let i = 0; i < parts.length; i += 2) {
    let segment = parts[i]

    // #include <WiFi.h> koruması
    segment = segment.replace(/#include\s*<([^>]+)>/g, '`#include <$1>`')

    // <kutuphane.h> veya <deneyap.h> koruması (eğer zaten backtick içinde değilse)
    segment = segment.replace(/(?<!`)(<[\w\d_.-]+\.h>)(?!`)/g, '`$1`')

    // C++ şablonları: vector<int>, map<string, int> vb.
    segment = segment.replace(/\b(vector|map|set|pair|unique_ptr|shared_ptr|array)<([^>]+)>/g, '`$1<$2>`')

    // Tekil < ve > karakterlerinin HTML sanılmasını önle
    segment = segment.replace(/\s<(\s|\d)/g, ' &lt;$1').replace(/(\s|\d)>(\s|\d)/g, '$1&gt;$2')

    parts[i] = segment
  }

  return parts.join('')
}

/**
 * Dret AI sohbet alanı için zenginleştirilmiş, karanlık temaya uygun Markdown render bileşeni.
 * Başlıklar, listeler, kalın/italik yazılar, inline kod kapsülleri, tablolar ve bağımsız kod bloklarını destekler.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps): ReactElement {
  const sanitizedContent = useMemo(() => sanitizeMarkdownContent(content), [content])

  return (
    <div className="dret-markdown-container text-[12px] leading-relaxed text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-1.5 mt-2.5 border-b border-white/10 pb-1 text-[13.5px] font-semibold text-white">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1 mt-2 text-[12.5px] font-semibold text-[#c4b5fd]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-1.5 text-[11.5px] font-semibold text-[#93a5fb]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed text-gray-200">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-300">
              {children}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 list-disc list-outside pl-4 space-y-0.5 text-gray-300 text-[11.5px]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal list-outside pl-4 space-y-0.5 text-gray-300 text-[11.5px]">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 rounded-r border-l-2 border-[#8b5cf6]/70 bg-[#8b5cf6]/10 px-2.5 py-1 text-[11px] italic text-gray-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded border border-panel-border">
              <table className="min-w-full text-left text-[10.5px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-panel-border bg-panel-light/60 font-semibold text-gray-300">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-panel-border/50">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-white/[0.02]">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 text-gray-300">
              {children}
            </td>
          ),
          hr: () => <hr className="my-2.5 border-panel-border/60" />,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#93a5fb] underline hover:text-[#c4b5fd] transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '')
            const textContent = String(children).replace(/\n$/, '')

            if (inline) {
              return (
                <code
                  className="rounded border border-[#8b5cf6]/25 bg-[#8b5cf6]/15 px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#c4b5fd]"
                  {...props}
                >
                  {children}
                </code>
              )
            }

            return (
              <ChatCodeBlock
                language={match ? match[1] : 'cpp'}
                code={textContent}
              />
            )
          }
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  )
}

/** Açıklama metni içinde örnek olarak verilen kod blokları için kopyalama butonlu kart */
function ChatCodeBlock({ language, code }: { language: string; code: string }): ReactElement {
  const [kopyalandi, setKopyalandi] = useState(false)

  const kopyala = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 2000)
    } catch {
      // Hata yok sayılır
    }
  }

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-panel-border bg-black/60 shadow-md">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-gray-400">
        <span className="font-mono uppercase font-semibold text-gray-400 tracking-wider">
          {language} · {code.split('\n').length} Satır
        </span>
        <button
          onClick={() => void kopyala()}
          className="rounded border border-panel-border bg-panel px-1.5 py-0.5 text-[9.5px] text-gray-300 hover:bg-panel-border hover:text-white"
        >
          {kopyalandi ? (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckSmallIcon className="h-2.5 w-2.5" />
              <span>Kopyalandı</span>
            </span>
          ) : (
            <span>Kopyala</span>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-2 font-mono text-[11px] leading-relaxed text-gray-200">
        {code}
      </pre>
    </div>
  )
}

function CheckSmallIcon({ className }: { className?: string }): ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default MarkdownRenderer
