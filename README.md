# 빈크래프트 영업관리 시스템

## 필수 설정

### logo.png 파일 추가
`public/logo.png` 파일을 빈크래프트 로고 이미지로 추가해주세요.
- 권장 크기: 200x200px 이상
- 배경: 투명 또는 흰색

## 설치 및 실행

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 주요 기능

### 영업관리 사이트
- 지도/동선/업체/중개사/일정/고객/보고서/설정

### 영업모드 (프레젠테이션)
- 60초 무활동 → 자동 잠금
- PIN 잠금 화면 (기본: 0000)
- 지역 분석 13개 섹션
- 빈크래프트 홈페이지 iframe

### AI 분석 탭
- 기본 보고서: 통계 요약
- AI 분석: Gemini API 활용
- 지역 분석: 상권 분석 13개 섹션

## API 키 (내장됨)
- Gemini API
- 네이버 지도 API

## 배포
Netlify 자동 빌드
- Build: `npm run build`
- Publish: `dist`

## 변경 이력 (v5)
- PIN 잠금 + 60초 타임아웃 구현
- 출처 팝업 모달화
- report 탭 지역 분석 추가
- 시뮬레이션 8개 항목 + ⓘ 정보 팝업
- Gemini 2.0-flash 모델 통일
- 영업모드 진입 시 타이머 초기화
