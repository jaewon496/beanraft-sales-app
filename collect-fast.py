import json, urllib.request, time, os, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE = 'https://m.nicebizmap.co.kr'
ZINI = 'https://api-v1.zinidata.co.kr'

with open('sgg-codes.json') as f:
    sgg_codes = json.load(f)

def check_chart(code):
    """chart/admi로 행정동 존재 확인 + 매출 데이터 동시 수집"""
    try:
        data = json.dumps({'upjong3Cd':'Q13007','admiCd':code,'yyyymm':'202601'}).encode()
        req = urllib.request.Request(f'{BASE}/api/explorer/markets/chart/admi',
            data=data, headers={'Referer':BASE,'Content-Type':'application/json'}, method='POST')
        resp = urllib.request.urlopen(req, timeout=8)
        d = json.loads(resp.read())
        if d.get('success') and d.get('data') and len(d['data']) > 0:
            return d['data']
    except:
        pass
    return None

def get_menu(code):
    try:
        req = urllib.request.Request(
            f'{ZINI}/v4/union/biz_trend_menu?CLSFC_TERM=M&YEAR=2026&TERMS=1&UPJONG_CD=Q13007&AREA_CD={code}',
            headers={'UNION-API-KEY':'pringles','Content-Type':'application/json'})
        resp = urllib.request.urlopen(req, timeout=8)
        d = json.loads(resp.read())
        if d.get('MESSAGE') == '성공':
            return d.get('RESULT',{}).get('MENU_LIST',[])
    except:
        pass
    return None

# 모든 가능한 행정동 코드 생성
all_codes = []
for sido, sgus in sgg_codes.items():
    for sgu in sgus:
        for dong in range(500, 900):
            code = f"{sido}{sgu}{dong}"
            if len(code) == 8:
                all_codes.append(code)

print(f"탐색 대상: {len(all_codes)}개 코드", flush=True)

# 병렬 수집 (10개 스레드)
result = {}
found = 0
checked = 0

def process_code(code):
    chart = check_chart(code)
    if chart:
        latest = chart[-1]
        entry = {
            'n': latest.get('admiNm',''),
            's': latest.get('saleAmt'),
            'c': latest.get('storeCnt'),
            'p': latest.get('avgPrice'),
            'h': [{'y':d['yyyymm'],'s':d['saleAmt'],'c':d['storeCnt']} for d in chart]
        }
        # 메뉴도 수집
        menu = get_menu(code)
        if menu:
            entry['menu'] = [{'n':m['MENU_NM'],'pr':m['AVG_SALE_UPRC'],'r':m.get('COM_PRE_RATE')} for m in menu[:5]]
        return code, entry
    return code, None

with ThreadPoolExecutor(max_workers=10) as executor:
    futures = {executor.submit(process_code, c): c for c in all_codes}
    for future in as_completed(futures):
        checked += 1
        code, entry = future.result()
        if entry:
            result[code] = entry
            found += 1
        
        if checked % 500 == 0:
            print(f"  {checked}/{len(all_codes)} 확인, {found}개 발견", flush=True)
            # 중간 저장
            with open('nicebizmap-data.json', 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False)

# 최종 저장
with open('nicebizmap-data.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False)

size = os.path.getsize('nicebizmap-data.json') / 1024
print(f"\n완료! {found}개 행정동, {size:.1f}KB", flush=True)
