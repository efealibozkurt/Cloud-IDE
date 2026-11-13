/** GitHub sürüm notları HTML ya da Markdown gelebilir; arayüzde düz metin olarak göstermek için sadeleştirir. */
export function surumNotunuSadelestir(ham: unknown, enFazla = 1500): string {
  let metin = ''
  if (typeof ham === 'string') metin = ham
  else if (Array.isArray(ham)) {
    metin = ham
      .map((x) => (x && typeof x === 'object' && 'note' in x ? String((x as { note: unknown }).note ?? '') : ''))
      .filter(Boolean)
      .join('\n\n')
  }
  metin = metin
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return metin.length > enFazla ? `${metin.slice(0, enFazla).trimEnd()}…` : metin
}
