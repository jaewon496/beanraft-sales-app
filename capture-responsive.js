const puppeteer = require('puppeteer');
const path = require('path');

const TARGET_URL = 'http://localhost:5173';
const DESKTOP_DIR = path.resolve('C:/Users/user/OneDrive/바탕 화면');

const SESSION_DATA = JSON.stringify({
  user: {
    name: '조희재',
    role: 'manager',
    managerId: 2,
    username: 'sm002',
    email: 'sm002@beancraft.com'
  },
  expiry: 9999999999999
});

const APP_VERSION = '2026.01.30.v6-firebase-fix';

const VIEWPORTS = [
  { name: 'PC', width: 1280, height: 900, filename: '중개사모드_PC_1280.png' },
  { name: '태블릿', width: 768, height: 1024, filename: '중개사모드_태블릿_768.png' },
  { name: '모바일', width: 375, height: 812, filename: '중개사모드_모바일_375.png' },
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function debugScreenshot(page, label) {
  const debugPath = path.join(DESKTOP_DIR, 'debug_responsive_' + label + '.png');
  await page.screenshot({ path: debugPath, fullPage: true });
  console.log('  -> Debug screenshot: ' + debugPath);
}

// Find the smallest (most specific / leaf-like) visible element containing exact or partial text
// and click it using Puppeteer mouse click (not el.click()) for better event handling
async function findAndClickText(page, searchText, options) {
  options = options || {};
  const exact = options.exact || false;
  const timeout = options.timeout || 10000;
  const desc = options.desc || searchText;

  console.log('  -> Finding & clicking: "' + desc + '"');

  const start = Date.now();
  while (Date.now() - start < timeout) {
    // Find the best matching element (smallest textContent length that still contains the text)
    const box = await page.evaluate((searchText, exact) => {
      const candidates = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') continue;
        const text = el.textContent.trim();
        const match = exact ? (text === searchText) : text.includes(searchText);
        if (match) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            candidates.push({
              textLen: text.length,
              tag: el.tagName,
              text: text.substring(0, 80),
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
              w: rect.width,
              h: rect.height
            });
          }
        }
      }
      if (candidates.length === 0) return null;
      // Sort by text length ascending to find the most specific element
      candidates.sort((a, b) => a.textLen - b.textLen);
      return candidates[0];
    }, searchText, exact);

    if (box) {
      console.log('     Found: <' + box.tag + '> "' + box.text.substring(0, 40) + '" at (' + Math.round(box.x) + ',' + Math.round(box.y) + ')');
      await page.mouse.click(box.x, box.y);
      console.log('     OK (mouse clicked)');
      return true;
    }
    await sleep(500);
  }

  console.log('     WARN: "' + desc + '" not found within ' + timeout + 'ms');
  return false;
}

(async () => {
  console.log('=== 중개사모드 소개 탭 반응형 스크린샷 캡처 ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--window-size=1280,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // ===== Step 1: Load page & inject session =====
    console.log('[1/7] 페이지 로드 및 세션 주입...');
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(1000);

    await page.evaluate((sessionStr, appVer) => {
      localStorage.setItem('bc_session', sessionStr);
      localStorage.setItem('bc_app_version', appVer);
    }, SESSION_DATA, APP_VERSION);
    console.log('  -> localStorage 주입 완료');

    // ===== Step 2: Reload =====
    console.log('[2/7] 리로드 후 5초 대기...');
    await page.reload({ waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(5000);

    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 300));
    console.log('  -> 현재 텍스트:', pageText.substring(0, 150).replace(/\n/g, ' | '));

    // ===== Step 3: Click 설정 (sidebar) =====
    console.log('[3/7] "설정" 클릭...');
    const settingsOk = await findAndClickText(page, '설정', { exact: true, desc: '설정 (sidebar)' });
    if (!settingsOk) {
      await debugScreenshot(page, 'settings_fail');
      throw new Error('설정을 찾을 수 없습니다');
    }
    await sleep(2000);

    // ===== Step 4: Click 영업모드 (tab) =====
    console.log('[4/7] "영업모드" 탭 클릭...');
    // On the settings page, there are tabs: 나의 알림, 영업모드, 계정
    // We need to click the tab labeled "영업모드" (exact)
    const salesTabOk = await findAndClickText(page, '영업모드', { exact: true, desc: '영업모드 탭' });
    if (!salesTabOk) {
      await debugScreenshot(page, 'salestab_fail');
      throw new Error('영업모드 탭을 찾을 수 없습니다');
    }
    await sleep(1500);
    await debugScreenshot(page, 'after_salestab');

    // ===== Step 5: Click 영업모드 시작 (button) =====
    console.log('[5/7] "영업모드 시작" 버튼 클릭...');
    const startOk = await findAndClickText(page, '영업모드 시작', { exact: true, desc: '영업모드 시작 버튼' });
    if (!startOk) {
      await debugScreenshot(page, 'start_fail');
      throw new Error('영업모드 시작 버튼을 찾을 수 없습니다');
    }
    await sleep(3000);

    // Verify: check if page changed (should no longer show "영업모드 시작" button,
    // or should show a different view)
    await debugScreenshot(page, 'after_start');
    const afterStartText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log('  -> 영업모드 진입 후 텍스트:', afterStartText.substring(0, 250).replace(/\n/g, ' | '));

    // Check if we see the sales mode cards (중개사, 카페, etc.)
    const hasBrokerCard = afterStartText.includes('중개사');
    console.log('  -> 중개사 카드 존재:', hasBrokerCard);

    // ===== Step 6: Click 중개사 card =====
    console.log('[6/7] "중개사" 카드 클릭...');

    // In sales mode, there should be cards. We need to click the one that says "중개사"
    // But be careful not to click the sidebar "중개사" nav item
    // Strategy: find elements with "중개사" that are NOT in the sidebar (i.e., in the main content area)
    const brokerClicked = await page.evaluate(() => {
      const candidates = [];
      const all = document.querySelectorAll('*');
      for (const el of all) {
        if (el.offsetParent === null && el.tagName !== 'BODY' && el.tagName !== 'HTML') continue;
        const text = el.textContent.trim();
        if (!text.includes('중개사')) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        // Skip elements that are in the sidebar (typically x < 200 for the left nav)
        if (rect.x < 200) continue;
        candidates.push({
          textLen: text.length,
          tag: el.tagName,
          text: text.substring(0, 80),
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          w: rect.width,
          h: rect.height
        });
      }
      if (candidates.length === 0) return null;
      // Pick the most specific (smallest text) element
      candidates.sort((a, b) => a.textLen - b.textLen);
      return candidates[0];
    });

    if (brokerClicked) {
      console.log('  -> Found: <' + brokerClicked.tag + '> "' + brokerClicked.text.substring(0, 40) + '" at (' + Math.round(brokerClicked.x) + ',' + Math.round(brokerClicked.y) + ')');
      await page.mouse.click(brokerClicked.x, brokerClicked.y);
      console.log('  -> OK (mouse clicked)');
    } else {
      console.log('  -> 중개사 카드를 메인 영역에서 찾지 못함. 전체에서 시도...');
      const fallbackOk = await findAndClickText(page, '중개사', { exact: true, desc: '중개사 (fallback)', timeout: 5000 });
      if (!fallbackOk) {
        await debugScreenshot(page, 'broker_fail');
        throw new Error('중개사 카드를 찾을 수 없습니다');
      }
    }
    await sleep(3000);

    // ===== Verify: 소개 탭 도달 =====
    await debugScreenshot(page, 'after_broker');
    const brokerText = await page.evaluate(() => document.body.innerText.substring(0, 800));
    console.log('  -> 중개사 클릭 후 텍스트:', brokerText.substring(0, 300).replace(/\n/g, ' | '));

    // Check if we see the intro tab content (소개)
    const hasIntro = brokerText.includes('소개');
    console.log('  -> 소개 탭 존재:', hasIntro);

    // ===== Step 7: Capture screenshots at each viewport =====
    console.log('\n[7/7] 해상도별 스크린샷 캡처...\n');

    for (const vp of VIEWPORTS) {
      console.log('  --- ' + vp.name + ' (' + vp.width + 'x' + vp.height + ') ---');

      // Set viewport
      await page.setViewport({ width: vp.width, height: vp.height });
      await sleep(1500);

      // Scroll through page to trigger lazy loading
      await page.evaluate(async () => {
        const totalHeight = Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight
        );
        const step = 400;
        for (let pos = 0; pos < totalHeight; pos += step) {
          window.scrollTo(0, pos);
          await new Promise(r => setTimeout(r, 150));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 300));
      });
      await sleep(1000);

      const bodyHeight = await page.evaluate(() => {
        return Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.offsetHeight
        );
      });
      console.log('  -> 페이지 높이: ' + bodyHeight + 'px');

      // Capture full page screenshot
      const outputPath = path.join(DESKTOP_DIR, vp.filename);
      await page.screenshot({
        path: outputPath,
        fullPage: true
      });
      console.log('  -> 저장: ' + outputPath + '\n');
    }

    console.log('=== 모든 스크린샷 캡처 완료 ===');
    console.log('저장 위치:');
    for (const vp of VIEWPORTS) {
      console.log('  - ' + path.join(DESKTOP_DIR, vp.filename));
    }

  } catch (err) {
    console.error('\n오류 발생:', err.message);
    await debugScreenshot(page, 'error');
    console.error(err.stack);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('\n브라우저 종료.');
  }
})();
