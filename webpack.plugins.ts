import type IForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ForkTsCheckerWebpackPlugin: typeof IForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

export const plugins = [
  new ForkTsCheckerWebpackPlugin({
    logger: 'webpack-infrastructure',
    typescript: {
      diagnosticOptions: {
        semantic: true,
        syntactic: false,
      },
      mode: 'write-references',
    },
    // Exclude test files from type checking during development
    issue: {
      exclude: [
        { file: '**/__tests__/**' },
        { file: '**/*.test.ts' },
        { file: '**/*.test.tsx' },
      ],
    },
  }),
];
