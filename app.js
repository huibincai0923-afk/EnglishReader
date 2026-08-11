const state = {
  book: null,
  chapters: [],
  current: 0,
  currentWord: null,
  vocab: JSON.parse(localStorage.getItem("english-reader-vocab") || "[]")
};

const WORDS = {
  stringent:{meaning:"严格的；严厉的",level:"IELTS 7+",pronunciation:"/ˈstrɪndʒənt/"},
  mitigate:{meaning:"缓解；减轻",level:"IELTS 7+",pronunciation:"/ˈmɪtɪɡeɪt/"},
  degradation:{meaning:"退化；恶化",level:"IELTS 7+",pronunciation:"/ˌdeɡrəˈdeɪʃən/"},
  implement:{meaning:"实施；执行",level:"IELTS 6+",pronunciation:"/ˈɪmplɪment/"},
  significant:{meaning:"重要的；显著的",level:"IELTS 6+",pronunciation:"/sɪɡˈnɪfɪkənt/"},
  substantial:{meaning:"大量的；重大的",level:"IELTS 7+",pronunciation:"/səbˈstænʃəl/"},
  consequently:{meaning:"因此；所以",level:"IELTS 7+",pronunciation:"/ˈkɒnsɪkwentli/"},
  facilitate:{meaning:"促进；使便利",level:"IELTS 7+",pronunciation:"/fəˈsɪlɪteɪt/"},
  considerable:{meaning:"相当大的；值得考虑的",level:"IELTS 6+",pronunciation:"/kənˈsɪdərəbəl/"},
  controversial:{meaning:"有争议的",level:"IELTS 7+",pronunciation:"/ˌkɒntrəˈvɜːʃəl/"},
  conventional:{meaning:"传统的；惯例的",level:"IELTS 6+",pronunciation:"/kənˈvenʃənəl/"},
  acquire:{meaning:"获得；习得",level:"IELTS 6+",pronunciation:"/əˈkwaɪə/"},
  evident:{meaning:"明显的；显然的",level:"IELTS 6+",pronunciation:"/ˈevɪdənt/"},
  inevitable:{meaning:"不可避免的",level:"IELTS 7+",pronunciation:"/ɪnˈevɪtəbəl/"},
  predominant:{meaning:"占主导地位的",level:"IELTS 8+",pronunciation:"/prɪˈdɒmɪnənt/"}
};

const fileInput = document.getElementById("fileInput");
const reader = document.getElementById("reader");
const chapterList = document.getElementById("chapterList");
const chapterTitle = document.getElementById("chapterTitle");
const bookTitle = document.getElementById("bookTitle");
const prevButton = document.getElementById("prevButton");
const nextButton = document.getElementById("nextButton");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const popup = document.getElementById("popup");
const toast = document.getElementById("toast");

fileInput.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    await loadEpub(file);
  } catch (err) {
    console.error(err);
    showToast("This EPUB could not be opened.");
  }
});

document.getElementById("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("english-reader-dark", document.body.classList.contains("dark"));
});

if (localStorage.getItem("english-reader-dark") === "true") {
  document.body.classList.add("dark");
}

prevButton.addEventListener("click", () => showChapter(state.current - 1));
nextButton.addEventListener("click", () => showChapter(state.current + 1));
document.getElementById("popupClose").addEventListener("click", closePopup);
document.getElementById("addWordButton").addEventListener("click", () => {
  if (!state.currentWord) return;
  if (!state.vocab.includes(state.currentWord)) state.vocab.push(state.currentWord);
  localStorage.setItem("english-reader-vocab", JSON.stringify(state.vocab));
  showToast(`${state.currentWord} added to your vocabulary.`);
});

async function loadEpub(file) {
  const zip = await JSZip.loadAsync(file);
  const containerXml = await readZipText(zip, "META-INF/container.xml");
  const rootfile = new DOMParser().parseFromString(containerXml, "application/xml")
    .querySelector("rootfile")?.getAttribute("full-path");
  if (!rootfile) throw new Error("No EPUB package found.");

  const rootDir = rootfile.includes("/") ? rootfile.slice(0, rootfile.lastIndexOf("/") + 1) : "";
  const opfText = await readZipText(zip, rootfile);
  const opf = new DOMParser().parseFromString(opfText, "application/xml");

  const title = opf.querySelector("metadata > title, dc\:title")?.textContent?.trim() || file.name.replace(/\.epub$/i, "");
  bookTitle.textContent = title;

  const manifest = {};
  opf.querySelectorAll("manifest > item").forEach(item => {
    manifest[item.getAttribute("id")] = {
      href: item.getAttribute("href"),
      mediaType: item.getAttribute("media-type"),
      properties: item.getAttribute("properties") || ""
    };
  });

  const spine = [...opf.querySelectorAll("spine > itemref")]
    .map(item => manifest[item.getAttribute("idref")])
    .filter(Boolean);

  state.chapters = [];
  for (let i = 0; i < spine.length; i++) {
    const item = spine[i];
    const path = normalizePath(rootDir + decodeURIComponent(item.href.split("#")[0]));
    const raw = await readZipText(zip, path);
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const body = doc.body;
    if (!body) continue;

    const heading = body.querySelector("h1,h2,h3,title")?.textContent?.trim() || `Chapter ${state.chapters.length + 1}`;
    const content = body.innerHTML;
    if (stripHtml(content).trim().length < 20) continue;

    state.chapters.push({title: heading, content});
  }

  if (!state.chapters.length) throw new Error("No readable chapters found.");

  state.book = file.name;
  state.current = Number(localStorage.getItem(`book-${file.name}-chapter`) || 0);
  state.current = Math.max(0, Math.min(state.current, state.chapters.length - 1));
  renderChapterList();
  showChapter(state.current);
}

async function readZipText(zip, path) {
  const file = zip.file(path) || zip.file(normalizePath(path));
  if (!file) throw new Error(`Missing EPUB file: ${path}`);
  return await file.async("text");
}

function normalizePath(path) {
  const parts = path.split("/");
  const out = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return out.join("/");
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

function renderChapterList() {
  chapterList.innerHTML = "";
  state.chapters.forEach((chapter, index) => {
    const button = document.createElement("button");
    button.className = "chapter";
    button.textContent = chapter.title;
    button.addEventListener("click", () => showChapter(index));
    chapterList.appendChild(button);
  });
}

function showChapter(index) {
  if (index < 0 || index >= state.chapters.length) return;
  state.current = index;
  localStorage.setItem(`book-${state.book}-chapter`, String(index));

  const chapter = state.chapters[index];
  chapterTitle.textContent = chapter.title;
  reader.innerHTML = chapter.content;
  highlightVocabulary(reader);

  [...chapterList.children].forEach((el, i) => el.classList.toggle("active", i === index));
  prevButton.disabled = index === 0;
  nextButton.disabled = index === state.chapters.length - 1;

  const percent = Math.round(((index + 1) / state.chapters.length) * 100);
  progressText.textContent = `${percent}%`;
  progressBar.style.width = `${percent}%`;
  window.scrollTo({top: 0, behavior: "smooth"});
}

function highlightVocabulary(container) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(node => {
    if (!node.nodeValue.trim() || node.parentElement.closest(".vocab,script,style")) return;
    const regex = new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\b`, "gi");
    if (!regex.test(node.nodeValue)) return;

    const fragment = document.createDocumentFragment();
    let last = 0;
    node.nodeValue.replace(regex, (match, _word, offset) => {
      fragment.appendChild(document.createTextNode(node.nodeValue.slice(last, offset)));
      const span = document.createElement("span");
      span.className = "vocab";
      span.textContent = match;
      span.addEventListener("click", () => openPopup(match.toLowerCase()));
      fragment.appendChild(span);
      last = offset + match.length;
      return match;
    });
    fragment.appendChild(document.createTextNode(node.nodeValue.slice(last)));
    node.parentNode.replaceChild(fragment, node);
  });
}

function openPopup(word) {
  const data = WORDS[word];
  if (!data) return;
  state.currentWord = word;
  document.getElementById("popupWord").textContent = word;
  document.getElementById("popupPronunciation").textContent = data.pronunciation;
  document.getElementById("popupMeaning").textContent = data.meaning;
  document.getElementById("popupLevel").textContent = data.level;
  popup.classList.remove("hidden");
}

function closePopup() {
  popup.classList.add("hidden");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 1800);
}
