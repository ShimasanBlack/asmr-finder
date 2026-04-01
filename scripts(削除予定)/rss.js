const axios = require('axios');
const cheerio = require('cheerio');

// DLsite RSSフィードURL（音声作品・ASMRカテゴリ）
const RSS_FEEDS = [
  'https://www.dlsite.com/maniax/works/type/=/work_type_category/audio/format/rss',
  'https://www.dlsite.com/maniax/works/type/=/work_type_category/audio/order/trend/format/rss',
];

const AFFILIATE_ID = process.env.DLSITE_AFFILIATE_ID || '';

async function fetchRSS(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MariGuraBot/1.0; +https://marigura.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 15000,
    });

    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);

    if (!body.includes('<item') && !body.includes('<entry')) {
      console.error(`  ⚠ RSS形式ではありません`);
      console.error(`  レスポンス先頭300文字: ${body.slice(0, 300)}`);
      return [];
    }

    const $ = cheerio.load(body, { xmlMode: true });
    const items = [];

    $('item').each((_, el) => {
      const title   = $(el).find('title').first().text().trim();
      const link    = $(el).find('link').first().text().trim()
                      || $(el).find('guid').first().text().trim();
      const pubDate = $(el).find('pubDate').first().text().trim();
      const encl    = $(el).find('enclosure').attr('url') || '';
      const desc    = $(el).find('description').first().text().trim();
      const img     = $(el).find('media\\:content').attr('url')
                      || $(el).find('media\\:thumbnail').attr('url')
                      || encl;

      if (title && link) items.push({ title, link, pubDate, image: img, description: desc });
    });

    return items;
  } catch (err) {
    console.error(`RSS取得エラー [${url}]: ${err.message}`);
    if (err.response) console.error(`  HTTPステータス: ${err.response.status}`);
    return [];
  }
}

async function fetchAllFeeds() {
  let all = [];
  for (const url of RSS_FEEDS) {
    console.log(`RSS取得中: ${url}`);
    const items = await fetchRSS(url);
    console.log(`  → ${items.length}件取得`);
    all = all.concat(items);
    await new Promise(r => setTimeout(r, 1000));
  }
  const seen = new Set();
  return all.filter(item => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });
}

function extractRJCode(url) {
  const match = url.match(/\/(RJ\d+)/i);
  return match ? match[1] : null;
}

function makeAffiliateUrl(url) {
  if (!AFFILIATE_ID) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}affiliate_id=${AFFILIATE_ID}`;
}

module.exports = { fetchAllFeeds, extractRJCode, makeAffiliateUrl };
