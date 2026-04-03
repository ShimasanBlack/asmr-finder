/**
 * common.js - 記事共通コンポーネント
 * 各記事に <script src="/common.js"></script> を入れるだけで動く
 */

(function () {
  // ──────────────────────────────────────
  // スタイル注入
  // ──────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* 共通ナビ */
    .site-nav { background: #1a1a1a; padding: 10px 20px; display: flex; align-items: center; gap: 20px; }
    .site-nav a { color: #ccc; text-decoration: none; font-size: .85rem; }
    .site-nav a:hover { color: #fff; }
    .site-nav .nav-logo { color: #fff !important; font-weight: 800; font-size: 1rem; }

    /* 共通ボタン */
    .btn-finder-common {
      display: block; width: 100%; max-width: 480px; margin: 14px auto 0;
      padding: 14px 24px; background: linear-gradient(135deg,#2980b9,#1a5276);
      color: #fff !important; text-decoration: none; text-align: center;
      font-size: .95rem; font-weight: 800; border-radius: 50px;
      transition: transform .15s;
    }
    .btn-finder-common:hover { transform: translateY(-2px); opacity: 1; }

    /* 中間ナビボックス */
    .common-mid-nav {
      border-top: 1px solid #e8e8e8;
      border-bottom: 1px solid #e8e8e8;
      padding: 20px 0; margin: 40px 0; text-align: center;
    }
    .common-mid-nav .mid-title {
      font-size: .88rem; color: #888; margin-bottom: 10px;
    }
    .btn-finder-common {
      display: inline-block; padding: 10px 28px;
      background: transparent; border: 1px solid #555;
      color: #333 !important; text-decoration: none;
      font-size: .88rem; font-weight: 700; border-radius: 6px;
      transition: all .15s;
    }
    .btn-finder-common:hover { background: #333; color: #fff !important; }

    /* 末尾ファインダーボックス */
    .common-box-finder {
      border-top: 1px solid #e8e8e8;
      padding: 20px 0; margin: 40px 0; text-align: center;
    }
    .common-box-finder .finder-title {
      font-size: .88rem; color: #888; margin-bottom: 10px;
    }
  `;
  document.head.appendChild(style);

  // ──────────────────────────────────────
  // 中間ナビ（#commonMidNav）
  // data-r18-link="true" をつけるとR18リンクも表示
  // ──────────────────────────────────────
  document.querySelectorAll("#commonMidNav").forEach(el => {
    const showR18Link = el.dataset.r18Link === "true";
    el.className = "common-mid-nav";
    el.innerHTML = `
      <p class="mid-title">もっと作品を探したい人はこちら</p>
      <a href="/index.html" class="btn-finder-common">→ 作品一覧を見る</a>
      ${showR18Link ? `<p style="font-size:.82rem;margin-top:14px;color:#888;">刺激強めが好みの人は → <a href="/articles/r18-amama-article.html" style="color:#e8485a;">R18甘々ASMRまとめ</a></p>` : ""}
    `;
  });

  document.querySelectorAll("#commonBoxFinder").forEach(el => {
    el.className = "common-box-finder";
    el.innerHTML = `
      <p class="finder-title">もっと作品を探したい人はこちら</p>
      <a href="/index.html" class="btn-finder-common">→ 作品一覧を見る</a>
    `;

    // DLsiteランキングブログパーツを直後に挿入
    const blogWrap = document.createElement("div");
    blogWrap.style.cssText = "margin: 24px 0;";
    blogWrap.innerHTML = `<p style="font-size:.72rem;color:#bbb;margin-bottom:6px;text-align:right;">Powered by DLsite</p>`;

    const s1 = document.createElement("script");
    s1.type = "text/javascript";
    s1.text = `blogparts={"base":"https://www.dlsite.com/","type":"ranking","site":"home","query":{"period":"year","options":[null,"-MEN"]},"title":"ランキング","display":"horizontal","detail":"1","column":"h","image":"medium","count":"5","wrapper":"0","autorotate":false,"aid":"ShimasanBlack"}`;

    const s2 = document.createElement("script");
    s2.type = "text/javascript";
    s2.src = "https://www.dlsite.com/js/blogparts.js";
    s2.charset = "UTF-8";

    blogWrap.appendChild(s1);
    blogWrap.appendChild(s2);
    el.insertAdjacentElement("afterend", blogWrap);
  });

  // ──────────────────────────────────────
  // 関連記事自動生成（#commonRelated）
  // articles.htmlをfetchしてARTICLES配列から関連記事を生成
  // ──────────────────────────────────────
  async function loadRelatedArticles() {
    const el = document.getElementById("commonRelated");
    if (!el) return;

    const currentId  = el.dataset.id;       // 現在の記事ID
    const tagsStr    = el.dataset.tags ?? "";// カンマ区切りのタグ
    const currentTags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
    const maxItems   = parseInt(el.dataset.max ?? "3");

    try {
      const res = await fetch("/articles.html");
      if (!res.ok) throw new Error("fetch失敗");
      const text = await res.text();
      const match = text.match(/const ARTICLES = (\[[\s\S]*?\]);/);
      if (!match) throw new Error("ARTICLES配列が見つかりません");
      const articles = Function(`"use strict"; return ${match[1]}`)();

      // 現在の記事を除外 → タグが1つ以上一致 → 一致数が多い順にソート
      const related = articles
        .filter(a => a.id !== currentId)
        .map(a => {
          const aTags = a.relatedTags ?? [];
          const score = currentTags.filter(t => aTags.includes(t)).length;
          return { ...a, score };
        })
        .filter(a => a.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxItems);

      if (related.length === 0) return;

      // R18記事はlocalStorageのshowR18状態に従う
      const showR18 = localStorage.getItem("showR18") === "true";
      const visible = related.filter(a => !a.r18 || showR18);
      if (visible.length === 0) return;

      el.className = "box-related";
      el.innerHTML = `
        <p class="rel-title">📚 関連記事</p>
        <ul>
          ${visible.map(a => `<li>${a.emoji} <a href="${a.url}">${a.title}</a></li>`).join("")}
        </ul>
      `;
    } catch (e) {
      // fetch不可（ローカル）はフォールバック表示なし
      console.info("関連記事: fetch不可", e.message);
    }
  }

  loadRelatedArticles();

})();
