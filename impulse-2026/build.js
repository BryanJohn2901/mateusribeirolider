#!/usr/bin/env node
/**
 * Production build for the static Impulse Empresarial landing page.
 * Vanilla HTML/CSS/JS project (no bundler) -> generates ./dist ready to deploy.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');
const sharp = require('sharp');

const ROOT = __dirname;
const SRC_HTML = path.join(ROOT, 'index.html');
const DIST = path.join(ROOT, 'dist');
const TMP = path.join(ROOT, '.build-tmp');

async function main() {
  console.log('Limpando dist/ ...');
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.rmSync(TMP, { recursive: true, force: true });
  for (const dir of [DIST, path.join(DIST, 'css'), path.join(DIST, 'js'), path.join(DIST, 'assets', 'img'), path.join(DIST, 'assets', 'fonts'), TMP]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let html = fs.readFileSync(SRC_HTML, 'utf8');

  // ── 1. Extrai o <style> customizado e o <script> de config do Tailwind ──
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (!styleMatch) throw new Error('Bloco <style> não encontrado em index.html');
  // dist/css/style.css fica um nível abaixo de dist/, então QUALQUER referência a assets/
  // (fontes, imagens de background, etc.) precisa de "../" na frente.
  const customCss = styleMatch[1]
    .replace(
      /assets\/fonts\/nova-pro-2026-04-07-06-13-42-utc\/NovaPro_EE\/(NovaPro-(?:Regular|Bold)\.otf)/g,
      'assets/fonts/$1'
    )
    .replace(
      /assets\/fonts\/liferdas\/(Liferdas-[A-Za-z]+\.woff)/g,
      'assets/fonts/$1'
    )
    .replace(/url\((['"]?)assets\//g, 'url($1../assets/');

  const mainScriptMatch = html.match(/<script>\s*AOS\.init[\s\S]*?<\/script>/);
  if (!mainScriptMatch) throw new Error('Script principal (AOS.init...) não encontrado em index.html');
  const mainJs = mainScriptMatch[0].replace(/^<script>/, '').replace(/<\/script>$/, '');

  // ── 2. CSS: Tailwind compilado + purgado (JIT real, sem CDN) + CSS customizado, minificado ──
  console.log('Compilando e purgando Tailwind CSS...');
  const tailwindInput = path.join(TMP, 'tailwind-input.css');
  fs.writeFileSync(
    tailwindInput,
    `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n${customCss}\n`
  );
  const tailwindOutTmp = path.join(TMP, 'tailwind-output.css');
  execSync(
    `npx tailwindcss -i "${tailwindInput}" -o "${tailwindOutTmp}" --config "${path.join(ROOT, 'tailwind.config.cjs')}" --minify`,
    { stdio: 'inherit', cwd: ROOT }
  );
  const rawCss = fs.readFileSync(tailwindOutTmp, 'utf8');
  const cleaned = new CleanCSS({ level: 2 }).minify(rawCss);
  if (cleaned.errors.length) throw new Error('clean-css: ' + cleaned.errors.join('; '));
  fs.writeFileSync(path.join(DIST, 'css', 'style.css'), cleaned.styles);
  console.log(`  css/style.css: ${(cleaned.styles.length / 1024).toFixed(1)} kB`);

  // ── 3. JS: extrai a lógica principal (UTMs, máscara, webhook, redirect, popup, FAQ, countdown) ──
  console.log('Minificando JavaScript...');
  const jsResult = await minifyJs(mainJs, { compress: true, mangle: true, format: { comments: false } });
  if (!jsResult.code) throw new Error('Terser não retornou código');
  fs.writeFileSync(path.join(DIST, 'js', 'main.js'), jsResult.code);
  console.log(`  js/main.js: ${(jsResult.code.length / 1024).toFixed(1)} kB`);

  // ── 4. Assets: imagens referenciadas (recomprimidas em WebP) + apenas as fontes usadas ──
  console.log('Otimizando imagens...');
  const srcImgDir = path.join(ROOT, 'assets', 'img');
  for (const file of fs.readdirSync(srcImgDir)) {
    const srcPath = path.join(srcImgDir, file);
    const outPath = path.join(DIST, 'assets', 'img', file);
    if (file.toLowerCase().endsWith('.webp')) {
      const original = fs.readFileSync(srcPath);
      const recompressed = await sharp(original).webp({ quality: 80 }).toBuffer();
      fs.writeFileSync(outPath, recompressed.length < original.length ? recompressed : original);
    } else {
      fs.copyFileSync(srcPath, outPath);
    }
  }
  const before = dirSize(srcImgDir);
  const after = dirSize(path.join(DIST, 'assets', 'img'));
  console.log(`  assets/img: ${(before / 1024).toFixed(0)} kB -> ${(after / 1024).toFixed(0)} kB`);

  console.log('Copiando fontes usadas (Nova Pro Regular/Bold, Liferdas)...');
  const fontSrcDir = path.join(ROOT, 'assets', 'fonts', 'nova-pro-2026-04-07-06-13-42-utc', 'NovaPro_EE');
  fs.copyFileSync(path.join(fontSrcDir, 'NovaPro-Regular.otf'), path.join(DIST, 'assets', 'fonts', 'NovaPro-Regular.otf'));
  fs.copyFileSync(path.join(fontSrcDir, 'NovaPro-Bold.otf'), path.join(DIST, 'assets', 'fonts', 'NovaPro-Bold.otf'));

  const liferdasSrcDir = path.join(ROOT, 'assets', 'fonts', 'liferdas');
  for (const file of fs.readdirSync(liferdasSrcDir)) {
    fs.copyFileSync(path.join(liferdasSrcDir, file), path.join(DIST, 'assets', 'fonts', file));
  }

  // ── 5. Monta o index.html final: remove CDN/config/style/script inline e aponta para os novos caminhos ──
  console.log('Montando index.html final...');
  html = html
    .replace(/\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\n?/, '\n    <link rel="stylesheet" href="css/style.css">\n')
    .replace(/<script>\s*tailwind\.config[\s\S]*?<\/script>\n?/, '')
    .replace(/<style>[\s\S]*?<\/style>\n?/, '')
    .replace(/<script>\s*AOS\.init[\s\S]*?<\/script>/, '<script src="js/main.js"></script>')
    .replace(/assets\/fonts\/nova-pro-2026-04-07-06-13-42-utc\/NovaPro_EE\/(NovaPro-(?:Regular|Bold)\.otf)/g, 'assets/fonts/$1')
    .replace(/assets\/fonts\/liferdas\/(Liferdas-[A-Za-z]+\.woff)/g, 'assets/fonts/$1');

  // sanity check: nenhum third-party script foi removido
  for (const marker of [
    'unpkg.com/aos@2.3.1/dist/aos.css',
    'unpkg.com/aos@2.3.1/dist/aos.js',
    'cdnjs.cloudflare.com/ajax/libs/font-awesome',
    'googletagmanager.com/gtm.js',
    'googletagmanager.com/ns.html'
  ]) {
    if (!html.includes(marker)) throw new Error(`Script/link de terceiro removido acidentalmente: ${marker}`);
  }
  if (html.includes('cdn.tailwindcss.com')) throw new Error('CDN do Tailwind não foi removido do build final');

  const minifiedHtml = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeEmptyAttributes: false,
    minifyCSS: false,
    minifyJS: false,
    keepClosingSlash: true
  });
  fs.writeFileSync(path.join(DIST, 'index.html'), minifiedHtml);
  console.log(`  index.html: ${(minifiedHtml.length / 1024).toFixed(1)} kB`);

  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('\nBuild concluído em ./dist');
}

function dirSize(dir) {
  return fs.readdirSync(dir).reduce((sum, f) => sum + fs.statSync(path.join(dir, f)).size, 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
