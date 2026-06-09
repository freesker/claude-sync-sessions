const esbuild = require('esbuild');
const fs = require('fs');
const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

// The hook entrypoint is added in a later task; build it only once it exists so
// intermediate states stay compilable.
const entries = [{ in: 'src/extension.ts', out: 'out/extension.js' }];
if (fs.existsSync('src/hook.ts')) entries.push({ in: 'src/hook.ts', out: 'out/hook.js' });

async function main() {
  const contexts = await Promise.all(
    entries.map((e) =>
      esbuild.context({ ...common, entryPoints: [e.in], outfile: e.out, external: ['vscode'] }),
    ),
  );
  if (watch) {
    await Promise.all(contexts.map((c) => c.watch()));
  } else {
    await Promise.all(contexts.map((c) => c.rebuild()));
    await Promise.all(contexts.map((c) => c.dispose()));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
