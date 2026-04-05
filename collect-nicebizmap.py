#!/usr/bin/env python3
"""나이스비즈맵 전국 행정동 커피전문점 매출 수집"""
import json, urllib.request, time, sys, os

NICEBIZMAP_BASE = "https://m.nicebizmap.co.kr"
ZINIDATA_BASE = "https://api-v1.zinidata.co.kr"
UPJONG_CD = "Q13007"  # 커피전문점
YYYYMM = "202601"

# 시도 코드
MEGA_CDS = {
    '11': '서울특별시', '26': '부산광역시', '27': '대구광역시',
    '28': '인천광역시', '29': '광주광역시', '30': '대전광역시',
    '31': '울산광역시', '36': '세종특별자치시', '41': '경기도',
    '43': '충청북도', '44': '충청남도', '46': '전라남도',
    '47': '경상북도', '48': '경상남도', '50': '제주특별자치도',
    '51': '강원특별자치도', '52': '전북특별자치도'
}

# 시군구 코드 (시도코드 + 2자리 + 0)
# 서울: 11010(종로), 11020(중구), 11030(용산), ...
# 나이스비즈맵 admiCd = 시도2 + 시군구3 + 행정동3 = 8자리

def api_get(url, headers=None):
    """GET 요청"""
    h = {'Referer': NICEBIZMAP_BASE, 'Content-Type': 'application/json'}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read())
    except Exception as e:
        return None

def api_post(url, data, headers=None):
    """POST 요청"""
    h = {'Referer': NICEBIZMAP_BASE, 'Content-Type': 'application/json'}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=h, method='POST')
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read())
    except Exception as e:
        return None

def collect_chart_admi(admi_cd):
    """행정동별 매출/점포수 6개월 추이"""
    url = f"{NICEBIZMAP_BASE}/api/explorer/markets/chart/admi"
    result = api_post(url, {
        'upjong3Cd': UPJONG_CD,
        'admiCd': admi_cd,
        'yyyymm': YYYYMM
    })
    if result and result.get('success') and result.get('data'):
        return result['data']
    return None

def collect_menu(admi_cd):
    """급상승 메뉴 데이터"""
    url = f"{ZINIDATA_BASE}/v4/union/biz_trend_menu?CLSFC_TERM=M&YEAR={YYYYMM[:4]}&TERMS={int(YYYYMM[4:])}&UPJONG_CD={UPJONG_CD}&AREA_CD={admi_cd}"
    result = api_get(url, headers={'UNION-API-KEY': 'pringles'})
    if result and result.get('MESSAGE') == '성공':
        return result.get('RESULT', {}).get('MENU_LIST', [])
    return None

def discover_admi_codes(mega_cd):
    """시도 내 행정동 코드 탐색"""
    admis = []
    # 시군구 코드 범위 탐색
    for cty in range(10, 100):
        cty_cd = f"{mega_cd}{cty:02d}"
        # 행정동 코드 범위 탐색 (500~700이 일반적)
        found_in_cty = False
        for dong in range(500, 720, 10):
            admi_cd = f"{cty_cd}0{dong}"
            result = api_get(f"{NICEBIZMAP_BASE}/api/common/region/admi/{admi_cd}")
            if result and result.get('success') and result.get('data'):
                data = result['data']
                admis.append({
                    'cd': admi_cd,
                    'nm': data.get('admiNm', ''),
                    'cty': data.get('ctyCd', '')
                })
                found_in_cty = True
            time.sleep(0.05)  # 50ms 딜레이
        if not found_in_cty and cty > 20:
            # 연속으로 없으면 다음 시도
            pass
    return admis

# 메인 실행
if __name__ == '__main__':
    output_file = os.path.join(os.path.dirname(__file__), 'nicebizmap-data.json')
    
    # 1단계: 행정동 코드 수집 (또는 기존 파일 로드)
    admi_list_file = os.path.join(os.path.dirname(__file__), 'admi-codes.json')
    
    if os.path.exists(admi_list_file):
        with open(admi_list_file, 'r', encoding='utf-8') as f:
            all_admis = json.load(f)
        print(f"기존 행정동 코드 로드: {len(all_admis)}개")
    else:
        print("행정동 코드 탐색 시작...")
        all_admis = []
        for mega_cd, mega_nm in MEGA_CDS.items():
            print(f"  {mega_nm} ({mega_cd}) 탐색 중...")
            admis = discover_admi_codes(mega_cd)
            all_admis.extend(admis)
            print(f"    → {len(admis)}개 발견")
        
        with open(admi_list_file, 'w', encoding='utf-8') as f:
            json.dump(all_admis, f, ensure_ascii=False, indent=2)
        print(f"행정동 코드 저장 완료: {len(all_admis)}개")
    
    # 2단계: 매출 데이터 수집
    print(f"\n매출 데이터 수집 시작 ({len(all_admis)}개 행정동)")
    
    collected = {}
    errors = 0
    
    for i, admi in enumerate(all_admis):
        cd = admi['cd']
        nm = admi['nm']
        
        # chart/admi 수집
        chart = collect_chart_admi(cd)
        
        # 메뉴 수집
        menu = collect_menu(cd)
        
        if chart:
            # 압축 저장 (키 축약)
            latest = chart[-1] if chart else {}
            collected[cd] = {
                'n': nm,                           # 행정동명
                's': latest.get('saleAmt'),        # 매출(억원)
                'c': latest.get('storeCnt'),       # 점포수
                'p': latest.get('avgPrice'),       # 결제단가
                'm': YYYYMM,                       # 기준월
                'h': [{'y': d['yyyymm'], 's': d['saleAmt'], 'c': d['storeCnt']} for d in chart],  # 6개월 추이
            }
            if menu:
                collected[cd]['menu'] = [{'n': m['MENU_NM'], 'pr': m['AVG_SALE_UPRC'], 'r': m.get('COM_PRE_RATE')} for m in menu[:5]]
        else:
            errors += 1
        
        if (i + 1) % 50 == 0:
            print(f"  {i+1}/{len(all_admis)} 완료 (수집: {len(collected)}, 실패: {errors})")
            # 중간 저장
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(collected, f, ensure_ascii=False)
        
        time.sleep(0.1)  # 100ms 딜레이
    
    # 최종 저장
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(collected, f, ensure_ascii=False)
    
    size_kb = os.path.getsize(output_file) / 1024
    print(f"\n수집 완료!")
    print(f"  행정동: {len(collected)}개")
    print(f"  실패: {errors}개")
    print(f"  파일 크기: {size_kb:.1f}KB")
