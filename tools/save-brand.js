/* ============================================================
   save-brand.js — brand.html 이 만든 그림을 images/ 에 저장합니다

   브라우저 안에서 만든 그림은 파일로 바로 못 내립니다.
   잠깐 문을 하나 열어 두고 받아 적는 방식입니다.

   쓰는 법
     1) node tools/save-brand.js        ← 문을 엽니다 (5179번)
     2) 브라우저로 tools/brand.html 을 열고
        saveAll() 을 부릅니다
     3) 다 받으면 저절로 닫힙니다
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'images');
const WANT = 5;
let got = 0;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.end(); return; }
  if (req.method !== 'POST') { res.end('ok'); return; }

  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    try {
      const { name, data } = JSON.parse(body);
      // 파일 이름에 경로가 섞여 들어오지 못하게 막습니다
      const safe = path.basename(String(name));
      if (!/^[\w.-]+\.png$/.test(safe)) throw new Error('이름이 이상합니다: ' + safe);
      const buf = Buffer.from(String(data).split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, safe), buf);
      console.log(`  ✓ images/${safe.padEnd(22)} ${(buf.length / 1024).toFixed(0)}KB`);
      got++;
      res.end('ok');
      if (got >= WANT) { console.log('다 받았습니다.'); server.close(); }
    } catch (e) {
      console.error('  ✗', e.message);
      res.statusCode = 400; res.end('fail');
    }
  });
});

server.listen(5179, '127.0.0.1', () => console.log('5179번에서 기다립니다…'));
