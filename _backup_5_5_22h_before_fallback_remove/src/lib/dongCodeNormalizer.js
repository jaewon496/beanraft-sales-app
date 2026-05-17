/**
 * 행정동 코드 정규화 통합 함수
 *
 * 행정동 코드 두 가지 체계:
 * - 8자리 (통계청 행정구역분류코드, KOSTAT): 11680640 (예: 역삼1동)
 * - 10자리 (행정안전부 행정표준코드, MOIS): 1168064000 (예: 역삼1동)
 *
 * 대부분의 행정동은 10자리 = 8자리 + "00" 관계지만,
 * 리(里) 단위 코드는 끝이 "00"이 아닐 수 있으므로 단순 변환 시 검증 필요.
 *
 * 입력: 좌표 또는 코드 1개
 * 출력: { code8, code10, dongName } 둘 다 함께 반환
 */

/**
 * 8자리 → 10자리 변환 (단순 "00" 추가)
 * 통·반 코드가 있는 행정동은 정확하지 않을 수 있음
 * @param {string} code8
 * @returns {string|null}
 */
export function code8to10(code8) {
  if (!code8 || typeof code8 !== 'string') return null;
  if (code8.length !== 8) return null;
  return code8 + '00';
}

/**
 * 10자리 → 8자리 변환 (끝 "00" 제거)
 * 끝이 "00"이 아니면 리(里) 단위 정보 손실 발생 → null 반환
 * @param {string} code10
 * @returns {string|null}
 */
export function code10to8(code10) {
  if (!code10 || typeof code10 !== 'string') return null;
  if (code10.length !== 10) return null;
  if (!code10.endsWith('00')) return null; // 리 단위 코드면 변환 불가
  return code10.slice(0, 8);
}

/**
 * 행정동코드 양쪽 형식 보장
 * @param {string|number} code - 8자리 또는 10자리 코드
 * @returns {{ code8: string|null, code10: string|null, valid: boolean, original: string|null }}
 */
export function normalizeDongCode(code) {
  if (code == null || code === '') {
    return { code8: null, code10: null, valid: false, original: null };
  }
  const str = String(code).trim();

  if (str.length === 8) {
    return { code8: str, code10: code8to10(str), valid: true, original: str };
  }
  if (str.length === 10) {
    return { code8: code10to8(str), code10: str, valid: true, original: str };
  }
  return { code8: null, code10: null, valid: false, original: str };
}

/**
 * 좌표 → 행정동 정보 응답 정규화
 * 다양한 API 응답 형태에서 dongCd / 동 이름 추출
 * @param {object} geoApiResponse
 * @returns {{ code8: string|null, code10: string|null, valid: boolean, dongName: string }}
 */
export function extractDongInfo(geoApiResponse) {
  if (!geoApiResponse || typeof geoApiResponse !== 'object') {
    return { code8: null, code10: null, valid: false, dongName: '' };
  }
  const rawCode =
    geoApiResponse.dongCd ||
    geoApiResponse.admdstCd ||
    geoApiResponse.admiCd ||
    geoApiResponse?.dong?.code ||
    geoApiResponse?.region?.code;

  const normalized = normalizeDongCode(rawCode);
  return {
    ...normalized,
    dongName:
      geoApiResponse.admdstCdNm ||
      geoApiResponse.dongNm ||
      geoApiResponse?.dong?.name ||
      ''
  };
}

/**
 * dongInfo 객체에 양쪽 코드 보강 (기존 호환성 유지)
 * 기존 dongCd 필드는 그대로 두고 dongCode8/dongCode10 추가
 * @param {object} dongInfo - { dongCd, dongNm, admdstCdNm, ... }
 * @returns {object} 양쪽 코드가 추가된 dongInfo
 */
export function enrichDongInfo(dongInfo) {
  if (!dongInfo) return dongInfo;
  const norm = normalizeDongCode(dongInfo.dongCd);
  return {
    ...dongInfo,
    dongCode8: norm.code8,
    dongCode10: norm.code10
  };
}

/**
 * 자릿수 검증 로깅 (개발/디버깅 용)
 * @param {string} apiName - API 이름 (예: '비즈맵', '소상공인365')
 * @param {string} code - 검증할 코드
 * @param {number} expectedLength - 기대 자릿수 (8 또는 10)
 * @returns {boolean} 정상이면 true
 */
export function assertDongCodeLength(apiName, code, expectedLength) {
  if (!code) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[${apiName}] dongCd 비어있음`);
    }
    return false;
  }
  const str = String(code);
  if (str.length !== expectedLength) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[${apiName}] dongCd 자릿수 이상: ${str} (${str.length}자리, 기대 ${expectedLength}자리)`);
    }
    return false;
  }
  return true;
}
