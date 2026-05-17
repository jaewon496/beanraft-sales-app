// 사업자번호 진위·영업상태 검증 (국세청 공공데이터포털 API)
// 카드 8 외부 매체 인용 매장의 검증용
//
// 입력: { bizNumbers: ['2200872593', ...] }  (10자리 숫자만, '-' 제거)
// 출력: { results: [{ bizNumber, businessType, operatingStatus, taxType, endDate, valid }] }
//
// businessType: '개인사업자' | '영리법인' | '비영리법인' | '비법인단체'
//   사업자번호 가운데 2자리 코드:
//     01~80: 개인사업자
//     81~88: 영리법인
//     89~99: 비영리·비법인
//
// operatingStatus: '영업' | '휴업' | '폐업' | '미등록'
//
// 호출 예:
//   POST /.netlify/functions/biznum-verify
//   Body: { "bizNumbers": ["2200872593", "1234567890"] }

const NTS_API_URL = 'https://api.odcloud.kr/api/nts-businessman/v1/status';

/**
 * 사업자번호 가운데 2자리로 사업자 유형 분류
 * @param {string} bizNo - 10자리 사업자등록번호 (숫자만)
 * @returns {'개인사업자'|'영리법인'|'비영리법인'|'비법인단체'|'알 수 없음'}
 */
const classifyBusinessType = (bizNo) => {
  if (!bizNo || bizNo.length !== 10) return '알 수 없음';
  const middle = parseInt(bizNo.substring(3, 5), 10);
  if (isNaN(middle)) return '알 수 없음';
  if (middle >= 1 && middle <= 80) return '개인사업자';
  if (middle >= 81 && middle <= 88) return '영리법인';
  if (middle === 89) return '비영리법인';
  if (middle >= 90 && middle <= 99) return '비법인단체';
  return '알 수 없음';
};

/**
 * 국세청 응답 b_stt_cd → 영업상태 한글
 */
const mapOperatingStatus = (sttCd, sttName) => {
  if (!sttCd && !sttName) return '미등록';
  if (sttCd === '01' || (sttName || '').includes('계속')) return '영업';
  if (sttCd === '02' || (sttName || '').includes('휴업')) return '휴업';
  if (sttCd === '03' || (sttName || '').includes('폐업')) return '폐업';
  return '미등록';
};

const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const apiKey = process.env.NTS_BIZNO_API_KEY || '';
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'NTS_BIZNO_API_KEY not set', results: [] })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: 'invalid_body' }) };
  }

  const rawList = Array.isArray(body.bizNumbers) ? body.bizNumbers : [];
  // 10자리 숫자만 정규화 (하이픈/공백 제거)
  const bizList = rawList
    .map(n => String(n || '').replace(/[^0-9]/g, ''))
    .filter(n => n.length === 10);

  if (bizList.length === 0) {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ results: [], reason: 'no_valid_biz_numbers' })
    };
  }

  // 국세청 API: 한 번에 100건까지. 100건 초과 시 청크로 나눔.
  const chunks = [];
  for (let i = 0; i < bizList.length; i += 100) {
    chunks.push(bizList.slice(i, i + 100));
  }

  const allResults = [];

  for (const chunk of chunks) {
    try {
      const url = `${NTS_API_URL}?serviceKey=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ b_no: chunk }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status_code !== 'OK') {
        // 실패: 청크 전체를 미등록으로 표기하고 계속
        chunk.forEach(bn => {
          allResults.push({
            bizNumber: bn,
            businessType: classifyBusinessType(bn),
            operatingStatus: '미등록',
            taxType: '',
            endDate: '',
            valid: false,
            error: data.error || `status_${res.status}`,
          });
        });
        continue;
      }

      const items = Array.isArray(data.data) ? data.data : [];
      for (const item of items) {
        const bn = String(item.b_no || '').replace(/[^0-9]/g, '');
        const status = mapOperatingStatus(item.b_stt_cd, item.b_stt);
        allResults.push({
          bizNumber: bn,
          businessType: classifyBusinessType(bn),
          operatingStatus: status,
          taxType: item.tax_type || '',
          endDate: item.end_dt || '',
          valid: status === '영업',
        });
      }
    } catch (e) {
      chunk.forEach(bn => {
        allResults.push({
          bizNumber: bn,
          businessType: classifyBusinessType(bn),
          operatingStatus: '미등록',
          taxType: '',
          endDate: '',
          valid: false,
          error: e.message,
        });
      });
    }
  }

  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify({
      results: allResults,
      count: allResults.length,
      timestamp: new Date().toISOString(),
    }),
  };
};

const corsHeaders = () => ({
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

exports.handler = handler;
