/**
 * dlsite-scraper.js  v2.0
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
 *
 * 変更履歴：
 *   v2.0 - 価格・タイトル・画像・タグの取得精度向上
 *          拡張フィールド追加（rating / category / createdAt）
 *          null安全・エラー耐性強化
 *          ログ表示の改善
 */

'use strict';

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

// =====================================================
// ① 設定（1箇所を変えるだけで全体に反映）
// =====================================================

const CONFIG = {
  // 出力ファイルのパス
  OUTPUT_FILE: path.join(__dirname, 'works.json'),

  // リクエスト間隔（ミリ秒）：MIN〜MAX のランダム待機
  WAIT_MIN_MS: 5000,
  WAIT_MAX_MS: 10000,

  // description の最大文字数
  DESC_MAX_LENGTH: 120,

  // HTTP タイムアウト（ミリ秒）
  TIMEOUT_MS: 15000,

  // User-Agent（一般的なブラウザに偽装）
  USER_AGENT:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/124.0.0.0 Safari/537.36',

  // タグの最大取得件数
  TAG_MAX: 10,
};

// =====================================================
// 取得対象URLリスト
// ここに DLsite の作品ページ URL を追加してください
// 例: 'https://www.dlsite.com/maniax/work/=/product_id/RJ000000.html'
// =====================================================

const TARGET_URLS = [
  // ↓ ここに URL を貼り付けてください
  // 'https://www.dlsite.com/maniax/work/=/product_id/RJxxxxxx.html',
];

// =====================================================
// ② ログ出力
//    レベルごとにアイコン・色を変えて見やすく表示
// =====================================================

const LOG_FORMAT = {
  INFO:  { icon: '📋', label: 'INFO ' },
  SKIP:  { icon: '⏭️ ', label: 'SKIP ' },
  OK:    { icon: '✅', label: 'OK   ' },
  ERROR: { icon: '❌', label: 'ERROR' },
  WARN:  { icon: '⚠️ ', label: 'WARN ' },
  START: { icon: '🚀', label: 'START' },
  SAVE:  { icon: '💾', label: 'SAVE ' },
};

/**
 * タイムスタンプ付きログ出力
 * @param {keyof LOG_FORMAT} level
 * @param {string} message
 */
function log(level, message) {
  const time   = new Date().toLocaleTimeString('ja-JP');
  const format = LOG_FORMAT[level] ?? { icon: '  ', label: level };
  console.log(`[${time}] ${format.icon} [${format.label}] ${message}`);
}

// =====================================================
// ③ 汎用ユーティリティ
// =====================================================

/**
 * MIN〜MAX ミリ秒のランダム待機
 */
function randomWait(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  log('INFO', `次のリクエストまで ${(ms / 1000).toFixed(1)} 秒待機中…`);
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * HTML タグ除去 ＋ HTMLエンティティ変換
 * @param {string|null|undefined} html
 * @returns {string}
 */
function stripTags(html) {
  if (!html) return '';
  // よく使われるエンティティを変換してからタグを除去
  return html
    .replace(/&amp;/gi,  '&')
    .replace(/&lt;/gi,   '<')
    .replace(/&gt;/gi,   '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 文字列を maxLength 文字以内に短縮（超えたら末尾に「…」）
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength
    ? text.slice(0, maxLength - 1) + '…'
    : text;
}

/**
 * 文字列が日本語を含むか判定（英語のみのタグを除外するために使用）
 * @param {string} str
 * @returns {boolean}
 */
function containsJapanese(str) {
  // ひらがな・カタカナ・漢字のいずれかが含まれれば true
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(str);
}

// =====================================================
// ④ URLからカテゴリを推定
//    DLsite のサブドメイン・パスから分類する
// =====================================================

/**
 * URLのパスからカテゴリを推定する
 * @param {string} url
 * @returns {string}
 */
function detectCategory(url) {
  if (/\/maniax\//.test(url))  return 'R18';
  if (/\/home\//.test(url))    return '全年齢';
  if (/\/books\//.test(url))   return '電子書籍';
  if (/\/soft\//.test(url))    return 'ゲーム';
  if (/\/comic\//.test(url))   return 'マンガ';
  return '不明';
}

// =====================================================
// ⑤ 各フィールドの抽出関数（責務を1関数1項目に分離）
//    HTML構造が変わっても各関数だけ修正すればOK
// =====================================================

/**
 * 作品ID を URL から抽出する
 * @param {string} url
 * @returns {string|null}
 */
function extractId(url) {
  const m = url.match(/product_id\/((?:RJ|BJ|VJ|AJ)\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * タイトルを抽出・整形する
 *
 * 改善点：
 *   - og:title → <title> の順にフォールバック
 *   - 「| DLsite」「- DLsite」などの接尾辞を正規表現で完全除去
 *   - サイト名パターンを複数対応
 *
 * @param {string} html
 * @returns {string}
 */
function extractTitle(html) {
  // パターン1: og:title メタタグ（最も信頼性が高い）
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  // パターン2: <title> タグ（フォールバック）
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);

  const raw = ogMatch?.[1] ?? titleMatch?.[1] ?? '';

  return stripTags(raw)
    // 「| DLsite」「- DLsite」「【DLsite】」などを除去
    .replace(/[\|｜\-\s]*DLsite[^\s]*/gi, '')
    // 「| 同人誌・同人ゲーム」などサイト名の付属情報を除去
    .replace(/[\|｜]\s*同人.*/g, '')
    .trim();
}

/**
 * サークル名を抽出する
 *
 * 改善点：
 *   - 複数のHTMLパターンに対応
 *
 * @param {string} html
 * @returns {string}
 */
function extractCircle(html) {
  // パターン1: maker_name クラス内の <a> タグ
  const p1 = html.match(
    /<[^>]+class=["'][^"']*maker_name[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i
  );
  if (p1) return stripTags(p1[1]);

  // パターン2: itemprop="brand" または itemprop="author"
  const p2 = html.match(/itemprop=["'](?:brand|author)["'][^>]*>([^<]+)</i);
  if (p2) return stripTags(p2[1]);

  return '';
}

/**
 * 価格を抽出する
 *
 * 改善点：
 *   - 4パターンの価格表示に対応
 *   - 割引後価格を優先取得
 *   - カンマ付き数値（1,100円）にも対応
 *
 * @param {string} html
 * @returns {string}
 */
function extractPrice(html) {
  // パターン1: 割引後価格クラス（優先）
  // <span class="work_price">550円</span>
  const p1 = html.match(
    /<[^>]+class=["'][^"']*work_price[^"']*["'][^>]*>\s*([\d,]+)\s*円/i
  );
  if (p1) return `${p1[1]}円`;

  // パターン2: price_base などの価格クラス
  const p2 = html.match(
    /<[^>]+class=["'][^"']*price(?:_base|_sale|_num)?[^"']*["'][^>]*>\s*([\d,]+)\s*円/i
  );
  if (p2) return `${p2[1]}円`;

  // パターン3: meta タグの価格情報
  // <meta itemprop="price" content="550" />
  const p3 = html.match(/itemprop=["']price["'][^>]+content=["']([\d.]+)["']/i);
  if (p3) {
    const yen = Math.round(parseFloat(p3[1]));
    return `${yen.toLocaleString()}円`;
  }

  // パターン4: テキスト中の価格パターン（最終手段）
  // 「550円」「1,100円」などの文字列を直接検索
  const p4 = html.match(/(\d{2,5}(?:,\d{3})*)\s*円/);
  if (p4) return `${p4[1]}円`;

  return '価格不明';
}

/**
 * 説明文を抽出・整形する
 * @param {string} html
 * @returns {string}
 */
function extractDescription(html) {
  // パターン1: og:description メタタグ
  const p1 = html.match(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{5,})["']/i
  );
  if (p1) return truncate(stripTags(p1[1]), CONFIG.DESC_MAX_LENGTH);

  // パターン2: name="description" メタタグ
  const p2 = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{5,})["']/i
  );
  if (p2) return truncate(stripTags(p2[1]), CONFIG.DESC_MAX_LENGTH);

  return '';
}

/**
 * サムネイル画像URLを抽出する
 *
 * 改善点：
 *   - 3段階のフォールバック
 *
 * @param {string} html
 * @returns {string}
 */
function extractImage(html) {
  // パターン1: og:image（最も確実）
  const p1 = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );
  if (p1?.[1]) return p1[1];

  // パターン2: twitter:image
  const p2 = html.match(
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
  );
  if (p2?.[1]) return p2[1];

  // パターン3: img タグの src で DLsite の画像CDNを使っているもの
  const p3 = html.match(/<img[^>]+src=["'](https?:\/\/img\.dlsite\.jp[^"']+)["']/i);
  if (p3?.[1]) return p3[1];

  return '';
}

/**
 * タグ一覧を抽出する
 *
 * 改善点：
 *   - 日本語タグのみ抽出（英語ノイズを除外）
 *   - Set を使って完全に重複排除
 *   - 3パターンのフォールバック
 *
 * @param {string} html
 * @returns {string[]}
 */
function extractTags(html) {
  // Set で重複を完全排除
  const tagSet = new Set();

  /**
   * タグ候補文字列を検証・追加するヘルパー
   * @param {string} raw
   */
  const addTag = (raw) => {
    const tag = stripTags(raw).trim();
    if (
      tag.length >= 2 &&          // 1文字のノイズを除外
      tag.length <= 20 &&         // 異常に長いものを除外
      containsJapanese(tag)       // 日本語を含むものだけ
    ) {
      tagSet.add(tag);
    }
  };

  // パターン1: work_genre セクション内の <a> タグ
  const genreSection = html.match(
    /<div[^>]+id=["']work_genre["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (genreSection) {
    for (const m of genreSection[1].matchAll(/<a[^>]*>([^<]{2,})<\/a>/gi)) {
      addTag(m[1]);
    }
  }

  // パターン2: itemprop="genre" 属性を持つ要素
  for (const m of html.matchAll(/itemprop=["']genre["'][^>]*>([^<]{2,})</gi)) {
    addTag(m[1]);
  }

  // パターン3: keywords メタタグ（上の2パターンで取れなかった場合のみ）
  if (tagSet.size === 0) {
    const kwMatch = html.match(
      /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i
    );
    if (kwMatch) {
      kwMatch[1].split(/[,、]/).forEach(k => addTag(k));
    }
  }

  // Set → 配列に変換して最大件数で切り捨て
  return [...tagSet].slice(0, CONFIG.TAG_MAX);
}

// =====================================================
// ⑥ HTMLパーサー本体
//    各抽出関数を呼び出してオブジェクトにまとめる
//    ⑦ 拡張フィールド（rating / category / createdAt）追加
// =====================================================

/**
 * DLsite 作品ページの HTML から作品情報オブジェクトを生成する
 * @param {string} html  取得した HTML
 * @param {string} url   作品ページURL
 * @returns {object|null} 作品情報、取得失敗なら null
 */
function parseWorkPage(html, url) {
  try {
    // 各フィールドを専用関数で抽出
    const id          = extractId(url);
    const title       = extractTitle(html);
    const circle      = extractCircle(html);
    const price       = extractPrice(html);
    const description = extractDescription(html);
    const img         = extractImage(html);
    const tags        = extractTags(html);
    const category    = detectCategory(url);

    // タイトルが取れなければ解析失敗
    if (!title) {
      log('WARN', `タイトルを取得できませんでした → ${url}`);
      return null;
    }

    // 取得結果をまとめたオブジェクト
    return {
      // ── 基本情報 ──────────────────────────────
      id,           // 例: "RJ123456"
      title,        // 作品タイトル
      circle,       // サークル名
      price,        // 価格（例: "550円"）
      description,  // 説明文（最大120文字）
      img,          // サムネイルURL
      tags,         // タグ配列（日本語のみ・最大10件）
      url,          // 元の作品ページURL

      // ── カテゴリ（URLから自動推定） ────────────
      // 例: "R18" / "全年齢" / "ゲーム" など
      category,

      // ── 拡張フィールド（後から手動で追記する用） ──
      // healing: 癒し度（0〜5）　後で手動入力
      // ero:     抜き度（0〜5）  後で手動入力
      healing: null,
      ero:     null,

      // rating: 総合評価（後でClaudeや手動で設定する用途）
      // 例: { score: 4.5, count: 120 }
      rating: null,

      // ── 管理用タイムスタンプ ───────────────────
      // createdAt: 初回取得日時（一度保存したら上書きしない）
      createdAt: new Date().toISOString(),
      // fetchedAt: 最終取得日時（再取得のたびに更新する用途）
      fetchedAt: new Date().toISOString(),
    };

  } catch (e) {
    // ⑧ HTML解析中の予期しないエラーをキャッチして null を返す
    log('ERROR', `HTML解析エラー: ${e.message}`);
    return null;
  }
}

// =====================================================
// ⑦ JSON ファイル操作
// =====================================================

/**
 * works.json を読み込む（なければ空配列を返す）
 * @returns {object[]}
 */
function loadWorks() {
  if (!fs.existsSync(CONFIG.OUTPUT_FILE)) {
    log('INFO', `works.json が見つからないため新規作成します`);
    return [];
  }
  try {
    const raw  = fs.readFileSync(CONFIG.OUTPUT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const arr  = Array.isArray(data) ? data : [];
    log('INFO', `既存データ ${arr.length} 件を読み込みました`);
    return arr;
  } catch (e) {
    log('WARN', `JSON 読み込みエラー → 空配列で初期化: ${e.message}`);
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
    JSON.stringify(works, null, 2),
    'utf-8'
  );
  log('SAVE', `works.json に ${works.length} 件保存しました`);
}

// =====================================================
// ⑧ HTTP 取得
// =====================================================

/**
 * 1件のURLからHTMLを取得してパースする
 * @param {string} url
 * @returns {Promise<object|null>}
 */
async function fetchWork(url) {
  log('INFO', `取得開始 → ${url}`);

  const response = await axios.get(url, {
    timeout: CONFIG.TIMEOUT_MS,
    headers: {
      'User-Agent':      CONFIG.USER_AGENT,
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Accept':          'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'Cache-Control':   'no-cache',
    },
    maxRedirects: 5,
    // ⑧ レスポンスのエンコーディングを明示（文字化け防止）
    responseEncoding: 'utf8',
  });

  const work = parseWorkPage(response.data, url);

  if (work) {
    // 取得成功時に詳細をログ出力
    log('OK', [
      `「${work.title}」`,
      `| ${work.circle || 'サークル不明'}`,
      `| ${work.price}`,
      `| タグ: ${work.tags.length > 0 ? work.tags.join('・') : 'なし'}`,
    ].join(' '));
  }

  return work;
}

// =====================================================
// メイン処理
// =====================================================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   DLsite スクレイパー v2.0  起動      ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (TARGET_URLS.length === 0) {
    log('WARN', 'TARGET_URLS が空です。URLを追加してから実行してください。');
    return;
  }

  log('START', `対象URL: ${TARGET_URLS.length} 件`);

  // 既存データ読み込み＋キャッシュ構築
  const works      = loadWorks();
  const cachedUrls = new Set(works.map(w => w.url));

  let added   = 0;
  let skipped = 0;
  let errors  = 0;

  for (let i = 0; i < TARGET_URLS.length; i++) {
    const url = TARGET_URLS[i].trim();
    const progress = `[${i + 1}/${TARGET_URLS.length}]`;

    // ── キャッシュチェック（取得済みはスキップ）────
    if (cachedUrls.has(url)) {
      log('SKIP', `${progress} 取得済みのためスキップ → ${url}`);
      skipped++;
      continue;
    }

    // ── HTTP 取得 ────────────────────────────────
    try {
      const work = await fetchWork(url);

      if (work) {
        works.push(work);
        cachedUrls.add(url);
        added++;
        saveWorks(works); // 1件ごとに即保存（途中終了対策）
      } else {
        log('WARN', `${progress} データ取得失敗（HTMLパース不可）→ ${url}`);
        errors++;
      }

    } catch (e) {
      // ⑧ エラーが起きても次のURLへ続行
      const status  = e.response?.status ?? 'N/A';
      const message = e.code === 'ECONNABORTED' ? 'タイムアウト' : e.message;
      log('ERROR', `${progress} HTTP ${status} → ${message} [${url}]`);
      errors++;
    }

    // ── 次のURLまで待機（最後だけスキップ）────────
    if (i < TARGET_URLS.length - 1) {
      await randomWait(CONFIG.WAIT_MIN_MS, CONFIG.WAIT_MAX_MS);
    }
  }

  // ── 完了サマリー ──────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║           完了サマリー                ║');
  console.log(`║  ✅ 新規追加 : ${String(added).padStart(3)}  件                ║`);
  console.log(`║  ⏭️  スキップ : ${String(skipped).padStart(3)}  件（取得済み）     ║`);
  console.log(`║  ❌ エラー   : ${String(errors).padStart(3)}  件                ║`);
  console.log(`║  💾 合計保存 : ${String(works.length).padStart(3)}  件                ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  if (errors > 0) {
    log('WARN', `${errors} 件のエラーがありました。URLと対象ページを確認してください。`);
  }
}

// 起動
main().catch(e => {
  log('ERROR', `予期しないエラーで終了: ${e.message}`);
  process.exit(1);
});
