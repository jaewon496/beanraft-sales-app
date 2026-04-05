import { useState, useEffect } from 'react';
import CountUp from 'react-countup';
import Chart from 'react-apexcharts';

// 컬러 팔레트
const C = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSub: '#6B7280',
  accent: '#10B981',
  accent2: '#8B5CF6',
  accent3: '#F59E0B',
  danger: '#EF4444',
  blue: '#3B82F6',
  navy: '#1E40AF',
  border: '#E5E7EB',
  shadow: '0 1px 3px rgba(0,0,0,0.08)',
};

const font = "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ====== 공통 컴포넌트 ======

function Num({ value, suffix = '', prefix = '', decimals = 0, dur = 1.2 }) {
  return (
    <CountUp end={value} suffix={suffix} prefix={prefix} decimals={decimals} duration={dur} separator="," />
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 24, boxShadow: C.shadow, fontFamily: font, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: 0, fontFamily: font }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: C.textSub, margin: '4px 0 0', fontFamily: font }}>{sub}</p>}
    </div>
  );
}

function Dot({ color, size = 8 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: color, marginRight: 6, flexShrink: 0,
    }} />
  );
}

function Row({ children, gap = 24, style = {} }) {
  return (
    <div style={{ display: 'flex', gap, ...style }}>
      {children}
    </div>
  );
}

// ====== 지도 마커 데이터 ======
const markers = [
  // 프랜차이즈 (f)
  { x: 42, y: 32, type: 'f' }, { x: 55, y: 28, type: 'f' }, { x: 48, y: 45, type: 'f' },
  { x: 38, y: 50, type: 'f' }, { x: 60, y: 42, type: 'f' }, { x: 52, y: 55, type: 'f' },
  { x: 45, y: 62, type: 'f' }, { x: 58, y: 35, type: 'f' }, { x: 35, y: 40, type: 'f' },
  // 개인카페 (i)
  { x: 44, y: 38, type: 'i' }, { x: 50, y: 33, type: 'i' }, { x: 53, y: 42, type: 'i' },
  { x: 46, y: 52, type: 'i' }, { x: 40, y: 46, type: 'i' }, { x: 57, y: 48, type: 'i' },
  { x: 43, y: 58, type: 'i' }, { x: 55, y: 58, type: 'i' }, { x: 49, y: 42, type: 'i' },
  { x: 36, y: 55, type: 'i' }, { x: 62, y: 50, type: 'i' }, { x: 47, y: 35, type: 'i' },
  { x: 51, y: 60, type: 'i' }, { x: 39, y: 35, type: 'i' }, { x: 56, y: 38, type: 'i' },
  { x: 44, y: 48, type: 'i' }, { x: 52, y: 30, type: 'i' }, { x: 60, y: 55, type: 'i' },
  { x: 41, y: 60, type: 'i' }, { x: 48, y: 25, type: 'i' },
];

// ====== 헤더 ======
function Header() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 0', fontFamily: font,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: 3 }}>BEANCRAFT</span>
        <span style={{ fontSize: 15, color: C.textSub, fontWeight: 500 }}>상권 분석 리포트</span>
      </div>
      <div style={{
        background: '#F3F4F6', borderRadius: 20, padding: '8px 20px',
        fontSize: 14, color: C.text, fontWeight: 500, border: `1px solid ${C.border}`,
      }}>
        서울시 용산구 청파로 205-6
      </div>
    </div>
  );
}

// ====== 섹션 A: 지도 + KPI ======
function MapArea() {
  return (
    <div style={{
      position: 'relative', height: 400, background: '#E8ECF0', borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* 상단 오버레이 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 50, zIndex: 3,
        background: 'linear-gradient(to bottom, rgba(232,236,240,0.95), rgba(232,236,240,0))',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 12,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: font }}>
          용산구 청파로 일대
        </span>
      </div>

      {/* 그리드 라인 (지도 느낌) */}
      {[20, 40, 60, 80].map(p => (
        <div key={`h${p}`} style={{
          position: 'absolute', top: `${p}%`, left: 0, right: 0, height: 1,
          background: 'rgba(0,0,0,0.04)', zIndex: 0,
        }} />
      ))}
      {[20, 40, 60, 80].map(p => (
        <div key={`v${p}`} style={{
          position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: 1,
          background: 'rgba(0,0,0,0.04)', zIndex: 0,
        }} />
      ))}

      {/* 500m 반경 원 */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 280, height: 280, borderRadius: '50%',
        border: '2px dashed rgba(16,185,129,0.4)',
        background: 'rgba(16,185,129,0.06)',
        zIndex: 1,
      }} />

      {/* 마커들 */}
      {markers.map((m, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: `${m.x}%`, top: `${m.y}%`,
          width: m.type === 'f' ? 8 : 6,
          height: m.type === 'f' ? 8 : 6,
          borderRadius: '50%',
          background: m.type === 'f' ? C.accent : C.accent2,
          transform: 'translate(-50%, -50%)',
          zIndex: 2,
          boxShadow: `0 0 4px ${m.type === 'f' ? 'rgba(16,185,129,0.5)' : 'rgba(139,92,246,0.5)'}`,
        }} />
      ))}

      {/* 중앙 핀 마커 */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -100%)', zIndex: 4,
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%',
          background: C.danger, border: '2px solid #fff',
          boxShadow: '0 2px 6px rgba(239,68,68,0.5)',
        }} />
        <div style={{
          width: 0, height: 0, margin: '0 auto',
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `8px solid ${C.danger}`,
        }} />
      </div>

      {/* 범례 (좌하단) */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 3,
        background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '8px 12px',
        fontSize: 11, fontFamily: font, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Dot color={C.accent} size={7} /><span>프랜차이즈</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Dot color={C.accent2} size={7} /><span>개인카페</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Dot color={C.danger} size={7} /><span>검색 위치</span>
        </div>
      </div>

      {/* 반경 표시 (우하단) */}
      <div style={{
        position: 'absolute', bottom: 12, right: 12, zIndex: 3,
        background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: '6px 12px',
        fontSize: 12, fontWeight: 600, fontFamily: font, color: C.text,
      }}>
        반경 500m
      </div>
    </div>
  );
}

function KPISidebar() {
  const items = [
    {
      label: '카페 수', value: 241, suffix: '개', sub: '프랜차이즈 67 / 개인 174',
      change: '+3% 전월 대비', changeUp: true, color: C.accent,
    },
    {
      label: '월 추정 매출', value: 4280, suffix: '만원', sub: '반경 500m 평균',
      change: '+8.2% 전월 대비', changeUp: true, color: C.accent2,
    },
    {
      label: '유동인구', value: 32450, suffix: '명', sub: '일평균',
      change: '-2.1% 전월 대비', changeUp: false, color: C.accent3,
    },
    {
      label: 'AI 종합점수', value: 72, suffix: '점', sub: '100점 만점 / 양호',
      change: null, changeUp: true, color: C.accent, progress: 72,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: C.card, borderRadius: 12, padding: '16px 20px',
          boxShadow: C.shadow, borderLeft: `4px solid ${item.color}`, fontFamily: font,
        }}>
          <div style={{ fontSize: 12, color: C.textSub, fontWeight: 500, marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
            <Num value={item.value} suffix={item.suffix} />
          </div>
          <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{item.sub}</div>
          {item.change && (
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: item.changeUp ? C.accent : C.danger }}>
              {item.change}
            </div>
          )}
          {item.progress != null && (
            <div style={{ marginTop: 8, height: 6, background: '#E5E7EB', borderRadius: 3 }}>
              <div style={{
                height: '100%', width: `${item.progress}%`, background: item.color,
                borderRadius: 3, transition: 'width 1s ease',
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionA() {
  return (
    <Row gap={24} style={{ marginBottom: 24 }}>
      <div style={{ flex: '0 0 60%' }}>
        <MapArea />
      </div>
      <div style={{ flex: 1 }}>
        <KPISidebar />
      </div>
    </Row>
  );
}

// ====== 섹션 B: 매출 추이 + 연령 ======
function SalesChart() {
  const options = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: font },
    xaxis: {
      categories: ['4월','5월','6월','7월','8월','9월','10월','11월','12월','1월','2월','3월'],
    },
    stroke: { curve: 'smooth', width: 2, colors: [C.accent] },
    fill: {
      type: 'gradient',
      gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] },
    },
    colors: [C.accent],
    dataLabels: { enabled: false },
    grid: { borderColor: '#F3F4F6' },
    tooltip: { y: { formatter: v => `${v.toLocaleString()}만원` } },
  };
  const series = [{ name: '매출', data: [3500, 3800, 3600, 4100, 3900, 4280, 4100, 4500, 4300, 4600, 4200, 4800] }];

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="매출 추이" sub="최근 12개월 월별 추정 매출 (만원)" />
      <Chart options={options} series={series} type="area" height={260} />
    </Card>
  );
}

function AgeDonut() {
  const labels = ['10대', '20대', '30대', '40대', '50대', '60대+'];
  const data = [3, 22, 34, 24, 12, 5];
  const colors = ['#6EE7B7', '#10B981', '#059669', '#8B5CF6', '#7C3AED', '#6D28D9'];

  const options = {
    chart: { type: 'donut', fontFamily: font },
    labels, colors,
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '60%' } } },
    stroke: { width: 2, colors: ['#fff'] },
    tooltip: { y: { formatter: v => `${v}%` } },
  };

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="소비 고객 연령" />
      <Row gap={16} style={{ alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Chart options={options} series={data} type="donut" height={240} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 100 }}>
          {labels.map((l, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontFamily: font }}>
              <Dot color={colors[i]} size={8} />
              <span style={{ color: C.textSub, marginRight: 8 }}>{l}</span>
              <span style={{ fontWeight: 700, color: C.text }}>{data[i]}%</span>
            </div>
          ))}
        </div>
      </Row>
    </Card>
  );
}

function SectionB() {
  return <Row gap={24} style={{ marginBottom: 24 }}><SalesChart /><AgeDonut /></Row>;
}

// ====== 섹션 C: 유동인구 + 프랜차이즈 vs 개인 ======
function TrafficBar() {
  const timeLabels = ['6시','8시','10시','12시','14시','16시','18시','20시','22시','24시'];
  const data = [1200, 3400, 5600, 4800, 6200, 7800, 8500, 6300, 4100, 2200];
  const maxVal = Math.max(...data);

  const options = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: font },
    xaxis: { categories: timeLabels },
    colors: [({ dataPointIndex }) => data[dataPointIndex] === maxVal ? '#059669' : C.accent],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    grid: { borderColor: '#F3F4F6' },
    tooltip: { y: { formatter: v => `${v.toLocaleString()}명` } },
  };
  const series = [{ name: '유동인구', data }];

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="시간대별 유동인구" sub="2시간 간격 평균 (명)" />
      <Chart options={options} series={series} type="bar" height={260} />
    </Card>
  );
}

function FranchiseVsIndividual() {
  const categories = ['매장수', '평균매출', '평균면적', '생존율'];

  const options = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: font },
    plotOptions: { bar: { horizontal: true, borderRadius: 4, barHeight: '55%' } },
    xaxis: { categories },
    colors: [C.accent, '#A7F3D0'],
    dataLabels: { enabled: true, style: { fontSize: '12px' } },
    grid: { borderColor: '#F3F4F6' },
    legend: { position: 'top', fontFamily: font },
  };
  const series = [
    { name: '프랜차이즈', data: [67, 4800, 42, 78] },
    { name: '개인카페', data: [174, 3200, 28, 62] },
  ];

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="프랜차이즈 vs 개인카페" />
      <Chart options={options} series={series} type="bar" height={260} />
    </Card>
  );
}

function SectionC() {
  return <Row gap={24} style={{ marginBottom: 24 }}><TrafficBar /><FranchiseVsIndividual /></Row>;
}

// ====== 섹션 D: 3열 카드 ======
function TrendIndex() {
  const items = [
    { color: C.accent, text: '커피 전문점 지속 증가세 (+4.2%)' },
    { color: C.accent2, text: '디저트 복합 매장 확대 트렌드' },
    { color: C.accent3, text: '무인카페 신규 진입 활발' },
    { color: C.blue, text: '스페셜티 커피 수요 증가' },
  ];
  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="상권 트렌드 지수" />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color: C.text }}><Num value={68.5} decimals={1} /></span>
        <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>+2.3 전월대비</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: C.text, fontFamily: font }}>
            <Dot color={item.color} />{item.text}
          </div>
        ))}
      </div>
    </Card>
  );
}

function DeliveryAnalysis() {
  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="배달 분석" />
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>배달 매출 비중</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: C.text }}><Num value={24} suffix="%" /></div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}>주요 시간대</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['11-13시', '18-20시'].map(t => (
            <span key={t} style={{
              background: '#F3F4F6', borderRadius: 12, padding: '4px 12px',
              fontSize: 13, fontWeight: 600, color: C.text,
            }}>{t}</span>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: C.textSub, marginBottom: 6 }}>성별</div>
        <div style={{ display: 'flex', height: 20, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ width: '58%', background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600 }}>여성 58%</div>
          <div style={{ width: '42%', background: C.accent2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600 }}>남성 42%</div>
        </div>
      </div>
    </Card>
  );
}

function StartupCost() {
  const items = [
    { label: '인테리어', value: 5200, color: C.accent },
    { label: '장비', value: 3800, color: C.accent2 },
    { label: '보증금', value: 2500, color: C.accent3 },
    { label: '기타', value: 1300, color: '#9CA3AF' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="예상 창업비용" />
      <div style={{ fontSize: 28, fontWeight: 800, color: C.text, marginBottom: 16 }}>
        <Num value={12800} suffix="만원" prefix="" />
      </div>
      {/* 스택 바 */}
      <div style={{ display: 'flex', height: 24, borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            width: `${(item.value / total) * 100}%`, background: item.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#fff', fontWeight: 600,
          }}>
            {item.value >= 2000 ? `${(item.value / 10000).toFixed(1)}억` : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontFamily: font }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Dot color={item.color} /><span style={{ color: C.text }}>{item.label}</span>
            </div>
            <span style={{ fontWeight: 700, color: C.text }}>{item.value.toLocaleString()}만원</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SectionD() {
  return <Row gap={24} style={{ marginBottom: 24 }}><TrendIndex /><DeliveryAnalysis /><StartupCost /></Row>;
}

// ====== 섹션 E: 입지 인프라 + 시장 생존율 ======
function Infrastructure() {
  const items = [
    { color: C.blue, name: '대중교통', count: '4개' },
    { color: C.accent2, name: '주차장', count: '2개' },
    { color: C.accent, name: '학교', count: '3개' },
    { color: C.danger, name: '병원', count: '5개' },
    { color: C.accent3, name: '은행', count: '2개' },
    { color: C.navy, name: '편의점', count: '8개' },
  ];

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="입지 인프라" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            background: '#F9FAFB', borderRadius: 8, padding: '14px 12px',
            textAlign: 'center', fontFamily: font,
          }}>
            <Dot color={item.color} size={10} />
            <div style={{ fontSize: 13, color: C.textSub, marginTop: 6 }}>{item.name}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 2 }}>{item.count}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SurvivalRate() {
  const rates = [
    { label: '1년', value: 82, color: C.accent },
    { label: '3년', value: 54, color: C.accent3 },
    { label: '5년', value: 38, color: C.danger },
  ];

  const options = {
    chart: { type: 'line', toolbar: { show: false }, fontFamily: font },
    xaxis: { categories: ['0년', '1년', '2년', '3년', '4년', '5년'] },
    stroke: { curve: 'smooth', width: 3, colors: [C.accent] },
    colors: [C.accent],
    markers: { size: 5, colors: [C.accent], strokeColors: '#fff', strokeWidth: 2 },
    dataLabels: { enabled: false },
    grid: { borderColor: '#F3F4F6' },
    yaxis: { min: 0, max: 100, labels: { formatter: v => `${v}%` } },
    tooltip: { y: { formatter: v => `${v}%` } },
  };
  const series = [{ name: '생존율', data: [100, 82, 68, 54, 45, 38] }];

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="시장 생존율" />
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
        {rates.map((r, i) => (
          <div key={i} style={{ textAlign: 'center', fontFamily: font }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: r.color }}><Num value={r.value} suffix="%" /></div>
            <div style={{ fontSize: 12, color: C.textSub }}>{r.label}</div>
          </div>
        ))}
      </div>
      <Chart options={options} series={series} type="line" height={180} />
    </Card>
  );
}

function SectionE() {
  return <Row gap={24} style={{ marginBottom: 24 }}><Infrastructure /><SurvivalRate /></Row>;
}

// ====== 섹션 F: AI 종합 ======
function AIGauge() {
  const score = 72;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#E5E7EB" strokeWidth="10" />
        <circle cx="70" cy="70" r={radius} fill="none" stroke={C.accent} strokeWidth="10"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1.5s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" fontSize="28" fontWeight="800" fill={C.text} fontFamily={font}>
          {score}
        </text>
        <text x="70" y="85" textAnchor="middle" fontSize="12" fill={C.textSub} fontFamily={font}>
          / 100
        </text>
      </svg>
    </div>
  );
}

function AIBars() {
  const bars = [
    { label: '시장성', value: 78, color: C.accent },
    { label: '경쟁환경', value: 55, color: C.accent3 },
    { label: '입지', value: 62, color: C.blue },
    { label: '수익성', value: 68, color: C.accent2 },
    { label: '성장성', value: 75, color: '#059669' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
      {bars.map((b, i) => (
        <div key={i}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: font, marginBottom: 4 }}>
            <span style={{ color: C.text, fontWeight: 500 }}>{b.label}</span>
            <span style={{ fontWeight: 700, color: b.color }}>{b.value}</span>
          </div>
          <div style={{ height: 8, background: '#E5E7EB', borderRadius: 4 }}>
            <div style={{
              height: '100%', width: `${b.value}%`, background: b.color, borderRadius: 4,
              transition: 'width 1s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionF() {
  return (
    <Card style={{ marginBottom: 24 }}>
      <SectionTitle title="AI 종합 분석" />
      <Row gap={32} style={{ alignItems: 'center' }}>
        <div style={{ flex: '0 0 140px' }}>
          <AIGauge />
        </div>
        <div style={{ flex: 1 }}>
          <AIBars />
        </div>
        <div style={{
          flex: 1, background: '#ECFDF5', borderRadius: 10, padding: 20,
          borderLeft: `4px solid ${C.accent}`, fontFamily: font,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 8 }}>AI 코멘트</div>
          <div style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>
            경쟁이 치열하지만 유동인구 대비 성장 여지가 있는 상권입니다. 20-30대 소비층이 두텁고 카페 수요가 꾸준합니다.
          </div>
        </div>
      </Row>
    </Card>
  );
}

// ====== 섹션 G: 3열 하단 ======
function SNSTrend() {
  const items = [
    { color: C.accent, label: '블로그 언급', value: '1,240건' },
    { color: C.accent2, label: '인스타 해시태그', value: '#용산카페 2.3만' },
    { color: C.blue, label: '네이버 리뷰', value: '평균 4.2점' },
    { color: C.accent3, label: '카카오맵 저장', value: '8,420회' },
  ];

  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="SNS 트렌드" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: font }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Dot color={item.color} /><span style={{ fontSize: 13, color: C.textSub }}>{item.label}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{item.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeatherImpact() {
  return (
    <Card style={{ flex: 1 }}>
      <SectionTitle title="날씨 영향" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: font }}>
        <div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>맑은 날 매출 변화</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>+12%</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>비 오는 날 매출 변화</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: C.danger }}>-18%</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>기온 vs 매출 상관계수</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.text }}>0.72</div>
        </div>
      </div>
    </Card>
  );
}

function OpportunityRisk() {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 10, fontFamily: font }}>기회 요인</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['2호선 역세권 유동인구', '20-30대 비율 높은 소비층', '배달 시장 성장세'].map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontFamily: font, color: C.text }}>
              <Dot color={C.accent} />{t}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.danger, marginBottom: 10, fontFamily: font }}>리스크 요인</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['프랜차이즈 밀집 경쟁', '임대료 상승 추세', '계절별 매출 편차'].map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 13, fontFamily: font, color: C.text }}>
              <Dot color={C.danger} />{t}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SectionG() {
  return <Row gap={24} style={{ marginBottom: 24 }}><SNSTrend /><WeatherImpact /><OpportunityRisk /></Row>;
}

// ====== 섹션 H: 푸터 ======
function Footer() {
  return (
    <div style={{
      textAlign: 'center', padding: '32px 0 24px', fontFamily: font,
      borderTop: `1px solid ${C.border}`, marginTop: 8,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2, color: C.text, marginBottom: 8 }}>
        BEANCRAFT SALES ANALYTICS
      </div>
      <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>
        데이터 출처: 소상공인365, 나이스비즈맵, 카카오, 네이버, 공정위
      </div>
      <div style={{ fontSize: 12, color: C.textSub }}>
        2026.04.01 기준
      </div>
    </div>
  );
}

// ====== 메인 ======
export default function UITest() {
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: font }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px 40px' }}>
        <Header />
        <SectionA />
        <SectionB />
        <SectionC />
        <SectionD />
        <SectionE />
        <SectionF />
        <SectionG />
        <Footer />
      </div>
    </div>
  );
}
