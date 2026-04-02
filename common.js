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
  });

})();
