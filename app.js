let DATA={words:{},phrases:{}},book=null,rendition=null,locations=null,current=null,highlightLevel=localStorage.getItem("highlight-level")||"B2";
const $=id=>document.getElementById(id);
fetch("vocabulary.json").then(r=>r.json()).then(d=>{DATA=d; $("levelSelect").value=highlightLevel;}).catch(console.error);

$("epubInput").addEventListener("change",e=>e.target.files[0]&&openBook(e.target.files[0]));
$("prev").onclick=()=>rendition?.prev(); $("next").onclick=()=>rendition?.next();
document.addEventListener("keydown",e=>{if(["INPUT","SELECT"].includes(e.target.tagName))return;if(e.key==="ArrowLeft")rendition?.prev();if(e.key==="ArrowRight")rendition?.next()});
$("fontUp").onclick=()=>rendition?.themes.fontSize("115%");
$("fontDown").onclick=()=>rendition?.themes.fontSize("90%");
$("theme").onclick=()=>{document.body.classList.toggle("dark");localStorage.setItem("reader-dark",document.body.classList.contains("dark"))};
if(localStorage.getItem("reader-dark")==="true")document.body.classList.add("dark");
$("levelSelect").onchange=()=>{highlightLevel=$("levelSelect").value;localStorage.setItem("highlight-level",highlightLevel);if(rendition)rendition.views().forEach(v=>decorate(v.document))};
$("close").onclick=()=>{$("popup").classList.add("hidden")};
$("save").onclick=()=>{if(!current)return;let a=JSON.parse(localStorage.getItem("reader-vocab")||"[]");if(!a.some(x=>x.text===current.text))a.push(current);localStorage.setItem("reader-vocab",JSON.stringify(a));$("popup").classList.add("hidden");toast("Added to vocabulary")};

async function openBook(file){
 try{
  const buf=await file.arrayBuffer(); book=ePub(buf);
  $("viewer").innerHTML="";
  rendition=book.renderTo("viewer",{width:"100%",height:"100%",spread:"none",flow:"scrolled-doc"});
  rendition.themes.default({body:{color:"inherit !important",background:"transparent !important",fontFamily:"Georgia,serif",fontSize:"18px",lineHeight:"1.75",padding:"0 8% !important"},
   ".reader-word":{background:"#fff2b8",borderRadius:"3px",cursor:"pointer",padding:"0 2px"},
   ".reader-phrase":{background:"#dceeff",borderRadius:"3px",cursor:"pointer",padding:"0 2px"}});
  rendition.on("rendered",(_,view)=>setTimeout(()=>decorate(view.document),30));
  rendition.on("relocated",loc=>{if(loc?.start){localStorage.setItem("reader-cfi",loc.start.cfi);updateProgress(loc)}});
  const meta=await book.loaded.metadata;$("bookTitle").textContent=meta.title||file.name.replace(/\.epub$/i,"");$("bookAuthor").textContent=meta.creator||"EPUB";
  await buildToc();const saved=localStorage.getItem("reader-cfi");await rendition.display(saved||undefined);
  $("prev").disabled=false;$("next").disabled=false;toast("Book loaded");
 }catch(e){console.error(e);toast("Could not open this EPUB")}
}
async function buildToc(){
 const nav=await book.loaded.navigation;$("toc").innerHTML="";
 const walk=arr=>arr.forEach(x=>{if(x.label&&x.href){let b=document.createElement("button");b.textContent=x.label.trim();b.onclick=()=>rendition.display(x.href);$("toc").appendChild(b)}if(x.subitems)walk(x.subitems)});
 walk(nav.toc||[]);if(!$("toc").children.length)$("toc").innerHTML="<small>No table of contents found.</small>";
}
function rank(x){return x==="C1"?1:0}
function allowed(level){return highlightLevel==="B1"||level===highlightLevel|| (highlightLevel==="B2"&&level==="C1")}
function esc(s){return s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}
function decorate(doc){
 if(!doc?.body)return;
 const phraseKeys=Object.keys(DATA.phrases).filter(k=>allowed(DATA.phrases[k].cefr)).sort((a,b)=>b.length-a.length);
 const wordKeys=Object.keys(DATA.words).filter(k=>allowed(DATA.words[k].cefr)).sort((a,b)=>b.length-a.length);
 if(!phraseKeys.length&&!wordKeys.length)return;
 const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 nodes.forEach(n=>{
  if(!n.nodeValue.trim()||n.parentElement.closest(".reader-word,.reader-phrase,script,style,svg"))return;
  const source=n.nodeValue;
  const all=[];
  phraseKeys.forEach(k=>{const r=new RegExp("\\b"+esc(k).replace(/\\ /g,"\\s+")+"\\b","gi");let m;while((m=r.exec(source)))all.push({i:m.index,j:m.index+m[0].length,text:m[0],kind:"phrase",key:k})});
  wordKeys.forEach(k=>{const r=new RegExp("\\b"+esc(k)+"\\b","gi");let m;while((m=r.exec(source)))all.push({i:m.index,j:m.index+m[0].length,text:m[0],kind:"word",key:k})});
  all.sort((a,b)=>a.i-b.i||b.j-a.j);
  const picked=[];let end=-1;for(const x of all)if(x.i>=end){picked.push(x);end=x.j}
  if(!picked.length)return;
  const f=doc.createDocumentFragment();let last=0;
  picked.forEach(x=>{f.appendChild(doc.createTextNode(source.slice(last,x.i)));const s=doc.createElement("span");s.className=x.kind==="phrase"?"reader-phrase":"reader-word";s.textContent=x.text;s.addEventListener("click",()=>show(x.kind,x.key));f.appendChild(s);last=x.j});
  f.appendChild(doc.createTextNode(source.slice(last)));n.parentNode.replaceChild(f,n);
 });
}
function show(kind,key){const d=DATA[kind==="word"?"words":"phrases"][key];current={text:key,kind,cefr:d.cefr,meaning:d.meaning};$("word").textContent=key;$("pron").textContent=(kind==="phrase"?"Phrase":"Word")+" · "+d.cefr;$("meaning").textContent=d.meaning;$("level").textContent=d.cefr;$("popup").classList.remove("hidden")}
function updateProgress(loc){try{if(!locations){book.locations.generate(1600).then(x=>{locations=x;updateProgress(loc)});return}const p=Math.max(0,Math.min(100,Math.round(locations.percentageFromCfi(loc.start.cfi)*100)));$("progress").textContent=p+"%";$("progressFill").style.width=p+"%";$("location").textContent=p+"%"}catch(e){}}
function toast(m){$("toast").textContent=m;$("toast").classList.remove("hidden");clearTimeout(window.__toast);window.__toast=setTimeout(()=>$("toast").classList.add("hidden"),1600)}
