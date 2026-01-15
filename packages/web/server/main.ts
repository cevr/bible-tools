/**
 * Bible Tools Web Server
 *
 * Serves Bible and EGW data via Effect HttpApi, plus static files in production.
 * In development, Vite handles static files and proxies /api to this server.
 *
 * Run with: bun run server (production) or bun run server:dev (development)
 */
import {
  HttpApiBuilder,
  HttpApiScalar,
  HttpMiddleware,
  HttpServer,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform';
import { BunHttpServer, BunRuntime } from '@effect/platform-bun';
import { Effect, Layer, Logger, LogLevel } from 'effect';

import { BibleToolsApi } from '@bible/api';
import { BibleDatabase } from '@bible/core/bible-db';
import { EGWParagraphDatabase } from '@bible/core/egw-db';

import { BibleGroupLive } from './api/groups/BibleGroupLive.js';
import { EGWGroupLive } from './api/groups/EGWGroupLive.js';
import { BibleServiceLive } from './services/BibleService.js';
import { EGWServiceLive } from './services/EGWService.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = Number(process.env.PORT ?? 3001);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ============================================================================
// API Implementation Layer
// ============================================================================

// Compose all group handlers
const BibleGroupLayer = BibleGroupLive.pipe(
  Layer.provide(BibleServiceLive),
  Layer.provide(BibleDatabase.Default),
);

const EGWGroupLayer = EGWGroupLive.pipe(
  Layer.provide(EGWServiceLive),
  Layer.provide(EGWParagraphDatabase.Default),
);

const ApiLive = HttpApiBuilder.api(BibleToolsApi).pipe(
  Layer.provide(BibleGroupLayer),
  Layer.provide(EGWGroupLayer),
);

// ============================================================================
// Static File Serving (Production Only)
// ============================================================================

const serveStaticFile = (filePath: string, contentType: string) =>
  Effect.gen(function* () {
    const file = Bun.file(filePath);
    const exists = yield* Effect.promise(() => file.exists());
    if (!exists) {
      return yield* Effect.fail('not-found' as const);
    }
    const content = yield* Effect.promise(() => file.arrayBuffer());
    return HttpServerResponse.raw(content, {
      headers: { 'Content-Type': contentType },
    });
  });

const getContentType = (path: string): string => {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
};

// Middleware to serve static files in production
const StaticFilesMiddleware = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const url = new URL(request.url, 'http://localhost');
    const pathname = url.pathname;

    // Skip API routes
    if (pathname.startsWith('/api') || pathname.startsWith('/docs')) {
      return yield* app;
    }

    // Only serve static files in production
    if (!IS_PRODUCTION) {
      return yield* app;
    }

    const distDir = new URL('../dist', import.meta.url).pathname;

    // Try to serve the exact file
    const filePath = `${distDir}${pathname === '/' ? '/index.html' : pathname}`;
    const contentType = getContentType(filePath);

    const result = yield* serveStaticFile(filePath, contentType).pipe(
      Effect.catchAll(() =>
        // SPA fallback: serve index.html for non-file routes
        pathname.includes('.')
          ? Effect.fail('not-found' as const)
          : serveStaticFile(`${distDir}/index.html`, 'text/html'),
      ),
      Effect.catchAll(() => app),
    );

    return result;
  }),
);

// ============================================================================
// Server Configuration
// ============================================================================

// OpenAPI docs at /docs
const DocsLive = HttpApiScalar.layer().pipe(Layer.provide(ApiLive));

// Combine API routes with docs and static files
const HttpLive = HttpApiBuilder.serve(StaticFilesMiddleware).pipe(
  Layer.provide(DocsLive),
  Layer.provide(ApiLive),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: PORT })),
);

// ============================================================================
// Start Server
// ============================================================================

const program = Layer.launch(HttpLive).pipe(
  Effect.tapErrorCause(Effect.logError),
  Logger.withMinimumLogLevel(LogLevel.Debug),
);

console.log(`Starting Bible Tools server on port ${PORT}...`);
console.log(`  Mode: ${IS_PRODUCTION ? 'production' : 'development'}`);
console.log(`  API: http://localhost:${PORT}/api`);
console.log(`  Docs: http://localhost:${PORT}/docs`);
if (IS_PRODUCTION) {
  console.log(`  Static: http://localhost:${PORT}/`);
}

BunRuntime.runMain(program);
