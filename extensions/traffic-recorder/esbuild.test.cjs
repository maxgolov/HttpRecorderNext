const esbuild = require('esbuild');

const production = process.argv.includes('--production');

async function main() {
  // Build the test runner
  const runnerCtx = await esbuild.context({
    entryPoints: ['src/test/runTest.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/test/runTest.js',
    external: [
      'vscode',
      'mocha',
      '@vscode/test-electron',
      // Node.js built-in modules
      'fs', 'path', 'child_process', 'util', 'net', 'tls', 'crypto',
      'http', 'https', 'stream', 'events', 'url', 'os', 'assert'
    ],
    logLevel: 'info',
  });

  await runnerCtx.rebuild();
  await runnerCtx.dispose();

  // Build the test suite - all test files need to be separate entry points
  // since they are discovered at runtime by glob
  const glob = require('glob');
  const testFiles = glob.sync('src/test/suite/**/*.test.ts');
  
  const suiteCtx = await esbuild.context({
    entryPoints: ['src/test/suite/index.ts', ...testFiles],
    bundle: true, // Bundle each test file with its dependencies
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outdir: 'dist/test/suite',
    outbase: 'src/test/suite',
    external: [
      'vscode',
      'mocha',
      '@vscode/test-electron',
      // Node.js built-in modules
      'fs', 'path', 'child_process', 'util', 'net', 'tls', 'crypto',
      'http', 'https', 'stream', 'events', 'url', 'os', 'assert'
    ],
    logLevel: 'info',
  });

  await suiteCtx.rebuild();
  await suiteCtx.dispose();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
