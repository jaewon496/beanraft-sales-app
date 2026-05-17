# -*- coding: utf-8 -*-
import re

# 4월 17일 데이터 (파일에서)
april = []
with open('/tmp/april17.txt', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        parts = line.split('|')
        if len(parts) >= 2:
            name = parts[0].strip()
            try:
                dist = int(parts[1].strip())
                april.append((name, dist))
            except: pass

# 현재 데이터 (사용자가 추출해서 별도 파일로 저장한다고 가정)
