#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
const SOURCE_HTML = path.join(ROOT, 'index.html');
const DIST_HTML = path.join(ROOT, 'dist', 'index.html');
const DIST_JS = path.join(ROOT, 'dist', 'js', 'main.min.js');

const EXPECTED = {
  webhook: 'https://hook.us2.make.com/6qaglponybteo2l6d187c5p91i7r1tae?produto=m-lex',
  redirect: 'https://chat.whatsapp.com/JTL5M4OR2VE79IGBSoI0EJ',
  defaultCampaign: 'm-lex',
};

function formatPhone(raw) {
  let value = raw.replace(/\D/g, '');
  if (value.startsWith('55') && value.length > 2) value = value.slice(2);
  value = value.slice(0, 11);
  let formatado = value;
  if (value.length > 2) formatado = `(${value.slice(0, 2)}) ` + value.slice(2);
  if (value.length > 7) formatado = formatado.slice(0, 10) + '-' + formatado.slice(10);
  return { formatado, raw: value };
}

function buildPayload({ nome, email, phoneRaw, utms = {}, pageUrl }) {
  const rawPhone = phoneRaw.replace(/\D/g, '');
  return {
    nome: nome.trim(),
    email: email.trim(),
    telefone: '+55' + rawPhone,
    utm_source: utms.utm_source || '',
    utm_term: utms.utm_term || '',
    utm_campaign: utms.utm_campaign || EXPECTED.defaultCampaign,
    utm_medium: utms.utm_medium || '',
    utm_content: utms.utm_content || '',
    url: pageUrl,
  };
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function testPhoneMask() {
  const cases = [
    { input: '11999887766', expected: '(11) 99988-7766', rawLen: 11 },
    { input: '5511999887766', expected: '(11) 99988-7766', rawLen: 11 },
    { input: '1133334444', expected: '(11) 33334-444', rawLen: 10 },
    { input: '11999', expected: '(11) 999', rawLen: 5 },
  ];

  cases.forEach(({ input, expected, rawLen }) => {
    const { formatado, raw } = formatPhone(input);
    assert.strictEqual(formatado, expected, `máscara falhou para ${input}`);
    assert.strictEqual(raw.length, rawLen, `raw length falhou para ${input}`);
  });

  assert.ok(formatPhone('123').raw.length < 10, 'telefone curto deve bloquear envio');
  console.log('✓ máscara de telefone');
}

function testPayloadShape() {
  const payload = buildPayload({
    nome: 'Teste Automatizado',
    email: 'teste@exemplo.com',
    phoneRaw: '11987654321',
    utms: {
      utm_source: 'google',
      utm_term: 'lex',
      utm_campaign: 'm-lex',
      utm_medium: 'cpc',
      utm_content: 'hero',
    },
    pageUrl: 'https://mateusribeirolider.com/?utm_source=google',
  });

  assert.deepStrictEqual(Object.keys(payload).sort(), [
    'email',
    'nome',
    'telefone',
    'url',
    'utm_campaign',
    'utm_content',
    'utm_medium',
    'utm_source',
    'utm_term',
  ]);
  assert.strictEqual(payload.telefone, '+5511987654321');
  assert.strictEqual(payload.utm_campaign, 'm-lex');
  console.log('✓ estrutura do payload');
  return payload;
}

function testHtmlIntegrity() {
  const source = read(SOURCE_HTML);
  assert.ok(source.includes(`data-webhook="${EXPECTED.webhook}"`), 'webhook ausente no HTML fonte');
  assert.ok(source.includes(`data-redirect="${EXPECTED.redirect}"`), 'redirect ausente no HTML fonte');
  assert.ok(source.includes('id="form-m-lex"'), 'form-m-lex ausente');
  assert.ok(source.includes('id="popup-m-lex"'), 'popup-m-lex ausente');
  assert.ok(source.includes('id="utm_campaign"'), 'utm_campaign ausente');
  assert.ok(source.includes('mask-telefone'), 'mask-telefone ausente');
  assert.ok(source.includes('onclick="abrirPopupMLex()"'), 'botão popup ausente');
  console.log('✓ integridade do HTML fonte');
}

function testDistParity() {
  if (!fs.existsSync(DIST_HTML) || !fs.existsSync(DIST_JS)) {
    throw new Error('dist/ não encontrada — execute npm run build antes dos testes');
  }

  const distHtml = read(DIST_HTML);
  const distJs = read(DIST_JS);

  assert.ok(distHtml.includes(EXPECTED.webhook), 'webhook ausente em dist/index.html');
  assert.ok(distHtml.includes(EXPECTED.redirect), 'redirect ausente em dist/index.html');
  assert.ok(distJs.includes(EXPECTED.webhook), 'webhook ausente em dist/js/main.min.js');
  assert.ok(distJs.includes(EXPECTED.redirect), 'redirect ausente em dist/js/main.min.js');
  assert.ok(distHtml.includes('rel="canonical" href="https://mateusribeirolider.com/"'), 'canonical incorreta');
  assert.ok(distHtml.includes('js/main.min.js'), 'JS de produção não referenciado');
  assert.ok(distHtml.includes('css/main.min.css'), 'CSS de produção não referenciado');
  console.log('✓ paridade source ↔ dist');
}

async function testWebhookLive(payload) {
  const testPayload = {
    ...payload,
    nome: '[TESTE AUTO] ' + payload.nome,
    email: 'teste-automatizado+' + Date.now() + '@exemplo.com',
  };

  const response = await fetch(EXPECTED.webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload),
  });

  const body = await response.text();
  assert.ok(response.ok, `webhook retornou HTTP ${response.status}: ${body}`);
  console.log(`✓ webhook Make.com (HTTP ${response.status})`);
  return { status: response.status, body, payload: testPayload };
}

async function testRedirectLive() {
  const response = await fetch(EXPECTED.redirect, {
    method: 'GET',
    redirect: 'manual',
  });

  assert.ok(
    response.status === 200 || response.status === 302 || response.status === 301,
    `redirect WhatsApp retornou HTTP ${response.status}`
  );
  console.log(`✓ link de redirect WhatsApp (HTTP ${response.status})`);
}

async function main() {
  console.log('\n=== Testes de captura LEX ===\n');
  testPhoneMask();
  const samplePayload = testPayloadShape();
  testHtmlIntegrity();
  testDistParity();

  const webhookResult = await testWebhookLive(samplePayload);
  await testRedirectLive();

  console.log('\n=== Resumo operacional ===\n');
  console.log('Webhook URL:', EXPECTED.webhook);
  console.log('Redirect URL:', EXPECTED.redirect);
  console.log('\nPayload de exemplo enviado ao webhook:\n');
  console.log(JSON.stringify(webhookResult.payload, null, 2));
  console.log('\nResposta do webhook:', webhookResult.body || '(vazio)');
  console.log('\n✅ Todos os testes passaram.\n');
}

main().catch((error) => {
  console.error('\n❌ Teste falhou:', error.message);
  process.exit(1);
});
