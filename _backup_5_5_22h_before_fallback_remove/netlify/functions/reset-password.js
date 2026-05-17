// 팀원 비밀번호 초기화 Netlify Function
// Firebase Admin SDK를 사용하여 다른 사용자의 비밀번호를 변경합니다.
//
// 필요한 Netlify 환경변수:
//   FIREBASE_SERVICE_ACCOUNT - Firebase 서비스 계정 JSON 문자열
//     (Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성)
//
// 환경변수가 없으면 Firebase Web API Key를 사용한 대체 방법을 시도합니다.

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
    const { email, newPassword, adminKey } = JSON.parse(event.body);

    // 간단한 관리자 인증
    if (adminKey !== 'beancraft-admin-reset-2024') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: '권한이 없습니다' }) };
    }

    if (!email || !newPassword) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: '이메일과 새 비밀번호를 입력하세요' }) };
    }

    // Firebase Admin SDK 초기화 시도
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountJson) {
      // Firebase Admin SDK 사용
      const admin = await import('firebase-admin');

      if (!admin.default.apps.length) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.default.initializeApp({
          credential: admin.default.credential.cert(serviceAccount),
          databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app'
        });
      }

      try {
        // 기존 사용자 찾기
        const userRecord = await admin.default.auth().getUserByEmail(email);
        // 비밀번호 변경
        await admin.default.auth().updateUser(userRecord.uid, { password: newPassword });

        return {
          statusCode: 200, headers,
          body: JSON.stringify({ success: true, message: `${email} 비밀번호가 초기화되었습니다.` })
        };
      } catch (adminError) {
        if (adminError.code === 'auth/user-not-found') {
          // 사용자가 없으면 새로 생성
          await admin.default.auth().createUser({ email, password: newPassword });
          return {
            statusCode: 200, headers,
            body: JSON.stringify({ success: true, message: `${email} 계정이 새로 생성되었습니다.` })
          };
        }
        throw adminError;
      }
    } else {
      // Firebase Admin SDK가 없으면 RTDB에 리셋 플래그 저장
      // (클라이언트에서 RTDB 플래그를 확인하여 처리)
      const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY;
      const DATABASE_URL = process.env.VITE_FIREBASE_DATABASE_URL || 'https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app';

      if (!FIREBASE_API_KEY) {
        return {
          statusCode: 500, headers,
          body: JSON.stringify({ error: 'FIREBASE_SERVICE_ACCOUNT 또는 VITE_FIREBASE_API_KEY 환경변수가 필요합니다.' })
        };
      }

      // Firebase REST API로 RTDB에 직접 쓰기
      const username = email.split('@')[0];
      const resetData = { newPassword, requestedAt: new Date().toISOString() };

      const dbRes = await fetch(`${DATABASE_URL}/passwordResets/${username}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resetData)
      });

      if (!dbRes.ok) {
        const errText = await dbRes.text();
        return {
          statusCode: 500, headers,
          body: JSON.stringify({ error: 'DB 저장 실패: ' + errText })
        };
      }

      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          method: 'rtdb-flag',
          message: `비밀번호 초기화 요청이 등록되었습니다. ${email} 사용자가 다음 로그인 시 새 비밀번호로 접속할 수 있습니다.\n\n(Firebase Admin SDK 설정 시 즉시 변경 가능)`
        })
      };
    }
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: '비밀번호 초기화 실패: ' + error.message })
    };
  }
}
