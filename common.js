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
      background: #eaf4ff; border: 1px solid #2980b9;
      border-radius: 12px; padding: 20px 24px; margin: 40px 0; text-align: center;
    }
    .common-mid-nav .mid-title {
      font-size: .95rem; font-weight: 800; color: #1a5276; margin-bottom: 6px;
    }
    .common-mid-nav .mid-desc {
      font-size: .85rem; color: #555; margin-bottom: 4px;
    }

    /* 末尾ファインダーボックス */
    .common-box-finder {
      background: #1a1a1a; border-radius: 12px;
      padding: 24px; margin: 40px 0; text-align: center;
    }
    .common-box-finder .finder-title {
      font-size: 1rem; font-weight: 800; color: #fff; margin-bottom: 8px;
    }
    .common-box-finder .finder-desc {
      font-size: .85rem; color: #aaa; margin-bottom: 4px;
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
      <p class="mid-title">🔍 もっと自分に合う作品を探したい人へ</p>
      <p class="mid-desc">タグ・キーワードで絞り込める作品検索ツールです。10秒で当たり作品が見つかります。</p>
      <a href="/index.html" class="btn-finder-common">作品一覧を見る（無料）</a>
      ${showR18Link ? `<p style="font-size:.82rem;margin-top:14px;color:#888;">👉 もっと刺激強めがいい人はこちら → <a href="/articles/r18-amama-article.html" style="color:#e8485a;font-weight:700;">R18甘々ASMRまとめ</a></p>` : ""}
    `;
  });

  // ──────────────────────────────────────
  // 末尾ファインダーボックス（#commonBoxFinder）
  // ──────────────────────────────────────
  document.querySelectorAll("#commonBoxFinder").forEach(el => {
    el.className = "common-box-finder";
    el.innerHTML = `
      <p class="finder-title">🎧 作品をもっと探したい人へ</p>
      <p class="finder-desc">タグ・ジャンルで絞り込める作品検索ツールです。</p>
      <a href="/index.html" class="btn-finder-common">作品一覧を見る（無料）</a>
    `;
  });

})();
