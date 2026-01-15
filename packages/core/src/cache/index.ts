/**
 * Promise Cache
 *
 * A caching layer for async functions with status tracking.
 * Compatible with React's use() and Solid's createResource.
 */

export {
  PromiseStatus,
  type PromiseWithStatus,
  wrapPromise,
  resolvedPromise,
  rejectedPromise,
  defer,
  type Deferred,
} from './promise.js';

export { createCache, type CacheOptions, type LoadFn } from './cache.js';
