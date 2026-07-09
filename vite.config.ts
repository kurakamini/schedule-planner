/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages はサブパス(/schedule-planner/)で配信されるため、本番ビルドのみ
  // base を付ける。dev/preview はローカル運用なのでルート(/)のまま
  base: command === 'build' ? '/schedule-planner/' : '/',
  plugins: [react()],
  // スマホ実機から自宅 Wi-Fi 経由でアクセスするため LAN に公開する
  server: {
    host: true,
  },
  // preview も dev と同じポートにする。ポート(=オリジン)が変わると
  // ブラウザの保存データ(localStorage)が別扱いになって見えなくなるため
  preview: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}))
