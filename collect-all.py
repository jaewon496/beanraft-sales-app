import json, urllib.request, time, sys

BASE = 'https://m.nicebizmap.co.kr'
ZINI = 'https://api-v1.zinidata.co.kr'

def get_admi(code):
    try:
        req = urllib.request.Request(f'{BASE}/api/common/region/admi/{code}', headers={'Referer': BASE})
        resp = urllib.request.urlopen(req, timeout=5)
        d = json.loads(resp.read())
        if d.get('success') and d.get('data'):
            return d['data'].get('admiNm', '')
    except:
        pass
    return None

def get_chart(code):
    try:
        data = json.dumps({'upjong3Cd':'Q13007','admiCd':code,'yyyymm':'202601'}).encode()
        req = urllib.request.Request(f'{BASE}/api/explorer/markets/chart/admi', data=data,
            headers={'Referer': BASE, 'Content-Type': 'application/json'}, method='POST')
        resp = urllib.request.urlopen(req, timeout=10)
        d = json.loads(resp.read())
        if d.get('success') and d.get('data'):
            return d['data']
    except:
        pass
    return None

def get_menu(code):
    try:
        req = urllib.request.Request(
            f'{ZINI}/v4/union/biz_trend_menu?CLSFC_TERM=M&YEAR=2026&TERMS=1&UPJONG_CD=Q13007&AREA_CD={code}',
            headers={'UNION-API-KEY': 'pringles', 'Content-Type': 'application/json'})
        resp = urllib.request.urlopen(req, timeout=10)
        d = json.loads(resp.read())
        if d.get('MESSAGE') == '성공':
            return d.get('RESULT', {}).get('MENU_LIST', [])
    except:
        pass
    return None

# 1단계: 전국 행정동 코드 탐색
# 시도(2자리) + 구(3자리) + 0 + 동(2자리) + 0 = 8자리
# 시도코드: 11,26,27,28,29,30,31,36,41,43,44,46,47,48,50,51,52
mega_codes = [11,26,27,28,29,30,31,36,41,43,44,46,47,48,50,51,52]

all_admis = []
print("전국 행정동 탐색 시작...")

for mega in mega_codes:
    count = 0
    for gu in range(10, 100):  # 시군구
        for dong in range(500, 900):  # 행정동 (넓게)
            code = f"{mega}{gu:02d}0{dong}"
            if len(code) != 8:
                continue
            nm = get_admi(code)
            if nm:
                all_admis.append({'cd': code, 'nm': nm})
                count += 1
            time.sleep(0.02)
    print(f"  시도 {mega}: {count}개 동", flush=True)

print(f"\n전국 행정동: {len(all_admis)}개")

# 저장
with open('admi-codes.json', 'w', encoding='utf-8') as f:
    json.dump(all_admis, f, ensure_ascii=False)

# 2단계: 매출 데이터 수집
print(f"\n매출 수집 시작...")
result = {}
for i, a in enumerate(all_admis):
    cd = a['cd']
    chart = get_chart(cd)
    menu = get_menu(cd)
    
    if chart:
        latest = chart[-1] if chart else {}
        result[cd] = {
            'n': a['nm'],
            's': latest.get('saleAmt'),
            'c': latest.get('storeCnt'),
            'p': latest.get('avgPrice'),
            'h': [{'y':d['yyyymm'],'s':d['saleAmt'],'c':d['storeCnt']} for d in chart]
        }
        if menu:
            result[cd]['menu'] = [{'n':m['MENU_NM'],'pr':m['AVG_SALE_UPRC'],'r':m.get('COM_PRE_RATE')} for m in menu[:5]]
    
    if (i+1) % 100 == 0:
        print(f"  {i+1}/{len(all_admis)} (수집: {len(result)})", flush=True)
        with open('nicebizmap-data.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)
    time.sleep(0.05)

with open('nicebizmap-data.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False)

import os
size = os.path.getsize('nicebizmap-data.json') / 1024
print(f"\n완료! {len(result)}개 행정동, {size:.1f}KB")
