import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cpSync, createReadStream, existsSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

const prototypeRoot = fileURLToPath(new URL('./prototype-3d/dist', import.meta.url))

export default defineConfig({
  plugins: [react(), {
    name: 'aquamonitor-prototype',
    configureServer(server) {
      server.middlewares.use('/prototype', (request, response) => {
        let pathname: string
        try { pathname = decodeURIComponent((request.url ?? '/').split('?')[0]) }
        catch { response.statusCode = 400; response.end(); return }
        const file = resolve(prototypeRoot, `.${pathname === '/' ? '/index.html' : pathname}`)
        if (!file.startsWith(prototypeRoot + sep) || !existsSync(file)) {
          response.statusCode = 404
          response.end('Protótipo indisponível. Execute npm run dev novamente.')
          return
        }
        const contentTypes: Record<string, string> = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' }
        const contentType = contentTypes[extname(file)] ?? 'application/octet-stream'
        response.setHeader('Content-Type', contentType)
        const stream = createReadStream(file)
        stream.on('error', () => { response.statusCode = 404; response.end() })
        stream.pipe(response)
      })
    },
    closeBundle() {
      cpSync(prototypeRoot, fileURLToPath(new URL('./dist/prototype', import.meta.url)), { recursive: true })
    },
  }],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
