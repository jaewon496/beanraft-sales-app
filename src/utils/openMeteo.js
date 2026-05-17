// openMeteo.js - Open-Meteo ERA5 아카이브 기반 1년 기상 통계
// 용도: 좌표(lat/lng)로 최근 365일 실측 기상 데이터를 받아와 카페 운영 결정에 쓸 분포값을 반환.
// 에러 시 null 반환(전체 검색 영향 없음).

const ENDPOINT = 'https://archive-api.open-meteo.com/v1/archive';

// 소수점 3자리 좌표 기준 메모리 캐시 (세션 내 중복 호출 방지)
const _cache = new Map();

const _roundCoord = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
};

const _fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// WMO weather_code 범주 매핑 (https://open-meteo.com/en/docs)
// 0=맑음, 1=대체로 맑음, 2=부분 구름, 3=흐림, 45/48=안개
// 51/53/55=이슬비, 56/57=어는 이슬비, 61/63/65=비(약/중/강), 66/67=어는 비
// 71-77=눈, 80-82=소나기, 85-86=눈소나기, 95-99=뇌우
// 체감 보정:
//  - 부분 구름(code 2)까지 '맑은 날'에 포함 (해 노출 시간 충분)
//  - 이슬비(51/53/55)는 카페 운영 영향 미미 → '흐림'에 포함
//  - 본격 비(61~67) 및 소나기/뇌우만 '비'로 분류
const _isSunny = (code) => code === 0 || code === 1 || code === 2;
const _isCloudy = (code) => code === 3 || code === 45 || code === 48 || code === 51 || code === 53 || code === 55;
const _isRain = (code) => (code >= 56 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99);
const _isSnow = (code) => (code >= 71 && code <= 77) || code === 85 || code === 86;

/**
 * Open-Meteo ERA5 아카이브에서 최근 365일 일별 기상값을 가져와 분포 통계로 반환한다.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<object|null>}
 */
export async function fetchWeatherStats(lat, lng) {
  const rLat = _roundCoord(lat);
  const rLng = _roundCoord(lng);
  if (rLat == null || rLng == null) return null;

  const cacheKey = `${rLat},${rLng}`;
  if (_cache.has(cacheKey)) {
    return _cache.get(cacheKey);
  }

  try {
    // ERA5 아카이브는 약 5일 지연이 있어 end_date를 오늘-6일로 여유를 둠
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() - 6);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 364); // 365일 구간

    const params = new URLSearchParams({
      latitude: String(rLat),
      longitude: String(rLng),
      start_date: _fmtDate(startDate),
      end_date: _fmtDate(endDate),
      daily: 'precipitation_sum,weather_code,temperature_2m_max,temperature_2m_min,sunshine_duration',
      timezone: 'Asia/Seoul',
    });

    const url = `${ENDPOINT}?${params.toString()}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    let json;
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) {
        console.warn('[openMeteo] HTTP', res.status);
        return null;
      }
      json = await res.json();
    } finally {
      clearTimeout(timer);
    }

    const daily = json?.daily;
    if (!daily || !Array.isArray(daily.time) || daily.time.length === 0) {
      console.warn('[openMeteo] daily 배열 없음');
      return null;
    }

    const times = daily.time;
    const precips = daily.precipitation_sum || [];
    const codes = daily.weather_code || [];
    const tmaxs = daily.temperature_2m_max || [];
    const tmins = daily.temperature_2m_min || [];
    const sunshines = daily.sunshine_duration || []; // 초 단위

    let rainDays = 0;
    let heavyRainDays = 0;
    let snowDays = 0;
    let sunnyDays = 0;
    let cloudyDays = 0;
    let heatWaveDays = 0;
    let coldWaveDays = 0;
    let tempSum = 0;
    let tempCount = 0;
    let winterMinTemp = Infinity;
    let summerMaxTemp = -Infinity;

    // [v15] 월별 집계 (Card 11 차트용)
    const monthlyTempSum = new Array(12).fill(0);
    const monthlyTempCount = new Array(12).fill(0);
    const monthlyRainDays = new Array(12).fill(0);
    const monthlySnowDays = new Array(12).fill(0);
    const monthlySunshineSec = new Array(12).fill(0);
    // [v25] 월별 일별 상세 (캘린더 클릭 펼침용)
    const monthlyDayDetails = Array.from({ length: 12 }, () => []);

    const totalDays = times.length;

    for (let i = 0; i < totalDays; i++) {
      const code = Number(codes[i]);
      const precip = Number(precips[i]) || 0;
      const tmax = Number(tmaxs[i]);
      const tmin = Number(tmins[i]);

      // 체감 보정 분류:
      //  1) 눈 코드면 눈
      //  2) 본격 비(56~67/소나기/뇌우) 또는 일강수 5mm 이상이면 비
      //  3) 강수 없고 일조시간 5시간 이상이면 맑음 (체감 기준; ERA5 weather_code는 맑음을 과소계상)
      //  4) 그 외(이슬비/안개/구름) 흐림
      const sunSec = Number(sunshines[i]);
      const sunHours = Number.isFinite(sunSec) ? sunSec / 3600 : 0;
      if (_isSnow(code)) snowDays++;
      else if (_isRain(code) || precip >= 5) {
        rainDays++;
        if (precip >= 30) heavyRainDays++;
      } else if (sunHours >= 7 || _isSunny(code)) sunnyDays++;
      else cloudyDays++;

      // 기온 통계
      if (Number.isFinite(tmax) && Number.isFinite(tmin)) {
        tempSum += (tmax + tmin) / 2;
        tempCount++;
      }
      if (Number.isFinite(tmax) && tmax >= 33) heatWaveDays++;
      if (Number.isFinite(tmin) && tmin <= -12) coldWaveDays++;

      // 계절별 극값: 7-8월 최고, 12-2월 최저
      const month = Number(String(times[i]).slice(5, 7));
      if (Number.isFinite(tmax) && (month === 7 || month === 8) && tmax > summerMaxTemp) {
        summerMaxTemp = tmax;
      }
      if (Number.isFinite(tmin) && (month === 12 || month === 1 || month === 2) && tmin < winterMinTemp) {
        winterMinTemp = tmin;
      }

      // [v15] 월별 집계
      const mi = month - 1;
      if (mi >= 0 && mi < 12) {
        if (Number.isFinite(tmax) && Number.isFinite(tmin)) {
          monthlyTempSum[mi] += (tmax + tmin) / 2;
          monthlyTempCount[mi]++;
        }
        if (_isRain(code) || precip >= 5) monthlyRainDays[mi]++;
        if (_isSnow(code)) monthlySnowDays[mi]++;
        if (Number.isFinite(sunSec)) monthlySunshineSec[mi] += sunSec;
        // [v25] 일별 상세 (날짜·날씨타입·강수량·기온)
        const day = Number(String(times[i]).slice(8, 10));
        const dayType = _isSnow(code)
          ? 'snow'
          : (_isRain(code) || precip >= 5)
            ? 'rain'
            : (sunHours >= 7 || _isSunny(code))
              ? 'sunny'
              : 'cloudy';
        monthlyDayDetails[mi].push({
          d: day,
          t: dayType,
          p: precip > 0 ? Math.round(precip * 10) / 10 : 0,
          tmax: Number.isFinite(tmax) ? Math.round(tmax * 10) / 10 : null,
          tmin: Number.isFinite(tmin) ? Math.round(tmin * 10) / 10 : null,
        });
      }
    }

    const avgTemp = tempCount > 0 ? Math.round((tempSum / tempCount) * 10) / 10 : null;
    const _winterMin = winterMinTemp === Infinity ? null : Math.round(winterMinTemp * 10) / 10;
    const _summerMax = summerMaxTemp === -Infinity ? null : Math.round(summerMaxTemp * 10) / 10;

    const nationalAvgRainDays = 105; // 기상청 평년값(전국 단일 상수)
    let relativePosition = '평균';
    if (rainDays < nationalAvgRainDays - 15) relativePosition = '낮음';
    else if (rainDays > nationalAvgRainDays + 15) relativePosition = '높음';

    // [v15] 월별 평균 기온·강수일·일조시간(시간)
    const monthlyAvgTemp = monthlyTempSum.map((s, i) => monthlyTempCount[i] > 0 ? Math.round((s / monthlyTempCount[i]) * 10) / 10 : null);
    const monthlySunshineHours = monthlySunshineSec.map(s => Math.round((s / 3600) * 10) / 10);

    const result = {
      rainDays,
      heavyRainDays,
      snowDays,
      sunnyDays,
      cloudyDays,
      avgTemp,
      winterMinTemp: _winterMin,
      summerMaxTemp: _summerMax,
      heatWaveDays,
      coldWaveDays,
      totalDays,
      dataSource: `Open-Meteo ${_fmtDate(startDate)}~${_fmtDate(endDate)}`,
      nationalAvgRainDays,
      relativePosition,
      // [v15] 월별 시계열 (12점)
      monthlyAvgTemp,         // [13.2, 14.1, ...]
      monthlyRainDays,        // [3, 5, ...]
      monthlySnowDays,        // [v25] 월별 눈 일수
      monthlySunshineHours,   // [180.5, 220.1, ...]
      // [v25] 월별 일별 상세 (캘린더 클릭 펼침용)
      monthlyDayDetails,
    };

    _cache.set(cacheKey, result);
    return result;
  } catch (e) {
    console.warn('[openMeteo] fetch 실패:', e?.message || e);
    return null;
  }
}

export default { fetchWeatherStats };
