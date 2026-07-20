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
const PAGE_TITLE = 'Formação LEX | Liderança Exponencial';
const META_DESCRIPTION =
  'Formação LEX: 2 dias presenciais em Alphaville (SP) para transformar o técnico que executa no líder que o mercado reconhece, segue e paga mais caro. 08 e 09 de agosto de 2026.';
const OG_IMAGE = `${CANONICAL_URL}assets/lex-icon.webp`;

const FORBIDDEN_BRAND_PATTERNS = [
  /personal\s*trainer\s*academy/i,
  /personaltraineracademy/i,
  /pos\.personaltraineracademy\.com/i,
];

const FONT_FILES = [
  'fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Regular.otf',
  'fonts/nova-pro-2026-04-07-06-13-42-utc/NovaPro_EE/NovaPro-Bold.otf',
  'fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique Main Files/WOFF2/Avantique-Bold.woff2',
  'fonts/avant-ique-corporate-logo-geometric-grotesk-font-2026-04-07-06-16-08-utc/Avantique Main Files/WOFF2/Avantique-Semibold.woff2',
];

function log(step, message) {
  console.log(`[build] ${step}: ${message}`);
}

function assertNoForbiddenBrands(label, content) {
  for (const pattern of FORBIDDEN_BRAND_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(
        `Referência proibida (${pattern}) encontrada em ${label}. Remova qualquer menção à Personal Trainer Academy.`
      );
    }
  }
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
    <meta property="og:title" content="${PAGE_TITLE}">
    <meta property="og:description" content="${META_DESCRIPTION}">
    <meta property="og:url" content="${CANONICAL_URL}">
    <meta property="og:image" content="${OG_IMAGE}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${PAGE_TITLE}">
    <meta name="twitter:description" content="${META_DESCRIPTION}">
    <meta name="twitter:image" content="${OG_IMAGE}">
    <link rel="preconnect" href="https://www.googletagmanager.com" crossorigin>
    <link rel="preconnect" href="https://www.google-analytics.com" crossorigin>
    <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
    <link rel="preconnect" href="https://unpkg.com" crossorigin>
    <link rel="dns-prefetch" href="https://www.youtube.com">
    <link rel="dns-prefetch" href="https://hook.us2.make.com">
    <link rel="dns-prefetch" href="https://chat.whatsapp.com">`;

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${PAGE_TITLE}</title>`);

  if (!html.includes('rel="canonical"')) {
    html = html.replace(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      `<meta name="viewport" content="width=device-width, initial-scale=1.0">${seoBlock}`
    );
  } else {
    html = html.replace(
      /<link rel="canonical" href="[^"]*">/,
      `<link rel="canonical" href="${CANONICAL_URL}">`
    );
    if (!html.includes('name="description"')) {
      html = html.replace(
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `<meta name="viewport" content="width=device-width, initial-scale=1.0">${seoBlock}`
      );
    }
  }

  return html;
}

function fixAccessibility(html) {
  return html
    .replace(
      'src="assets/captura-web.webp" alt="" class="hero-bg-img',
      'src="assets/captura-web.webp" alt="Ambiente da Formação LEX" class="hero-bg-img'
    )
    .replace(
      'src="assets/mobile-2.webp" alt="" loading="eager"',
      'src="assets/mobile-2.webp" alt="Ambiente da Formação LEX" loading="eager"'
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

async function copyAssets() {
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

  async function walkAndCopy(relativeDir = '') {
    const currentSrc = path.join(assetsSrc, relativeDir);
    if (!fs.existsSync(currentSrc)) return;

    for (const entry of fs.readdirSync(currentSrc, { withFileTypes: true })) {
      if (entry.name === '__MACOSX' || entry.name.startsWith('.')) continue;

      const relPath = path.join(relativeDir, entry.name);
      const srcPath = path.join(assetsSrc, relPath);
      const destPath = path.join(assetsDest, relPath);

      if (entry.isDirectory()) {
        if (relativeDir === '' && entry.name === 'fonts') continue;
        ensureDir(destPath);
        await walkAndCopy(relPath);
        continue;
      }

      ensureDir(path.dirname(destPath));

      const ext = path.extname(entry.name).toLowerCase();
      const shouldConvert =
        sharp && (ext === '.jpeg' || ext === '.jpg' || (ext === '.png' && entry.name === 'mateus-ribeiro.png'));

      if (shouldConvert) {
        const webpRel = relPath.replace(/\.(jpe?g|png)$/i, '.webp');
        const webpDest = path.join(assetsDest, webpRel);
        await sharp(srcPath).webp({ quality: 82, effort: 4 }).toFile(webpDest);
        imageMap.set(`assets/${relPath.replace(/\\/g, '/')}`, `assets/${webpRel.replace(/\\/g, '/')}`);
        log('assets', `convertido ${relPath} → ${webpRel}`);
      } else if (ext === '.webp' && sharp && !relPath.includes('fonts/')) {
        await sharp(srcPath).webp({ quality: 82, effort: 4 }).toFile(destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  await walkAndCopy();

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
  assertNoForbiddenBrands('index.html (fonte)', sourceHtml);
  const imageMap = await copyAssets();

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

  assertNoForbiddenBrands('dist/index.html', minifiedHtml);
  assertNoForbiddenBrands(
    'dist/js/main.min.js',
    fs.readFileSync(path.join(DIST, 'js', 'main.min.js'), 'utf8')
  );

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
