/**
 * Stable context objects for the DB provider.
 *
 * Separated from db-provider.tsx so that HMR reloads of the component
 * don't re-execute createContext (which would produce new objects and
 * break the old component tree's references).
 */
import { createContext } from 'react';
import type { DbClient } from '@/workers/db-client';
import type { CachedAppCore } from '@/lib/cached-app';

export const CachedAppContext = createContext<CachedAppCore | null>(null);
export const DbContext = createContext<DbClient | null>(null);
