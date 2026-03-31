/**
 * dlsite-scraper.js
 *
 * DLsiteの作品ページから情報を取得して works.json に追記保存するスクリプト。
 *
 * 使い方：
 *   1. npm install axios  （初回のみ）
 *   2. スクリプト下部の TARGET_URLS に対象URLを追加
 *   3. node dlsite-scraper.js
 *
 * ⚠️ 注意
 *   - リクエスト間隔は 5〜10 秒のランダム待機で低負荷設計
 *   - 過度なアクセスは利用規約違反になります
 *   - 個人の学習・研究目的の範囲で使用してください
 */

'use strict';

const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');

// =====================================================
// 設定
// =====================================================

const CONFIG = {
  // 出力ファイルのパス（実行ディレクトリに保存）
  OUTPUT_FILE: path.join(__dirname, 'works.json'),

  // リクエスト間隔（ミリ秒）：MIN〜MAXのランダム
  WAIT_MIN_MS: 5000,
  WAIT_MAX_MS: 10000,

  // description の最大文字数（超えたら末尾を「…」で短縮）
  DESC_MAX_LENGTH: 120,

  // HTTPタイムアウト（ミリ秒）
  TIMEOUT_MS: 15000,

  // User-Agent（一般的なブラウザに見せる）
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36',
};

// =====================================================
// 取得対象URLリスト
// ここに DLsite の作品ページ URL を追加してください
// 例: 'https://www.dlsite.com/maniax/work/=/product_id/RJ000000.html'
// =====================================================

const TARGET_URLS = [
  // ↓ ここに URL を貼り付けてください
  // 'https://www.dlsite.com/maniax/work/=/product_id/RJxxxxxx.html',
  // 'https://www.dlsite.com/maniax/work/=/product_id/RJyyyyyy.html',
];

// =====================================================
// ログ出力ヘルパー
// =====================================================

/**
 * タイムスタンプ付きでコンソールに出力する
 * @param {'INFO'|'SKIP'|'OK'|'ERROR'|'WARN'} level
 * @param {string} message
 */
function log(level, message) {
  const time  = new Date().toLocaleTimeString('ja-JP');
  const icons = { INFO: '📋', SKIP: '⏭️ ', OK: '✅', ERROR: '❌', WARN: '⚠️ ' };
  const icon  = icons[level] ?? '  ';
  console.log(`[${time}] ${icon} [${level}] ${message}`);
}

// =====================================================
// ユーティリティ
// =====================================================

/**
 * MIN〜MAX ミリ秒のランダム待機
 */
function randomWait(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  log('INFO', `次のリクエストまで ${(ms / 1000).toFixed(1)} 秒待機…`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 文字列を maxLength 以内に短縮する（超えた場合は末尾に「…」）
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength) {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim(); // 改行・連続空白を1スペースに
  return cleaned.length > maxLength
    ? cleaned.slice(0, maxLength - 1) + '…'
    : cleaned;
}

/**
 * HTML タグを除去したプレーンテキストを返す
 * @param {string} html
 * @returns {string}
 */
function stripTags(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, c => {
    // よく使われる HTML エンティティを変換
    const entities = {
      '&amp;': '&', '&lt;': '<', '&gt;': '>',
      '&quot;': '"', '&#039;': "'", '&nbsp;': ' ',
    };
    return entities[c] ?? c;
  });
}

// =====================================================
// JSON ファイル操作
// =====================================================

/**
 * works.json を読み込む（なければ空配列を返す）
 * @returns {object[]} 既存の作品配列
 */
function loadWorks() {
  if (!fs.existsSync(CONFIG.OUTPUT_FILE)) {
    log('INFO', `${CONFIG.OUTPUT_FILE} が存在しないため新規作成します`);
    return [];
  }
  try {
    const raw  = fs.readFileSync(CONFIG.OUTPUT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    log('INFO', `既存データ ${data.length} 件を読み込みました`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    log('WARN', `JSON 解析エラー。空配列で初期化します: ${e.message}`);
    return [];
  }
}

/**
 * 作品配列を works.json に書き込む
 * @param {object[]} works
 */
function saveWorks(works) {
  fs.writeFileSync(
    CONFIG.OUTPUT_FILE,
    JSON.stringify(works, null, 2), // 読みやすいインデント付き
    'utf-8'
  );
  log('OK', `${CONFIG.OUTPUT_FILE} に ${works.length} 件保存しました`);
}

// =====================================================
// HTML パーサー
// 正規表現で必要な情報を抽出する
// =====================================================

/**
 * DLsite 作品ページの HTML から作品情報を抽出する
 * @param {string} html   取得した HTML 文字列
 * @param {string} url    元のURL（id 抽出に使用）
 * @returns {object|null} 作品情報オブジェクト、失敗時は null
 */
function parseWorkPage(html, url) {
  try {
    // ── 作品ID（RJxxxxxx 形式）──────────────────────
    const idMatch = url.match(/product_id\/(RJ\d+|BJ\d+|VJ\d+)/i);
    const workId  = idMatch ? idMatch[1] : null;

    // ── タイトル ──────────────────────────────────
    // <meta property="og:title" content="作品タイトル" />
    const titleMatch = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    ) || html.match(/<title>([^<]+)<\/title>/i);
    const title = stripTags(titleMatch?.[1] ?? '').replace(' | DLsite', '').trim();

    // ── サークル名 ────────────────────────────────
    // <span class="maker_name"><a ...>サークル名</a></span>
    const circleMatch = html.match(
      /<span[^>]+class=["'][^"']*maker_name[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i
    );
    const circle = stripTags(circleMatch?.[1] ?? '').trim();

    // ── 価格 ──────────────────────────────────────
    // <span class="strike">1,100円</span> or <span ...>550円</span>
    const priceMatch = html.match(
      /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?([\d,]+)円/i
    );
    const price = priceMatch ? `${priceMatch[1]}円` : '価格不明';

    // ── 説明文 ────────────────────────────────────
    // <meta name="description" content="..." />
    const descMatch = html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,})["']/i
    );
    const description = truncate(
      stripTags(descMatch?.[1] ?? ''),
      CONFIG.DESC_MAX_LENGTH
    );

    // ── サムネイル画像URL ─────────────────────────
    // <meta property="og:image" content="https://..." />
    const imgMatch = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );
    const img = imgMatch?.[1] ?? '';

    // ── タグ（複数） ──────────────────────────────
    // <div class="main_genre"><a href="...">タグ名</a></div>
    // <a href="/maniax/fsr/=/keyword_creater/...">タグ名</a> など
    const tags = [];

    // パターン1: work_genre の a タグ
    const genreSection = html.match(
      /<div[^>]+id=["']work_genre["'][^>]*>([\s\S]*?)<\/div>/i
    );
    if (genreSection) {
      const genreTags = genreSection[1].matchAll(/<a[^>]*>([^<]+)<\/a>/gi);
      for (const m of genreTags) {
        const tag = stripTags(m[1]).trim();
        if (tag && !tags.includes(tag)) tags.push(tag);
      }
    }

    // パターン2: itemprop="genre" を持つ要素
    const genreItems = html.matchAll(
      /itemprop=["']genre["'][^>]*>([^<]+)</gi
    );
    for (const m of genreItems) {
      const tag = stripTags(m[1]).trim();
      if (tag && !tags.includes(tag)) tags.push(tag);
    }

    // パターン3: keyword メタタグ（補完用）
    if (tags.length === 0) {
      const kwMatch = html.match(
        /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i
      );
      if (kwMatch) {
        kwMatch[1].split(/[,、]/).forEach(k => {
          const tag = k.trim();
          if (tag && !tags.includes(tag)) tags.push(tag);
        });
      }
    }

    // タイトルが取れなければ解析失敗とみなす
    if (!title) {
      log('WARN', `タイトルを取得できませんでした: ${url}`);
      return null;
    }

    return {
      id:          workId,
      title,
      circle,
      price,
      description,
      img,
      tags:        tags.slice(0, 10), // タグは最大10件
      url,
      fetchedAt:   new Date().toISOString(),
    };

  } catch (e) {
    log('ERROR', `HTML 解析中にエラー: ${e.message}`);
    return null;
  }
}

// =====================================================
// メイン処理
// =====================================================

/**
 * 1件の URL から情報を取得して返す
 * @param {string} url
 * @returns {object|null}
 */
async function fetchWork(url) {
  log('INFO', `取得中: ${url}`);

  const response = await axios.get(url, {
    timeout: CONFIG.TIMEOUT_MS,
    headers: {
      'User-Agent':      CONFIG.USER_AGENT,
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    // リダイレクトを自動でたどる
    maxRedirects: 5,
  });

  const work = parseWorkPage(response.data, url);
  if (work) {
    log('OK', `取得完了: ${work.title}（タグ: ${work.tags.join(', ') || 'なし'}）`);
  }
  return work;
}

/**
 * エントリポイント
 * すべての URL を順番に処理する
 */
async function main() {
  console.log('');
  console.log('========================================');
  console.log('  DLsite スクレイパー 起動');
  console.log('========================================');
  console.log('');

  // URL が指定されていなければ終了
  if (TARGET_URLS.length === 0) {
    log('WARN', 'TARGET_URLS が空です。スクリプト下部にURLを追加してください。');
    return;
  }

  // 既存データを読み込む
  const works      = loadWorks();
  // 既に取得済みのURLをセットに格納（高速なキャッシュ判定）
  const cachedUrls = new Set(works.map(w => w.url));

  let added   = 0; // 新規追加件数
  let skipped = 0; // スキップ件数
  let errors  = 0; // エラー件数

  for (let i = 0; i < TARGET_URLS.length; i++) {
    const url = TARGET_URLS[i].trim();

    // ── キャッシュチェック ───────────────────────
    // 既に取得済みの URL はスキップ
    if (cachedUrls.has(url)) {
      log('SKIP', `取得済みのためスキップ: ${url}`);
      skipped++;
      continue;
    }

    // ── HTTP リクエスト ──────────────────────────
    try {
      const work = await fetchWork(url);

      if (work) {
        works.push(work);
        cachedUrls.add(url); // キャッシュを更新
        added++;

        // 取得成功のたびに保存（途中終了しても消えない）
        saveWorks(works);
      } else {
        log('WARN', `データを取得できませんでした: ${url}`);
        errors++;
      }

    } catch (e) {
      // エラーが起きても次のURLの処理を続ける
      const status = e.response?.status ?? 'N/A';
      log('ERROR', `リクエスト失敗 [HTTP ${status}]: ${url} → ${e.message}`);
      errors++;
    }

    // ── 最後の URL 以外は待機 ────────────────────
    const isLast = i === TARGET_URLS.length - 1;
    if (!isLast) {
      await randomWait(CONFIG.WAIT_MIN_MS, CONFIG.WAIT_MAX_MS);
    }
  }

  // ── 結果サマリー ─────────────────────────────
  console.log('');
  console.log('========================================');
  console.log('  完了サマリー');
  console.log(`  新規追加 : ${added} 件`);
  console.log(`  スキップ : ${skipped} 件（取得済み）`);
  console.log(`  エラー   : ${errors} 件`);
  console.log(`  合計保存 : ${works.length} 件`);
  console.log('========================================');
  console.log('');
}

// 起動
main().catch(e => {
  log('ERROR', `予期しないエラーで終了: ${e.message}`);
  process.exit(1);
});
