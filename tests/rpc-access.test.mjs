import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import crypto from 'node:crypto'

// Execute the actual registration function with inert Electron/Express boundaries.
// No service callback, database, model, file watcher or network socket is started.
function boot(env = {}) {
  const source = readFileSync(new URL('../src/main/ipc/handlers.ts', import.meta.url), 'utf8')
  const start = source.indexOf('export function registerIpcHandlers')
  const end = source.indexOf('\nfunction handleDatabaseEvents', start)
  assert.ok(start >= 0 && end > start)
  const middleware = []
  const routes = new Map()
  const listens = []
  const app = { use(fn) { middleware.push(fn) }, post(path, fn) { routes.set(path, fn) }, listen(...args) { listens.push(args) } }
  const express = Object.assign(() => app, { json: () => (_req, _res, next) => next() })
  const context = vm.createContext({
    ipcMain: { handle() {} }, process: { env }, crypto, Buffer, URL,
    console: { log() {}, error() {} },
    require(name) {
      if (name === 'express') return express
      if (name === 'cors') return () => (_req, _res, next) => next()
      throw new Error(`Unexpected import: ${name}`)
    }
  })
  const extracted = source.slice(start, end).replace('export function', 'function')
  vm.runInContext(stripTypeScriptTypes(`const expressHandlers = new Map();\n${extracted}\nregisterIpcHandlers();\nexpressHandlers.set('offline:ping', async () => 'pong');`), context)
  return {
    listens,
    async request({ token, origin, method = 'POST', body = { channel: 'offline:ping' } } = {}) {
      const req = { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) }, body }
      const res = { statusCode: 200, finished: false, headers: {}, status(code) { this.statusCode = code; return this }, json(value) { this.data = value; this.finished = true; return this }, setHeader(k, v) { this.headers[k] = v }, end() { this.finished = true; return this } }
      async function dispatch(index) {
        if (res.finished) return
        const fn = middleware[index]
        if (fn) await fn(req, res, () => dispatch(index + 1))
        else await routes.get('/api/rpc')?.(req, res)
      }
      await dispatch(0)
      return res
    }
  }
}

const token = 'offline-test-token-'.repeat(3)
test('HTTP RPC is disabled without a strong explicit token', () => {
  assert.equal(boot().listens.length, 0)
  assert.equal(boot({ COGNITWIN_RPC_TOKEN: 'short' }).listens.length, 0)
})
test('enabled listener binds only to loopback on a numeric port', () => {
  const app = boot({ COGNITWIN_RPC_TOKEN: token })
  assert.equal(app.listens.length, 1)
  assert.equal(app.listens[0][0], 3000)
  assert.equal(app.listens[0][1], '127.0.0.1')
})
test('missing and incorrect bearer tokens cannot dispatch a handler', async () => {
  const app = boot({ COGNITWIN_RPC_TOKEN: token })
  assert.equal((await app.request()).statusCode, 401)
  assert.equal((await app.request({ token: token + 'x' })).statusCode, 401)
  assert.equal((await app.request({ token })).data.data, 'pong')
})
test('browser origins are denied unless explicitly allowed', async () => {
  const app = boot({ COGNITWIN_RPC_TOKEN: token, COGNITWIN_RPC_ORIGIN: 'http://localhost:5173' })
  assert.equal((await app.request({ token, origin: 'https://untrusted.example' })).statusCode, 403)
  const allowed = await app.request({ token, origin: 'http://localhost:5173' })
  assert.equal(allowed.data.data, 'pong')
  assert.equal(allowed.headers['Access-Control-Allow-Origin'], 'http://localhost:5173')
  assert.equal((await app.request({ origin: 'http://localhost:5173', method: 'OPTIONS' })).statusCode, 204)
})
test('invalid port or non-loopback configured origin does not start RPC', () => {
  assert.equal(boot({ COGNITWIN_RPC_TOKEN: token, PORT: 'not-a-port' }).listens.length, 0)
  assert.equal(boot({ COGNITWIN_RPC_TOKEN: token, COGNITWIN_RPC_ORIGIN: 'https://untrusted.example' }).listens.length, 0)
})
test('malformed request body is rejected before dispatch', async () => {
  const app = boot({ COGNITWIN_RPC_TOKEN: token })
  assert.equal((await app.request({ token, body: null })).statusCode, 400)
  assert.equal((await app.request({ token, body: { channel: 42 } })).statusCode, 400)
})

function renderer(fetch, sessionToken) {
  const source = readFileSync(new URL('../src/renderer/src/main.tsx', import.meta.url), 'utf8')
  const start = source.indexOf('const executeRpc =')
  const end = source.indexOf('const createProxy =', start)
  assert.ok(start >= 0 && end > start)
  const context = vm.createContext({ fetch, sessionStorage: { getItem: () => sessionToken }, console: { error() {} } })
  return vm.runInContext(stripTypeScriptTypes(`${source.slice(start, end)}\nexecuteRpc;`), context)
}
test('browser bridge refuses a missing token before fetching', async () => {
  let calls = 0
  const rpc = renderer(async () => { calls++; throw new Error('unexpected request') }, null)
  await assert.rejects(() => rpc('offline:ping', {}), /token/)
  assert.equal(calls, 0)
})
test('browser bridge supplies bearer auth to normal and streaming calls', async () => {
  const requests = []
  const rpc = renderer(async (url, request) => {
    requests.push({ url, request })
    return { ok: true, body: null, json: async () => ({ data: 'pong' }) }
  }, token)
  assert.equal(await rpc('offline:ping', {}), 'pong')
  await rpc('llm:chat-stream', {})
  assert.equal(requests.length, 2)
  for (const { url, request } of requests) {
    assert.equal(url, 'http://127.0.0.1:3000/api/rpc')
    assert.equal(request.headers.Authorization, `Bearer ${token}`)
  }
})
test('streaming bridge surfaces HTTP authorization failures', async () => {
  const rpc = renderer(async () => ({ ok: false, status: 401 }), token)
  await assert.rejects(() => rpc('llm:chat-stream', {}), /401/)
})
