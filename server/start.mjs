// Runs Unity on a web host: serves the built app (dist/) and the API from one address.
// Build first with `npm run build`, then `npm start`.
// PORT sets the port. UNITY_DATA_DIR sets where the data file lives; on a host, point it
// at a disk that is kept between restarts, or listings and chats will be lost.
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { api } from './api.mjs'

const DIST = resolve(process.cwd(), 'dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
}

function serveFile(req, res) {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  let file = normalize(join(DIST, path))
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  res.statusCode = 200
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
  // Built files have a unique name per version, so browsers may keep them; the page itself is always fresh.
  res.setHeader('Cache-Control', file.includes(`${DIST}/assets/`) ? 'public, max-age=31536000, immutable' : 'no-cache')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  createReadStream(file).pipe(res)
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('No built app found. Run "npm run build" first.')
  process.exit(1)
}
const port = Number(process.env.PORT) || 8080
createServer((req, res) => api(req, res, () => serveFile(req, res))).listen(port, () => console.log(`Unity is running on port ${port}`))
