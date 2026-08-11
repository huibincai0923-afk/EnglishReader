let DATA={words:{},phrases:{}},book=null,rendition=null,locations=null;
let highlightLevel=localStorage.getItem("highlight-level")||"B2";
let current=null, markColor="yellow";
let marks=JSON.parse(localStorage.getItem("reader-marks")||"[]");

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
 let a=JSON.parse(localStorage.getItem("reader-vocab")||"[]");
 if(!a.some(x=>x.text===current.text))a.push(current);
 localStorage.setItem("reader-vocab",JSON.stringify(a));
 $("popup").classList.add("hidden");toast("Added to vocabulary");
};

document.querySelectorAll(".mark-btn").forEach(b=>b.onclick=()=>{
 markColor=b.dataset.mark;
 document.querySelectorAll(".mark-btn").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 toast("Mark color: "+b.textContent);
});

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
      localStorage.setItem("reader-cfi",loc.start.cfi);
      updateToc(loc);updateProgress(loc);
    }
  });
  const meta=await book.loaded.metadata;
  $("bookTitle").textContent=meta.title||file.name.replace(/\.epub$/i,"");
  $("bookAuthor").textContent=meta.creator||"EPUB";
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
 $("meaning").textContent=d.meaning;$("popup").classList.remove("hidden");
}

function installMarking(view){
 const doc=view?.document;if(!doc||doc.__markInstalled)return;doc.__markInstalled=true;
 const bubble=doc.createElement("div");bubble.className="mark-bubble hidden";
 bubble.innerHTML='<button data-c="red">红</button><button data-c="yellow">黄</button><button data-c="blue">蓝</button><button data-c="purple">紫</button><button data-c="green">绿</button>';
 doc.body.appendChild(bubble);
 let pending=null;

 function textNodes(root){
   const w=doc.createTreeWalker(root,NodeFilter.SHOW_TEXT),a=[];while(w.nextNode())a.push(w.currentNode);return a;
 }
 function applyRange(range,color){
   const root=range.commonAncestorContainer.nodeType===1?range.commonAncestorContainer:range.commonAncestorContainer.parentElement||doc.body;
   const nodes=textNodes(root).filter(n=>{
     if(!n.nodeValue.trim()||n.parentElement?.closest("script,style,.mark-bubble"))return false;
     try{return range.intersectsNode(n)}catch(e){return false}
   });
   let changed=false;
   nodes.forEach(n=>{
     let a=0,b=n.nodeValue.length;
     if(n===range.startContainer)a=range.startOffset;
     if(n===range.endContainer)b=range.endOffset;
     if(a>=b)return;
     const frag=doc.createDocumentFragment();
     if(a)frag.appendChild(doc.createTextNode(n.nodeValue.slice(0,a)));
     const span=doc.createElement("span");span.className="user-mark mark-"+color;span.textContent=n.nodeValue.slice(a,b);
     frag.appendChild(span);
     if(b<n.nodeValue.length)frag.appendChild(doc.createTextNode(n.nodeValue.slice(b)));
     n.parentNode.replaceChild(frag,n);changed=true;
   });
   return changed;
 }
 doc.addEventListener("mouseup",()=>{
   setTimeout(()=>{
     const sel=doc.defaultView.getSelection();
     if(!sel||sel.isCollapsed||!sel.toString().trim())return;
     const range=sel.getRangeAt(0);
     if(!doc.body.contains(range.commonAncestorContainer))return;
     pending={range:range.cloneRange(),text:sel.toString().trim()};
     const rect=range.getBoundingClientRect();
     bubble.style.left=Math.max(8,Math.min(doc.documentElement.clientWidth-190,rect.left+rect.width/2-95))+"px";
     bubble.style.top=Math.max(8,rect.top+doc.defaultView.scrollY-50)+"px";
     bubble.classList.remove("hidden");
   },25);
 });
 bubble.addEventListener("mousedown",e=>e.preventDefault());
 bubble.addEventListener("click",e=>{
   const btn=e.target.closest("button");if(!btn||!pending)return;
   const color=btn.dataset.c;
   if(applyRange(pending.range,color)){
     marks.push({text:pending.text,color,at:Date.now()});marks=marks.slice(-1000);
     localStorage.setItem("reader-marks",JSON.stringify(marks));toast("Marked");
   }else toast("Could not mark the selection");
   doc.defaultView.getSelection()?.removeAllRanges();bubble.classList.add("hidden");pending=null;
 });
 doc.addEventListener("mousedown",e=>{if(!bubble.contains(e.target))bubble.classList.add("hidden")});
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
 }catch(e){}
}
function toast(m){$("toast").textContent=m;$("toast").classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.add("hidden"),1600)}
