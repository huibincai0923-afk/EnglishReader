let DATA={words:{},phrases:{}},book=null,rendition=null,locations=null;
function safeJSON(key,fallback){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return fallback;
    const value=JSON.parse(raw);
    return value??fallback;
  }catch(e){
    try{localStorage.removeItem(key)}catch(_){}
    return fallback;
  }
}
let current=null, markColor=localStorage.getItem("reader-mark-color")||"yellow";
let currentCfi="", currentChapter="";
let notes=safeJSON("reader-notes",[]);
let vocab=safeJSON("reader-vocab",[]);
let sessionStarted=0;
let lastActivity=0;
let timerInterval=null;
let activeBookId="";
let library=safeJSON("reader-library",[]);
let readerMargin=localStorage.getItem("reader-margin")||"medium";
let marks=safeJSON("reader-marks-v34",safeJSON("reader-marks",[]));

const $=id=>document.getElementById(id);
fetch("vocabulary.json").then(r=>r.json()).then(d=>{DATA=d}).catch(console.error);

$("epubInput").addEventListener("change",e=>e.target.files[0]&&openBook(e.target.files[0]));
$("prev").onclick=()=>rendition?.prev();$("next").onclick=()=>rendition?.next();
$("theme").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("reader-dark",document.body.classList.contains("dark"))};
if(localStorage.getItem("reader-dark")==="true")document.body.classList.add("dark");

const fs=localStorage.getItem("reader-font-size")||"18";
$("fontSize").value=fs;
$("fontSize").onchange=()=>{let n=$("fontSize").value;localStorage.setItem("reader-font-size",n);rendition?.themes.fontSize(n+"px");applyReadingFont()};
const savedFont=localStorage.getItem("reader-font-family")||"Georgia";
$("fontFamily").value=savedFont;
function applyReadingFont(){
  let f=$("fontFamily")?.value||localStorage.getItem("reader-font-family")||"Georgia";
  if(f==="Arial"){f="Georgia"; if($("fontFamily"))$("fontFamily").value="Georgia";}
  const n=$("fontSize")?.value||localStorage.getItem("reader-font-size")||"18";
  const stack=f==="Helvetica" ? "Helvetica, Arial, sans-serif" :
              "Georgia, 'Times New Roman', serif";
  localStorage.setItem("reader-font-family",f);
  localStorage.setItem("reader-font-size",n);
  try{
    if(rendition){
      rendition.themes.fontFamily(stack);
      rendition.themes.fontSize(n+"px");
    }
  }catch(_){}
  const host=$("extensionReader");
  if(host){
    host.dataset.font=f;
    host.style.setProperty("--reader-font",stack);
    host.style.setProperty("--reader-size",n+"px");
    host.style.setProperty("font-family",stack,"important");
    host.style.setProperty("font-size",n+"px","important");
    host.querySelectorAll(".extension-chapter-content, .extension-chapter-content *").forEach(el=>{
      if(!el.closest("pre,code,svg,img")){
        el.style.setProperty("font-family",stack,"important");
        el.style.setProperty("font-size",n+"px","important");
      }
    });
  }
}
$("fontFamily").onchange=applyReadingFont;
$("fontUp").onclick=()=>{$("fontSize").value=String(Math.min(42,Number($("fontSize").value)+2));$("fontSize").dispatchEvent(new Event("change"))};
$("fontDown").onclick=()=>{$("fontSize").value=String(Math.max(18,Number($("fontSize").value)-2));$("fontSize").dispatchEvent(new Event("change"))};

$("close").onclick=()=>$("popup").classList.add("hidden");
$("save").onclick=()=>{
  if(!current)return;
  vocab=JSON.parse(localStorage.getItem("reader-vocab")||"[]");
  if(!vocab.some(x=>x.text.toLowerCase()===current.text.toLowerCase())){
    vocab.push({...current,addedAt:Date.now()});
    localStorage.setItem("reader-vocab",JSON.stringify(vocab));
  }
  $("popup").classList.add("hidden");
  toast("Added to vocabulary");
};

function setMarkColor(color, notify=true){
  markColor=color;
  localStorage.setItem("reader-mark-color",color);
  document.querySelectorAll(".mark-btn").forEach(x=>x.classList.toggle("active",x.dataset.mark===color));
  if(notify) toast("Default mark color: "+color);
}
document.querySelectorAll(".mark-btn").forEach(b=>b.onclick=()=>setMarkColor(b.dataset.mark,true));
setMarkColor(markColor,false);


$("openVocab").onclick=()=>openDrawer("Vocabulary");
$("openStats").onclick=()=>openDrawer("Reading");
$("openNotes").onclick=()=>openDrawer("Notes");
$("drawerClose").onclick=()=>$("drawer").classList.add("hidden");

function openDrawer(type){
  $("drawerTitle").textContent=type;
  $("drawer").classList.remove("hidden");
  renderDrawer(type);
}
function renderDrawer(type){
  const body=$("drawerBody");
  if(type==="Vocabulary"){
    vocab=JSON.parse(localStorage.getItem("reader-vocab")||"[]");
    if(!vocab.length){body.innerHTML='<div class="empty">No saved words yet.<br>Click a highlighted word to see its definition, then save it to Vocabulary.</div>';return}
    body.innerHTML=vocab.slice().reverse().map((x,i)=>`
      <div class="vocab-item">
        <div class="vocab-word">${escapeHtml(x.text)}</div>
        <div class="vocab-meta">${escapeHtml(x.kind||"word")} · ${escapeHtml(x.cefr||"")}</div>
        <div class="vocab-meaning">${escapeHtml(x.meaning||"")}</div>
        <div class="note-actions"><button class="item-delete" data-vocab="${vocab.length-1-i}">Delete</button></div>
      </div>`).join("");
    body.querySelectorAll("[data-vocab]").forEach(b=>b.onclick=()=>{
      vocab.splice(Number(b.dataset.vocab),1);localStorage.setItem("reader-vocab",JSON.stringify(vocab));renderDrawer("Vocabulary");
    });
    return;
  }

  if(type==="Notes"){
    const savedMarks=JSON.parse(localStorage.getItem("reader-marks-v5")||localStorage.getItem("reader-marks-v34")||localStorage.getItem("reader-marks")||"[]");
    const items=savedMarks.filter(x=>x&&x.text&&x.text.trim()).slice().reverse();
    if(!items.length){
      body.innerHTML='<div class="notes-empty"><h3>No annotations yet</h3><p>Underline a passage while reading. Your saved passages will appear here.</p></div>';
      return;
    }
    body.innerHTML=items.map((n,i)=>{
      const c=n.color||"yellow";
      const label=(n.chapter||currentChapter||"Current chapter").split("#")[0];
      return `<div class="note-item auto-note">
        <div class="note-ref"><span class="note-color-dot ${escapeHtml(c)}"></span><span>${escapeHtml(label)}</span></div>
        <div class="note-text">${escapeHtml(n.text)}</div>
        <div class="note-actions"><button class="item-delete" data-mark-note="${items.length-1-i}" aria-label="Remove mark">Remove</button></div>
      </div>`;
    }).join("");
    body.querySelectorAll("[data-mark-note]").forEach(b=>b.onclick=()=>{
      const idx=Number(b.dataset.markNote);
      const marksNow=JSON.parse(localStorage.getItem("reader-marks-v5")||"[]");
      marksNow.splice(idx,1);
      localStorage.setItem("reader-marks-v5",JSON.stringify(marksNow));
      renderDrawer("Notes");
      toast("Mark removed");
    });
    return;
  }

  // Reading dashboard
  const today=todayKey();
  const total=Number(localStorage.getItem("reader-total-seconds")||0);
  const todaySec=Number(localStorage.getItem("reader-day-"+today)||0);
  const completed=library.filter(x=>x.completed);
  body.innerHTML=`
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Today</div><div class="stat-value">${formatDuration(todaySec)}</div></div>
      <div class="stat-card"><div class="stat-label">Total reading time</div><div class="stat-value">${formatDuration(total)}</div></div>
    </div>
    <div class="side-title">Books finished</div>
    ${completed.length?completed.slice().reverse().map(x=>`
      <div class="library-book">
        <div class="library-title">${escapeHtml(x.title)}</div>
        <div class="library-meta">${escapeHtml(x.author||"")} · Finished ${new Date(x.finishedAt).toLocaleDateString()}</div>
      </div>`).join(""):'<div class="empty">No finished books yet.</div>'}
    <div class="side-title" style="margin-top:20px">Reading history</div>
    ${library.length?library.slice().reverse().map((x,i)=>`
      <div class="library-book">
        <div class="library-title">${escapeHtml(x.title)}</div>
        <div class="library-meta">${escapeHtml(x.author||"")} · ${Math.round((x.progress||0)*100)}%</div>
        <div class="progress-mini"><span style="width:${Math.round((x.progress||0)*100)}%"></span></div>
      </div>`).join(""):'<div class="empty">Import a book to start your library.</div>'}
  `;
}

function todayKey(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function formatDuration(sec){
  sec=Math.max(0,Math.floor(sec));
  const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60);
  if(h)return h+"h "+m+"m";
  return m+"m";
}
function touchReadingTimer(){
  lastActivity=Date.now();
  if(!sessionStarted) sessionStarted=Date.now();
}
function startReadingTimer(){
  stopReadingTimer();
  sessionStarted=Date.now();lastActivity=Date.now();
  timerInterval=setInterval(()=>{
    if(!document.hidden && Date.now()-lastActivity<90000){
      const delta=1;
      const total=Number(localStorage.getItem("reader-total-seconds")||0)+delta;
      const key=todayKey(), day=Number(localStorage.getItem("reader-day-"+key)||0)+delta;
      localStorage.setItem("reader-total-seconds",String(total));
      localStorage.setItem("reader-day-"+key,String(day));
      if(!$("drawer").classList.contains("hidden") && $("drawerTitle").textContent==="Reading")renderDrawer("Reading");
    }
  },1000);
}
function stopReadingTimer(){
  if(timerInterval)clearInterval(timerInterval);
  timerInterval=null;sessionStarted=0;lastActivity=0;
}
["mousemove","keydown","wheel","touchstart","mousedown"].forEach(ev=>document.addEventListener(ev,touchReadingTimer,{passive:true}));
document.addEventListener("visibilitychange",()=>{if(document.hidden)lastActivity=0;else touchReadingTimer();});

function bookId(meta,file){
  return (meta?.identifier||"")+"|"+(meta?.title||file.name);
}
function updateLibrary(meta,file,progress){
  library=JSON.parse(localStorage.getItem("reader-library")||"[]");
  const id=bookId(meta,file);
  let b=library.find(x=>x.id===id);
  if(!b){b={id,title:meta.title||file.name.replace(/\.epub$/i,""),author:meta.creator||"",progress:0,completed:false,startedAt:Date.now()};library.push(b)}
  b.progress=Math.max(0,Math.min(1,progress||0));
  if(b.progress>=0.995&&!b.completed){b.completed=true;b.finishedAt=Date.now();toast("🎉 Book finished!");}
  b.lastRead=Date.now();
  localStorage.setItem("reader-library",JSON.stringify(library));
}

function escapeHtml(x){
  return String(x??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}


const marginMenu=document.createElement("div");
marginMenu.className="margin-menu";
marginMenu.innerHTML=
  '<button data-margin="narrow">Narrow</button>'+
  '<button data-margin="medium">Medium</button>'+
  '<button data-margin="wide">Wide</button>';
marginMenu.style.display="none";
document.body.appendChild(marginMenu);

$("marginBtn").onclick=()=>{
  const r=$("marginBtn").getBoundingClientRect();
  marginMenu.style.left=r.left+"px";
  marginMenu.style.top=(r.bottom+8)+"px";
  marginMenu.style.display=marginMenu.style.display==="none"?"flex":"none";
  syncMarginMenu();
};
function syncMarginMenu(){
  marginMenu.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.margin===readerMargin));
}
marginMenu.querySelectorAll("button").forEach(b=>b.onclick=()=>{
  readerMargin=b.dataset.margin;
  localStorage.setItem("reader-margin",readerMargin);
  applyReaderMargin();
  syncMarginMenu();
  marginMenu.style.display="none";
});
document.addEventListener("mousedown",e=>{
  if(marginMenu.style.display!=="none" && !marginMenu.contains(e.target) && e.target!==$("marginBtn"))
    marginMenu.style.display="none";
});
function applyReaderMargin(){
  const widths={narrow:"28px",medium:"58px",wide:"92px"};
  const pad=widths[readerMargin]||widths.medium;
  document.documentElement.style.setProperty("--reader-margin",pad);
  // Apply to the outer reader viewport. EPUB content also gets a matching
  // horizontal padding when its document is available.
  $("viewer")?.style.setProperty("padding-left",pad);
  $("viewer")?.style.setProperty("padding-right",pad);
  if(book?.renderer?.getContents){
    book.renderer.getContents().forEach(c=>{
      try{
        const d=c.document;
        d.documentElement.style.setProperty("--epub-margin",pad);
        d.body.style.paddingLeft=pad;
        d.body.style.paddingRight=pad;
      }catch(e){}
    });
  }
}
syncMarginMenu();
applyReaderMargin();


function restoreV5Marks(){
  if(!book?.rendition)return;
  let saved=[];
  try{saved=JSON.parse(localStorage.getItem("reader-marks-v5")||"[]")}catch(e){}
  saved.forEach(m=>{
    if(!m.cfi || !m.color)return;
    const colors={
      red:"#c98b8b",yellow:"#d5c58b",blue:"#8eabc0",
      purple:"#a694b8",green:"#8eaa8e"
    };
    try{
      book.rendition.annotations.add(
        "underline",m.cfi,{},null,"v5-mark-"+m.color,
        {color:colors[m.color]||colors.yellow,"stroke-width":"3","stroke-linecap":"round"}
      );
    }catch(e){}
  });
}


function installV5EpubStyles(view){
  const d=view?.document;
  if(!d?.head || d.getElementById("v5-epub-styles"))return;
  const st=d.createElement("style");
  st.id="v5-epub-styles";
  st.textContent="html,body{background:#f5f0e6!important;}";
  d.head.appendChild(st);
}

async function openBook(file){
 try{
  const buf=await file.arrayBuffer();
  book=ePub(buf);
  $("viewer").innerHTML="";
  rendition=book.renderTo("viewer",{width:"100%",height:"auto",spread:"none",flow:"scrolled-doc"});
  rendition.themes.default({
    body:{color:"inherit !important",background:"transparent !important",fontFamily:(localStorage.getItem("reader-font-family")||"Georgia"),fontSize:fs+"px",lineHeight:"1.8",padding:"0 7% !important"},
    ".reader-word":{background:"#fff2b8",borderRadius:"3px",cursor:"pointer",padding:"0 2px"},
    ".reader-phrase":{background:"#dceeff",borderRadius:"3px",cursor:"pointer",padding:"0 2px"},
    ".user-mark":{paddingBottom:"1px"},
    ".user-mark.mark-red":{borderBottom:"3px solid #c98b8b !important"},
    ".user-mark.mark-yellow":{borderBottom:"3px solid #d5c58b !important"},
    ".user-mark.mark-blue":{borderBottom:"3px solid #8eabc0 !important"},
    ".user-mark.mark-purple":{borderBottom:"3px solid #a694b8 !important"},
    ".user-mark.mark-green":{borderBottom:"3px solid #8eaa8e !important"}
  });
  rendition.on("rendered",(_,view)=>setTimeout(()=>{
    try{
      decorate(view.document);restoreMarks(view.document);installMarking(view);
      extensionChapterView=view;renderExtensionReader(view);
    }catch(e){
      console.warn("Annotation mirror skipped:",e);
      const host=$("extensionReader"); if(host)host.style.display="none";
      document.body.classList.remove("browser-annotation-active");
    }
  },40));
  rendition.on("relocated",loc=>{
    if(loc?.start){
      currentCfi=loc.start.cfi;
      currentChapter=loc.start.href||"";
      localStorage.setItem("reader-cfi",loc.start.cfi);
      updateToc(loc);updateProgress(loc);
    }
  });
  const meta=await book.loaded.metadata;
  $("bookTitle").textContent=meta.title||file.name.replace(/\.epub$/i,"");
  $("bookAuthor").textContent=meta.creator||"EPUB";
  activeBookId=bookId(meta,file);
  updateLibrary(meta,file,0);
  startReadingTimer();
  await buildToc();
  const saved=localStorage.getItem("reader-cfi");
  await rendition.display(saved||undefined);
  applyReadingFont();
  $("prev").disabled=false;$("next").disabled=false;toast("Book loaded");
 }catch(e){console.error(e);toast("This EPUB could not be opened")}
}


/* ============================================================
   V5.2 — Browser Annotation Mode
   EPUB.js renders chapters inside iframes. Many Chrome annotation
   extensions only operate on the top-level document and do not
   declare all_frames=true. To make third-party web annotation
   extensions usable, this mode mirrors the currently rendered
   XHTML chapter into a normal top-level DOM container.
   No shadow DOM is used.
   ============================================================ */
let browserAnnotationMode=localStorage.getItem("browser-annotation-mode")!=="false";
let extensionChapterView=null;

function setBrowserMode(on, notify=true){
  browserAnnotationMode=!!on;
  localStorage.setItem("browser-annotation-mode",String(browserAnnotationMode));
  document.body.classList.toggle("browser-annotation-active",browserAnnotationMode);
  $("browserMode")?.classList.toggle("active",browserAnnotationMode);
  if(extensionChapterView) renderExtensionReader(extensionChapterView);
  if(notify) toast(browserAnnotationMode?"Web annotations on":"Web annotations off");
}

function absolutizeUrls(container, baseURI){
  container.querySelectorAll("[src]").forEach(el=>{
    try{el.src=new URL(el.getAttribute("src"),baseURI).href}catch(e){}
  });
  container.querySelectorAll("[href]").forEach(el=>{
    const h=el.getAttribute("href");
    if(!h || h.startsWith("#") || h.startsWith("javascript:"))return;
    try{el.href=new URL(h,baseURI).href}catch(e){}
  });
}

function renderExtensionReader(view){
  const host=$("extensionReader");
  const iframe=document.querySelector("#viewer iframe");
  if(!host || !view?.document?.body)return;

  extensionChapterView=view;
  host.innerHTML="";
  host.style.setProperty("--reader-font",$("fontFamily")?.value||"Georgia");
  host.style.setProperty("--reader-size",($("fontSize")?.value||"18")+"px");

  const shell=document.createElement("article");
  shell.className="extension-chapter";
  shell.setAttribute("data-extension-reader","true");

  // Copy chapter-local styles so the mirrored page remains visually close
  // to the EPUB rendition while still being ordinary top-level DOM.
  view.document.querySelectorAll("style").forEach(st=>{
    const copy=document.createElement("style");
    copy.textContent=st.textContent||"";
    shell.appendChild(copy);
  });

  const content=document.createElement("div");
  content.className="extension-chapter-content";
  content.innerHTML=view.document.body.innerHTML;
  content.querySelectorAll("script,iframe,object,embed").forEach(x=>x.remove());
  absolutizeUrls(content,view.document.baseURI||location.href);

  // Avoid duplicating EPUB.js UI artefacts if any exist.
  content.querySelectorAll(".v5-mark-palette").forEach(x=>x.remove());
  shell.appendChild(content);
  host.appendChild(shell);

  decorate(host);
  restoreMarks(host);
  installBrowserMarking(host);
  installMarkInteraction(host);
  document.body.classList.toggle("browser-annotation-active",browserAnnotationMode);
  if(iframe)iframe.style.display=browserAnnotationMode?"none":"block";
  host.style.display=browserAnnotationMode&&host.innerHTML.trim()?"block":"none";
  if(!host.innerHTML.trim()){
    document.body.classList.remove("browser-annotation-active");
    const frame=document.querySelector("#viewer iframe"); if(frame)frame.style.display="block";
  }
  applyReadingFont();
}


function installMarkInteraction(host){
  if(host.__markInteractionInstalled)return;
  host.__markInteractionInstalled=true;
  let pop=null;
  const close=()=>{if(pop){pop.remove();pop=null;}};

  host.addEventListener("click",e=>{
    const link=e.target.closest?.("a");
    if(link && host.contains(link)){
      const href=link.getAttribute("href")||"";
      if(href && !/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)){
        e.preventDefault();e.stopPropagation();return;
      }
    }

    const mark=e.target.closest?.(".user-mark");
    if(!mark || !host.contains(mark)){
      if(!e.target.closest?.(".mark-delete-popover")) close();
      return;
    }
    e.preventDefault();e.stopPropagation();close();

    pop=document.createElement("div");
    pop.className="mark-delete-popover";
    pop.innerHTML='<button type="button" data-delete-mark="1">Remove underline</button>';
    document.body.appendChild(pop);

    const r=mark.getBoundingClientRect(), p=pop.getBoundingClientRect();
    pop.style.left=Math.max(8,Math.min(innerWidth-p.width-8,r.left+r.width/2-p.width/2))+"px";
    pop.style.top=Math.min(innerHeight-p.height-8,Math.max(8,r.bottom+8))+"px";

    pop.querySelector("[data-delete-mark]").onclick=ev=>{
      ev.preventDefault();ev.stopPropagation();
      const text=(mark.textContent||"").replace(/\s+/g," ").trim();
      const parent=mark.parentNode;
      while(mark.firstChild) parent.insertBefore(mark.firstChild,mark);
      mark.remove();

      const saved=JSON.parse(localStorage.getItem("reader-marks-v5")||"[]");
      const pos=saved.findIndex(x=>
        (x.text||"").replace(/\s+/g," ").trim()===text &&
        (x.chapter||"")===currentChapter
      );
      if(pos>=0)saved.splice(pos,1);
      localStorage.setItem("reader-marks-v5",JSON.stringify(saved));
      marks=saved;
      close();
      toast("Underline removed");
      if(!$("drawer").classList.contains("hidden") && $("drawerTitle").textContent==="Notes") renderDrawer("Notes");
    };
  },true);

  document.addEventListener("mousedown",e=>{
    if(pop && !pop.contains(e.target) && !host.contains(e.target))close();
  },true);
}

function installBrowserMarking(host){
  if(host.__browserMarkingInstalled)return;
  host.__browserMarkingInstalled=true;
  let palette=null,pendingText="",pendingRange=null;

  const hide=()=>{
    if(palette)palette.remove();
    palette=null;pendingText="";pendingRange=null;
  };
  const closePalette=()=>{
    if(palette)palette.remove();
    palette=null;
  };

  function wrapRangeSafely(range,color){
    const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT);
    const nodes=[]; let node;
    while(node=walker.nextNode()){
      if(!node.nodeValue?.trim())continue;
      try{if(range.intersectsNode(node))nodes.push(node)}catch(_){}
    }
    if(!nodes.length)return false;

    const first=nodes[0], last=nodes[nodes.length-1];
    nodes.forEach((textNode,i)=>{
      const full=textNode.nodeValue;
      let a=(i===0&&textNode===range.startContainer)?range.startOffset:0;
      let b=(i===nodes.length-1&&textNode===range.endContainer)?range.endOffset:full.length;
      a=Math.max(0,Math.min(a,full.length)); b=Math.max(a,Math.min(b,full.length));
      if(a===b)return;
      const parent=textNode.parentNode;
      if(!parent)return;
      const before=document.createTextNode(full.slice(0,a));
      const mark=document.createElement("span");
      mark.className="user-mark mark-"+color;
      mark.dataset.markColor=color;
      mark.textContent=full.slice(a,b);
      const after=document.createTextNode(full.slice(b));
      const frag=document.createDocumentFragment();
      if(before.nodeValue)frag.appendChild(before);
      frag.appendChild(mark);
      if(after.nodeValue)frag.appendChild(after);
      parent.replaceChild(frag,textNode);
    });
    return true;
  }

  const show=()=>{
    const sel=window.getSelection();
    if(!sel||sel.rangeCount===0||sel.isCollapsed)return;
    const text=sel.toString().replace(/\s+/g," ").trim();
    const range=sel.getRangeAt(0);
    if(!text||!host.contains(range.commonAncestorContainer))return;
    if(palette)palette.remove();
    pendingText=text; pendingRange=range.cloneRange();

    palette=document.createElement("div");
    palette.className="v5-mark-palette";
    palette.innerHTML='<button type="button" data-c="red">❤️</button><button type="button" data-c="yellow">🧡</button><button type="button" data-c="blue">💙</button><button type="button" data-c="purple">💜</button><button type="button" data-c="green">💚</button>';
    document.body.appendChild(palette);
    const r=range.getBoundingClientRect(),p=palette.getBoundingClientRect();
    palette.style.left=Math.max(8,Math.min(innerWidth-p.width-8,r.left+r.width/2-p.width/2))+"px";
    palette.style.top=Math.max(8,r.top-p.height-10)+"px";
    palette.style.cursor="grab";
    makePaletteMovable(palette,3000);

    palette.querySelectorAll("button").forEach(b=>{
      b.classList.toggle("active",b.dataset.c===markColor);
      b.addEventListener("pointerdown",e=>{
        e.preventDefault();e.stopPropagation();
        const color=b.dataset.c;
        closePalette();
        setTimeout(()=>applyBrowserMark(color),0);
      },true);
      b.onclick=e=>{e.preventDefault();e.stopPropagation()};
    });
  };

  function applyBrowserMark(color){
    const range=pendingRange, text=pendingText;
    if(!range||!text){hide();return}
    let ok=false;
    try{ok=wrapRangeSafely(range,color)}catch(e){console.warn("Marking failed",e)}
    if(!ok){hide();toast("Could not mark this selection");return}
    hide();
    try{window.getSelection().removeAllRanges()}catch(_){}
    const rec={text,color,chapter:currentChapter||"Current chapter",cfi:currentCfi,at:Date.now()};
    let saved=safeJSON("reader-marks-v5",[]);
    if(!Array.isArray(saved))saved=[];
    saved.push(rec); saved=saved.slice(-500);
    try{localStorage.setItem("reader-marks-v5",JSON.stringify(saved))}catch(_){}
    marks=saved;
    markColor=color;
    try{localStorage.setItem("reader-mark-color",color)}catch(_){}
    setMarkColor(color,false);
    toast("Marked · added to Notes");
    if(!$("drawer").classList.contains("hidden")&&$("drawerTitle").textContent==="Notes")renderDrawer("Notes");
  }

  host.addEventListener("mouseup",()=>setTimeout(show,30),true);
  host.addEventListener("touchend",()=>setTimeout(show,50),true);
  document.addEventListener("mousedown",e=>{
    if(palette&&!palette.contains(e.target)&&!host.contains(e.target))hide();
  },true);
}

$("browserMode").onclick=()=>setBrowserMode(!browserAnnotationMode);
setBrowserMode(browserAnnotationMode,false);

async function buildToc(){
 const nav=await book.loaded.navigation;
 $("toc").innerHTML="";
 const items=[];
 const walk=arr=>arr.forEach(x=>{
   if(x.label&&x.href){
     const b=document.createElement("button");
     b.textContent=x.label.trim();b.dataset.href=x.href.split("#")[0];
     b.onclick=()=>rendition.display(x.href);
     $("toc").appendChild(b);items.push(b);
   }
   if(x.subitems)walk(x.subitems);
 });
 walk(nav.toc||[]);
 window.__tocItems=items;
 if(!items.length)$("toc").innerHTML="<small>No table of contents found.</small>";
}

function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}

function makePaletteMovable(palette,autoHideMs=3000){
  if(!palette)return;
  let timer=null, dragging=false, sx=0,sy=0,ox=0,oy=0;
  const schedule=()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{if(palette.isConnected)palette.remove()},autoHideMs);
  };
  palette.addEventListener("pointerdown",e=>{
    if(e.target.closest("button")){schedule();return;}
    dragging=true;
    const r=palette.getBoundingClientRect();
    sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top;
    palette.setPointerCapture?.(e.pointerId);
    palette.style.cursor="grabbing";
    clearTimeout(timer);
  });
  palette.addEventListener("pointermove",e=>{
    if(!dragging)return;
    palette.style.left=Math.max(6,Math.min(innerWidth-palette.offsetWidth-6,ox+e.clientX-sx))+"px";
    palette.style.top=Math.max(6,Math.min(innerHeight-palette.offsetHeight-6,oy+e.clientY-sy))+"px";
  });
  palette.addEventListener("pointerup",e=>{
    dragging=false; palette.style.cursor="grab"; schedule();
  });
  palette.addEventListener("pointercancel",()=>{dragging=false;schedule()});
  schedule();
}
function wordFamilyVariants(key){
  const k=String(key||"").toLowerCase().trim();
  if(!k || !/^[a-z]+$/.test(k)) return [k];
  const out=new Set([k]);
  const add=x=>{if(x&&x.length>=3)out.add(x)};

  if(/[^aeiou]y$/.test(k)){
    add(k.slice(0,-1)+"ies"); add(k.slice(0,-1)+"ied"); add(k.slice(0,-1)+"ying");
  }else if(/e$/.test(k)){
    add(k+"s"); add(k+"d"); add(k.slice(0,-1)+"ing");
  }else{
    add(k+"s"); add(k+"ed"); add(k+"ing");
  }
  if(/(s|x|z|ch|sh|o)$/.test(k)) add(k+"es");

  // analyze/analyse family, including the noun analysis/analyses.
  if(k.endsWith("ize")){
    const stem=k.slice(0,-3);
    add(stem+"izes"); add(stem+"ized"); add(stem+"izing");
    add(stem+"ise"); add(stem+"ises"); add(stem+"ised"); add(stem+"ising");
    if(k.endsWith("yze")){
      const nounStem=k.slice(0,-3);
      add(nounStem+"ysis"); add(nounStem+"yses");
    }
  }else if(k.endsWith("ise")){
    const stem=k.slice(0,-3);
    add(stem+"ises"); add(stem+"ised"); add(stem+"ising");
    add(stem+"ize"); add(stem+"izes"); add(stem+"ized"); add(stem+"izing");
  }
  return [...out];
}

function wordFamilyRegex(key){
  const variants=wordFamilyVariants(key).filter(Boolean).sort((a,b)=>b.length-a.length);
  return new RegExp("\\b(?:"+variants.map(esc).join("|")+")\\b","gi");
}



function decorate(doc){
  if(!doc?.body) return;

  // Only decorate plain text nodes. Existing vocabulary spans and user marks are skipped.
  const phraseKeys=Object.keys(DATA.phrases)
    
    .sort((a,b)=>b.length-a.length);
  const wordKeys=Object.keys(DATA.words)
    
    .sort((a,b)=>b.length-a.length);

  const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
  const nodes=[];
  while(walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach(n=>{
    if(!n.nodeValue.trim()) return;
    if(n.parentElement?.closest(".reader-word,.reader-phrase,.user-mark,script,style")) return;

    const source=n.nodeValue;
    const matches=[];

    phraseKeys.forEach(key=>{
      const re=new RegExp("\\b"+esc(key).replace(/\\ /g,"\\s+")+"\\b","gi");
      let m;
      while((m=re.exec(source))){
        matches.push({i:m.index,j:m.index+m[0].length,key,mkind:"phrase"});
      }
    });

    wordKeys.forEach(key=>{
      const re=wordFamilyRegex(key);
      let m;
      while((m=re.exec(source))){
        matches.push({i:m.index,j:m.index+m[0].length,key,mkind:"word"});
      }
    });

    matches.sort((a,b)=>a.i-b.i || (b.j-b.i)-(a.j-a.i));

    // Longest/first match wins. This prevents phrase and word highlights from overlapping.
    const picked=[];
    let cursor=0;
    for(const m of matches){
      if(m.i<cursor) continue;
      picked.push(m);
      cursor=m.j;
    }
    if(!picked.length) return;

    const frag=doc.createDocumentFragment();
    let last=0;
    picked.forEach(m=>{
      if(m.i>last) frag.appendChild(doc.createTextNode(source.slice(last,m.i)));
      const span=doc.createElement("span");
      span.className=m.mkind==="phrase"?"reader-phrase":"reader-word";
      span.textContent=source.slice(m.i,m.j);
      span.dataset.lookupKey=m.key;
      span.addEventListener("click",e=>{
        // A click without a selection opens the vocabulary definition.
        const sel=doc.defaultView.getSelection();
        if(!sel || sel.isCollapsed) showWord(m.mkind,m.key);
      });
      frag.appendChild(span);
      last=m.j;
    });
    if(last<source.length) frag.appendChild(doc.createTextNode(source.slice(last)));
    n.parentNode.replaceChild(frag,n);
  });
}


function showWord(kind,key){
 const d=DATA[kind==="word"?"words":"phrases"][key];
 current={text:key,kind,cefr:d.cefr,meaning:d.meaning};
 $("word").textContent=key;$("pron").textContent=(kind==="phrase"?"Phrase":"Word")+" · "+d.cefr;
 $("meaning").textContent=d.meaning;
 $("popup").classList.remove("hidden");
 currentChapter=currentChapter||"Current chapter";
}





function installMarking(view){
  const doc=view?.document, win=doc?.defaultView;
  if(!doc || !win || !book?.rendition) return;
  if(view.__v5MarkingInstalled) return;
  view.__v5MarkingInstalled=true;

  const rendition=book.rendition;
  const palette=document.createElement("div");
  palette.className="v5-mark-palette hidden";
  palette.innerHTML=
    '<button data-c="red" title="Red">❤️</button>'+
    '<button data-c="yellow" title="Yellow">🧡</button>'+
    '<button data-c="blue" title="Blue">💙</button>'+
    '<button data-c="purple" title="Purple">💜</button>'+
    '<button data-c="green" title="Green">💚</button>';
  document.body.appendChild(palette);

  let pendingCfi=null;
  let pendingText="";

  function sync(){
    palette.querySelectorAll("button").forEach(b=>{
      b.classList.toggle("active",b.dataset.c===markColor);
    });
  }
  function hide(){
    palette.classList.add("hidden");
    pendingCfi=null;
    pendingText="";
  }

  function showFromSelection(){
    const sel=win.getSelection();
    if(!sel || sel.rangeCount===0 || sel.isCollapsed) return;
    const text=sel.toString().replace(/\s+/g," ").trim();
    if(!text) return;

    const range=sel.getRangeAt(0);
    if(!doc.body.contains(range.commonAncestorContainer)) return;

    let cfi;
    try{
      cfi=rendition.getCfiFromRange(range);
    }catch(e){
      return;
    }
    if(!cfi) return;

    pendingCfi=cfi;
    pendingText=text;
    sync();
    palette.classList.remove("hidden");

    const rect=range.getBoundingClientRect();
    const pr=palette.getBoundingClientRect();
    let left=rect.left+rect.width/2-pr.width/2;
    let top=rect.top-pr.height-10;

    // Convert iframe coordinates to top-level viewport coordinates.
    const frame=view.window?.frameElement;
    if(frame){
      const fr=frame.getBoundingClientRect();
      left += fr.left;
      top += fr.top;
    }
    left=Math.max(8,Math.min(window.innerWidth-pr.width-8,left));
    top=Math.max(8,top);
    palette.style.left=left+"px";
    palette.style.top=top+"px";
  }

  let timer=0;
  const schedule=()=>{
    clearTimeout(timer);
    timer=setTimeout(showFromSelection,50);
  };
  doc.addEventListener("mouseup",schedule,true);
  doc.addEventListener("touchend",schedule,true);
  doc.addEventListener("selectionchange",schedule,true);

  function addAnnotation(color){
    if(!pendingCfi)return;

    const className="v5-mark-"+color;
    const styles={
      red:{color:"#c98b8b"},
      yellow:{color:"#d5c58b"},
      blue:{color:"#8eabc0"},
      purple:{color:"#a694b8"},
      green:{color:"#8eaa8e"}
    };
    const style=styles[color]||styles.yellow;

    try{
      rendition.annotations.remove(pendingCfi,"underline");
    }catch(e){}

    rendition.annotations.add(
      "underline",
      pendingCfi,
      {},
      null,
      "v5-mark-"+color,
      {color:style.color, "stroke-width":"3", "stroke-linecap":"round"}
    );

    markColor=color;
    localStorage.setItem("reader-mark-color",color);

    marks.push({
      text:pendingText,
      color,
      cfi:pendingCfi,
      at:Date.now()
    });
    marks=marks.slice(-2000);
    localStorage.setItem("reader-marks-v5",JSON.stringify(marks));

    // Keep the existing optional vocabulary behavior, but marking itself
    // never depends on vocabulary membership.
    const normalized=pendingText.toLowerCase();
    let vocabItem=null;
    if(DATA?.words){
      const key=Object.keys(DATA.words).find(k=>k.toLowerCase()===normalized);
      if(key){
        const d=DATA.words[key];
        vocabItem={text:key,kind:"word",cefr:d.cefr,meaning:d.meaning,addedAt:Date.now()};
      }
    }
    if(!vocabItem && DATA?.phrases){
      const key=Object.keys(DATA.phrases).find(k=>k.toLowerCase()===normalized);
      if(key){
        const d=DATA.phrases[key];
        vocabItem={text:key,kind:"phrase",cefr:d.cefr,meaning:d.meaning,addedAt:Date.now()};
      }
    }
    if(vocabItem){
      vocab=JSON.parse(localStorage.getItem("reader-vocab")||"[]");
      if(!vocab.some(x=>x.text.toLowerCase()===vocabItem.text.toLowerCase())){
        vocab.push(vocabItem);
        localStorage.setItem("reader-vocab",JSON.stringify(vocab));
      }
    }

    toast(vocabItem?"Marked · added to Vocabulary":"Marked");
    try{win.getSelection()?.removeAllRanges()}catch(e){}
    hide();
  }

  palette.addEventListener("click",e=>{
    const btn=e.target.closest("button");
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    addAnnotation(btn.dataset.c);
  });

  document.addEventListener("mousedown",e=>{
    if(!palette.contains(e.target)) hide();
  },true);
}





function restoreMarks(doc){
 const saved=JSON.parse(localStorage.getItem("reader-marks-v34")||localStorage.getItem("reader-marks")||"[]");if(!saved.length||!doc?.body)return;
 saved.forEach(m=>{
   if(!m.text||m.text.length<2)return;
   const w=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),hits=[];
   while(w.nextNode()){const n=w.currentNode;if(n.parentElement?.closest(".user-mark,script,style"))continue;if(n.nodeValue.includes(m.text))hits.push(n)}
   if(hits.length!==1)return;
   const n=hits[0],i=n.nodeValue.indexOf(m.text),f=doc.createDocumentFragment();
   if(i)f.appendChild(doc.createTextNode(n.nodeValue.slice(0,i)));
   const span=doc.createElement("span");span.className="user-mark mark-"+m.color;span.dataset.markColor=m.color;span.textContent=m.text;f.appendChild(span);
   if(i+m.text.length<n.nodeValue.length)f.appendChild(doc.createTextNode(n.nodeValue.slice(i+m.text.length)));
   n.parentNode.replaceChild(f,n);
 });
}

function updateToc(loc){
 if(!window.__tocItems?.length)return;
 const href=(loc?.start?.href||"").split("#")[0];
 let active=null;
 window.__tocItems.forEach(b=>{
   b.classList.remove("active");
   if(b.dataset.href&&href&&(href.endsWith(b.dataset.href)||b.dataset.href.endsWith(href)))active=b;
 });
 if(active){active.classList.add("active");active.scrollIntoView({block:"nearest",behavior:"smooth"})}
}

function updateProgress(loc){
 try{
   if(!locations){book.locations.generate(1600).then(x=>{locations=x;updateProgress(loc)});return}
   const p=Math.max(0,Math.min(100,Math.round(locations.percentageFromCfi(loc.start.cfi)*100)));
   $("location").textContent=p+"%";$("progressFill").style.width=p+"%";
   if(activeBookId){
     library=JSON.parse(localStorage.getItem("reader-library")||"[]");
     const b=library.find(x=>x.id===activeBookId);
     if(b){b.progress=p/100;b.lastRead=Date.now();if(p>=99.5&&!b.completed){b.completed=true;b.finishedAt=Date.now();toast("🎉 Book finished!")}localStorage.setItem("reader-library",JSON.stringify(library));}
   }
 }catch(e){}
}
function toast(m){$("toast").textContent=m;$("toast").classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.add("hidden"),1600)}


/* =========================
   V5.1 — refined Pomodoro
   ========================= */
const POMO_KEY="english-reader-pomodoro";
let pomoMinutes=Number(localStorage.getItem(POMO_KEY+"-minutes")||25);
let pomoRemaining=pomoMinutes*60;
let pomoRunning=false;
let pomoInterval=null;
let pomoCompleted=Number(localStorage.getItem(POMO_KEY+"-completed")||0);
let pomoToday=Number(localStorage.getItem(POMO_KEY+"-today-count")||0);
let pomoTodayKey=localStorage.getItem(POMO_KEY+"-today-key")||"";

function pomoTodayResetIfNeeded(){
  const k=todayKey();
  if(pomoTodayKey!==k){pomoTodayKey=k;pomoToday=0;localStorage.setItem(POMO_KEY+"-today-key",k);localStorage.setItem(POMO_KEY+"-today-count","0");}
}
pomoTodayResetIfNeeded();

function renderPomodoro(){
  const total=pomoMinutes*60;
  const elapsed=total-pomoRemaining;
  const deg=Math.max(0,Math.min(360,(elapsed/total)*360));
  const ring=$("timerRing");
  if(ring)ring.style.setProperty("--progress",deg+"deg");
  const m=Math.floor(pomoRemaining/60), sec=pomoRemaining%60;
  if($("pomoTime"))$("pomoTime").textContent=String(m).padStart(2,"0")+":"+String(sec).padStart(2,"0");
  if($("pomoStart"))$("pomoStart").textContent=pomoRunning?"Pause":"Start focus";
  if($("pomoHint"))$("pomoHint").textContent=pomoRunning?"in focus":"deep reading";
  if($("pomoToday"))$("pomoToday").textContent=pomoToday;
  if($("pomoTotal"))$("pomoTotal").textContent=pomoCompleted;
  const mins=Math.floor(Number(localStorage.getItem(POMO_KEY+"-minutes-total")||0));
  if($("pomoMinutes"))$("pomoMinutes").textContent=mins+"m";
}

function savePomoStats(){
  localStorage.setItem(POMO_KEY+"-completed",String(pomoCompleted));
  localStorage.setItem(POMO_KEY+"-today-count",String(pomoToday));
  localStorage.setItem(POMO_KEY+"-minutes-total",String(Number(localStorage.getItem(POMO_KEY+"-minutes-total")||0)+pomoMinutes));
  localStorage.setItem(POMO_KEY+"-minutes",String(pomoMinutes));
}

function resetPomodoro(){
  if(pomoInterval)clearInterval(pomoInterval);
  pomoInterval=null;pomoRunning=false;pomoRemaining=pomoMinutes*60;renderPomodoro();
}
function finishPomodoro(){
  if(pomoInterval)clearInterval(pomoInterval);
  pomoInterval=null;pomoRunning=false;pomoCompleted++;pomoToday++;savePomoStats();
  pomoRemaining=pomoMinutes*60;renderPomodoro();
  toast("Focus session complete · take a short break");
  try{document.title="Break · English Reader";setTimeout(()=>document.title="English Reader",3500)}catch(e){}
}
function togglePomodoro(){
  if(pomoRunning){
    pomoRunning=false;clearInterval(pomoInterval);pomoInterval=null;renderPomodoro();return;
  }
  pomoRunning=true;
  clearInterval(pomoInterval);
  pomoInterval=setInterval(()=>{
    if(pomoRemaining<=1){finishPomodoro();return}
    pomoRemaining--;renderPomodoro();
  },1000);
  renderPomodoro();
}

$("openPomodoro").onclick=()=>{
  pomoTodayResetIfNeeded();
  $("pomodoro").classList.remove("hidden");
  renderPomodoro();
};
$("pomoClose").onclick=()=>{$("pomodoro").classList.add("hidden")};
$("pomodoro").addEventListener("mousedown",e=>{if(e.target===$("pomodoro"))$("pomodoro").classList.add("hidden")});
$("pomoStart").onclick=togglePomodoro;
$("pomoReset").onclick=resetPomodoro;
$("pomoSkip").onclick=()=>{resetPomodoro();toast("Timer reset")};
document.querySelectorAll(".preset").forEach(b=>b.onclick=()=>{
  if(pomoRunning)return;
  pomoMinutes=Number(b.dataset.preset)||25;
  pomoRemaining=pomoMinutes*60;
  localStorage.setItem(POMO_KEY+"-minutes",String(pomoMinutes));
  document.querySelectorAll(".preset").forEach(x=>x.classList.toggle("active",x===b));
  renderPomodoro();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")$("pomodoro")?.classList.add("hidden");
  if(e.key===" " && document.activeElement?.tagName!=="INPUT" && document.activeElement?.tagName!=="TEXTAREA" && !$("pomodoro")?.classList.contains("hidden")){
    e.preventDefault();togglePomodoro();
  }
});
renderPomodoro();

(function watchTocCount(){
  const toc=document.getElementById("toc"), count=document.getElementById("tocCount");
  if(!toc||!count)return;
  const update=()=>{
    const n=toc.querySelectorAll("button").length;
    count.textContent=n?n+" chapters":"";
  };
  new MutationObserver(update).observe(toc,{childList:true,subtree:true});
  update();
})();
