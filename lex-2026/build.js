#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SOURCE_HTML = path.join(ROOT, 'index.html');
const CANONICAL_URL = 'https://mateusribeirolider.com/';
const SITE_NAME = 'Formação LEX';
const META_DESCRIPTION =
  'Formação LEX: 2 dias presenciais em Alphaville, São Paulo, para empresários que querem se tornar a face da autoridade do próprio negócio. 08 e 09 de agosto de 2026.';
const OG_IMAGE = `${CANONICAL_URL}assets/lex-icon.webp`;

const FONT_FILES = [
  'fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Regular.otf',
  'fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Bold.otf',
  'fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique Main Files/WOFF2/Avantique-Bold.woff2',
  'fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique Main Files/WOFF2/Avantique-Semibold.woff2',
];

function collectReferencedAssets(html) {
  const paths = new Set();
  const regex = /assets\/[A-Za-z0-9._\-]+\.(?:webp|svg)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    paths.add(match[0]);
  }
  return [...paths];
}

function resolveAssetSource(assetRef) {
  const assetsSrc = path.join(ROOT, 'assets');
  const relative = assetRef.replace(/^assets\//, '');
  const candidates = [
    path.join(assetsSrc, relative),
    path.join(assetsSrc, relative.replace(/asset-(\d+)/g, 'asset $1')),
    path.join(assetsSrc, relative.replace(/-/g, ' ')),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const parsed = path.parse(relative);
  if (parsed.ext === '.webp') {
    for (const ext of ['.webp', '.jpeg', '.jpg', '.png']) {
      const alt = path.join(assetsSrc, `${parsed.name}${ext}`);
      if (fs.existsSync(alt)) return alt;
      const spaced = path.join(assetsSrc, `${parsed.name.replace(/-/g, ' ')}${ext}`);
      if (fs.existsSync(spaced)) return spaced;
    }
  }

  return null;
}

function assertReferencedAssets(html) {
  const missing = collectReferencedAssets(html).filter((ref) => !resolveAssetSource(ref));
  if (missing.length) {
    throw new Error(`Assets referenciados ausentes: ${missing.join(', ')}`);
  }
}

function log(step, message) {
  console.log(`[build] ${step}: ${message}`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rimraf(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function readSourceHtml() {
  return fs.readFileSync(SOURCE_HTML, 'utf8');
}

function extractBetween(source, startTag, endTag) {
  const start = source.indexOf(startTag);
  const end = source.indexOf(endTag, start);
  if (start === -1 || end === -1) {
    throw new Error(`Não foi possível extrair bloco ${startTag}`);
  }
  return source.slice(start + startTag.length, end).trim();
}

function extractGtmBlocks(html) {
  const placeholders = [];
  const patterns = [
    /<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->/g,
    /<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->/g,
  ];

  patterns.forEach((pattern) => {
    html = html.replace(pattern, (match) => {
      const token = `<!--__GTM_PLACEHOLDER_${placeholders.length}__-->`;
      placeholders.push(match);
      return token;
    });
  });

  return { html, placeholders };
}

function restoreGtmBlocks(html, placeholders) {
  placeholders.forEach((block, index) => {
    html = html.replace(`<!--__GTM_PLACEHOLDER_${index}__-->`, block);
  });
  return html;
}

function injectSeoAndPerformance(html) {
  const seoBlock = `
    <meta name="description" content="${META_DESCRIPTION}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${CANONICAL_URL}">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:title" content="Formação LEX | Liderança Exponencial">
    <meta property="og:description" content="${META_DESCRIPTION}">
    <meta property="og:url" content="${CANONICAL_URL}">
    <meta property="og:image" content="${OG_IMAGE}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="Formação LEX | Liderança Exponencial">
    <meta name="twitter:description" content="${META_DESCRIPTION}">
    <meta name="twitter:image" content="${OG_IMAGE}">
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="preconnect" href="https://www.google-analytics.com" crossorigin>
    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
    <link rel="preconnect" href="https://unpkg.com" crossorigin>
    <link rel="dns-prefetch" href="https://www.youtube.com">
    <link rel="dns-prefetch" href="https://payfast.greenn.com.br">`;

  if (!html.includes('rel="canonical"')) {
    html = html.replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">${seoBlock}`
    );
  }

  return html;
}

function fixAccessibility(html) {
  return html
    .replace(
      'src="assets/hero-bg.webp" alt="" class="hero-bg-img',
      'src="assets/hero-bg.webp" alt="Ambiente da Formação LEX" class="hero-bg-img'
    )
    .replace(
      'src="assets/hero-bg-mobile.webp" alt="" loading="eager"',
      'src="assets/hero-bg-mobile.webp" alt="Ambiente da Formação LEX" loading="eager"'
    )
    .replace(
      'src="assets/asset-39.webp" alt="" class="video-poster-img"',
      'src="assets/asset-39.webp" alt="Capa do vídeo de apresentação da Formação LEX" class="video-poster-img"'
    )
    .replace(
      'src="assets/asset-6.webp" alt="" class="w-full h-full object-cover opacity-[0.08]"',
      'src="assets/asset-6.webp" alt="Textura decorativa da seção" class="w-full h-full object-cover opacity-[0.08]" aria-hidden="true"'
    )
    .replace(
      'src="assets/asset-8.webp" alt="" class="absolute inset-0 w-full h-full object-cover opacity-20',
      'src="assets/asset-8.webp" alt="Textura decorativa da seção A Formação" class="absolute inset-0 w-full h-full object-cover opacity-20'
    );
}

function buildFontsCss() {
  return `@font-face {
    font-family: 'Nova Pro';
    src: url('../assets/fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Regular.otf') format('opentype');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Nova Pro';
    src: url('../assets/fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Bold.otf') format('opentype');
    font-weight: 700;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Avantique';
    src: url('../assets/fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique%20Main%20Files/WOFF2/Avantique-Bold.woff2') format('woff2');
    font-weight: 700 900;
    font-style: normal;
    font-display: swap;
}

@font-face {
    font-family: 'Avantique';
    src: url('../assets/fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique%20Main%20Files/WOFF2/Avantique-Semibold.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
}
`;
}

async function copyAssets(html) {
  const assetsSrc = path.join(ROOT, 'assets');
  const assetsDest = path.join(DIST, 'assets');
  ensureDir(assetsDest);

  const imageMap = new Map();
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    sharp = null;
  }

  const referenced = collectReferencedAssets(html);
  log('assets', `${referenced.length} arquivos referenciados`);

  for (const assetRef of referenced) {
    const srcPath = resolveAssetSource(assetRef);
    if (!srcPath) {
      throw new Error(`Asset não encontrado: ${assetRef}`);
    }

    const relativeDest = assetRef.replace(/^assets\//, '');
    const ext = path.extname(srcPath).toLowerCase();
    const destPath = path.join(assetsDest, relativeDest);
    ensureDir(path.dirname(destPath));

    if (ext === '.svg') {
      fs.copyFileSync(srcPath, destPath);
      continue;
    }

    const webpDest = destPath.endsWith('.webp')
      ? destPath
      : path.join(path.dirname(destPath), `${path.parse(relativeDest).name}.webp`);

    if (sharp) {
      await sharp(srcPath).webp({ quality: 82, effort: 4 }).toFile(webpDest);
    } else {
      fs.copyFileSync(srcPath, webpDest);
    }

    const srcRef = `assets/${path.relative(assetsSrc, srcPath).replace(/\\/g, '/')}`;
    const destRef = `assets/${path.relative(assetsDest, webpDest).replace(/\\/g, '/')}`;
    if (srcRef !== destRef) {
      imageMap.set(srcRef, destRef);
    }

    if (assetRef !== destRef) {
      imageMap.set(assetRef, destRef);
    }
  }

  for (const fontRel of FONT_FILES) {
    const src = path.join(assetsSrc, fontRel);
    const dest = path.join(assetsDest, fontRel);
    if (!fs.existsSync(src)) {
      throw new Error(`Fonte obrigatória ausente: ${fontRel}`);
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }

  return imageMap;
}

function verifyDistBuild(html) {
  const assetsDir = path.join(DIST, 'assets');
  const rasterNonWebp = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.name.startsWith('.')) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        rasterNonWebp.push(path.relative(DIST, fullPath));
      }
    }
  }

  if (fs.existsSync(assetsDir)) walk(assetsDir);

  if (rasterNonWebp.length) {
    throw new Error(`dist contém raster fora de WebP: ${rasterNonWebp.join(', ')}`);
  }

  const missing = collectReferencedAssets(html).filter((ref) => {
    const filePath = path.join(DIST, ref.replace(/^assets\//, 'assets/'));
    return !fs.existsSync(filePath);
  });

  if (missing.length) {
    throw new Error(`dist com referências quebradas: ${missing.join(', ')}`);
  }

  log('verify', 'assets WebP OK e referências válidas');
}

function compileTailwind(customCssPath) {
  const tempInput = path.join(ROOT, '.build-tailwind.css');
  const tailwindBase = fs.readFileSync(path.join(ROOT, 'src/styles/tailwind.css'), 'utf8');
  const customCss = fs.readFileSync(customCssPath, 'utf8');
  fs.writeFileSync(tempInput, `${tailwindBase}\n${customCss}`);
  const outputPath = path.join(DIST, 'css', 'tailwind.css');

  execSync(`npx tailwindcss -i "${tempInput}" -o "${outputPath}" --minify`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  fs.unlinkSync(tempInput);
  fs.unlinkSync(customCssPath);
  return outputPath;
}

function minifyCssBundle(files) {
  const combined = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const result = new CleanCSS({ level: 2 }).minify(combined);
  if (result.errors.length) {
    throw new Error(result.errors.join('\n'));
  }
  return result.styles;
}

async function buildJavaScript(sourceHtml, imageMap) {
  const scriptMatch = sourceHtml.match(/<script src="https:\/\/unpkg.com\/aos@2\.3\.1\/dist\/aos\.js"><\/script>\s*<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!scriptMatch) {
    throw new Error('Bloco principal de JavaScript não encontrado.');
  }

  let js = scriptMatch[1].trim();
  for (const [from, to] of imageMap.entries()) {
    js = js.split(from).join(to);
  }
  const minified = await minifyJs(js, {
    compress: true,
    mangle: true,
    format: { comments: false },
  });

  if (!minified.code) {
    throw new Error('Falha ao minificar JavaScript.');
  }

  const outPath = path.join(DIST, 'js', 'main.min.js');
  fs.writeFileSync(outPath, minified.code);
  return outPath;
}

function transformHtml(sourceHtml, imageMap) {
  let html = sourceHtml;
  const gtm = extractGtmBlocks(html);
  html = gtm.html;

  const customCss = extractBetween(html, '<style>', '</style>');
  const customCssPath = path.join(ROOT, '.build-custom.css');
  fs.writeFileSync(customCssPath, customCss);

  html = html.replace(/<style>[\s\S]*?<\/style>\s*/g, '');

  html = html.replace(
    /<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>\s*/g,
    ''
  );
  html = html.replace(/<script>\s*tailwind\.config[\s\S]*?<\/script>\s*/g, '');

  html = html.replace(
    /<link rel="preload" href="assets\/fonts\/[^"]+" as="font"[^>]*>\s*/g,
    ''
  );
  html = html.replace(
    /<link rel="stylesheet" href="assets\/fonts\/fonts\.css">\s*/g,
    ''
  );

  const headLinks = `
    <link rel="preload" href="assets/fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique%20Main%20Files/WOFF2/Avantique-Bold.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="assets/fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Regular.otf" as="font" type="font/otf" crossorigin>
    <link rel="stylesheet" href="css/fonts.min.css">
    <link rel="stylesheet" href="css/main.min.css">`;

  html = html.replace(
    '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">',
    `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">${headLinks}`
  );

  html = html.replace(
    /<script src="https:\/\/unpkg.com\/aos@2\.3\.1\/dist\/aos\.js"><\/script>\s*<script>[\s\S]*?<\/script>/,
    '<script src="https://unpkg.com/aos@2.3.1/dist/aos.js" defer></script>\n    <script src="js/main.min.js" defer></script>'
  );

  html = injectSeoAndPerformance(html);
  html = fixAccessibility(html);

  for (const [from, to] of imageMap.entries()) {
    html = html.split(from).join(to);
  }

  html = restoreGtmBlocks(html, gtm.placeholders);
  return { html, customCssPath };
}

async function main() {
  log('start', 'limpando dist/');
  rimraf(DIST);
  ensureDir(path.join(DIST, 'css'));
  ensureDir(path.join(DIST, 'js'));
  ensureDir(path.join(DIST, 'assets'));

  const sourceHtml = readSourceHtml();
  assertReferencedAssets(sourceHtml);

  const imageMap = await copyAssets(sourceHtml);

  const { html: transformedHtml, customCssPath } = transformHtml(sourceHtml, imageMap);

  log('css', 'compilando Tailwind purgado');
  const tailwindPath = compileTailwind(customCssPath);

  const fontsCssPath = path.join(DIST, 'css', 'fonts.min.css');
  fs.writeFileSync(fontsCssPath, new CleanCSS({ level: 2 }).minify(buildFontsCss()).styles);

  const mainCssPath = path.join(DIST, 'css', 'main.min.css');
  const mainCss = minifyCssBundle([tailwindPath]);
  fs.writeFileSync(mainCssPath, mainCss);
  fs.unlinkSync(tailwindPath);

  log('js', 'minificando JavaScript');
  await buildJavaScript(sourceHtml, imageMap);

  log('html', 'minificando index.html');
  const minifiedHtml = await minifyHtml(transformedHtml, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: false,
    minifyJS: false,
    keepClosingSlash: true,
  });

  fs.writeFileSync(path.join(DIST, 'index.html'), minifiedHtml);

  verifyDistBuild(minifiedHtml);

  const stats = {
    html: fs.statSync(path.join(DIST, 'index.html')).size,
    css: fs.statSync(mainCssPath).size + fs.statSync(fontsCssPath).size,
    js: fs.statSync(path.join(DIST, 'js', 'main.min.js')).size,
  };

  log('done', `dist pronta — HTML ${(stats.html / 1024).toFixed(1)}KB | CSS ${(stats.css / 1024).toFixed(1)}KB | JS ${(stats.js / 1024).toFixed(1)}KB`);
}

main().catch((error) => {
  console.error('[build] erro:', error);
  process.exit(1);
});
