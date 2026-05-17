// Netlify Functions - storeRadius 프록시 (공공데이터포털 소상공인 반경 내 상가)
// 기존 Render.com 서버(naver-scraper.onrender.com)를 대체

const http = require('http');
const https = require('https');
const zlib = require('zlib');

const DATA_GO_KR_API_KEY = '02ca822d8e1bf0357b1d782a02dca991192a1b0a89e6cf6ff7e6c4368653cbcb';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

function httpGet(url, timeout = 25000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      rejectUnauthorized: false,
      headers: { 'Accept': 'application/json', 'Accept-Encoding': 'gzip, deflate', 'User-Agent': 'Mozilla/5.0' },
      timeout
    }, (res) => {
      const encoding = (res.headers['content-encoding'] || '').toLowerCase();
      let stream = res;
      if (encoding === 'gzip') {
        stream = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        stream = res.pipe(zlib.createInflate());
      }
      // [버그 수정] 청크를 Buffer로 모은 후 마지막에 UTF-8 디코딩
      // 기존 `data += chunk`는 청크 경계에 한글 멀티바이트가 걸리면 깨짐
      // (한글 1글자=3바이트가 두 청크에 나뉘면 각각 invalid UTF-8로 fffd 변환됨)
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString('utf-8');
          resolve(JSON.parse(data));
        } catch (e) {
          const preview = Buffer.concat(chunks).toString('utf-8').substring(0, 200);
          reject(new Error(`JSON 파싱 실패: ${preview}`));
        }
      });
      stream.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const qs = event.queryStringParameters || {};
  const { cx, cy, radius, numOfRows, pageNo, indsLclsCd, indsMclsCd } = qs;

  if (!cx || !cy) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'cx, cy 파라미터 필요' })
    };
  }

  try {
    const params = new URLSearchParams({
      serviceKey: DATA_GO_KR_API_KEY,
      cx,
      cy,
      radius: radius || '550',
      numOfRows: numOfRows || '500',
      pageNo: pageNo || '1',
      type: 'json'
    });
    if (indsLclsCd) params.set('indsLclsCd', indsLclsCd);
    if (indsMclsCd) params.set('indsMclsCd', indsMclsCd);

    const url = `http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?${params.toString()}`;
    const data = await httpGet(url);

    // 공공데이터포털 원본 응답 그대로 전달 (App.jsx에서 body.items 파싱)
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data)
    };
  } catch (e) {
    console.error('[store-radius-proxy] 오류:', e.message);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: e.message })
    };
  }
};
