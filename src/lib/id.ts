// ID 生成。crypto.randomUUID() は HTTPS/localhost(セキュアコンテキスト)限定で、
// 自宅 Wi-Fi の http://<IP>:5173 では存在せずクラッシュするため、直接使わないこと。
// crypto.getRandomValues はどのコンテキストでも使える。

export function generateId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
