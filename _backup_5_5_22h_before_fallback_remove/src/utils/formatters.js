/**
 * formatters.js
 * 공통 포맷팅 유틸리티
 */

import { toKoreanUnit } from './DataNormalizer.js';

/**
 * 천단위 콤마 포맷
 * 604501 → "604,501"
 *
 * @param {number} n - 숫자
 * @returns {string} 콤마 포맷 문자열
 */
export function formatNumber(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return Math.round(n).toLocaleString();
}

/**
 * 퍼센트 포맷
 * 0.813 → "81.3%"
 * 0.5   → "50.0%"
 *
 * @param {number} n - 비율 (0~1 또는 0~100)
 * @param {number} decimals - 소수점 자릿수 (기본 1)
 * @returns {string} 퍼센트 문자열
 */
export function formatPercent(n, decimals = 1) {
  if (typeof n !== 'number' || isNaN(n)) return '0%';

  // 1 이하면 비율(0~1)로 간주, 아니면 이미 퍼센트값
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toFixed(decimals)}%`;
}

// DataNormalizer의 toKoreanUnit을 re-export
export { toKoreanUnit };
