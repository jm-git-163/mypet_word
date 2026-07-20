/* ============================================================
   env.js — .env 파일에서 열쇠를 읽어 옵니다 (딸린 꾸러미 없음)
   도구들이 공통으로 씁니다. 앱(브라우저)에서는 절대 쓰이지 않습니다.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function load() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return {};
  const out = {};
  // BOM 제거 (윈도우 메모장으로 저장하면 붙습니다)
  const text = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (v !== '') out[k] = v;
  }
  return out;
}

const FILE_ENV = load();

/** 환경변수 우선, 없으면 .env, 없으면 기본값 */
function get(name, fallback) {
  return process.env[name] || FILE_ENV[name] || fallback;
}

/** 반드시 있어야 하는 열쇠. 없으면 친절히 안내하고 멈춥니다. */
function require_(name, where) {
  const v = get(name);
  if (!v) {
    console.error(`\n❌ 열쇠 ${name} 가 없습니다.\n`);
    console.error('   1) .env.example 을 복사해서 .env 로 이름을 바꾸세요.');
    console.error('        copy .env.example .env');
    console.error(`   2) .env 를 열어 ${name}= 뒤에 열쇠를 붙여 넣으세요.`);
    if (where) console.error(`   ※ 열쇠 발급: ${where}`);
    console.error('   ※ .env 는 깃에 올라가지 않습니다. 채팅에도 붙여 넣지 마세요.\n');
    process.exit(1);
  }
  return v;
}

/** 화면·기록에 열쇠를 그대로 찍지 않기 위한 가림 처리 */
function mask(v) {
  if (!v) return '(없음)';
  return v.slice(0, 4) + '…' + v.slice(-3) + ` (${v.length}자)`;
}

module.exports = { get, require: require_, mask, ROOT, loaded: Object.keys(FILE_ENV) };
