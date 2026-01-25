import { Options } from '@effect/cli';
import { Context } from 'effect';

import { model } from './model';

export interface CliOptionsService {
  readonly verbose: boolean;
}

export class CliOptions extends Context.Tag('CliOptions')<CliOptions, CliOptionsService>() {}

export const verbose = Options.boolean('verbose').pipe(
  Options.withAlias('v'),
  Options.withDescription('Enable verbose logging'),
);

export const cliOptions = {
  verbose,
  model,
};
