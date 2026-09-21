// صفحات از قبل با build.py به تصویر تبدیل شدن، پس اینجا خبری از رندر PDF نیست.
// اندازه‌ی نمایش هر صفحه: A4 افقی (297×210mm)
const PAGE_W = 480;
const PAGE_RATIO = 297 / 210;

let flipbookEl = document.getElementById("flipbook");
const loadingEl = document.getElementById("loading");
const tabsEl = document.getElementById("catalogTabs");
const counterEl = document.getElementById("counter");

let pageFlip = null;
let catalogs = [];

const fa = (n) => n.toLocaleString("fa-IR", { useGrouping: false });

const pageUrl = (c, n) => `pages/${c.id}/${String(n).padStart(3, "0")}.jpg`;

// ایندکس‌ها برعکس‌اند: شماره‌ی واقعی صفحه = تعداد کل - ایندکس
function updateCounter() {
  const n = pageFlip.getPageCount();
  const i = pageFlip.getCurrentPageIndex();
  const single = i === 0 || i === n - 1;
  // ضخامت جلد فقط وقتی کتاب بسته‌ست معنی داره؛ باز که بشه توی درز وسط دیده می‌شه
  flipbookEl.classList.toggle("closed", single);
  counterEl.textContent = single
    ? `${fa(n - i)} / ${fa(n)}`
    : `${fa(n - i - 1)}–${fa(n - i)} / ${fa(n)}`;
}

function preload(src) {
  return new Promise((done) => {
    const img = new Image();
    img.onload = img.onerror = done;
    img.src = src;
  });
}

async function loadCatalog(catalog) {
  loadingEl.style.display = "flex";

  // destroy() خودِ #flipbook رو از DOM برمی‌داره، پس هر بار یه المنت تازه می‌سازیم
  if (pageFlip) {
    pageFlip.destroy();
    pageFlip = null;
  }
  flipbookEl.remove();
  flipbookEl = document.createElement("div");
  flipbookEl.id = "flipbook";
  document.querySelector("main").appendChild(flipbookEl);

  // جلد و اولین طیف رو قبل از ساختن کتاب لود می‌کنیم تا بدون پرش باز بشه
  await Promise.all(
    [1, 2, 3].filter((n) => n <= catalog.pages).map((n) => preload(pageUrl(catalog, n)))
  );

  // کاتالوگ فارسیه: صفحات رو برعکس می‌چینیم تا مکانیک ورق‌خوردن کتابخونه
  // (که ذاتاً چپ‌به‌راسته) دقیقاً معادل کتاب راست‌به‌چپ بشه
  for (let n = catalog.pages; n >= 1; n--) {
    const page = document.createElement("div");
    // کلاس --hard خودِ کتابخونه همیشه سر وقت ست نمی‌شه، پس جلد رو خودمون علامت می‌زنیم
    const isCover = n === 1 || n === catalog.pages;
    page.className = isCover ? "page cover" : "page";
    const img = document.createElement("img");
    img.src = pageUrl(catalog, n);
    img.alt = `صفحه ${n}`;
    page.appendChild(img);
    // لبه‌ی ضخامتِ جلد از رنگ خودِ طرح جلد ساخته می‌شه، نه یه نوار کاغذیِ ثابت.
    // این استایل رو روی یه المنت فرزند می‌ذاریم چون کتابخونه استایل خودِ .page رو
    // موقع پوزیشن دادن بازنویسی می‌کنه و هر چیزی روی خودش رو پاک می‌کنه.
    if (isCover) {
      const edge = document.createElement("div");
      edge.className = "cover-edge";
      edge.style.backgroundImage = `url("${pageUrl(catalog, n)}")`;
      page.appendChild(edge);
    }
    flipbookEl.appendChild(page);
  }

  pageFlip = new St.PageFlip(flipbookEl, {
    width: PAGE_W,
    height: Math.round(PAGE_W / PAGE_RATIO),
    size: "stretch",
    minWidth: 300,
    maxWidth: 1200,
    minHeight: Math.round(300 / PAGE_RATIO),
    maxHeight: Math.round(1200 / PAGE_RATIO),
    showCover: true, // جلد و پشت جلد تک‌صفحه‌ای
    usePortrait: false,
  });
  pageFlip.loadFromHTML(document.querySelectorAll("#flipbook .page"));
  pageFlip.turnToPage(catalog.pages - 1); // چون ترتیب برعکسه، جلد آخرین صفحه‌ست
  pageFlip.on("flip", updateCounter);
  // تا کتاب نیمه‌باز/در حال ورق خوردنه ضخامتِ جلد نباید دیده بشه
  pageFlip.on("changeState", (e) => {
    if (e.data === "read") updateCounter();
    else flipbookEl.classList.remove("closed");
  });
  updateCounter();

  loadingEl.style.display = "none";
}


// ترتیب صفحات برعکسه، پس «بعد» و «قبل» هم جابه‌جا می‌شن
document.getElementById("nextBtn").addEventListener("click", () => pageFlip && pageFlip.flipPrev());
document.getElementById("prevBtn").addEventListener("click", () => pageFlip && pageFlip.flipNext());

document.addEventListener("keydown", (e) => {
  if (!pageFlip) return;
  if (e.key === "ArrowLeft") pageFlip.flipPrev();
  if (e.key === "ArrowRight") pageFlip.flipNext();
});

(async function init() {
  try {
    // no-cache: بعد از هر build.py مرورگر باید لیست تازه رو ببینه
    catalogs = await (await fetch("pages/manifest.json", { cache: "no-cache" })).json();
  } catch {
    loadingEl.textContent = "فایل pages/manifest.json پیدا نشد — اول python build.py رو اجرا کن.";
    return;
  }

  for (const c of catalogs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = c.name;
    btn.addEventListener("click", () => {
      if (btn.classList.contains("active")) return;
      tabsEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      loadCatalog(c);
    });
    tabsEl.appendChild(btn);
  }

  if (catalogs.length) {
    tabsEl.firstElementChild.classList.add("active");
    loadCatalog(catalogs[0]);
  }
  else loadingEl.textContent = "هیچ کاتالوگی ساخته نشده.";
})();
