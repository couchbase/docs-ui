'use strict'

// Minimal static file server for the built preview site (public/), used by the
// visual-regression suite. Usage: node scripts/serve-public.js [dir] [port]

const fs = require('fs')
const http = require('http')
const path = require('path')

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'public'))
const port = Number(process.argv[3] || process.env.PORT || 5254)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.yaml': 'text/yaml',
}

http
  .createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(req.url.split(/[?#]/)[0]))
    if (!file.startsWith(root)) return res.writeHead(403).end()
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found')
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' }).end(data)
    })
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`))
