require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { fetchAllFeeds, extractRJCode, makeAffiliateUrl } = require('./rss');

// 最大取得件数
const MAX_WORKS = 50;

// カテゴリ・タグの簡易マッピング
function guessCategory(title) {
  if (/耳かき|耳舐め/.test(title)) return '耳かき';
  if (/囁き|ささやき|ASMR/.test(title)) return '囁き';
  if (/睡眠|おやすみ|眠り/.test(title)) return '睡眠';
  if (/催眠|トランス/.test(title)) return '催眠';
  if (/癒し|リラックス/.test(title)) return '癒し';
  return 'ASMR';
}

function guessTags(title) {
  const tags = [];
  if (/耳かき/.test(title)) tags.push('耳かき');
  if (/耳舐め/.test(title)) tags.push('耳舐め');
  if (/囁き|ささやき/.test(title)) tags.push('囁き');
  if (/ASMR/.test(title)) tags.push('ASMR');
  if (/睡眠|おやすみ/.test(title)) tags.push('睡眠');
  if (/癒し/.test(title)) tags.push('癒し');
  if (/バイノーラル/.test(title)) tags.push('バイノーラル');
  if (/催眠/.test(title)) tags.push('催眠');
  if (tags.length === 0) tags.push('ASMR');
  return tags;
}

function makeCTA(category) {
  const map = {
    '耳かき':  '耳かき音声を聴いてみる →',
    '囁き':    'ひそひそ声に癒されてみる →',
    '睡眠':    '眠れる音声を聴いてみる →',
    '催眠':    '催眠音声を体験してみる →',
    '癒し':    '癒し音声を聴いてみる →',
    'ASMR':    'この作品を聴いてみる →',
  };
  return map[category] || 'この作品を聴いてみる →';
}

/**
 * RSSアイテムをworks.json形式に変換
 */
function formatWork(item) {
  const rjCode   = extractRJCode(item.link);
  const id       = rjCode || `work_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const affUrl   = makeAffiliateUrl(item.link);
  const category = guessCategory(item.title);
  const tags     = guessTags(item.title);

  // サムネイル：RJコードがあればDLsite CDNから直接取得
  const image = item.image ||
    (rjCode ? `https://img.dlsite.jp/modpub/images2/work/doujin/${rjCode.slice(0, -3)}000/${rjCode}_img_main.jpg` : '');

  return {
    id,
    title:       item.title,
    url:         affUrl,
    image,
    category,
    tags,
    description: `${item.title}。${category}系のASMR作品です。`,
    cta:         makeCTA(category),
    createdAt:   item.pubDate || new Date().toISOString(),
  };
}

/**
 * メイン処理
 */
async function main() {
  console.log('=== works.json ビルド開始 ===');

  // RSS取得
  const items = await fetchAllFeeds();
  console.log(`合計 ${items.length} 件取得（重複排除済み）`);

  if (items.length === 0) {
    console.warn('取得件数が0件です。既存のworks.jsonを維持します。');
    process.exit(0);
  }

  // 整形・最大件数制限
  const works = items
    .slice(0, MAX_WORKS)
    .map(item => {
      try {
        return formatWork(item);
      } catch (err) {
        console.error(`整形エラー [${item.link}]:`, err.message);
        return null;
      }
    })
    .filter(Boolean);

  console.log(`整形完了: ${works.length} 件`);

  // data/works.json に保存
  const outDir  = path.join(__dirname, '..', 'data');
  const outPath = path.join(outDir, 'works.json');

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(works, null, 2), 'utf-8');
  console.log(`✅ 保存完了: ${outPath}`);
  console.log('=== ビルド完了 ===');
}

main().catch(err => {
  console.error('致命的エラー:', err.message);
  process.exit(1);
});
