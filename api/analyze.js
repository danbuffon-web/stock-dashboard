2026-03-22 15:47:31.232 [error] (node:4) Warning: Failed to load the ES module: /var/task/api/analyze.js. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:4) Warning: Failed to load the ES module: /var/task/api/analyze.js. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.
/var/task/api/analyze.js:1
export default async function handler(req, res) {
^^^^^^

SyntaxError: Unexpected token 'export'
    at wrapSafe (node:internal/modules/cjs/loader:1692:18)
    at Module._compile (node:internal/modules/cjs/loader:1735:20)
    at Object..js (node:internal/modules/cjs/loader:1893:10)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module.<anonymous> (node:internal/modules/cjs/loader:1300:12)
    at /opt/rust/nodejs.js:2:13531
    at Module.pn (/opt/rust/nodejs.js:2:13909)
    at Xe.e.<computed>.Ye._load (/opt/rust/nodejs.js:2:13501)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
Node.js process exited with exit status: 1. The logs above can help with debugging the issue.
(node:4) Warning: Failed to load the ES module: /var/task/api/analyze.js. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.
(Use `node --trace-warnings ...` to show where the warning was created)
(node:4) Warning: Failed to load the ES module: /var/task/api/analyze.js. Make sure to set "type": "module" in the nearest package.json file or use the .mjs extension.
/var/task/api/analyze.js:1
export default async function handler(req, res) {
^^^^^^

SyntaxError: Unexpected token 'export'
    at wrapSafe (node:internal/modules/cjs/loader:1692:18)
    at Module._compile (node:internal/modules/cjs/loader:1735:20)
    at Object..js (node:internal/modules/cjs/loader:1893:10)
    at Module.load (node:internal/modules/cjs/loader:1481:32)
    at Module.<anonymous> (node:internal/modules/cjs/loader:1300:12)
    at /opt/rust/nodejs.js:2:13531
    at Module.pn (/opt/rust/nodejs.js:2:13909)
    at Xe.e.<computed>.Ye._load (/opt/rust/nodejs.js:2:13501)
    at TracingChannel.traceSync (node:diagnostics_channel:328:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:245:24)
Node.js process exited with exit status: 1. The logs above can help with debugging the issue.
