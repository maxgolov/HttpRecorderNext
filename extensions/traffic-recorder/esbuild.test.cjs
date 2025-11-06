const esbuild = require('esbuild');

const production = process.argv.includes('--production');

async function main() {
  const ctx = await esbuild.context({
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

  await ctx.rebuild();
  await ctx.dispose();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
