#!/usr/bin/env python3
"""나이스비즈맵 전국 행정동 제과점(베이커리) 매출 수집 — 커피(collect-nicebizmap.py)와 동일 방식, 업종코드만 Q11002.
chart/admi 엔드포인트는 세션/로그인/카카오 안 씀(공개) → 알림 0. 평균(매출/점포/객단가) 수집.
전국 동 목록은 이미 만들어둔 커피 전국 파일(nicebizmap-data.json)의 키를 그대로 사용."""
import json, urllib.request, time, os

BASE = "https://m.nicebizmap.co.kr"
UPJONG_CD = "Q11002"   # 제과점(베이커리)
YYYYMM = "202605"
ROOT = os.path.dirname(os.path.abspath(__file__))
COFFEE_FILE = os.path.join(ROOT, "nicebizmap-data.json")
OUT_FILE = os.path.join(ROOT, "nicebizmap-bakery-data.json")

def post(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode(),
        headers={'Referer': BASE, 'Content-Type': 'application/json'}, method='POST')
    try:
        return json.loads(urllib.request.urlopen(req, timeout=12).read())
    except Exception:
        return None

def collect_admi(admi_cd):
    r = post(f"{BASE}/api/explorer/markets/chart/admi",
             {'upjong3Cd': UPJONG_CD, 'admiCd': admi_cd, 'yyyymm': YYYYMM})
    if r and r.get('success') and r.get('data'):
        return r['data']
    return None

if __name__ == '__main__':
    coffee = json.load(open(COFFEE_FILE, encoding='utf-8'))
    dongs = list(coffee.keys())
    print(f"전국 동 {len(dongs)}개 (커피 파일 키 재사용). 제과 수집 시작", flush=True)

    out = {}
    err = 0
    for i, cd in enumerate(dongs):
        chart = collect_admi(cd)
        if chart:
            latest = chart[-1] if chart else {}
            out[cd] = {'name': latest.get('admiNm', ''), 'chart': chart}
        else:
            err += 1
        if (i + 1) % 100 == 0:
            json.dump(out, open(OUT_FILE, 'w', encoding='utf-8'), ensure_ascii=False)
            print(f"  {i+1}/{len(dongs)} (수집 {len(out)}, 실패 {err})", flush=True)
        time.sleep(0.12)

    json.dump(out, open(OUT_FILE, 'w', encoding='utf-8'), ensure_ascii=False)
    kb = os.path.getsize(OUT_FILE) / 1024
    print(f"DONE 수집 {len(out)} / 실패 {err} / {kb:.0f}KB", flush=True)
