// 계정 생성 Netlify Function
// Firebase REST API를 사용하여 새 사용자 계정을 생성합니다.
// 서비스 계정 없이 기존 VITE_ 환경변수만으로 작동합니다.

const API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBRrxkXnyGd3HKXFKEUB2o15sY8U2N2Mic';
const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: '요청 본문이 비어있습니다' })
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(event.body);
    } catch (parseErr) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: '잘못된 요청 형식입니다' })
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: '잘못된 요청 데이터입니다' })
      };
    }

    const { username, password, name, color, adminKey } = parsed;

    // 관리자 인증
    if (adminKey !== 'beancraft-admin-reset-2024') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: '권한이 없습니다' }) };
    }

    if (!username || !password || !name) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '아이디, 비밀번호, 이름을 모두 입력하세요' }) };
    }

    if (password.length < 4) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '비밀번호는 4자 이상이어야 합니다' }) };
    }

    // 아이디 접두사 기반 역할 자동 지정
    // sm = 영업자(manager), am = 회계(accounting), admin = 관리자
    let autoRole = 'manager'; // 기본값
    if (username.startsWith('am')) {
      autoRole = 'accounting';
    } else if (username.startsWith('sm')) {
      autoRole = 'manager';
    } else if (username === 'admin') {
      autoRole = 'admin';
    } else {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '아이디는 sm(영업자) 또는 am(회계)으로 시작해야 합니다' }) };
    }

    const email = `${username}@beancraft.com`;

    // Firebase RTDB에서 managers 데이터 가져오기 (중복 체크용)
    const managersRes = await fetch(`${DATABASE_URL}/managers.json`);
    if (!managersRes.ok) {
      throw new Error(`RTDB managers 조회 실패: ${managersRes.status}`);
    }
    const managersData = await managersRes.json() || {};

    // 중복 username 체크 (RTDB에서) - null 항목 필터링
    const existingManager = Object.values(managersData).filter(m => m && typeof m === 'object').find(m => m.username === username);
    if (existingManager) {
      return {
        statusCode: 409, headers,
        body: JSON.stringify({ error: '이미 존재하는 아이디입니다' })
      };
    }

    // Firebase Auth REST API로 계정 생성
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: name,
          returnSecureToken: false
        })
      }
    );

    const signUpData = await signUpRes.json();

    if (!signUpRes.ok) {
      // Firebase Auth 에러 처리
      const errorMessage = signUpData?.error?.message || 'Unknown error';
      if (errorMessage === 'EMAIL_EXISTS') {
        return {
          statusCode: 409, headers,
          body: JSON.stringify({ error: '이미 존재하는 아이디입니다' })
        };
      }
      if (errorMessage.startsWith('WEAK_PASSWORD')) {
        return {
          statusCode: 400, headers,
          body: JSON.stringify({ error: '비밀번호가 너무 약합니다 (6자 이상 필요)' })
        };
      }
      throw new Error(`Firebase Auth 계정 생성 실패: ${errorMessage}`);
    }

    // 새 ID 생성 (기존 managers 중 최대 id + 1) - null 항목 필터링
    const existingIds = Object.values(managersData).filter(m => m && typeof m === 'object').map(m => Number(m.id) || 0);
    const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    // managers에 저장 (Firebase RTDB REST API)
    const newManager = {
      id: newId,
      name,
      username,
      color: color || '#3b82f6',
      role: autoRole,
      promo: { '명함': 0, '브로셔': 0, '전단지': 0, '쿠폰': 0 },
      createdAt: new Date().toISOString()
    };

    const putRes = await fetch(`${DATABASE_URL}/managers/${newId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newManager)
    });

    if (!putRes.ok) {
      throw new Error(`RTDB managers 저장 실패: ${putRes.status}`);
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        success: true,
        message: `${name}(${username}) 계정이 생성되었습니다`,
        manager: newManager
      })
    };
  } catch (error) {
    console.error('Create account error:', error);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: '계정 생성 실패: ' + error.message })
    };
  }
}
