let DATA={words:{},phrases:{}},book=null,rendition=null,locations=null;
let highlightLevel=localStorage.getItem("highlight-level")||"B2";
let current=null, markColor=localStorage.getItem("reader-mark-color")||"yellow";
let currentCfi="", currentChapter="";
let notes=JSON.parse(localStorage.getItem("reader-notes")||"[]");
let vocab=JSON.parse(localStorage.getItem("reader-vocab")||"[]");
let sessionStarted=0;
let lastActivity=0;
let timerInterval=null;
let activeBookId="";
let library=JSON.parse(localStorage.getItem("reader-library")||"[]");
let marks=JSON.parse(localStorage.getItem("reader-marks-v34")||localStorage.getItem("reader-marks")||"[]");

const $=id=>document.getElementById(id);
fetch("vocabulary.json").then(r=>r.json()).then(d=>{
  DATA=d;$("levelSelect").value=highlightLevel;
}).catch(console.error);

$("epubInput").addEventListener("change",e=>e.target.files[0]&&openBook(e.target.files[0]));
$("prev").onclick=()=>rendition?.prev();$("next").onclick=()=>rendition?.next();
$("theme").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("reader-dark",document.body.classList.contains("dark"))};
if(localStorage.getItem("reader-dark")==="true")document.body.classList.add("dark");

const fs=localStorage.getItem("reader-font-size")||"18";
$("fontSize").value=fs;
$("fontSize").onchange=()=>{let n=$("fontSize").value;localStorage.setItem("reader-font-size",n);rendition?.themes.fontSize(n+"px")};
$("fontUp").onclick=()=>{$("fontSize").value=String(Math.min(42,Number($("fontSize").value)+2));$("fontSize").dispatchEvent(new Event("change"))};
$("fontDown").onclick=()=>{$("fontSize").value=String(Math.max(18,Number($("fontSize").value)-2));$("fontSize").dispatchEvent(new Event("change"))};
$("levelSelect").onchange=()=>{highlightLevel=$("levelSelect").value;localStorage.setItem("highlight-level",highlightLevel);rendition?.views().forEach(v=>decorate(v.document))};

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
    if(!vocab.length){body.innerHTML='<div class="empty">No saved words yet.<br>Click a highlighted word and choose “Add to vocabulary”.</div>';return}
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
    notes=JSON.parse(localStorage.getItem("reader-notes")||"[]");
    body.innerHTML=`
      <div class="note-add">
        <textarea id="newNote" placeholder="Write a note about what you are reading..."></textarea>
        <button id="addNote">Add</button>
      </div>`+
      (notes.length?notes.slice().reverse().map((n,i)=>`
        <div class="note-item">
          <div class="note-ref">${escapeHtml(n.chapter||"Current chapter")} · ${new Date(n.at).toLocaleString()}</div>
          <div class="note-text">${escapeHtml(n.text)}</div>
          <div class="note-actions"><button class="item-delete" data-note="${notes.length-1-i}">Delete</button></div>
        </div>`).join(""):'<div class="empty">No notes yet.</div>');
    $("addNote").onclick=()=>{
      const text=$("newNote").value.trim();if(!text){toast("Write a note first");return}
      notes.push({text,chapter:currentChapter||"Current chapter",cfi:currentCfi,at:Date.now()});
      localStorage.setItem("reader-notes",JSON.stringify(notes));renderDrawer("Notes");toast("Note saved");
    };
    body.querySelectorAll("[data-note]").forEach(b=>b.onclick=()=>{
      notes.splice(Number(b.dataset.note),1);localStorage.setItem("reader-notes",JSON.stringify(notes));renderDrawer("Notes");
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

async function openBook(file){
 try{
  const buf=await file.arrayBuffer();
  book=ePub(buf);
  $("viewer").innerHTML="";
  rendition=book.renderTo("viewer",{width:"100%",height:"auto",spread:"none",flow:"scrolled-doc"});
  rendition.themes.default({
    body:{color:"inherit !important",background:"transparent !important",fontFamily:"Georgia,serif",fontSize:fs+"px",lineHeight:"1.8",padding:"0 7% !important"},
    ".reader-word":{background:"#fff2b8",borderRadius:"3px",cursor:"pointer",padding:"0 2px"},
    ".reader-phrase":{background:"#dceeff",borderRadius:"3px",cursor:"pointer",padding:"0 2px"}
  });
  rendition.on("rendered",(_,view)=>setTimeout(()=>{
    decorate(view.document);restoreMarks(view.document);installMarking(view);
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
  $("prev").disabled=false;$("next").disabled=false;toast("Book loaded");
 }catch(e){console.error(e);toast("This EPUB could not be opened")}
}

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

function allowed(level){
 return highlightLevel==="B2" ? (level==="B2"||level==="C1") : level==="C1";
}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}

function decorate(doc){
 if(!doc?.body)return;
 const phraseKeys=Object.keys(DATA.phrases).filter(k=>allowed(DATA.phrases[k].cefr)).sort((a,b)=>b.length-a.length);
 const wordKeys=Object.keys(DATA.words).filter(k=>allowed(DATA.words[k].cefr)).sort((a,b)=>b.length-a.length);
 const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{
   if(!n.nodeValue.trim()||n.parentElement?.closest(".reader-word,.reader-phrase,.user-mark,script,style"))return;
   const source=n.nodeValue,all=[];
   phraseKeys.forEach(k=>{const r=new RegExp("\\b"+esc(k).replace(/\\ /g,"\\s+")+"\\b","gi");let m;while((m=r.exec(source)))all.push({i:m.index,j:m.index+m[0].length,text:m[0],kind:"phrase",key:k})});
   wordKeys.forEach(k=>{const r=new RegExp("\\b"+esc(k)+"\\b","gi");let m;while((m=r.exec(source)))all.push({i:m.index,j:m.index+m[0].length,text:m[0],kind:"word",key:k})});
   all.sort((a,b)=>a.i-b.i||b.j-a.j);
   const picked=[];let end=-1;
   for(const x of all)if(x.i>=end){picked.push(x);end=x.j}
   if(!picked.length)return;
   const f=doc.createDocumentFragment();let last=0;
   picked.forEach(x=>{
     f.appendChild(doc.createTextNode(source.slice(last,x.i)));
     const span=doc.createElement("span");
     span.className=x.kind==="phrase"?"reader-phrase":"reader-word";span.textContent=x.text;
     span.addEventListener("click",()=>showWord(x.kind,x.key));
     f.appendChild(span);last=x.j;
   });
   f.appendChild(doc.createTextNode(source.slice(last)));n.parentNode.replaceChild(f,n);
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
  const doc=view?.document;
  if(!doc || doc.__markInstalled) return;
  doc.__markInstalled=true;

  // The toolbar lives inside the EPUB iframe, so it stays aligned with
  // the selection and never depends on the outer page's coordinates.
  const bubble=doc.createElement("div");
  bubble.className="mark-bubble hidden";
  bubble.innerHTML=
    '<button data-c="red" title="Red">🟥</button>'+
    '<button data-c="yellow" title="Yellow">🟨</button>'+
    '<button data-c="blue" title="Blue">🩵</button>'+
    '<button data-c="purple" title="Purple">🟪</button>'+
    '<button data-c="green" title="Green">🟩</button>';
  doc.body.appendChild(bubble);

  let pendingRange=null;
  let pendingText="";
  let hideTimer=null;

  const hide=()=>{
    bubble.classList.add("hidden");
    pendingRange=null;
    pendingText="";
  };

  function positionToolbar(range){
    const rect=range.getBoundingClientRect();
    const win=doc.defaultView;
    const maxLeft=Math.max(8,win.innerWidth-bubble.offsetWidth-8);
    const left=Math.max(8,Math.min(maxLeft,rect.left+(rect.width/2)-bubble.offsetWidth/2));
    const top=Math.max(8,rect.top-bubble.offsetHeight-10);
    bubble.style.left=left+"px";
    bubble.style.top=top+"px";
  }

  function showForSelection(){
    const sel=doc.defaultView.getSelection();
    if(!sel || sel.rangeCount===0 || sel.isCollapsed){
      return;
    }
    const text=sel.toString().replace(/\s+/g," ").trim();
    if(!text) return;

    const range=sel.getRangeAt(0);
    if(!doc.body.contains(range.commonAncestorContainer)) return;

    pendingRange=range.cloneRange();
    pendingText=text;

    bubble.classList.remove("hidden");
    // Wait one frame so offsetWidth/height are real before positioning.
    requestAnimationFrame(()=>positionToolbar(pendingRange));
  }

  // selectionchange catches mouse, touchpad and keyboard selections.
  doc.addEventListener("selectionchange",()=>{
    clearTimeout(hideTimer);
    hideTimer=setTimeout(()=>{
      const sel=doc.defaultView.getSelection();
      if(sel && !sel.isCollapsed && sel.toString().trim()) showForSelection();
      else hide();
    },80);
  });

  doc.addEventListener("scroll",()=>{
    if(pendingRange && !bubble.classList.contains("hidden")) positionToolbar(pendingRange);
  });

  // Prevent clicking the palette from replacing the current selection.
  bubble.addEventListener("mousedown",e=>e.preventDefault());

  function collectSelectedTextNodes(range){
    const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode()){
      const n=walker.currentNode;
      if(!n.nodeValue || !n.nodeValue.trim()) continue;
      if(n.parentElement?.closest("script,style,.mark-bubble")) continue;
      try{
        if(range.intersectsNode(n)) nodes.push(n);
      }catch(e){}
    }
    return nodes;
  }

  function markRange(range,color){
    // Never call Range.surroundContents(): that is what caused the old
    // "one paragraph" limitation. We split text nodes ourselves instead.
    const nodes=collectSelectedTextNodes(range);
    if(!nodes.length) return false;

    let changed=false;
    nodes.forEach(n=>{
      let a=0,b=n.nodeValue.length;
      if(n===range.startContainer) a=range.startOffset;
      if(n===range.endContainer) b=range.endOffset;

      // Defensive handling when the selection endpoint is an element.
      if(range.startContainer===n.parentNode) a=Math.min(a,n.nodeValue.length);
      if(range.endContainer===n.parentNode) b=Math.min(b,n.nodeValue.length);

      if(a<0)a=0;
      if(b>n.nodeValue.length)b=n.nodeValue.length;
      if(a>=b)return;

      const frag=doc.createDocumentFragment();
      if(a) frag.appendChild(doc.createTextNode(n.nodeValue.slice(0,a)));

      const span=doc.createElement("span");
      span.className="user-mark mark-"+color;
      span.dataset.markColor=color;
      span.textContent=n.nodeValue.slice(a,b);
      frag.appendChild(span);

      if(b<n.nodeValue.length) frag.appendChild(doc.createTextNode(n.nodeValue.slice(b)));
      n.parentNode.replaceChild(frag,n);
      changed=true;
    });
    return changed;
  }

  bubble.addEventListener("click",e=>{
    const btn=e.target.closest("button");
    if(!btn || !pendingRange)return;

    const color=btn.dataset.c;
    setMarkColor(color,false);
    const text=pendingText;
    const range=pendingRange.cloneRange();

    if(markRange(range,color)){
      marks.push({text,color,at:Date.now()});
      marks=marks.slice(-1000);
      localStorage.setItem("reader-marks-v34",JSON.stringify(marks));
      toast("Marked");
    }else{
      toast("Could not mark the selection");
    }

    doc.defaultView.getSelection()?.removeAllRanges();
    hide();
  });

  doc.addEventListener("mousedown",e=>{
    if(!bubble.contains(e.target)) hide();
  });
}


function restoreMarks(doc){
 const saved=JSON.parse(localStorage.getItem("reader-marks")||"[]");if(!saved.length||!doc?.body)return;
 saved.forEach(m=>{
   if(!m.text||m.text.length<2)return;
   const w=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),hits=[];
   while(w.nextNode()){const n=w.currentNode;if(n.parentElement?.closest(".user-mark,script,style"))continue;if(n.nodeValue.includes(m.text))hits.push(n)}
   if(hits.length!==1)return;
   const n=hits[0],i=n.nodeValue.indexOf(m.text),f=doc.createDocumentFragment();
   if(i)f.appendChild(doc.createTextNode(n.nodeValue.slice(0,i)));
   const span=doc.createElement("span");span.className="user-mark mark-"+m.color;span.textContent=m.text;f.appendChild(span);
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
