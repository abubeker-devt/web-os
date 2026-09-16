(()=>{
"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const Store={
  prefix:"webos.",
  get(k,d){try{const v=localStorage.getItem(this.prefix+k);return v===null?d:JSON.parse(v)}catch{return d}},
  set(k,v){try{localStorage.setItem(this.prefix+k,JSON.stringify(v))}catch{}},
  remove(k){try{localStorage.removeItem(this.prefix+k)}catch{}},
  bytes(){let b=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(this.prefix))b+=k.length+(localStorage.getItem(k)||"").length}}catch{}return b}
};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const timeAgo=ts=>{if(!ts)return"";const s=Math.floor((Date.now()-ts)/1000);if(s<60)return"just now";if(s<3600)return Math.floor(s/60)+"m ago";if(s<86400)return Math.floor(s/3600)+"h ago";return new Date(ts).toLocaleDateString()};
const fmtNum=n=>{if(!isFinite(n))return"Error";if(Math.abs(n)>=1e12)return n.toExponential(6);const r=Math.round(n*1e10)/1e10;return String(r)};
function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}}
const _scriptLoads={};
function loadScript(src){
  if(_scriptLoads[src])return _scriptLoads[src];
  const p=new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[src="${src}"]`);
    if(existing){
      if(existing.dataset.loaded==="1")return resolve();
      existing.addEventListener("load",()=>resolve());
      existing.addEventListener("error",()=>reject(new Error("Could not load "+src+" (are you offline?)")));
      return;
    }
    const s=document.createElement("script");s.src=src;
    s.onload=()=>{s.dataset.loaded="1";resolve()};
    s.onerror=()=>reject(new Error("Could not load "+src+" (are you offline?)"));
    document.head.appendChild(s);
  });
  _scriptLoads[src]=p;
  return p;
}
function ensureJSZip(){
  return window.JSZip?Promise.resolve(window.JSZip):loadScript("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js").then(()=>window.JSZip);
}
const TEXT_EXT=/\.(txt|md|js|json|css|html|htm|xml|csv|ts|jsx|tsx|py|c|cpp|h|sh|yml|yaml|svg|log)$/i;
const MIME_EXT={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",gif:"image/gif",webp:"image/webp",svg:"image/svg+xml",pdf:"application/pdf",mp3:"audio/mpeg",wav:"audio/wav",mp4:"video/mp4",webm:"video/webm",zip:"application/zip",ico:"image/x-icon",bmp:"image/bmp"};
const mimeFor=name=>MIME_EXT[(name.split(".").pop()||"").toLowerCase()]||"application/octet-stream";
function readDroppedFile(file){
  return new Promise(resolve=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    if(TEXT_EXT.test(file.name))reader.readAsText(file);else reader.readAsDataURL(file);
  });
}
function uniqueChildName(folderNode,name){
  let n=name,idx=2;
  while(folderNode.children[n]){const dot=n.lastIndexOf(".");n=(dot>0?n.slice(0,dot):n)+" ("+(idx++)+")"+(dot>0?n.slice(dot):"")}
  return n;
}
const isTouch=("ontouchstart"in window)||navigator.maxTouchPoints>0;
const APP_REGISTRY={};
let desktopIcons=[];
const INSTALLED_DEFAULT=["weather","game","music","paint"];
const App={
  register(id,def){
    APP_REGISTRY[id]=Object.assign({id,name:id,title:id,icon:"📦",core:false,width:480,height:380,html:"",init:null,onClose:null},def);
  },
  get(id){return APP_REGISTRY[id]},
  all(){return Object.values(APP_REGISTRY)},
  visible(){
    const installed=Store.get("installed",INSTALLED_DEFAULT);
    return this.all().filter(d=>d.core||installed.includes(d.id));
  }
};
const WM={
  layer:null,z:100,windows:{},minSize:{w:280,h:180},activeId:null,
  init(){this.layer=$("#windowsLayer")},
  open(id,args={}){
    const def=App.get(id);if(!def)return null;
    const winId="win-"+id;if(this.windows[winId]){const w=this.windows[winId];if(w.minimized)this.restore(winId);else this.focus(winId);return w}
    const el=document.createElement("div");el.className="window "+def.id+"-win";el.id=winId;
    el.innerHTML=`<div class="window-top"><div class="window-title"><span class="win-icon">${def.icon}</span>${esc(def.title)}</div><div class="window-actions"><button class="wbtn min" title="Minimize">—</button><button class="wbtn max" title="Maximize">▢</button><button class="wbtn close" title="Close">✕</button></div></div><div class="window-body"></div>`;
    this.layer.appendChild(el);
    const ws=Store.get("winstate",{})[id];
    const desktop=$("#desktop"),dw=desktop.clientWidth,dh=desktop.clientHeight;
    const w=Math.min(def.width||520,dw-40),h=Math.min(def.height||380,dh-this.minSize.h-30);
    const count=Object.keys(this.windows).length;
    if(ws){el.style.left=ws.l;el.style.top=ws.t;el.style.width=ws.w;el.style.height=ws.h}
    else{el.style.width=w+"px";el.style.height=h+"px";el.style.left=Math.max(12,(dw-w)/2+count*24-40)+"px";el.style.top=Math.max(12,(dh-h-30)/2+count*18-20)+"px"}
    this.attachResize(el);
    const top=el.querySelector(".window-top");
    top.addEventListener("pointerdown",e=>{if(e.target.closest(".window-actions"))return;if(el.classList.contains("maximized"))return;this.dragStart(el,e.pointerId,e)});
    top.addEventListener("dblclick",e=>{if(e.target.closest(".window-actions"))return;this.toggleMax(winId)});
    el.querySelector(".min").addEventListener("click",e=>{e.stopPropagation();this.minimize(winId)});
    el.querySelector(".max").addEventListener("click",e=>{e.stopPropagation();this.toggleMax(winId)});
    el.querySelector(".close").addEventListener("click",e=>{e.stopPropagation();this.close(winId)});
    el.addEventListener("pointerdown",()=>this.focus(winId));
    const body=el.querySelector(".window-body");
    body.innerHTML=def.html||"";
    const winObj={id:winId,app:id,el,minimized:false,maximized:false,preMax:null,args};
    this.windows[winId]=winObj;
    if(def.init){try{def.init(body,winObj,args)}catch(e){console.error(e);body.innerHTML=`<div style="color:var(--red)">App error: ${esc(e.message)}</div>`}}
    if(Settings.get().winAnim){el.classList.add("opening");requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove("opening")))}
    el.classList.add("show");
    this.focus(winId);
    Taskbar.refresh();
    SFX.open();
    return winObj;
  },
  focus(winId){
    const w=this.windows[winId];if(!w)return;
    w.el.style.zIndex=++this.z;
    this.activeId=winId;
    Object.values(this.windows).forEach(x=>x.el.classList.toggle("active",x.id===winId));
    Taskbar.refresh();
    if(typeof Widgets!=="undefined")Widgets.ticker&&Widgets.ticker();
  },
  focused(){return this.activeId},
  minimize(winId){
    const w=this.windows[winId];if(!w)return;
    SFX.minimize();
    if(Settings.get().winAnim){
      const tbBtn=$(`.task-app[data-win="${winId}"]`);
      if(tbBtn){
        const tr=tbBtn.getBoundingClientRect(),wr=w.el.getBoundingClientRect();
        const dx=(tr.left+tr.width/2)-(wr.left+wr.width/2),dy=(tr.top+tr.height/2)-(wr.top+wr.height/2);
        w.el.style.transformOrigin="center center";
        w.el.style.transition="transform .22s ease,opacity .22s ease";
        w.el.style.transform=`translate(${dx}px,${dy}px) scale(.12)`;
        w.el.style.opacity="0";
        setTimeout(()=>{w.minimized=true;w.el.classList.remove("show");w.el.style.transform="";w.el.style.opacity="";w.el.style.transition="";Taskbar.refresh()},220);
        return;
      }
    }
    w.minimized=true;w.el.classList.remove("show");Taskbar.refresh();
  },
  restore(winId){const w=this.windows[winId];if(!w)return;w.minimized=false;w.el.classList.add("show");this.focus(winId)},
  close(winId){
    const w=this.windows[winId];if(!w)return;
    const def=App.get(w.app);
    if(def&&def.onClose)try{def.onClose(w)}catch{}
    SFX.close();
    const finish=()=>{
      w.el.remove();delete this.windows[winId];
      if(this.activeId===winId)this.activeId=null;
      Object.values(this.windows).filter(x=>!x.minimized).sort((a,b)=>(parseFloat(b.el.style.zIndex)||0)-(parseFloat(a.el.style.zIndex)||0))[0]&&this.focus(Object.values(this.windows).filter(x=>!x.minimized).sort((a,b)=>(parseFloat(b.el.style.zIndex)||0)-(parseFloat(a.el.style.zIndex)||0))[0].id);
      Taskbar.refresh();saveWinState();
    };
    if(Settings.get().winAnim&&!w.minimized){
      w.el.classList.add("closing");
      setTimeout(finish,160);
    }else finish();
  },
  toggleMax(winId){
    const w=this.windows[winId];if(!w)return;
    const el=w.el;
    if(el.classList.contains("maximized")){
      el.classList.remove("maximized");
      w.preMax&&(el.style.left=w.preMax.l,el.style.top=w.preMax.t,el.style.width=w.preMax.w,el.style.height=w.preMax.h);
      el.querySelector(".max").textContent="▢";
      saveWinState();
    }else{
      w.preMax={l:el.style.left,t:el.style.top,w:el.style.width,h:el.style.height};
      el.classList.add("maximized");
      el.querySelector(".max").textContent="❐";
      saveWinState();
    }
  },
  snapRect(region){
    const dw=$("#desktop").clientWidth,dh=$("#desktop").clientHeight;
    const tileH=Math.floor((dh-varPx("--taskbar-h")-28)/2),tileW=Math.floor(dw/2);
    const rects={
      left:{l:14,t:14,w:tileW-21,h:tileH*2-14},
      right:{l:dw/2+7,t:14,w:tileW-21,h:tileH*2-14},
      tl:{l:14,t:14,w:tileW-21,h:tileH-21},
      tr:{l:dw/2+7,t:14,w:tileW-21,h:tileH-21},
      bl:{l:14,t:tileH+21,w:tileW-21,h:tileH-21},
      br:{l:dw/2+7,t:tileH+21,w:tileW-21,h:tileH-21},
      max:{l:0,t:0,w:dw,h:dh-varPx("--taskbar-h")-28}
    };
    return rects[region];
  },
  snap(winId,region){
    const w=this.windows[winId];if(!w)return;
    const el=w.el;
    w.preMax={l:el.style.left,t:el.style.top,w:el.style.width,h:el.style.height};
    el.classList.remove("maximized");
    if(region==="max"){el.classList.add("maximized");el.querySelector(".max").textContent="❐";saveWinState();return}
    const r=this.snapRect(region);if(!r)return;
    el.style.left=r.l+"px";el.style.top=r.t+"px";el.style.width=r.w+"px";el.style.height=r.h+"px";
    saveWinState();
  },
  snapRegionAt(x,y){
    const desktop=$("#desktop"),dw=desktop.clientWidth,dh=desktop.clientHeight;
    const edge=28,corner=90;
    const nearLeft=x<edge,nearRight=x>dw-edge,nearTop=y<edge,nearBottom=y>dh-edge;
    if(nearTop&&x<corner)return"tl";
    if(nearTop&&x>dw-corner)return"tr";
    if(nearBottom&&x<corner)return"bl";
    if(nearBottom&&x>dw-corner)return"br";
    if(nearTop)return"max";
    if(nearLeft)return"left";
    if(nearRight)return"right";
    return null;
  },
  ghost(region){
    let g=$("#snapGhost");
    if(!region){if(g)g.classList.remove("show");return}
    if(!g){g=document.createElement("div");g.id="snapGhost";g.className="snap-ghost";$("#desktop").appendChild(g)}
    const r=this.snapRect(region);if(!r)return;
    g.style.left=r.l+"px";g.style.top=r.t+"px";g.style.width=r.w+"px";g.style.height=r.h+"px";
    g.classList.add("show");
  },
  dragStart(el,pid,e){
    try{el.querySelector(".window-top").setPointerCapture(pid)}catch{}
    const sx=e.clientX,sy=e.clientY;
    const ol=parseFloat(el.style.left)||0,ot=parseFloat(el.style.top)||0;
    const desktop=$("#desktop");
    let pendingRegion=null;
    function move(ev){
      if(ev.pointerId!==pid)return;
      let nl=ol+(ev.clientX-sx),nt=ot+(ev.clientY-sy);
      nl=Math.max(-el.offsetWidth+80,Math.min(nl,desktop.clientWidth-80));
      nt=Math.max(0,Math.min(nt,desktop.clientHeight-80));
      el.style.left=nl+"px";el.style.top=nt+"px";
      if(Settings.get().snapEnabled){
        pendingRegion=WM.snapRegionAt(ev.clientX,ev.clientY);
        WM.ghost(pendingRegion);
      }
    }
    function up(ev){
      if(ev.pointerId!==pid)return;
      el.querySelector(".window-top").removeEventListener("pointermove",move);
      el.querySelector(".window-top").removeEventListener("pointerup",up);
      el.querySelector(".window-top").removeEventListener("pointercancel",up);
      try{el.querySelector(".window-top").releasePointerCapture(pid)}catch{}
      WM.ghost(null);
      saveWinState();
      if(pendingRegion&&Settings.get().snapEnabled&&!el.classList.contains("maximized")){
        WM.snap(WM.windows["win-"+el.id.split("-")[1]].id,pendingRegion);
      }
    }
    el.querySelector(".window-top").addEventListener("pointermove",move);
    el.querySelector(".window-top").addEventListener("pointerup",up);
    el.querySelector(".window-top").addEventListener("pointercancel",up);
  },
  attachResize(el){
    const dirs=["n","s","e","w","ne","nw","se","sw"];
    dirs.forEach(dir=>{
      const h=document.createElement("div");h.className="rz "+dir;el.appendChild(h);
      h.addEventListener("pointerdown",e=>{
        if(el.classList.contains("maximized"))return;
        e.stopPropagation();e.preventDefault();
        try{h.setPointerCapture(e.pointerId)}catch{}
        const pid=e.pointerId,sx=e.clientX,sy=e.clientY;
        const rect={l:el.offsetLeft,t:el.offsetTop,w:el.offsetWidth,h:el.offsetHeight};
        const MINW=280,MINH=160;
        function mv(ev){
          if(ev.pointerId!==pid)return;
          let l=rect.l,t=rect.t,w=rect.w,h=rect.h;
          if(dir.includes("e"))w=Math.max(MINW,rect.w+(ev.clientX-sx));
          if(dir.includes("s"))h=Math.max(MINH,rect.h+(ev.clientY-sy));
          if(dir.includes("w")){w=Math.max(MINW,rect.w-(ev.clientX-sx));l=rect.l+(rect.w-w)}
          if(dir.includes("n")){h=Math.max(MINH,rect.h-(ev.clientY-sy));t=rect.t+(rect.h-h)}
          el.style.left=l+"px";el.style.top=t+"px";el.style.width=w+"px";el.style.height=h+"px";
        }
        function up(ev){
          if(ev.pointerId!==pid)return;
          h.removeEventListener("pointermove",mv);h.removeEventListener("pointerup",up);h.removeEventListener("pointercancel",up);
          saveWinState();
        }
        h.addEventListener("pointermove",mv);h.addEventListener("pointerup",up);h.addEventListener("pointercancel",up);
      });
    });
  }
};
function varPx(name){return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))||0}
function saveWinState(){
  const st={};
  Object.values(WM.windows).forEach(w=>{
    if(!w.el.classList.contains("maximized")){
      st[w.app]={l:w.el.style.left,t:w.el.style.top,w:w.el.style.width,h:w.el.style.height};
    }
  });
  Store.set("winstate",st);
}
const NotifCenter={
  unread:0,
  list(){return Store.get("notifs",[])},
  save(l){Store.set("notifs",l.slice(0,30))},
  push(title,msg,icon="🔔",sticky=false){
    const l=this.list();l.unshift({title,msg,icon,at:Date.now(),read:false});this.save(l);this.unread++;this.renderBadge();
    toast(title,msg,icon,sticky);
    SFX.notif();
    this.notifyOS(title,msg);
  },
  notifyOS(title,msg){
    if(!Settings.get().systemNotifs)return;
    if(typeof Notification==="undefined"||Notification.permission!=="granted")return;
    if(document.visibilityState==="visible"&&document.hasFocus())return;
    try{const n=new Notification(title,{body:msg,icon:"icons/icon-192.png",tag:"webos-"+Date.now()});n.onclick=()=>{window.focus();n.close()}}catch{}
  },
  log(title,msg,icon="🔔"){
    const l=this.list();l.unshift({title,msg,icon,at:Date.now(),read:false});this.save(l);this.unread++;this.renderBadge();
  },
  renderBadge(){
    const b=$("#notifBadge");if(!b)return;
    if(this.unread>0){b.hidden=false;b.textContent=this.unread>9?"9+":String(this.unread)}else{b.hidden=true}
  },
  renderPanel(){
    const box=$("#notifList");if(!box)return;const items=this.list();
    this.unread=0;this.renderBadge();
    if(!items.length){box.innerHTML='<div class="notif-empty">No notifications yet</div>';return}
    box.innerHTML=items.map((n,i)=>`<div class="notif-entry" data-i="${i}"><span class="n-icon">${esc(n.icon)}</span><div class="n-body"><div class="n-title">${esc(n.title)}</div><div class="n-msg">${esc(n.msg)}</div></div><span class="n-time">${timeAgo(n.at)}</span></div>`).join("");
  },
  clearAll(){this.save([]);this.renderPanel()}
};
const TOAST_MAX_STACK=3;
function toast(title,msg,icon="🔔",sticky=false){
  const box=$("#notifications"),el=document.createElement("div");el.className="toast";
  el.innerHTML=`<div class="toast-title"><span>${esc(icon)}</span>${esc(title)}<button class="toast-close" title="Dismiss">✕</button></div><div class="toast-msg">${esc(msg)}</div>`;
  box.appendChild(el);
  const remove=()=>{el.classList.add("leaving");setTimeout(()=>el.remove(),320)};
  el.querySelector(".toast-close").addEventListener("click",remove);
  // A toast is always dismissible on its own, even "sticky" ones just stay longer;
  // it never blocks the screen forever.
  const delay=sticky===true?9000:(typeof sticky==="number"?sticky:3500);
  const t=setTimeout(remove,delay);
  el.addEventListener("mouseenter",()=>clearTimeout(t));
  // Cap how many toasts can stack up at once so old ones don't pile up and cover the desktop.
  const stack=[...box.children];
  if(stack.length>TOAST_MAX_STACK){
    stack.slice(0,stack.length-TOAST_MAX_STACK).forEach(old=>{old.classList.add("leaving");setTimeout(()=>old.remove(),320)});
  }
  return el;
}
function actionToast(title,msg,icon,actionLabel,callback,timeout=6000){
  const box=$("#notifications"),el=document.createElement("div");el.className="toast";
  el.innerHTML=`<div class="toast-title"><span>${esc(icon)}</span>${esc(title)}</div><div class="toast-msg">${esc(msg)}</div><div class="toast-actions"><button class="btn ghost tiny toast-dismiss">Dismiss</button><button class="btn tiny toast-action">${esc(actionLabel)}</button></div>`;
  box.appendChild(el);
  let done=false;
  const finish=()=>{if(done)return;done=true;el.classList.add("leaving");setTimeout(()=>el.remove(),320)};
  const t=setTimeout(finish,timeout);
  el.querySelector(".toast-dismiss").addEventListener("click",()=>{clearTimeout(t);finish()});
  el.querySelector(".toast-action").addEventListener("click",()=>{clearTimeout(t);finish();callback&&callback()});
}
const Settings={
  defaults:{wallpaper:"aurora",theme:"dark",accent:"purple",winStyle:"glass",iconSize:"medium",showIcons:true,widgets:true,density:"comfortable",fontSize:15,snapEnabled:true,sounds:true,winAnim:true,deviceName:"WebOS Device",highContrast:false,reduceMotion:false,largeTargets:false,realtimeProtection:true,firewallOn:true,permCamera:true,permClipboard:true,permLocation:true,lockOnBoot:true,autoLockEnabled:true,autoLockMinutes:5,systemNotifs:false},
  get(){return Object.assign({},this.defaults,Store.get("settings",{}))},
  set(p){Store.set("settings",Object.assign(this.get(),p));this.apply()},
  apply(){
    const s=this.get();const r=document.documentElement;
    r.style.setProperty("--accent",ACCENTS[s.accent]||ACCENTS.purple);
    r.style.setProperty("--accent-soft",hexToRgba(ACCENTS[s.accent]||ACCENTS.purple,.45));
    r.style.setProperty("--font-size",s.fontSize+"px");
    r.style.setProperty("--row-pad",s.density==="compact"?"8px":"12px");
    r.style.setProperty("--win-opacity",s.winStyle==="solid"?"1":".82");
    const wp=WALLPAPERS[s.wallpaper]||WALLPAPERS.aurora;
    $("#desktop").style.background=wp.css;
    let resolvedTheme=s.theme;
    if(s.theme==="auto"){
      resolvedTheme=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches===false)?"light":"dark";
      if(!this._autoListener&&window.matchMedia){
        this._autoListener=true;
        try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>{if(Settings.get().theme==="auto")Settings.apply()})}catch{}
      }
    }
    document.body.dataset.theme=resolvedTheme;
    document.body.dataset.winstyle=s.winStyle;
    document.body.dataset.iconsize=s.iconSize;
    document.body.dataset.icons=s.showIcons?"visible":"hidden";
    document.body.dataset.highcontrast=s.highContrast?"on":"off";
    document.body.dataset.reducemotion=s.reduceMotion?"on":"off";
    document.body.dataset.largetargets=s.largeTargets?"on":"off";
    renderDesktopIcons();
    renderStartApps();
    if(typeof Widgets!=="undefined")Widgets.render();
  }
};
function hexToRgba(h,a){const n=parseInt(h.slice(1),16);return"rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")"}
const SFX={
  ctx:null,
  ensure(){if(!this.ctx){try{this.ctx=new(window.AudioContext||window.webkitAudioContext)()}catch{return null}}if(this.ctx.state==="suspended")this.ctx.resume();return this.ctx},
  tone(freq,dur,type="sine",vol=0.05,delay=0){
    if(!Settings.get().sounds)return;
    const ctx=this.ensure();if(!ctx)return;
    const t0=ctx.currentTime+delay;
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t0);
    gain.gain.setValueAtTime(0,t0);
    gain.gain.linearRampToValueAtTime(vol,t0+0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);osc.stop(t0+dur+0.02);
  },
  open(){this.tone(420,0.09,"sine",0.05);this.tone(640,0.11,"sine",0.045,0.05)},
  close(){this.tone(500,0.09,"sine",0.045);this.tone(300,0.11,"sine",0.04,0.05)},
  minimize(){this.tone(380,0.08,"triangle",0.04)},
  click(){this.tone(700,0.035,"square",0.02)},
  notif(){this.tone(760,0.09,"sine",0.05);this.tone(1020,0.13,"sine",0.045,0.09)},
  error(){this.tone(200,0.16,"sawtooth",0.05);this.tone(140,0.2,"sawtooth",0.05,0.08)},
  startup(){this.tone(300,0.14,"sine",0.05);this.tone(450,0.14,"sine",0.045,0.1);this.tone(600,0.18,"sine",0.045,0.2)}
};
const WALLPAPERS={
  aurora:{label:"Aurora",css:"radial-gradient(circle at top left,rgba(122,92,255,.35),transparent 30%),radial-gradient(circle at top right,rgba(255,77,166,.25),transparent 30%),linear-gradient(135deg,#111325,#1a1140 45%,#0e1d3a)"},
  sunset:{label:"Sunset",css:"radial-gradient(circle at 20% 80%,rgba(255,120,60,.4),transparent 40%),linear-gradient(135deg,#2b0f2e,#4a1445 45%,#1a0b33)"},
  ocean:{label:"Ocean",css:"radial-gradient(circle at 70% 20%,rgba(77,184,255,.35),transparent 35%),linear-gradient(135deg,#04182b,#06315c 50%,#02101f)"},
  forest:{label:"Forest",css:"radial-gradient(circle at 30% 20%,rgba(80,200,140,.3),transparent 35%),linear-gradient(135deg,#062015,#0b3a24 50%,#03130c)"},
  graphite:{label:"Graphite",css:"radial-gradient(circle at 50% 0%,rgba(160,160,180,.18),transparent 40%),linear-gradient(160deg,#17181d,#23242b 55%,#101116)"},
  candy:{label:"Candy",css:"radial-gradient(circle at 80% 10%,rgba(255,150,220,.35),transparent 40%),linear-gradient(135deg,#3a0f4d,#7a1f6a 50%,#2a0b3d)"},
  desert:{label:"Desert",css:"radial-gradient(circle at 25% 15%,rgba(255,200,100,.3),transparent 40%),linear-gradient(135deg,#33200a,#5c3a14 50%,#1f1408)"},
  midnight:{label:"Midnight",css:"radial-gradient(circle at 60% 30%,rgba(60,80,255,.25),transparent 40%),linear-gradient(160deg,#050510,#0a0a24 55%,#020208)"}
};
const ACCENTS={
  purple:"#7a5cff",pink:"#ff4da6",blue:"#4db8ff",green:"#3ecf8e",orange:"#ff9f43",red:"#ff5c5c",teal:"#20d6c0",amber:"#ffc857"
};
const VFS={
  data:null,
  load(){this.data=Store.get("vfs",null);if(!this.data){this.data=this.defaultTree();this.save()}},
  save(){Store.set("vfs",this.data)},
  resolve(path){let n=this.data;for(const p of path){if(!n||n.type!=="folder"||!n.children[p])return null;n=n.children[p]}return n},
  list(path){const n=this.resolve(path);if(!n||n.type!=="folder")return[];return Object.values(n.children)},
  createFile(path,name,content=""){const f=this.resolve(path);if(!f||f.type!=="folder"||f.children[name])return false;const t=Date.now();f.children[name]={type:"file",name,content,created:t,modified:t};f.modified=t;this.save();return true},
  createFolder(path,name){const f=this.resolve(path);if(!f||f.type!=="folder"||f.children[name])return false;const t=Date.now();f.children[name]={type:"folder",name,created:t,modified:t,children:{}};f.modified=t;this.save();return true},
  rename(path,oldN,newN){const f=this.resolve(path);if(!f||f.children[oldN]==null||f.children[newN]!=null||!newN)return false;const e=f.children[oldN];delete f.children[oldN];e.name=newN;e.modified=Date.now();f.children[newN]=e;this.save();return true},
  delete(path,name){const f=this.resolve(path);if(!f||!f.children[name])return false;delete f.children[name];this.save();return true},
  move(fromPath,name,toPath){
    const src=this.resolve(fromPath),dest=this.resolve(toPath);
    if(!src||!dest||dest.type!=="folder"||!src.children[name])return false;
    if(JSON.stringify(fromPath)===JSON.stringify(toPath))return true;
    // Can't move a folder into itself or one of its own descendants.
    const node=src.children[name];
    if(node.type==="folder"){
      const isInside=toPath.length>=fromPath.length+1&&toPath.slice(0,fromPath.length).every((p,i)=>p===fromPath[i])&&toPath[fromPath.length]===name;
      if(isInside)return false;
    }
    let n=name,idx=2;while(dest.children[n]){const dot=n.lastIndexOf(".");n=(dot>0?n.slice(0,dot):n)+" ("+(idx++)+")"+(dot>0?n.slice(dot):"")}
    node.name=n;node.modified=Date.now();
    dest.children[n]=node;delete src.children[name];
    this.save();return true;
  },
  ensureInstalledAppsFolder(){
    const f=this.resolve([]);if(!f.children["Installed Apps"]){
      const t=Date.now();f.children["Installed Apps"]={type:"folder",name:"Installed Apps",created:t,modified:t,children:{}};this.save();
    }
    const inst=this.resolve(["Installed Apps"]);
    const installed=Store.get("installed",INSTALLED_DEFAULT);
    installed.forEach(id=>{
      if(!inst.children[id]){
        const def=App.get(id);if(!def)return;
        const t=Date.now();inst.children[id]={type:"file",name:"launch-"+id+".app",content:JSON.stringify({appId:id,name:def.title,icon:def.icon}),created:t,modified:t};
      }
    });
    Object.keys(inst.children).forEach(k=>{
      if(k.startsWith("launch-")){
        const id=k.slice(7,-4);
        const def=App.get(id);
        if(!def||!installed.includes(id))delete inst.children[k];
      }
    });
    this.save();
  },
  readFile(path,name){const f=this.resolve(path);const e=f&&f.children[name];return e&&e.type==="file"?e.content:null},
  writeFile(path,name,content){const f=this.resolve(path);const e=f&&f.children[name];if(!e||e.type!=="file")return false;e.content=content;e.modified=Date.now();this.save();return true},
  count(node=this.data){if(node.type==="file")return 1;return Object.values(node.children||{}).reduce((s,c)=>s+this.count(c),0)},
  defaultTree(){const t=Date.now();return{type:"folder",name:"Home",created:t,modified:t,children:{
    Documents:{type:"folder",name:"Documents",created:t,modified:t,children:{
      "welcome.txt":{type:"file",name:"welcome.txt",created:t,modified:t,content:"Welcome to Web OS 4.2!\n\nV4.2 brings:\n  * Terminal, Code Editor & PDF Viewer — install from the App Store\n  * Real window snapping (drag to edges/corners) + Alt-Tab switcher\n  * Task Manager (Ctrl+Shift+Esc) with live processes\n  * Drag & drop file uploads and .zip compress/extract in File Manager\n  * Sound effects, window animations, and an Auto (system) theme\n"}
    }},
    Pictures:{type:"folder",name:"Pictures",created:t,modified:t,children:{}},
    Music:{type:"folder",name:"Music",created:t,modified:t,children:{}},
    Downloads:{type:"folder",name:"Downloads",created:t,modified:t,children:{}}
  }}}
};
const Trash={
  list(){return Store.get("trash",[])},
  save(l){Store.set("trash",l.slice(0,80))},
  put(path,name){
    const f=VFS.resolve(path);const e=f&&f.children[name];if(!e)return false;
    delete f.children[name];VFS.save();
    const l=this.list();l.unshift({name,from:path,node:e,at:Date.now()});this.save(l);
    return true;
  },
  restore(i){
    const l=this.list();const it=l[i];if(!it)return false;
    const f=VFS.resolve(it.from);if(!f||f.type!=="folder"||f.children[it.name])return false;
    f.children[it.name]=it.node;f.modified=Date.now();VFS.save();l.splice(i,1);this.save(l);
    return true;
  },
  purge(i){const l=this.list();if(!l[i])return false;l.splice(i,1);this.save(l);return true},
  empty(){this.save([])},
  count(){return this.list().length}
};
function fileIcon(name,isFolder){
  if(isFolder){
    if(name==="Installed Apps")return"📲";
    return"📁";
  }
  if(name.startsWith("launch-")&&name.endsWith(".app"))return"📲";
  const ext=name.split(".").pop().toLowerCase();
  const m={txt:"📄",md:"📝",json:"🧾",js:"📜",css:"🎨",html:"🌐",png:"🖼️",jpg:"🖼️",jpeg:"🖼️",gif:"🖼️",svg:"🖼️",mp3:"🎵",wav:"🎵",mp4:"🎬",pdf:"📕",zip:"🗜️",csv:"📊",app:"📲"};
  return m[ext]||"📄";
}
function fileTypeLabel(name,isFolder){
  if(isFolder)return"Folder";
  if(name.startsWith("launch-")&&name.endsWith(".app"))return"App Shortcut";
  const ext=name.split(".").pop().toLowerCase();
  const m={txt:"Text File",md:"Markdown File",json:"JSON File",js:"JavaScript File",css:"Stylesheet",html:"HTML Document",
    png:"PNG Image",jpg:"JPEG Image",jpeg:"JPEG Image",gif:"GIF Image",svg:"SVG Image",webp:"WEBP Image",
    mp3:"Audio File",wav:"Audio File",mp4:"Video File",webm:"Video File",pdf:"PDF Document",zip:"Archive",csv:"CSV Spreadsheet"};
  return m[ext]||(ext&&ext!==name?ext.toUpperCase()+" File":"File");
}
function fileSizeLabel(bytes){
  if(bytes<1024)return bytes+" byte"+(bytes===1?"":"s");
  if(bytes<1024*1024)return(bytes/1024).toFixed(1)+" KB";
  return(bytes/(1024*1024)).toFixed(1)+" MB";
}
function fileByteSize(node){
  if(node.type==="folder")return Object.keys(node.children||{}).length;
  return new Blob([node.content||""]).size;
}
function fmtDateLabel(ts){return ts?new Date(ts).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"}):"—"}
const PropertiesDialog={
  open(path,node){
    const old=$("#propsDialog");if(old)old.remove();
    const overlay=document.createElement("div");overlay.className="folder-picker-overlay";overlay.id="propsDialog";
    const isFolder=node.type==="folder";
    const size=isFolder?`${fileByteSize(node)} item${fileByteSize(node)===1?"":"s"}`:fileSizeLabel(fileByteSize(node));
    const loc=path.length?"Home / "+path.join(" / "):"Home";
    overlay.innerHTML=`<div class="folder-picker props-dialog">
      <div class="fp-head"><strong>📄 File Properties</strong><button class="wbtn close fp-close" title="Close">✕</button></div>
      <div class="props-body">
        <div class="props-icon">${fileIcon(node.name,isFolder)}</div>
        <table class="props-table">
          <tr><td>Name</td><td>${esc(node.name)}</td></tr>
          <tr><td>Type</td><td>${esc(fileTypeLabel(node.name,isFolder))}</td></tr>
          <tr><td>Location</td><td>${esc(loc)}</td></tr>
          <tr><td>Size</td><td>${esc(size)}</td></tr>
          <tr><td>Created</td><td>${fmtDateLabel(node.created)}</td></tr>
          <tr><td>Modified</td><td>${fmtDateLabel(node.modified)}</td></tr>
        </table>
      </div>
      <div class="fp-actions"><span></span><button class="btn tiny fp-ok">Done</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const close=()=>overlay.remove();
    overlay.querySelector(".fp-close").addEventListener("click",close);
    overlay.querySelector(".fp-ok").addEventListener("click",close);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
  }
};
const Installer={
  installed(){return Store.get("installed",INSTALLED_DEFAULT)},
  isInstalled(id){return this.installed().includes(id)},
  install(id){
    if(this.isInstalled(id))return false;
    Store.set("installed",[...this.installed(),id]);
    const def=App.get(id);NotifCenter.push("App Store",`"${def.title}" installed. Open it from Start, Desktop, or Installed Apps folder.`,def.icon);
    VFS.ensureInstalledAppsFolder();
    refreshAll();
    return true;
  },
  uninstall(id,skipUndo=false){
    if(!this.isInstalled(id))return false;
    const def=App.get(id);
    const winId="win-"+id;
    if(WM.windows[winId])WM.close(winId);
    if(!skipUndo){
      actionToast("App Store",`"${def.title}" uninstalled.`,def.icon,"Undo",()=>{this.install(id)},6500);
    }
    Store.set("installed",this.installed().filter(x=>x!==id));
    VFS.ensureInstalledAppsFolder();
    refreshAll();
    return true;
  }
};
function refreshAll(){renderDesktopIcons();renderStartApps();if(VFS.renderCurrent)VFS.renderCurrent()}
const Taskbar={
  init(){$("#taskApps").innerHTML=""},
  refresh(){
    const box=$("#taskApps");if(!box)return;
    box.innerHTML="";
    const installed=Store.get("installed",INSTALLED_DEFAULT);
    Object.values(WM.windows).forEach(w=>{
      const def=App.get(w.app);if(!def)return;
      const btn=document.createElement("button");
      btn.className="tb-btn open"+(w.id===WM.activeId&&!w.minimized?" focused":"");
      btn.title=def.title;
      btn.dataset.win=w.id;
      btn.classList.add("task-app");
      btn.innerHTML=`<span>${def.icon}</span>`;
      btn.addEventListener("click",()=>{
        if(w.minimized)WM.restore(w.id);
        else if(WM.activeId===w.id)WM.minimize(w.id);
        else WM.focus(w.id);
      });
      box.appendChild(btn);
    });
  }
};
function renderStartApps(){
  const box=$("#startApps");if(!box)return;box.innerHTML="";
  App.visible().filter(def=>!def.desktopOnly).forEach(def=>{
    const tile=document.createElement("button");
    tile.className="app-tile";
    tile.dataset.app=def.id;
    tile.innerHTML=`<span class="tile-icon">${def.icon}</span><span>${esc(def.title)}</span>`;
    tile.addEventListener("click",()=>{WM.open(def.id);StartMenu.close()});
    box.appendChild(tile);
  });
}
const ICON_COLORS={
  thispc:"#5b7fd6",notes:"#ffc857",files:"#4db8ff",trash:"#8a93a6",calculator:"#3ecf8e",
  browser:"#4d7dff",settings:"#8a93a6",paint:"#ff4da6",weather:"#4db8ff",
  music:"#7a5cff",game:"#ff9f43",store:"#3ecf8e",sysinfo:"#7a5cff",about:"#ff5c5c",
  camera:"#3a3d46",taskmgr:"#ff6b6b",editor:"#2f6fed",terminal:"#1c1c22",pdfviewer:"#e5484d",
  security:"#2ecc71",phonelink:"#4d7dff",photos:"#ff9f43"
};
function renderDesktopIcons(){
  const box=$("#desktopIcons");if(!box)return;
  box.innerHTML="";
  if(!Settings.get().showIcons)return;
  desktopIcons=[];
  const installed=Store.get("installed",INSTALLED_DEFAULT);
  const order=["thispc","notes","files","trash","calculator","browser","camera","photos","security","phonelink","taskmgr","settings","paint","weather","music","game","store","sysinfo","about"];
  order.concat(installed).forEach(id=>{
    if(desktopIcons.includes(id))return;
    const def=App.get(id);if(!def||(!def.core&&!installed.includes(id)))return;
    desktopIcons.push(id);
    const tile=document.createElement("div");
    tile.className="desktop-icon";
    tile.dataset.app=id;
    tile.draggable=true;
    const badge=id==="trash"&&Trash.count()>0?`<span class="icon-badge">${Trash.count()}</span>`:"";
    const tint=ICON_COLORS[id];
    const tintStyle=tint?` style="background:linear-gradient(135deg,${hexToRgba(tint,0.9)},${hexToRgba(tint,0.55)})"`:"";
    tile.innerHTML=`<div class="icon-box"${tintStyle}><span class="app-glyph">${def.icon}</span>${badge}</div><span class="lbl">${esc(def.title)}</span>`;
    tile.addEventListener("click",e=>{e.stopPropagation();box.querySelectorAll(".desktop-icon").forEach(x=>x.classList.remove("selected"));tile.classList.add("selected")});
    tile.addEventListener("dblclick",()=>WM.open(id));
    if(isTouch)tile.addEventListener("click",()=>WM.open(id));
    tile.addEventListener("dragstart",e=>{e.dataTransfer.setData("text/app-id",id);tile.classList.add("dragging")});
    tile.addEventListener("dragend",()=>tile.classList.remove("dragging"));
    box.appendChild(tile);
  });
  box.querySelectorAll(".desktop-icon").forEach(t=>{
    t.addEventListener("click",e=>{if(e.target.closest(".desktop-icon")===t){
      box.querySelectorAll(".desktop-icon").forEach(x=>x.classList.remove("selected"));t.classList.add("selected");
    }});
  });
  $$(".desktop-icon").forEach(t=>t.addEventListener("click",e=>e.stopPropagation()));
  applyDesktopGridOrder(box);
}
function applyDesktopGridOrder(box){
  const saved=Store.get("desktopOrder",{});
  [...box.children].sort((a,b)=>{
    const ai=saved[a.dataset.app],bi=saved[b.dataset.app];
    if(ai!=null&&bi!=null)return ai-bi;
    if(ai!=null)return -1;
    if(bi!=null)return 1;
    return 0;
  }).forEach(el=>box.appendChild(el));
}
function openApp(id,args){WM.open(id,args);StartMenu.close()}
App.register("notes",{
  id:"notes",core:true,title:"Notes",icon:"📝",width:560,height:440,
  html:`
    <div class="notes-app">
      <div class="notes-title-row">
        <input class="input notes-title" placeholder="Note title…">
        <button class="btn notes-save">💾 Save</button>
      </div>
      <div class="toolbar">
        <button class="btn ghost tiny notes-list-toggle">📋 Notes</button>
        <input class="input notes-search" placeholder="Search…" style="flex:1;min-width:80px">
        <button class="btn ghost tiny notes-new">＋ New</button>
        <button class="btn ghost tiny notes-delete">🗑️ Delete</button>
      </div>
      <div class="note-list"></div>
      <textarea class="notes-area" placeholder="Start typing…"></textarea>
      <div class="notes-status-bar"><span class="notes-counts">0 words · 0 chars</span><span class="notes-status">New note</span></div>
    </div>`,
  init(body,win){
    const titleEl=body.querySelector(".notes-title"),areaEl=body.querySelector(".notes-area"),listEl=body.querySelector(".note-list"),statusEl=body.querySelector(".notes-status"),countsEl=body.querySelector(".notes-counts"),searchEl=body.querySelector(".notes-search");
    const KEY="notes.list";
    const get=()=>Store.get(KEY,{}),set=l=>Store.set(KEY,l);
    const updCounts=()=>{const t=areaEl.value;const w=t.trim()?t.trim().split(/\s+/).length:0;countsEl.textContent=`${w} words · ${t.length} chars`};
    const markSaved=()=>statusEl.textContent="Saved ✓",markDirty=()=>statusEl.textContent="Unsaved changes";
    const renderList=()=>{
      const q=searchEl.value.trim().toLowerCase();
      const l=get();
      const names=Object.keys(l).filter(n=>!q||n.toLowerCase().includes(q)||(l[n].content||"").toLowerCase().includes(q)).sort((a,b)=>(l[b].pinned?1:0)-(l[a].pinned?1:0)||(l[b].updated||0)-(l[a].updated||0));
      if(!names.length){listEl.innerHTML=`<div class="note-list-row" style="cursor:default;color:var(--muted)">No notes</div>`;return}
      listEl.innerHTML=names.map(n=>{const m=(l[n].pinned?"📌 ":"")+timeAgo(l[n].updated);return`<div class="note-list-row${l[n].pinned?" pinned":""}" data-name="${esc(n)}"><span>📄 ${esc(n)}</span><span class="note-meta">${esc(m)}</span><button class="note-pin">${l[n].pinned?"Unpin":"Pin"}</button></div>`}).join("");
    };
    const load=n=>{const l=get();if(l[n]){titleEl.value=n;areaEl.value=l[n].content;markSaved();updCounts();renderList()}};
    const save=()=>{const n=titleEl.value.trim();if(!n){NotifCenter.push("Notes","Add a title first.","📝");return}const l=get(),p=l[n];l[n]={content:areaEl.value,created:p?p.created:Date.now(),updated:Date.now(),pinned:p?!!p.pinned:false};set(l);markSaved();updCounts();renderList();NotifCenter.push("Notes",`Saved "${n}".`,"📝")};
    body.querySelector(".notes-save").addEventListener("click",save);
    body.querySelector(".notes-new").addEventListener("click",()=>{titleEl.value="";areaEl.value="";markDirty();updCounts();titleEl.focus()});
    body.querySelector(".notes-delete").addEventListener("click",()=>{
      const n=titleEl.value.trim();if(!n)return;const l=get();if(!l[n]){NotifCenter.push("Notes","This note hasn't been saved.","📝");return}
      actionToast("Notes",`Delete "${n}"?`,"🗑️","Delete",()=>{delete l[n];set(l);renderList();titleEl.value="";areaEl.value="";updCounts();NotifCenter.push("Notes",`"${n}" deleted.`,"🗑️")});
    });
    body.querySelector(".notes-list-toggle").addEventListener("click",()=>{listEl.classList.toggle("show");if(listEl.classList.contains("show"))renderList()});
    searchEl.addEventListener("input",()=>listEl.classList.contains("show")&&renderList());
    listEl.addEventListener("click",e=>{
      const row=e.target.closest(".note-list-row");if(!row||!row.dataset.name)return;
      if(e.target.classList.contains("note-pin")){const l=get(),n=row.dataset.name;if(l[n]){l[n].pinned=!l[n].pinned;set(l);renderList()}return}
      load(row.dataset.name);
    });
    [titleEl,areaEl].forEach(el=>el.addEventListener("input",()=>{markDirty();updCounts()}));
    body.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save()}});
    updCounts();
    if(win.args&&win.args.note){const l=get();const n=l[win.args.note];if(n){titleEl.value=win.args.note;areaEl.value=n.content;markSaved();updCounts();renderList()}}
  }
});
const filesAppDef={
  id:"files",core:true,title:"File Manager",icon:"📁",width:680,height:480,
  html:`
    <div class="files-app">
      <div class="files-body">
        <div class="files-sidebar">
          <button class="files-nav-item" data-nav="root"><span class="files-nav-icon">🖥️</span><span>This PC</span></button>
          <button class="files-nav-item" data-nav="root"><span class="files-nav-icon">🏠</span><span>Home</span></button>
          <button class="files-nav-item" data-nav="trash"><span class="files-nav-icon">🗑️</span><span>Recycle Bin</span></button>
        </div>
        <div class="files-main">
          <div class="toolbar"><button class="btn ghost tiny files-up" title="Up">⬆</button><div class="crumb-bar"></div></div>
          <div class="toolbar"><input class="input files-search" placeholder="Search…" style="flex:1;min-width:100px"><select class="select files-sort"><option value="name">Name</option><option value="type">Type</option><option value="date">Date</option><option value="size">Size</option></select></div>
          <div class="toolbar">
            <button class="btn tiny files-new-file">📄 New</button>
            <button class="btn ghost tiny files-new-folder">📂 Folder</button>
            <button class="btn ghost tiny files-select-mode">☑️ Select</button>
            <button class="btn ghost tiny files-props">ℹ️ Properties</button>
            <button class="btn ghost tiny files-rename">✏️ Rename</button>
            <button class="btn ghost tiny files-copy">📋 Copy</button>
            <button class="btn ghost tiny files-cut">✂️ Cut</button>
            <button class="btn ghost tiny files-paste">📌 Paste</button>
            <button class="btn ghost tiny files-move">🗂️ Move to…</button>
            <button class="btn ghost tiny files-openwith">🚀 Open with…</button>
            <button class="btn ghost tiny files-compress">🗜️ Compress</button>
            <button class="btn ghost tiny files-extract">📦 Extract</button>
            <button class="btn ghost tiny files-upload">⬆️ Upload…</button>
            <button class="btn ghost tiny files-delete">🗑️ Delete</button>
          </div>
          <div class="folder-grid"></div>
          <input type="file" class="files-upload-input" multiple hidden>
          <div style="font-size:11px;color:var(--muted);display:flex;justify-content:space-between"><span class="files-stats">0 items</span><span class="files-clip"></span></div>
        </div>
      </div>
    </div>`,
  init(body){
    let cwd=[];let selSet=new Set();let lastClicked=null;let clip=null;let multiMode=false;
    const grid=body.querySelector(".folder-grid"),crumbsEl=body.querySelector(".crumb-bar"),searchEl=body.querySelector(".files-search"),sortSel=body.querySelector(".files-sort"),statsEl=body.querySelector(".files-stats"),clipEl=body.querySelector(".files-clip"),selectModeBtn=body.querySelector(".files-select-mode");
    const sorted=items=>{const mode=sortSel.value;return[...items].sort((a,b)=>{if(a.type!==b.type)return a.type==="folder"?-1:1;if(mode==="date")return(b.modified||0)-(a.modified||0);if(mode==="size")return((b.type==="file"?(b.content||"").length:Object.keys(b.children||{}).length)-((a.type==="file"?(a.content||"").length:Object.keys(a.children||{}).length)));if(mode==="type"){const ea=(a.name.split(".").pop()||""),eb=(b.name.split(".").pop()||"");return ea===eb?a.name.localeCompare(b.name):ea.localeCompare(eb)}return a.name.localeCompare(b.name)})};
    const navItems=[...body.querySelectorAll(".files-nav-item")];
    const renderCrumbs=()=>{
      crumbsEl.innerHTML=`<button class="crumb${cwd.length?"":" current"}" data-i="-1">🏠 Home</button>`+cwd.map((p,i)=>`<span class="crumb-sep">›</span><button class="crumb${i===cwd.length-1?" current":""}" data-i="${i}">${esc(p)}</button>`).join("");
      navItems.forEach(n=>n.classList.toggle("active",n.dataset.nav==="root"&&cwd.length===0));
    };
    const updateClip=()=>{clipEl.textContent=clip?`Clipboard: ${clip.mode} ${clip.names.length>1?clip.names.length+" items":'"'+clip.names[0]+'"'}`:selSet.size?`${selSet.size} selected`:"Clipboard empty"};
    VFS.renderCurrent=()=>{
      const node=VFS.resolve(cwd);
      if(!node){cwd=[];return}
      renderCrumbs();
      grid.innerHTML="";
      let items=VFS.list(cwd);
      const q=searchEl.value.trim().toLowerCase();
      if(q)items=items.filter(it=>it.name.toLowerCase().includes(q));
      statsEl.textContent=selSet.size?`${selSet.size} of ${items.length} selected`:`${items.length} item${items.length===1?"":"s"}`;
      if(!items.length){grid.innerHTML=`<div class="empty-state">${q?"No matches":"Empty folder"}</div>`;selSet.clear();return}
      const ordered=sorted(items);
      ordered.forEach(item=>{
        const el=document.createElement("div");
        el.className="file-tile"+(multiMode?" select-mode":"");
        el.title=item.type==="folder"?"Folder":"File";
        el.innerHTML=`${multiMode?`<span class="tile-check">${selSet.has(item.name)?"☑️":"⬜"}</span>`:""}<span class="tile-glyph">${fileIcon(item.name,item.type==="folder")}</span><div class="tile-name">${esc(item.name)}</div><div class="tile-date">${timeAgo(item.modified)}</div>`;
        if(clip&&clip.mode==="cut"&&clip.names.includes(item.name)&&JSON.stringify(clip.from)===JSON.stringify(cwd))el.classList.add("cut");
        if(item.name.endsWith(".app")&&item.name.startsWith("launch-"))el.innerHTML+=`<span class="tile-badge">📲</span>`;
        if(selSet.has(item.name))el.classList.add("selected");
        el.addEventListener("click",e=>{
          e.stopPropagation();
          if(multiMode||e.ctrlKey||e.metaKey){
            if(selSet.has(item.name))selSet.delete(item.name);else selSet.add(item.name);
            lastClicked=item.name;
          }else if(e.shiftKey&&lastClicked){
            const names=ordered.map(x=>x.name);const a=names.indexOf(lastClicked),b=names.indexOf(item.name);
            const[lo,hi]=a<b?[a,b]:[b,a];selSet.clear();for(let i=lo;i<=hi;i++)selSet.add(names[i]);
          }else{
            selSet.clear();selSet.add(item.name);lastClicked=item.name;
          }
          VFS.renderCurrent();updateClip();
        });
        el.addEventListener("dblclick",()=>{if(!multiMode)openItem(item)});
        grid.appendChild(el);
      });
    };
    const renameInline=(defaultName,onDone)=>{
      const target=selSet.size===1?grid.querySelector(".file-tile.selected"):null;
      const finish=v=>{if(v&&v!==defaultName)onDone(v)};
      if(!target){
        const input=document.createElement("input");input.className="input";input.value=defaultName;input.style.cssText="grid-column:1/-1;justify-self:center;width:60%";
        grid.prepend(input);input.focus();input.select();
        const cancel=()=>{if(input.isConnected)input.remove()};
        const commit=()=>{const v=input.value.trim();cancel();finish(v)};
        input.addEventListener("keydown",e=>{if(e.key==="Enter")commit();if(e.key==="Escape")cancel()});
        input.addEventListener("blur",commit);
        return;
      }
      const nameEl=target.querySelector(".tile-name");const orig=nameEl.textContent;
      const input=document.createElement("input");input.className="input";input.value=orig;input.style.cssText="width:100%;text-align:center;font-size:12px;padding:3px";
      nameEl.replaceWith(input);input.focus();input.select();
      const cancel=()=>{if(!input.isConnected)return;const sp=document.createElement("div");sp.className="tile-name";sp.textContent=orig;input.replaceWith(sp)};
      const commit=()=>{const v=input.value.trim();const sp=document.createElement("div");sp.className="tile-name";sp.textContent=v||orig;input.replaceWith(sp);finish(v)};
      input.addEventListener("keydown",e=>{if(e.key==="Enter")commit();if(e.key==="Escape")cancel()});
      input.addEventListener("blur",commit);
    };
    const openWithApp=(item,appId)=>{
      const def=App.get(appId);
      if(!def){NotifCenter.push("File Manager","App not available.","📁");return}
      if(!def.core&&!Installer.isInstalled(appId)){NotifCenter.push("File Manager",`Install "${def.title}" from the App Store to open this.`,def.icon);return}
      const winObj=WM.open(appId,{path:cwd.slice(),name:item.name});
      if(winObj){
        if(appId==="editor"&&winObj.openFile)winObj.openFile(cwd.slice(),item.name);
        if(appId==="pdfviewer"&&winObj.openPdf)winObj.openPdf(cwd.slice(),item.name);
      }
    };
    const CODE_EXT=/\.(js|json|css|html|ts|jsx|tsx|py|c|cpp|sh|xml|yml|yaml|md)$/i;
    const openItem=item=>{
      if(item.type==="folder"){cwd=[...cwd,item.name];searchEl.value="";selSet.clear();VFS.renderCurrent();return}
      if(item.name.startsWith("launch-")&&item.name.endsWith(".app")){
        const data=parseAppFile(item);if(data){WM.open(data.appId);return}
      }
      if(/\.zip$/i.test(item.name)){NotifCenter.push("File Manager","This is an archive — select it and click Extract.","🗜️");return}
      if(/\.pdf$/i.test(item.name)){openWithApp(item,"pdfviewer");return}
      if(/\.(png|jpg|jpeg|gif|webp)$/i.test(item.name)&&(item.content||"").startsWith("data:")){
        WM.open("paint",{});const win=WM.windows["win-paint"];
        if(win){setTimeout(()=>{const cv=win.el.querySelector("canvas");if(cv){const ctx=cv.getContext("2d"),im=new Image();im.onload=()=>{ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(im,0,0,cv.width,cv.height)};im.src=item.content}},30)}
        return;
      }
      if((item.content||"").startsWith&&(item.content||"").startsWith("data:")){NotifCenter.push("File Manager","This file type can't be previewed yet.","📄");return}
      if(CODE_EXT.test(item.name)&&item.name.split(".").pop().toLowerCase()!=="md"){openWithApp(item,"editor");return}
      const content=VFS.readFile(cwd,item.name);
      WM.open("notes",{note:`${cwd.length?cwd.join("/")+"/":""}${item.name}`});
      const win=WM.windows["win-notes"];
      if(win){setTimeout(()=>{const t=win.el.querySelector(".notes-title"),a=win.el.querySelector(".notes-area");if(t)t.value=item.name;if(a)a.value=content||""},30)}
    };
    navItems.forEach(n=>n.addEventListener("click",()=>{
      if(n.dataset.nav==="trash"){WM.open("trash");return}
      cwd=[];searchEl.value="";selSet.clear();VFS.renderCurrent();
    }));
    body.querySelector(".files-up").addEventListener("click",()=>{if(cwd.length){cwd=cwd.slice(0,-1);searchEl.value="";selSet.clear();VFS.renderCurrent()}});
    crumbsEl.addEventListener("click",e=>{const c=e.target.closest(".crumb");if(!c)return;const i=Number(c.dataset.i);cwd=i<0?[]:cwd.slice(0,i+1);searchEl.value="";selSet.clear();VFS.renderCurrent()});
    searchEl.addEventListener("input",debounce(VFS.renderCurrent,80));
    sortSel.addEventListener("change",VFS.renderCurrent);
    selectModeBtn.addEventListener("click",()=>{
      multiMode=!multiMode;selectModeBtn.classList.toggle("on",multiMode);
      if(!multiMode)selSet.clear();
      VFS.renderCurrent();updateClip();
    });
    body.querySelector(".files-new-file").addEventListener("click",()=>{renameInline("untitled.txt",v=>{if(VFS.createFile(cwd,v,"")){VFS.renderCurrent();refreshAll();NotifCenter.push("File Manager",`Created "${v}".`,"📄")}else NotifCenter.push("File Manager",`Name taken.`,"📁")})});
    body.querySelector(".files-new-folder").addEventListener("click",()=>{renameInline("New folder",v=>{if(VFS.createFolder(cwd,v)){VFS.renderCurrent();refreshAll();NotifCenter.push("File Manager",`Created folder "${v}".`,"📂")}else NotifCenter.push("File Manager",`Name taken.`,"📁")})});
    body.querySelector(".files-props").addEventListener("click",()=>{
      if(selSet.size!==1){NotifCenter.push("File Manager","Select exactly one item.","ℹ️");return}
      const name=[...selSet][0];const node=VFS.resolve(cwd).children[name];
      if(node)PropertiesDialog.open(cwd,node);
    });
    body.querySelector(".files-rename").addEventListener("click",()=>{
      if(selSet.size!==1){NotifCenter.push("File Manager","Select exactly one item.","📁");return}
      const name=[...selSet][0];
      renameInline(name,v=>{if(VFS.rename(cwd,name,v)){selSet.clear();selSet.add(v);VFS.renderCurrent();NotifCenter.push("File Manager",`Renamed to "${v}".`,"✏️")}else NotifCenter.push("File Manager",`Cannot rename.`,"📁")});
    });
    body.querySelector(".files-copy").addEventListener("click",()=>{if(!selSet.size){NotifCenter.push("File Manager","Select item(s).","📋");return}clip={mode:"copy",from:[...cwd],names:[...selSet]};updateClip()});
    body.querySelector(".files-cut").addEventListener("click",()=>{if(!selSet.size){NotifCenter.push("File Manager","Select item(s).","✂️");return}clip={mode:"cut",from:[...cwd],names:[...selSet]};VFS.renderCurrent();updateClip()});
    body.querySelector(".files-paste").addEventListener("click",()=>{
      if(!clip){NotifCenter.push("File Manager","Clipboard empty.","📌");return}
      const src=VFS.resolve(clip.from);
      if(!src){clip=null;updateClip();VFS.renderCurrent();NotifCenter.push("File Manager","Source gone.","📌");return}
      let pasted=0;
      clip.names.forEach(name=>{
        const node=src.children[name];if(!node)return;
        let n=name,idx=2;while(VFS.resolve(cwd).children[n]){const dot=n.lastIndexOf(".");n=(dot>0?n.slice(0,dot):n)+" ("+(idx++)+")"+(dot>0?n.slice(dot):"")}
        const c=JSON.parse(JSON.stringify(node));c.name=n;c.modified=Date.now();VFS.resolve(cwd).children[n]=c;
        if(clip.mode==="cut")delete src.children[name];
        pasted++;
      });
      if(clip.mode==="cut")clip=null;
      VFS.save();updateClip();VFS.renderCurrent();NotifCenter.push("File Manager",`Pasted ${pasted} item${pasted===1?"":"s"}.`,"📌");
    });
    body.querySelector(".files-move").addEventListener("click",()=>{
      if(!selSet.size){NotifCenter.push("File Manager","Select item(s) to move.","🗂️");return}
      const names=[...selSet];
      FolderPicker.open(cwd,dest=>{
        let moved=0;names.forEach(name=>{if(VFS.move(cwd,name,dest))moved++});
        selSet.clear();VFS.renderCurrent();refreshAll();
        NotifCenter.push("File Manager",`Moved ${moved} item${moved===1?"":"s"} to ${dest.length?dest.join("/"):"Home"}.`,"🗂️");
      });
    });
    body.querySelector(".files-delete").addEventListener("click",()=>{
      if(!selSet.size){NotifCenter.push("File Manager","Select item(s).","🗑️");return}
      const names=[...selSet];let n=0;
      names.forEach(name=>{if(Trash.put(cwd,name))n++});
      selSet.clear();VFS.renderCurrent();renderDesktopIcons();updateBadge();
      if(n>0){
        const undo=()=>{let restored=0;for(let i=0;i<n;i++){if(Trash.restore(0))restored++}VFS.renderCurrent();renderDesktopIcons();updateBadge();NotifCenter.push("File Manager",`Restored ${restored} item${restored===1?"":"s"}.`,"↩️")};
        NotifCenter.log("File deleted",`${n} item${n===1?"":"s"} moved to Recycle Bin.`,"🗑️");
        actionToast("File deleted",`${n} item${n===1?"":"s"} moved to Recycle Bin.`,"🗑️","Undo",undo,7000);
      }
    });
    body.querySelector(".files-openwith").addEventListener("click",()=>{
      if(selSet.size!==1){NotifCenter.push("File Manager","Select exactly one file.","🚀");return}
      const name=[...selSet][0];const node=VFS.resolve(cwd).children[name];
      if(!node||node.type==="folder"){NotifCenter.push("File Manager","Pick a file, not a folder.","🚀");return}
      const isImg=/\.(png|jpg|jpeg|gif|webp)$/i.test(name),isPdf=/\.pdf$/i.test(name),isCode=CODE_EXT.test(name);
      const candidates=[["notes","Notes"],["editor","Code Editor"],isImg?["paint","Paint"]:null,isPdf?["pdfviewer","PDF Viewer"]:null].filter(Boolean);
      const menu=$("#contextMenu");
      menu.innerHTML=candidates.map(([id,label],i)=>{const def=App.get(id);return`<button class="context-item" data-id="${id}"><span class="ctx-icon">${def?def.icon:"📦"}</span><span>${esc(label)}</span></button>`}).join("");
      const btn=body.querySelector(".files-openwith"),r=btn.getBoundingClientRect();
      menu.style.left=r.left+"px";menu.style.top=(r.bottom+4)+"px";menu.classList.add("show");
      const onPick=e=>{
        const it=e.target.closest(".context-item");menu.classList.remove("show");menu.removeEventListener("click",onPick);
        if(!it)return;
        const id=it.dataset.id;
        if(id==="notes"){openApp("notes");const win=WM.windows["win-notes"];const content=VFS.readFile(cwd,name);if(win){setTimeout(()=>{const t=win.el.querySelector(".notes-title"),a=win.el.querySelector(".notes-area");if(t)t.value=name;if(a)a.value=content||""},30)}return}
        openWithApp(node,id);
      };
      menu.addEventListener("click",onPick);
    });
    body.querySelector(".files-compress").addEventListener("click",async()=>{
      if(!selSet.size){NotifCenter.push("File Manager","Select item(s) to compress.","🗜️");return}
      const names=[...selSet];
      try{
        const JSZip=await ensureJSZip();
        const zip=new JSZip();
        const addNode=(zf,node)=>{
          if(node.type==="file"){
            const c=node.content||"";
            if(c.startsWith&&c.startsWith("data:"))zf.file(node.name,c.split(",")[1],{base64:true});
            else zf.file(node.name,c);
          }else{
            const sub=zf.folder(node.name);
            Object.values(node.children||{}).forEach(ch=>addNode(sub,ch));
          }
        };
        const folder=VFS.resolve(cwd);
        names.forEach(name=>{const node=folder.children[name];if(node)addNode(zip,node)});
        const base64=await zip.generateAsync({type:"base64"});
        const zipName=uniqueChildName(folder,(names.length===1?names[0].replace(/\.[^.]+$/,""):"Archive")+".zip");
        VFS.createFile(cwd,zipName,"data:application/zip;base64,"+base64);
        selSet.clear();VFS.renderCurrent();refreshAll();
        NotifCenter.push("File Manager",`Created "${zipName}".`,"🗜️");
      }catch(err){NotifCenter.push("File Manager","Compress failed: "+err.message,"⚠️")}
    });
    body.querySelector(".files-extract").addEventListener("click",async()=>{
      if(selSet.size!==1){NotifCenter.push("File Manager","Select exactly one .zip file.","📦");return}
      const name=[...selSet][0];
      if(!/\.zip$/i.test(name)){NotifCenter.push("File Manager","Select a .zip file to extract.","📦");return}
      const content=VFS.readFile(cwd,name);
      if(!content){NotifCenter.push("File Manager","Couldn't read archive.","⚠️");return}
      try{
        const JSZip=await ensureJSZip();
        const base64=content.split(",")[1]||content;
        const zip=await JSZip.loadAsync(base64,{base64:true});
        const destName=uniqueChildName(VFS.resolve(cwd),name.replace(/\.zip$/i,""));
        VFS.createFolder(cwd,destName);
        const destPath=[...cwd,destName];
        const entries=Object.values(zip.files);
        // If every entry sits under one common top-level folder (the usual "zip of a
        // single project folder" case), unwrap it instead of nesting it a second time.
        const topSegs=new Set(entries.map(e=>e.name.split("/").filter(Boolean)[0]).filter(Boolean));
        const singleRoot=entries.length&&topSegs.size===1?[...topSegs][0]:null;
        for(const entry of entries){
          let parts=entry.name.split("/").filter(Boolean);
          if(singleRoot&&parts[0]===singleRoot)parts=parts.slice(1);
          const fname=parts.pop();
          let folderPath=destPath;
          for(const p of parts){
            if(!VFS.resolve([...folderPath,p]))VFS.createFolder(folderPath,p);
            folderPath=[...folderPath,p];
          }
          if(entry.dir||!fname)continue;
          const isText=TEXT_EXT.test(fname);
          const data=isText?await entry.async("text"):`data:${mimeFor(fname)};base64,`+await entry.async("base64");
          VFS.createFile(folderPath,fname,data);
        }
        selSet.clear();VFS.renderCurrent();refreshAll();
        NotifCenter.push("File Manager",`Extracted to "${destName}".`,"📦");
      }catch(err){NotifCenter.push("File Manager","Extract failed: "+err.message,"⚠️")}
    });
    const uploadInput=body.querySelector(".files-upload-input");
    const uploadFiles=async fileList=>{
      const files=[...fileList];if(!files.length)return;
      let count=0;
      for(const f of files){
        const content=await readDroppedFile(f);
        const name=uniqueChildName(VFS.resolve(cwd),f.name);
        VFS.createFile(cwd,name,content);
        count++;
      }
      VFS.renderCurrent();refreshAll();
      NotifCenter.push("File Manager",`Uploaded ${count} file${count===1?"":"s"}.`,"⬆️");
    };
    body.querySelector(".files-upload").addEventListener("click",()=>uploadInput.click());
    uploadInput.addEventListener("change",()=>{uploadFiles(uploadInput.files);uploadInput.value=""});
    ["dragenter","dragover"].forEach(ev=>grid.addEventListener(ev,e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes("Files")){e.preventDefault();grid.classList.add("drag-over")}}));
    ["dragleave","drop"].forEach(ev=>grid.addEventListener(ev,e=>{if(ev==="drop")e.preventDefault();grid.classList.remove("drag-over")}));
    grid.addEventListener("drop",e=>{
      if(!e.dataTransfer||!e.dataTransfer.files||!e.dataTransfer.files.length)return;
      e.preventDefault();uploadFiles(e.dataTransfer.files);
    });
    grid.addEventListener("click",e=>{if(e.target===grid){selSet.clear();VFS.renderCurrent();updateClip()}});
    updateClip();VFS.renderCurrent();
  }
};
App.register("files",filesAppDef);
App.register("thispc",Object.assign({},filesAppDef,{id:"thispc",title:"This PC",icon:"🖥️",desktopOnly:true}));
const FolderPicker={
  open(startFrom,onPick){
    const old=$("#folderPicker");if(old)old.remove();
    const overlay=document.createElement("div");overlay.className="folder-picker-overlay";overlay.id="folderPicker";
    overlay.innerHTML=`<div class="folder-picker">
      <div class="fp-head"><strong>Move to…</strong><button class="wbtn close fp-close" title="Cancel">✕</button></div>
      <div class="fp-tree"></div>
      <div class="fp-actions"><span class="fp-target">Home</span><button class="btn tiny fp-here">Move here</button></div>
    </div>`;
    document.body.appendChild(overlay);
    let target=[];
    const treeEl=overlay.querySelector(".fp-tree"),targetLbl=overlay.querySelector(".fp-target");
    const renderNode=(path,node,depth)=>{
      const row=document.createElement("div");row.className="fp-row";row.style.paddingLeft=(depth*18+8)+"px";
      row.innerHTML=`<span>📂</span><span>${esc(path.length?path[path.length-1]:"Home")}</span>`;
      row.addEventListener("click",()=>{target=path;targetLbl.textContent=path.length?path.join(" / "):"Home";treeEl.querySelectorAll(".fp-row").forEach(r=>r.classList.remove("on"));row.classList.add("on")});
      treeEl.appendChild(row);
      Object.values(node.children||{}).filter(c=>c.type==="folder").sort((a,b)=>a.name.localeCompare(b.name)).forEach(c=>renderNode([...path,c.name],c,depth+1));
    };
    renderNode([],VFS.resolve([]),0);
    const close=()=>overlay.remove();
    overlay.querySelector(".fp-close").addEventListener("click",close);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    overlay.querySelector(".fp-here").addEventListener("click",()=>{onPick(target);close()});
  }
};
const FilePicker={
  open(filterExt,onPick){
    const old=$("#filePicker");if(old)old.remove();
    const overlay=document.createElement("div");overlay.className="folder-picker-overlay";overlay.id="filePicker";
    overlay.innerHTML=`<div class="folder-picker">
      <div class="fp-head"><strong>Open file…</strong><button class="wbtn close fp-close" title="Cancel">✕</button></div>
      <div class="toolbar" style="padding:0 2px"><button class="btn ghost tiny fp-up">⬆ Up</button><span class="fp-crumb" style="font-size:12px;color:var(--muted)">Home</span></div>
      <div class="fp-tree fp-files"></div>
      <div class="fp-actions"><span class="fp-hint" style="font-size:11px;color:var(--muted)">${filterExt?`Showing ${esc(filterExt)} files`:"Click a file to open"}</span><span></span></div>
    </div>`;
    document.body.appendChild(overlay);
    let cwd=[];
    const listEl=overlay.querySelector(".fp-files"),crumbEl=overlay.querySelector(".fp-crumb");
    const matches=name=>!filterExt||name.toLowerCase().endsWith(filterExt);
    const render=()=>{
      crumbEl.textContent=cwd.length?cwd.join(" / "):"Home";
      const node=VFS.resolve(cwd);
      const items=node?Object.values(node.children):[];
      listEl.innerHTML="";
      items.sort((a,b)=>(a.type===b.type?a.name.localeCompare(b.name):a.type==="folder"?-1:1)).forEach(item=>{
        if(item.type==="file"&&!matches(item.name))return;
        const row=document.createElement("div");row.className="fp-row";
        row.innerHTML=`<span>${fileIcon(item.name,item.type==="folder")}</span><span>${esc(item.name)}</span>`;
        row.addEventListener("click",()=>{
          if(item.type==="folder"){cwd=[...cwd,item.name];render();return}
          onPick(cwd.slice(),item.name);close();
        });
        listEl.appendChild(row);
      });
      if(!listEl.children.length)listEl.innerHTML=`<div style="padding:10px;color:var(--muted);font-size:12px">No matching files</div>`;
    };
    overlay.querySelector(".fp-up").addEventListener("click",()=>{if(cwd.length){cwd=cwd.slice(0,-1);render()}});
    render();
    const close=()=>overlay.remove();
    overlay.querySelector(".fp-close").addEventListener("click",close);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
  }
};
function parseAppFile(item){
  try{const d=JSON.parse(item.content);if(d&&d.appId&&App.get(d.appId))return d}catch{}return null
}
App.register("trash",{
  id:"trash",core:true,title:"Recycle Bin",icon:"🗑️",width:520,height:420,
  html:`<div class="files-app"><div class="toolbar"><button class="btn ghost tiny trash-restore">♻ Restore</button><button class="btn ghost tiny trash-purge">❌ Delete</button><button class="btn danger tiny trash-empty">🔥 Empty</button></div><div class="folder-grid"></div></div>`,
  init(body){
    const grid=body.querySelector(".folder-grid");let sel=null;
    const render=()=>{
      grid.innerHTML="";const items=Trash.list();
      if(!items.length){grid.innerHTML='<div class="empty-state">Recycle Bin is empty.</div>';sel=null;return}
      items.forEach((it,i)=>{
        const el=document.createElement("div");el.className="file-tile"+(sel===i?" selected":"");
        el.innerHTML=`<span class="tile-glyph">${fileIcon(it.name,it.node.type==="folder")}</span><div class="tile-name">${esc(it.name)}</div><div class="tile-date">from ${esc(["Home",...it.from].join("/"))} · ${timeAgo(it.at)}</div>`;
        el.addEventListener("click",()=>{sel=i;grid.querySelectorAll(".file-tile").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")});
        el.addEventListener("dblclick",()=>doRestore(i));
        grid.appendChild(el);
      });
      updateBadge();
    };
    const doRestore=i=>{if(Trash.restore(i)){render();NotifCenter.push("Recycle Bin","Item restored.","♻️")}else NotifCenter.push("Recycle Bin","Original folder missing or name taken.","♻️")};
    body.querySelector(".trash-restore").addEventListener("click",()=>{if(sel==null){NotifCenter.push("Recycle Bin","Select an item.","🗑️");return}doRestore(sel)});
    body.querySelector(".trash-purge").addEventListener("click",()=>{if(sel==null){NotifCenter.push("Recycle Bin","Select an item.","🗑️");return}Trash.purge(sel);render();NotifCenter.push("Recycle Bin","Item permanently deleted.","🔥")});
    body.querySelector(".trash-empty").addEventListener("click",()=>{Trash.empty();render();NotifCenter.push("Recycle Bin","Recycle Bin emptied.","🔥")});
    render();
  }
});
function updateBadge(){
  const desktop=$("#desktopIcons");if(!desktop)return;
  const tile=desktop.querySelector(`[data-app="trash"]`);
  if(tile){const old=tile.querySelector(".icon-badge");if(old)old.remove();if(Trash.count()>0){const b=document.createElement("span");b.className="icon-badge";b.textContent=Trash.count();tile.querySelector(".icon-box").appendChild(b)}}
}
App.register("calculator",{
  id:"calculator",core:true,title:"Calculator",icon:"🧮",width:340,height:520,
  html:`
    <div class="calc-app">
      <div class="toolbar">
        <button class="calc-mode-btn calc-mode active" data-mode="sci">Scientific</button>
        <button class="calc-mode-btn calc-mode" data-mode="prog">Programmer</button>
        <span style="flex:1"></span>
        <button class="btn ghost tiny calc-toggle-hist">🕘 History</button>
        <button class="btn ghost tiny calc-copy">📋 Copy</button>
        <button class="btn ghost tiny calc-clear-hist" hidden>🗑️ Clear</button>
      </div>
      <div class="calc-screen">
        <div class="calc-expr">&nbsp;</div>
        <div class="calc-mem-tiny">&nbsp;</div>
        <div class="calc-value">0</div>
      </div>
      <div class="calc-keys"></div>
      <div class="calc-history-panel"></div>
    </div>`,
  init(body){
    const exprEl=body.querySelector(".calc-expr"),valEl=body.querySelector(".calc-value"),memEl=body.querySelector(".calc-mem-tiny"),keysEl=body.querySelector(".calc-keys"),histPanel=body.querySelector(".calc-history-panel");
    let hist=Store.get("calc.history",[]);
    const renderHist=()=>{
      if(!hist.length){histPanel.innerHTML='<div class="calc-hist-row" style="cursor:default;color:var(--muted)">No history</div>';return}
      histPanel.innerHTML=hist.slice(0,30).map((h,i)=>`<div class="calc-hist-row" data-i="${i}"><span>${esc(h.expr)}</span><strong>${esc(h.result)}</strong></div>`).join("");
    };
    const saveHist=()=>Store.set("calc.history",hist.slice(0,30));
    const SCI=[
      ["sin","fn"],["cos","fn"],["tan","fn"],["π","fn"],
      ["√","fn"],["x²","fn"],["log","fn"],["ln","fn"],
      ["1/x","fn"],["n!","fn"],["e","fn"],["^","op"],
      ["C","clear"],["÷","op"],["×","op"],["⌫","back"],
      ["7","num"],["8","num"],["9","num"],["−","op"],
      ["4","num"],["5","num"],["6","num"],["+","op"],
      ["1","num"],["2","num"],["3","num"],["=","eq"],
      ["±","neg"],["0","num"],[".","dot"],["%","op"]
    ];
    const PROG=[
      ["AND","op"],["OR","op"],["XOR","op"],["NOT","fn"],
      ["<<","op"],[">>","op"],["MOD","op"],["HEX","base"],
      ["DEC","base"],["OCT","base"],["BIN","base"],["^","op"],
      ["C","clear"],["÷","op"],["×","op"],["⌫","back"],
      ["D","num"],["E","num"],["F","num"],["−","op"],
      ["A","num"],["B","num"],["C","num"],["+","op"],
      ["7","num"],["8","num"],["9","num"],["=","eq"],
      ["4","num"],["5","num"],["6","num"],["±","neg"],
      ["1","num"],["2","num"],["3","num"],["0","num"]
    ];
    let mode="sci",base=10,acc=null,pendingOp=null,current="0",fresh=true,lastExpr="";
    const baseName=b=>({16:"HEX",10:"DEC",8:"OCT",2:"BIN"}[b]);
    const renderKeys=()=>{
      keysEl.innerHTML="";
      const layout=mode==="prog"?PROG:SCI;
      layout.forEach(([label,kind])=>{
        const b=document.createElement("button");
        b.className="calc-key"+(kind==="op"?" op":kind==="eq"?" eq":kind==="fn"?" fn":kind==="clear"?" clear":kind==="base"?" fn":"");
        b.textContent=label;
        if(kind==="base")b.dataset.base=label;
        b.addEventListener("click",e=>{e.preventDefault();press(label,kind);renderKeys()});
        keysEl.appendChild(b);
      });
      if(mode==="prog")keysEl.querySelectorAll(".calc-key[data-base]").forEach(b=>b.classList.toggle("active-base",baseName(base)===b.dataset.base));
    };
    const show=()=>{valEl.textContent=current;exprEl.innerHTML=lastExpr||"&nbsp;";memEl.innerHTML=mode==="prog"?`Base: ${baseName(base)}`:"&nbsp;"};
    const parseCurrent=()=>{
      if(base===10)return parseFloat(current)||0;
      const v=parseInt(current,base);return isNaN(v)?0:v;
    };
    const formatNumber=n=>{
      if(!isFinite(n))return"Error";
      if(base===10)return fmtNum(n);
      return((Math.trunc(n))>>>0).toString(base).toUpperCase();
    };
    const applyOp=(a,op,b)=>{
      switch(op){
        case"+":return a+b;
        case"−":return a-b;
        case"×":return a*b;
        case"÷":return b===0?NaN:a/b;
        case"^":return Math.pow(a,b);
        case"%":return a-Math.floor(a/b)*b;
        case"AND":return(a&b)>>>0;
        case"OR":return(a|b)>>>0;
        case"XOR":return(a^b)>>>0;
        case"MOD":return b===0?NaN:(a%b+b)%b;
        case"<<":return(a<<b)>>>0;
        case">>":return a>>b;
        default:return NaN;
      }
    };
    const unaryFn=(label,v)=>{
      switch(label){
        case"sin":return Math.sin(v);
        case"cos":return Math.cos(v);
        case"tan":return Math.tan(v);
        case"log":return Math.log10(v);
        case"ln":return Math.log(v);
        case"√":return Math.sqrt(v);
        case"x²":return v*v;
        case"1/x":return v===0?NaN:1/v;
        case"n!":{if(v<0||Math.floor(v)!==v)return NaN;let r=1;for(let i=2;i<=v;i++)r*=i;return r}
        case"NOT":return(~v)>>>0;
        default:return v;
      }
    };
    const isDigit=(label,kind)=>kind==="num"||(mode==="prog"&&/^[0-9A-F]$/.test(label));
    const press=(label,kind)=>{
      if(label==="C"&&kind==="clear"){acc=null;pendingOp=null;current="0";fresh=true;lastExpr="";show();return}
      if(label==="⌫"){current=fresh?"0":(current.length>1?current.slice(0,-1):"0");show();return}
      if(label==="±"){const v=-parseCurrent();current=formatNumber(v);show();return}
      if(kind==="base"){
        const target={"HEX":16,"DEC":10,"OCT":8,"BIN":2}[label];
        const v=parseCurrent();base=target;current=formatNumber(v);renderKeys();show();return;
      }
      if(label==="π"){current=formatNumber(Math.PI);fresh=true;show();return}
      if(label==="e"){current=formatNumber(Math.E);fresh=true;show();return}
      if(kind==="fn"){
        const v=parseCurrent();
        current=formatNumber(unaryFn(label,v));
        lastExpr=`${label}(${fmtNum(v)})`;
        fresh=true;show();return;
      }
      if(kind==="op"){
        const v=parseCurrent();
        if(acc!==null&&pendingOp&&!fresh){acc=applyOp(acc,pendingOp,v)}
        else{acc=v}
        pendingOp=label;fresh=true;
        lastExpr=`${formatNumber(acc)} ${label}`;
        current=formatNumber(acc);show();return;
      }
      if(label==="="){
        if(acc===null||!pendingOp){show();return}
        const v=parseCurrent();
        const exprStr=`${formatNumber(acc)} ${pendingOp} ${formatNumber(v)}`;
        const r=applyOp(acc,pendingOp,v);
        const result=formatNumber(r);
        hist.unshift({expr:exprStr,result});if(hist.length>30)hist.pop();saveHist();renderHist();
        lastExpr=exprStr+" =";
        current=result;acc=null;pendingOp=null;fresh=true;show();return;
      }
      if(label==="."){
        if(base!==10)return;
        if(fresh){current="0.";fresh=false}
        else if(!current.includes("."))current+=".";
        show();return;
      }
      if(isDigit(label,kind)){
        if(fresh||current==="0"){current=label;fresh=false}else{current+=label}
        show();return;
      }
      show();
    };
    body.querySelectorAll(".calc-mode").forEach(btn=>btn.addEventListener("click",()=>{
      body.querySelectorAll(".calc-mode").forEach(x=>x.classList.remove("active"));btn.classList.add("active");
      mode=btn.dataset.mode;base=mode==="prog"?16:10;acc=null;pendingOp=null;current="0";fresh=true;lastExpr="";
      renderKeys();show();
    }));
    body.querySelector(".calc-toggle-hist").addEventListener("click",e=>{histPanel.classList.toggle("show");body.querySelector(".calc-clear-hist").hidden=!histPanel.classList.contains("show");renderHist();e.currentTarget.classList.toggle("ghost",histPanel.classList.contains("show"))});
    body.querySelector(".calc-clear-hist").addEventListener("click",()=>{hist=[];saveHist();renderHist()});
    histPanel.addEventListener("click",e=>{const r=e.target.closest(".calc-hist-row");if(!r||r.dataset.i==null)return;current=hist[Number(r.dataset.i)].result;fresh=true;acc=null;pendingOp=null;show()});
    body.querySelector(".calc-copy").addEventListener("click",()=>{const t=valEl.textContent;if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(()=>NotifCenter.push("Calculator",`Copied "${t}".`,"📋")).catch(()=>NotifCenter.push("Calculator","Result: "+t,"🧮"));else NotifCenter.push("Calculator","Result: "+t,"🧮")});
    body.tabIndex=-1;
    const keyMap={"*":"×","/":"÷","-":"−"};
    body.addEventListener("keydown",e=>{
      const key=e.key;
      if(key==="Enter"||key==="="){e.preventDefault();press("=","eq");renderKeys();return}
      if(key==="Backspace"){e.preventDefault();press("⌫","back");return}
      if(key==="Escape"){e.preventDefault();press("C","clear");return}
      if(key==="x"||key==="X"){e.preventDefault();press("×","op");return}
      if(/^[0-9]$/.test(key)){e.preventDefault();press(key,"num");return}
      if(mode==="prog"&&/^[a-fA-F]$/.test(key)){e.preventDefault();press(key.toUpperCase(),"num");return}
      if(key==="."){e.preventDefault();press(".","dot");return}
      if(key==="+"){e.preventDefault();press("+","op");return}
      if(["*","/","-"].includes(key)){e.preventDefault();press(keyMap[key],"op");return}
    });
    renderKeys();renderHist();show();
  }
});
App.register("browser",{
  id:"browser",core:true,title:"Browser",icon:"🌐",width:680,height:480,
  html:`<div class="browser-app"><div class="browser-bar"><button class="navbtn back" title="Back">←</button><button class="navbtn fwd" title="Forward">→</button><button class="navbtn refresh" title="Refresh">↻</button><input class="input addr flex-in" placeholder="Search…"><button class="navbtn star" title="Bookmark">☆</button></div><div class="browser-tabs"></div><div class="browser-content"></div></div>`,
  init(body){
    let stack=["home"],idx=0;
    const HIST_KEY="browser.history",BM_KEY="browser.bookmarks";
    const getH=()=>Store.get(HIST_KEY,[]),addH=q=>{const h=getH().filter(x=>x!==q);h.unshift(q);Store.set(HIST_KEY,h.slice(0,15))};
    const getB=()=>Store.get(BM_KEY,[]),setB=b=>Store.set(BM_KEY,b);
    const addr=body.querySelector(".addr"),content=body.querySelector(".browser-content"),tabsEl=body.querySelector(".browser-tabs"),back=body.querySelector(".back"),fwd=body.querySelector(".fwd"),star=body.querySelector(".star"),refresh=body.querySelector(".refresh");
    const isBM=()=>{const p=stack[idx];return p!=="home"&&getB().includes(p)};
    const updateNav=()=>{back.disabled=idx<=0;fwd.disabled=idx>=stack.length-1;star.textContent=isBM()?"★":"☆";addr.value=stack[idx]==="home"?"":stack[idx];tabsEl.innerHTML=stack.map((p,i)=>`<button class="browser-tab${i===idx?" current":""}" data-i="${i}">${p==="home"?"⌂ Home":"🔍 "+esc(p.length>20?p.slice(0,20)+"…":p)}</button>`).join("")};
    const renderHome=()=>{
      const r=getH(),b=getB();
      content.innerHTML=`<h2 style="margin-bottom:10px">🌐 Browser</h2><p>Type to search. Recent & bookmarks below.</p>`+
        (r.length?`<div class="section-label">Recent</div><div class="browser-chips">${r.map(q=>`<button class="btn ghost tiny chip" data-q="${esc(q)}">🕘 ${esc(q)}</button>`).join("")}</div>`:"")+
        (b.length?`<div class="section-label">Bookmarks</div>${b.map(x=>`<div class="note-list-row"><span>★</span><span class="bm-open" data-q="${esc(x)}" style="cursor:pointer">${esc(x)}</span><button class="note-pin bm-del" data-q="${esc(x)}">✕</button></div>`).join("")}`:"");
    };
    const renderPage=()=>{
      const p=stack[idx];if(p==="home"){renderHome();return}
      content.innerHTML=`<h2>🔍 Results for "${esc(p)}"</h2><p>Search results open in your real browser (X-Frame-Options).</p><div style="margin:14px 0"><button class="btn open-real">🌍 Open in real browser</button></div>`;
    };
    const nav=page=>{stack=stack.slice(0,idx+1);stack.push(page);idx=stack.length-1;if(page!=="home")addH(page);updateNav();renderPage()};
    addr.addEventListener("keydown",e=>{if(e.key==="Enter"){const v=addr.value.trim();if(v)nav(v)}});
    back.addEventListener("click",()=>{if(idx>0){idx--;updateNav();renderPage()}});
    fwd.addEventListener("click",()=>{if(idx<stack.length-1){idx++;updateNav();renderPage()}});
    refresh.addEventListener("click",()=>renderPage());
    star.addEventListener("click",()=>{const q=stack[idx];if(q==="home")return;const b=getB();if(b.includes(q))setB(b.filter(x=>x!==q));else{setB([q,...b].slice(0,20));NotifCenter.push("Browser",`Bookmarked "${q}".`,"★")}updateNav()});
    tabsEl.addEventListener("click",e=>{const t=e.target.closest(".browser-tab");if(t){idx=Number(t.dataset.i);updateNav();renderPage()}});
    content.addEventListener("click",e=>{
      if(e.target.classList.contains("open-real")){window.open("https://www.google.com/search?q="+encodeURIComponent(stack[idx]),"_blank");return}
      const del=e.target.closest(".bm-del");if(del){setB(getB().filter(x=>x!==del.dataset.q));renderHome();return}
      const open=e.target.closest(".bm-open,.chip");if(open&&open.dataset.q)nav(open.dataset.q);
    });
    updateNav();renderHome();
  }
});
App.register("settings",{
  id:"settings",core:true,title:"Settings",icon:"⚙️",width:620,height:560,
  html:`
    <div class="settings-app">
      <div class="set-section"><h4>Device</h4>
        <div class="set-row"><span>Device name</span><input class="input s-devicename" style="max-width:200px;text-align:right" maxlength="30"></div>
      </div>
      <div class="set-section"><h4>Personalization</h4>
        <div class="wp-grid"></div>
      </div>
      <div class="set-section"><h4>Accent color</h4>
        <div class="accent-row"></div>
      </div>
      <div class="set-section"><h4>Appearance</h4>
        <div class="set-row"><span>Theme</span><select class="select s-theme"><option value="dark">Dark</option><option value="light">Light</option><option value="auto">Auto (system)</option></select></div>
        <div class="set-row"><span>Sound effects</span><button class="toggle s-sounds"></button></div>
        <div class="set-row"><span>Window animations</span><button class="toggle s-winanim"></button></div>
        <div class="set-row"><span>Window style</span><select class="select s-winstyle"><option value="glass">Glass</option><option value="solid">Solid</option></select></div>
        <div class="set-row"><span>Desktop icon size</span><select class="select s-iconsize"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></div>
        <div class="set-row"><span>Show desktop icons</span><button class="toggle s-showicons"></button></div>
        <div class="set-row"><span>Show desktop widgets</span><button class="toggle s-widgets"></button></div>
        <div class="set-row"><span>Density</span><select class="select s-density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></div>
        <div class="set-row"><span>Font size</span><div style="display:flex;align-items:center;gap:10px"><input type="range" class="s-fontsize" min="13" max="20" value="15" style="width:140px;accent-color:var(--accent)"><span class="s-fontsize-val">15px</span></div></div>
      </div>
      <div class="set-section"><h4>Accessibility</h4>
        <div class="set-row"><span>High contrast</span><button class="toggle s-highcontrast"></button></div>
        <div class="set-row"><span>Reduce motion</span><button class="toggle s-reducemotion"></button></div>
        <div class="set-row"><span>Larger tap targets</span><button class="toggle s-largetargets"></button></div>
      </div>
      <div class="set-section"><h4>Notifications</h4>
        <div class="set-row"><span>Desktop notifications (even when this tab isn't focused)</span><button class="toggle s-sysnotifs"></button></div>
      </div>
      <div class="set-section"><h4>Clock</h4>
        <div class="set-row"><span>24-hour time</span><button class="toggle s-clock24"></button></div>
        <div class="set-row"><span>Show seconds</span><button class="toggle s-seconds"></button></div>
      </div>
      <div class="set-section"><h4>Shortcuts</h4>
        <div class="shortcut-grid">
          <div class="keys"><span class="kbd">Ctrl</span><span class="kbd">K</span></div><div>Open Start menu & search</div>
          <div class="keys"><span class="kbd">Ctrl</span><span class="kbd">S</span></div><div>Save note</div>
          <div class="keys"><span class="kbd">Alt</span><span class="kbd">Tab</span></div><div>Switch windows (hold Alt, tap Tab)</div>
          <div class="keys"><span class="kbd">Alt</span><span class="kbd">F4</span></div><div>Close active window</div>
          <div class="keys"><span class="kbd">Ctrl</span><span class="kbd">Shift</span><span class="kbd">Esc</span></div><div>Open Task Manager</div>
          <div class="keys"><span class="kbd">Ctrl</span><span class="kbd">←</span> / <span class="kbd">→</span></div><div>Snap window left / right</div>
          <div class="keys"><span class="kbd">Ctrl</span><span class="kbd">↑</span> / <span class="kbd">↓</span></div><div>Maximize / restore window</div>
          <div class="keys"><span class="kbd">Esc</span></div><div>Close menus</div>
          <div class="keys"><span class="kbd">↑</span> drag window to top</div><div>Maximize (drag to corners for quarter-tile)</div>
        </div>
      </div>
      <div class="set-section"><h4>Storage</h4>
        <div class="set-row"><span><span class="s-storage-used">— used</span></span><button class="btn ghost tiny s-reset">Reset everything</button></div>
      </div>
    </div>`,
  init(body){
    const s=Settings.get();
    const wpGrid=body.querySelector(".wp-grid"),accentRow=body.querySelector(".accent-row");
    const nameInput=body.querySelector(".s-devicename");
    nameInput.value=s.deviceName;
    const commitName=()=>{const v=nameInput.value.trim()||Settings.defaults.deviceName;nameInput.value=v;Settings.set({deviceName:v});NotifCenter.push("Settings",`Device renamed to "${v}".`,"📱")};
    nameInput.addEventListener("blur",commitName);
    nameInput.addEventListener("keydown",e=>{if(e.key==="Enter")nameInput.blur()});
    const renderWP=()=>{wpGrid.innerHTML=Object.entries(WALLPAPERS).map(([k,w])=>`<div class="wp-thumb${Settings.get().wallpaper===k?" selected":""}" style="background:${w.css}" data-k="${k}"><span>${esc(w.label)}</span></div>`).join("");wpGrid.querySelectorAll(".wp-thumb").forEach(t=>t.addEventListener("click",()=>{Settings.set({wallpaper:t.dataset.k});renderWP();NotifCenter.push("Settings",`Wallpaper: ${WALLPAPERS[t.dataset.k].label}.`,"🎨")}))};
    const renderAcc=()=>{accentRow.innerHTML=Object.entries(ACCENTS).map(([k,h])=>`<div class="accent-dot${Settings.get().accent===k?" selected":""}" style="background:${h}" data-k="${k}" title="${k}"></div>`).join("");accentRow.querySelectorAll(".accent-dot").forEach(t=>t.addEventListener("click",()=>{Settings.set({accent:t.dataset.k});renderAcc();NotifCenter.push("Settings",`Accent: ${t.dataset.k}.`,"🎯")}))};
    renderWP();renderAcc();
    body.querySelector(".s-theme").value=s.theme;
    body.querySelector(".s-winstyle").value=s.winStyle;
    body.querySelector(".s-iconsize").value=s.iconSize;
    body.querySelector(".s-density").value=s.density;
    const fsSlider=body.querySelector(".s-fontsize"),fsVal=body.querySelector(".s-fontsize-val");
    fsSlider.value=s.fontSize;fsVal.textContent=s.fontSize+"px";
    fsSlider.addEventListener("input",()=>{fsVal.textContent=fsSlider.value+"px";Settings.set({fontSize:parseInt(fsSlider.value,10)});Settings.apply()});
    body.querySelector(".s-theme").addEventListener("change",e=>{Settings.set({theme:e.target.value});NotifCenter.push("Settings",`Theme: ${e.target.value}.`,"🎨")});
    body.querySelector(".s-winstyle").addEventListener("change",e=>{Settings.set({winStyle:e.target.value});NotifCenter.push("Settings",`Window style: ${e.target.value}.`,"🪟")});
    body.querySelector(".s-iconsize").addEventListener("change",e=>{Settings.set({iconSize:e.target.value})});
    body.querySelector(".s-density").addEventListener("change",e=>{Settings.set({density:e.target.value});Settings.apply()});
    const T=(sel,key)=>{const el=body.querySelector(sel);el.classList.toggle("on",Settings.get()[key]);el.addEventListener("click",()=>{const v=!Settings.get()[key];Settings.set({[key]:v});el.classList.toggle("on",v);Settings.apply()})};
    T(".s-showicons","showIcons");T(".s-widgets","widgets");T(".s-clock24","clock24");T(".s-seconds","seconds");
    T(".s-sounds","sounds");T(".s-winanim","winAnim");
    T(".s-highcontrast","highContrast");T(".s-reducemotion","reduceMotion");T(".s-largetargets","largeTargets");
    const notifToggle=body.querySelector(".s-sysnotifs");
    const syncNotifToggle=()=>notifToggle.classList.toggle("on",Settings.get().systemNotifs);
    syncNotifToggle();
    notifToggle.addEventListener("click",async()=>{
      const turningOn=!Settings.get().systemNotifs;
      if(turningOn){
        if(typeof Notification==="undefined"){NotifCenter.push("Settings","Notifications aren't supported in this browser.","⚠️");return}
        const perm=await Notification.requestPermission();
        if(perm!=="granted"){NotifCenter.push("Settings","Notification permission was denied.","⚠️");return}
      }
      Settings.set({systemNotifs:turningOn});syncNotifToggle();
      NotifCenter.push("Settings",`Desktop notifications ${turningOn?"enabled":"disabled"}.`,"🔔");
    });
    const updStorage=()=>{body.querySelector(".s-storage-used").textContent=`${(Store.bytes()/1024).toFixed(1)} KB used`};
    updStorage();
    body.querySelector(".s-reset").addEventListener("click",()=>{
      actionToast("Settings","Reset all data, settings, and apps?","⚠️","Reset",()=>{
        for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith("webos."))localStorage.removeItem(k)}
        NotifCenter.push("Settings","All data reset. Reloading…","♻️");setTimeout(()=>location.reload(),900);
      },8000);
    });
    setInterval(()=>{if(document.body.contains(body))updStorage()},3000);
  }
});
App.register("sysinfo",{
  id:"sysinfo",core:true,title:"System Info",icon:"📊",width:540,height:480,
  html:`<div class="sysinfo-app"></div>`,
  init(body){
    const render=()=>{
      const nav=navigator,conn=nav.connection||{};
      const mem=nav.deviceMemory!=null?"≈ "+nav.deviceMemory+" GB":"—";
      const notes=Object.keys(Store.get("notes.list",{})).length;
      const files=VFS.count(),trash=Trash.count();
      const used=Store.bytes(),q=5*1024*1024,pct=Math.min(100,Math.round((used/q)*100));
      body.innerHTML=`
        <div class="sys-card"><h4>Web OS</h4><table><tr><td>Version</td><td>4.5</td></tr><tr><td>Device name</td><td>${esc(Settings.get().deviceName)}</td></tr><tr><td>Platform</td><td>${esc(nav.platform||"Web")}</td></tr><tr><td>CPU threads</td><td>${nav.hardwareConcurrency||"?"}</td></tr><tr><td>Memory</td><td>${esc(mem)}</td></tr><tr><td>Screen</td><td>${screen.width}×${screen.height}</td></tr><tr><td>Window</td><td>${window.innerWidth}×${window.innerHeight}</td></tr><tr><td>Online</td><td>${nav.onLine?"Yes":"No"}</td></tr><tr><td>Connection</td><td>${esc(conn.effectiveType||"—")}</td></tr></table></div>
        <div class="sys-card"><h4>Apps & windows</h4><table><tr><td>Open windows</td><td>${Object.keys(WM.windows).length}</td></tr><tr><td>Registered apps</td><td>${App.all().length}</td></tr><tr><td>Installed</td><td>${Store.get("installed",INSTALLED_DEFAULT).length}</td></tr></table></div>
        <div class="sys-card"><h4>Data</h4><table><tr><td>Notes</td><td>${notes}</td></tr><tr><td>Files</td><td>${files}</td></tr><tr><td>Trash</td><td>${trash}</td></tr></table><div class="bar-progress"><div style="width:${pct}%"></div></div><div style="font-size:11px;color:var(--muted);margin-top:4px">${(used/1024).toFixed(1)} KB used (${pct}%)</div></div>`;
    };
    render();const iv=setInterval(()=>{if(!document.body.contains(body)){clearInterval(iv);return}render()},2000);
  }
});
App.register("taskmgr",{
  id:"taskmgr",core:true,title:"Task Manager",icon:"📈",width:520,height:440,
  html:`<div class="taskmgr-app">
      <div class="toolbar"><strong style="flex:1">Processes</strong><span class="tm-summary" style="font-size:11px;color:var(--muted)"></span></div>
      <div class="tm-list"></div>
      <div class="toolbar"><button class="btn danger tiny tm-end" disabled>⛔ End task</button><span style="flex:1"></span><span class="tm-perf" style="font-size:11px;color:var(--muted)"></span></div>
    </div>`,
  init(body,win){
    const listEl=body.querySelector(".tm-list"),endBtn=body.querySelector(".tm-end"),sumEl=body.querySelector(".tm-summary"),perfEl=body.querySelector(".tm-perf");
    let sel=null;
    const bg=[{id:"__shell",name:"Web OS Shell",icon:"⬢",base:3+Math.random()*3},{id:"__desktop",name:"Desktop & Compositor",icon:"🖥️",base:1+Math.random()*2}];
    const stats={};
    const getStat=(key,base)=>{
      if(!stats[key])stats[key]={cpu:base,mem:20+Math.random()*40};
      stats[key].cpu=Math.max(0.2,Math.min(38,stats[key].cpu+(Math.random()*6-3)));
      stats[key].mem=Math.max(8,Math.min(220,stats[key].mem+(Math.random()*8-4)));
      return stats[key];
    };
    const render=()=>{
      const wins=Object.values(WM.windows);
      const rows=[...bg.map(b=>({key:b.id,icon:b.icon,name:b.name,bg:true})),
        ...wins.map(w=>{const def=App.get(w.app);return{key:w.id,icon:def?def.icon:"📦",name:def?def.title:w.app,bg:false,winId:w.id}})];
      let totalCpu=0;
      listEl.innerHTML=rows.map(r=>{
        const st=getStat(r.key,r.bg?(bg.find(b=>b.id===r.key)||{}).base:2+Math.random()*4);
        totalCpu+=st.cpu;
        return`<div class="tm-row${sel===r.key?" on":""}" data-key="${esc(r.key)}"><span class="tm-ico">${r.icon}</span><span class="tm-name">${esc(r.name)}</span><span class="tm-cpu">${st.cpu.toFixed(1)}%</span><span class="tm-mem">${st.mem.toFixed(0)} MB</span></div>`;
      }).join("");
      sumEl.textContent=`${rows.length} processes`;
      perfEl.textContent=`CPU ${Math.min(100,totalCpu).toFixed(0)}%`;
      endBtn.disabled=!sel||bg.some(b=>b.id===sel);
    };
    listEl.addEventListener("click",e=>{
      const row=e.target.closest(".tm-row");if(!row)return;
      sel=row.dataset.key;render();
    });
    endBtn.addEventListener("click",()=>{
      if(!sel)return;
      const w=WM.windows[sel];
      if(w){WM.close(sel);NotifCenter.push("Task Manager",`Ended task.`,"⛔")}
      sel=null;render();
    });
    render();
    const iv=setInterval(()=>{if(!document.body.contains(body)){clearInterval(iv);return}render()},1500);
  }
});
App.register("about",{
  id:"about",core:true,title:"About",icon:"ℹ️",width:440,height:400,
  html:`<div class="about-app"><div class="about-logo">⬢</div><div style="text-align:center"><span class="version-tag">Version 4.5</span></div><p><strong>Web OS</strong> is a browser-based desktop environment built with plain HTML, CSS, and JavaScript — no frameworks, no build step.</p><p>V4.5: A real lock screen — locks on startup and after you've been idle (configurable in Security Center), plus a "Lock now" button. Desktop notifications that still reach you when this tab isn't focused (opt in from Settings). Install Web OS as its own app and use it offline (look for the install icon in your browser's address bar). A new "This PC" desktop shortcut, plus a File Manager sidebar for jumping straight to This PC, Home, or the Recycle Bin.</p><p>V4.4: Security Center (real-time protection & firewall toggles, per-app permissions, quick scan) which the Camera app now actually checks; Phone Link (simulated notification mirroring and a shared clipboard with your "phone"); and a Photos app for browsing everything the Camera has saved.</p><p>Standard APIs available to apps: Camera (photo/video), Clipboard, and persistent Storage — the same building blocks a real OS gives its apps, and the App Store is how new ones get installed.</p><p>🥚 Try the Konami code: ↑ ↑ ↓ ↓ ← → ← → B A</p></div>`
});
App.register("store",{
  id:"store",core:true,title:"App Store",icon:"🛍️",width:580,height:460,
  html:`<div class="store-app"><div class="section-label" style="margin:0">Available apps</div><div class="store-list"></div></div>`,
  init(body){
    const list=body.querySelector(".store-list");
    const render=()=>{
      list.innerHTML="";
      const installed=Store.get("installed",INSTALLED_DEFAULT);
      App.all().filter(d=>!d.core&&d.id!=="store"&&d.id!=="trash").forEach(def=>{
        const inst=installed.includes(def.id);
        const card=document.createElement("div");card.className="store-card";
        card.innerHTML=`<div class="s-icon">${def.icon}</div><div class="s-info"><strong>${esc(def.title)}</strong><span>${esc(def.desc||"Application")}</span></div><div class="s-actions"><button class="btn ${inst?"ghost":"tiny"}">${inst?"Uninstall":"Install"}</button></div>`;
        const btn=card.querySelector("button");
        btn.addEventListener("click",()=>{
          if(inst){Installer.uninstall(def.id);render()}else{Installer.install(def.id);render()}
        });
        list.appendChild(card);
      });
    };
    render();
  }
});
const WX_DATA={
  "New York":[[18,25,"☀️"],[16,22,"🌤️"],[14,20,"⛅"],[12,18,"🌧️"],[10,15,"⛈️"]],
  "London":[[8,14,"🌧️"],[9,15,"⛅"],[7,13,"🌧️"],[6,11,"⛅"],[5,10,"🌤️"]],
  "Tokyo":[[15,22,"🌤️"],[16,23,"☀️"],[14,21,"🌧️"],[15,22,"⛅"],[13,20,"🌧️"]],
  "Sydney":[[20,28,"☀️"],[22,30,"☀️"],[19,26,"🌤️"],[18,24,"⛅"],[17,22,"🌧️"]],
  "Paris":[[10,18,"🌤️"],[11,19,"☀️"],[8,16,"🌧️"],[9,17,"⛅"],[7,14,"🌧️"]]
};
App.register("weather",{
  id:"weather",title:"Weather",icon:"🌤️",width:440,height:520,desc:"5-day forecast for five cities",
  html:`
    <div class="weather-app">
      <div class="toolbar"><select class="select wx-city"><option>New York</option><option>London</option><option>Tokyo</option><option>Sydney</option><option>Paris</option></select><button class="btn ghost tiny wx-refresh">🔄 Refresh</button></div>
      <div class="weather-card"></div>
      <div class="weather-days"></div>
    </div>`,
  init(body){
    const city=body.querySelector(".wx-city"),now=body.querySelector(".weather-card"),days=body.querySelector(".weather-days");
    const render=()=>{
      const c=city.value,d=WX_DATA[c]||WX_DATA["New York"];
      now.innerHTML=`<div class="wx-temp">${d[0][1]}°</div><div class="wx-cond">${d[0][2]} ${esc(c)}</div>`;
      days.innerHTML=d.slice(1).map((day,i)=>{
        const dt=new Date(Date.now()+(i+1)*864e5);
        return`<div class="wx-day"><span>${dt.toLocaleDateString(undefined,{weekday:"long"})}</span><span class="wx-icon">${day[2]}</span><span>${day[0]}° / <strong>${day[1]}°</strong></span></div>`;
      }).join("");
    };
    city.addEventListener("change",render);
    body.querySelector(".wx-refresh").addEventListener("click",()=>{render();NotifCenter.push("Weather","Forecast refreshed.","🌤️")});
    render();
  }
});
App.register("game",{
  id:"game",title:"Tic-Tac-Toe",icon:"🎮",width:380,height:520,desc:"Two-player game with scoreboard",
  html:`<div class="game-app"><div class="game-status">X to move</div><div class="game-board"></div><div class="game-score"></div><div class="toolbar"><button class="btn ghost tiny game-reset">↺ New round</button><button class="btn ghost tiny game-zero">Reset scores</button></div></div>`,
  init(body){
    const status=body.querySelector(".game-status"),boardEl=body.querySelector(".game-board"),scoreEl=body.querySelector(".game-score");
    const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const KEY="game.score";
    let board,turn,over;
    const score=()=>Store.get(KEY,{X:0,O:0,D:0});
    const renderScore=()=>{const s=score();scoreEl.textContent=`X: ${s.X}  ·  O: ${s.O}  ·  Draws: ${s.D}`};
    const renderBoard=()=>{
      boardEl.innerHTML="";
      board.forEach((c,i)=>{
        const b=document.createElement("button");b.className="game-cell";b.textContent=c||"";if(c)b.disabled=true;
        b.addEventListener("click",()=>move(i));
        boardEl.appendChild(b);
      });
    };
    const move=i=>{
      if(over||board[i])return;
      board[i]=turn;
      const win=WINS.find(line=>line.every(c=>board[c]===turn));
      if(win){over=true;const s=score();s[turn]++;Store.set(KEY,s);status.textContent=`${turn} wins! 🎉`;win.forEach(c=>boardEl.children[c].classList.add("win"));renderScore();NotifCenter.push("Tic-Tac-Toe",`Player ${turn} wins!`,"🎮");return}
      if(board.every(c=>c)){over=true;const s=score();s.D++;Store.set(KEY,s);status.textContent="Draw!";renderScore();return}
      turn=turn==="X"?"O":"X";status.textContent=`${turn} to move`;renderBoard();
    };
    const reset=()=>{board=Array(9).fill("");turn="X";over=false;status.textContent="X to move";renderBoard()};
    body.querySelector(".game-reset").addEventListener("click",reset);
    body.querySelector(".game-zero").addEventListener("click",()=>{Store.set(KEY,{X:0,O:0,D:0});renderScore()});
    reset();renderScore();
  }
});
App.register("music",{
  id:"music",title:"Music Player",icon:"🎵",width:420,height:520,desc:"Synth tracks with a live visualizer",
  html:`<div class="music-app"><div class="music-display"><div class="music-title">Pick a track</div><canvas class="music-viz" width="340" height="70"></canvas></div><div class="toolbar" style="justify-content:center"><button class="btn ghost tiny m-prev">⏮</button><button class="btn m-play">▶ Play</button><button class="btn ghost tiny m-stop">⏹</button><button class="btn ghost tiny m-next">⏭</button></div><div class="music-list"></div></div>`,
  init(body){
    const F={C4:261.6,D4:293.7,E4:329.6,F4:349.2,G4:392,A4:440,B4:493.9,C5:523.3,D5:587.3,E5:659.3,F5:698.5,G5:784,A5:880};
    const TRACKS=[
      {name:"Startup Chime",tempo:280,notes:["C4","E4","G4","C5","G4","E4","C4"]},
      {name:"Desktop Groove",tempo:210,notes:["C4","C4","G4","A4","G4","E4","D4","C4","E4","G4","A4","G5"]},
      {name:"Night Loop",tempo:270,notes:["A4","G4","E4","D4","E4","G4","A4","C5","B4","A4","G4","E4"]}
    ];
    const titleEl=body.querySelector(".music-title"),listEl=body.querySelector(".music-list"),playBtn=body.querySelector(".m-play"),canvas=body.querySelector(".music-viz");
    let ctx=null,an=null,tmr=null,raf=null,idx=0,step=0,playing=false;
    const renderList=()=>{listEl.innerHTML=TRACKS.map((t,i)=>`<div class="music-row${i===idx?" current":""}" data-i="${i}">${esc(t.name)}</div>`).join("")};
    const draw=()=>{
      if(!playing||!an)return;
      const c=canvas.getContext("2d");if(!c)return;
      const data=new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(data);
      c.clearRect(0,0,canvas.width,canvas.height);
      const bars=32,bw=canvas.width/bars;
      for(let i=0;i<bars;i++){const v=data[i*3]||0;c.fillRect(i*bw+1,canvas.height-(v/255)*canvas.height,bw-2,(v/255)*canvas.height)}
      raf=requestAnimationFrame(draw);
    };
    const tick=()=>{
      const t=TRACKS[idx],n=t.notes[step%t.notes.length];
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type="triangle";osc.frequency.value=F[n]||440;
      gain.gain.setValueAtTime(0.1,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t.tempo/1000);
      osc.connect(gain).connect(an);osc.start();osc.stop(ctx.currentTime+t.tempo/1000);
      step++;
    };
    const start=()=>{
      if(playing)return;
      if(typeof AudioContext==="undefined"){titleEl.textContent="Audio not supported";return}
      if(!ctx){ctx=new AudioContext();an=ctx.createAnalyser();an.connect(ctx.destination)}
      if(ctx.state==="suspended")ctx.resume();
      playing=true;playBtn.textContent="⏸ Pause";titleEl.textContent="🎵 "+TRACKS[idx].name;tmr=setInterval(tick,TRACKS[idx].tempo);tick();draw();
    };
    const stop=()=>{playing=false;playBtn.textContent="▶ Play";tmr&&clearInterval(tmr);raf&&cancelAnimationFrame(raf);const c=canvas.getContext("2d");if(c)c.clearRect(0,0,canvas.width,canvas.height)};
    playBtn.addEventListener("click",()=>playing?stop():start());
    body.querySelector(".m-stop").addEventListener("click",()=>{stop();step=0;titleEl.textContent="Pick a track"});
    body.querySelector(".m-next").addEventListener("click",()=>{stop();idx=(idx+1)%TRACKS.length;step=0;renderList();start()});
    body.querySelector(".m-prev").addEventListener("click",()=>{stop();idx=(idx-1+TRACKS.length)%TRACKS.length;step=0;renderList();start()});
    listEl.addEventListener("click",e=>{const r=e.target.closest(".music-row");if(!r)return;stop();idx=Number(r.dataset.i);step=0;renderList();start()});
    renderList();
  }
});
App.register("paint",{
  id:"paint",title:"Paint",icon:"🖌️",width:580,height:480,desc:"Canvas drawing with brush and eraser",
  html:`<div class="paint-app"><div class="paint-toolbar"><input type="color" class="paint-color" value="#7a5cff"><input type="range" class="paint-size" min="1" max="40" value="4"><button class="btn ghost tiny paint-eraser">🧽 Eraser</button><button class="btn ghost tiny paint-clear">🗑️ Clear</button><button class="btn ghost tiny paint-save">💾 Save</button></div><canvas class="paint-canvas" width="900" height="540"></canvas></div>`,
  init(body){
    const canvas=body.querySelector(".paint-canvas"),color=body.querySelector(".paint-color"),size=body.querySelector(".paint-size"),eraserBtn=body.querySelector(".paint-eraser"),clearBtn=body.querySelector(".paint-clear"),saveBtn=body.querySelector(".paint-save");
    const c=canvas.getContext("2d");c.fillStyle="#fff";c.fillRect(0,0,canvas.width,canvas.height);
    let drawing=false,last=null,eraser=false;
    const pos=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)}};
    canvas.addEventListener("pointerdown",e=>{drawing=true;last=pos(e);try{canvas.setPointerCapture(e.pointerId)}catch{}});
    canvas.addEventListener("pointermove",e=>{if(!drawing)return;const p=pos(e);c.strokeStyle=eraser?"#fff":color.value;c.lineWidth=Number(size.value)*(eraser?3:1);c.lineCap="round";c.lineJoin="round";c.beginPath();c.moveTo(last.x,last.y);c.lineTo(p.x,p.y);c.stroke();last=p});
    const end=()=>{drawing=false};
    canvas.addEventListener("pointerup",end);canvas.addEventListener("pointercancel",end);canvas.addEventListener("pointerleave",end);
    eraserBtn.addEventListener("click",e=>{eraser=!eraser;e.currentTarget.classList.toggle("ghost",!eraser)});
    clearBtn.addEventListener("click",()=>{c.fillStyle="#fff";c.fillRect(0,0,canvas.width,canvas.height)});
    saveBtn.addEventListener("click",()=>{
      try{
        const data=canvas.toDataURL("image/png");
        const link=document.createElement("a");link.href=data;link.download="paint-"+Date.now()+".png";
        link.click();NotifCenter.push("Paint","Drawing exported as PNG.","💾");
      }catch(e){NotifCenter.push("Paint","Save failed.","⚠️")}
    });
  }
});
App.register("camera",{
  id:"camera",core:true,title:"Camera",icon:"📷",width:420,height:640,desc:"Front & back camera, zoom, photo and video capture",
  html:`
    <div class="camera-app">
      <div class="cam-view-wrap">
        <video class="cam-video" autoplay playsinline muted></video>
        <canvas class="cam-canvas" hidden></canvas>
        <div class="cam-msg"></div>
        <div class="cam-rec-badge" hidden>● REC <span class="cam-rec-time">0:00</span></div>
        <div class="cam-spec-badge">Ultra HD</div>
      </div>
      <div class="cam-zoom-row"><span>🔎</span><input type="range" class="cam-zoom" min="1" max="4" step="0.1" value="1"><span class="cam-zoom-val">1.0×</span></div>
      <div class="cam-modes">
        <button class="cam-mode-btn on" data-mode="photo">PHOTO</button>
        <button class="cam-mode-btn" data-mode="video">VIDEO</button>
      </div>
      <div class="cam-controls">
        <div class="cam-thumb" title="Last capture — open in File Manager"></div>
        <button class="cam-shutter" title="Capture"></button>
        <button class="cam-flip" title="Switch camera">🔄</button>
      </div>
    </div>`,
  init(body){
    const video=body.querySelector(".cam-video"),canvas=body.querySelector(".cam-canvas"),msg=body.querySelector(".cam-msg"),
      zoomSlider=body.querySelector(".cam-zoom"),zoomVal=body.querySelector(".cam-zoom-val"),shutter=body.querySelector(".cam-shutter"),
      flipBtn=body.querySelector(".cam-flip"),thumb=body.querySelector(".cam-thumb"),recBadge=body.querySelector(".cam-rec-badge"),
      recTimeEl=body.querySelector(".cam-rec-time"),modeBtns=[...body.querySelectorAll(".cam-mode-btn")];
    let stream=null,facing="user",mode="photo",zoomTrack=null,recorder=null,chunks=[],recTimer=null,recSecs=0,lastShotUrl=null;
    const ensurePicturesFolder=()=>{const home=VFS.resolve([]);if(home&&!home.children["Pictures"]){const t=Date.now();home.children["Pictures"]={type:"folder",name:"Pictures",created:t,modified:t,children:{}};VFS.save()}};
    const setMsg=t=>{msg.textContent=t;msg.hidden=!t};
    const stopStream=()=>{if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}};
    const applyTransform=()=>{
      const v=zoomTrack?1:Number(zoomSlider.value);
      video.style.transform=(facing==="user"?"scaleX(-1) ":"")+`scale(${v})`;
    };
    const start=async()=>{
      if(!Settings.get().permCamera){setMsg("Camera access is blocked by Security Center. Enable it in Security Center → App permissions.");return}
      if(typeof navigator.mediaDevices==="undefined"||!navigator.mediaDevices.getUserMedia){setMsg("Camera isn't available in this browser context.");return}
      stopStream();setMsg("Starting camera…");
      try{
        stream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:facing,width:{ideal:3840},height:{ideal:2160}},
          audio:mode==="video"
        });
        video.srcObject=stream;setMsg("");
        const track=stream.getVideoTracks()[0];
        const caps=track.getCapabilities&&track.getCapabilities();
        if(caps&&caps.zoom){zoomTrack=track;zoomSlider.min=caps.zoom.min;zoomSlider.max=caps.zoom.max;zoomSlider.step=caps.zoom.step||0.1;zoomSlider.value=track.getSettings().zoom||caps.zoom.min}
        else{zoomTrack=null;zoomSlider.min=1;zoomSlider.max=4;zoomSlider.step=0.1;zoomSlider.value=1}
        zoomVal.textContent=Number(zoomSlider.value).toFixed(1)+"×";
        applyTransform();
      }catch(err){
        setMsg(err&&err.name==="NotAllowedError"?"Camera access was denied. Allow camera permission to use this app.":"No camera found on this device.");
      }
    };
    zoomSlider.addEventListener("input",()=>{
      const v=Number(zoomSlider.value);zoomVal.textContent=v.toFixed(1)+"×";
      if(zoomTrack){zoomTrack.applyConstraints({advanced:[{zoom:v}]}).catch(()=>{})}
      else{applyTransform()}
    });
    flipBtn.addEventListener("click",()=>{facing=facing==="user"?"environment":"user";start()});
    modeBtns.forEach(b=>b.addEventListener("click",()=>{
      if(recorder&&recorder.state==="recording")return;
      mode=b.dataset.mode;modeBtns.forEach(x=>x.classList.toggle("on",x===b));
      shutter.classList.toggle("video-mode",mode==="video");
      start();
    }));
    const flashEffect=()=>{const f=document.createElement("div");f.className="cam-flash";body.querySelector(".cam-view-wrap").appendChild(f);setTimeout(()=>f.remove(),260)};
    const takePhoto=()=>{
      if(!stream){setMsg("Camera not ready.");return}
      const vw=video.videoWidth||1280,vh=video.videoHeight||720;
      canvas.width=vw;canvas.height=vh;
      const ctx=canvas.getContext("2d");
      if(facing==="user"){ctx.translate(vw,0);ctx.scale(-1,1)}
      ctx.drawImage(video,0,0,vw,vh);
      const data=canvas.toDataURL("image/png");
      ensurePicturesFolder();
      const name="photo-"+Date.now()+".png";
      VFS.createFile(["Pictures"],name,data);
      thumb.style.backgroundImage=`url(${data})`;lastShotUrl=data;
      flashEffect();refreshAll();
      NotifCenter.push("Camera",`Saved "${name}" to Pictures.`,"📷");
    };
    const fmtTime=s=>Math.floor(s/60)+":"+String(s%60).padStart(2,"0");
    const startRecording=()=>{
      if(!stream){setMsg("Camera not ready.");return}
      chunks=[];
      try{recorder=new MediaRecorder(stream)}catch{setMsg("Video recording isn't supported in this browser.");return}
      recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:"video/webm"});
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=url;a.download="video-"+Date.now()+".webm";document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),15000);
        NotifCenter.push("Camera","Video saved to your downloads (clips are too large to keep in File Manager).","🎥");
      };
      recorder.start();recSecs=0;recTimeEl.textContent="0:00";recBadge.hidden=false;shutter.classList.add("recording");
      recTimer=setInterval(()=>{recSecs++;recTimeEl.textContent=fmtTime(recSecs)},1000);
    };
    const stopRecording=()=>{
      if(recorder&&recorder.state==="recording")recorder.stop();
      recBadge.hidden=true;shutter.classList.remove("recording");
      recTimer&&clearInterval(recTimer);
    };
    shutter.addEventListener("click",()=>{
      if(mode==="photo"){takePhoto();return}
      if(recorder&&recorder.state==="recording")stopRecording();else startRecording();
    });
    thumb.addEventListener("click",()=>{if(lastShotUrl)WM.open("files")});
    start();
    const stopAll=()=>{stopRecording();stopStream()};
    App.get("camera").onClose=stopAll;
  }
});
App.register("security",{
  id:"security",core:true,title:"Security Center",icon:"🛡️",width:520,height:600,desc:"Protection status, firewall, and app permissions",
  html:`<div class="settings-app">
      <div class="set-section sec-status"></div>
      <div class="set-section"><h4>Protection</h4>
        <div class="set-row"><span>Real-time protection</span><button class="toggle sec-realtime"></button></div>
        <div class="set-row"><span>Firewall</span><button class="toggle sec-firewall"></button></div>
      </div>
      <div class="set-section"><h4>App permissions</h4>
        <div class="set-row"><span>📷 Camera</span><button class="toggle sec-camera"></button></div>
        <div class="set-row"><span>📋 Clipboard</span><button class="toggle sec-clipboard"></button></div>
        <div class="set-row"><span>📍 Location</span><button class="toggle sec-location"></button></div>
      </div>
      <div class="set-section"><h4>Lock screen</h4>
        <div class="set-row"><span>Lock on startup</span><button class="toggle sec-lockboot"></button></div>
        <div class="set-row"><span>Auto-lock when idle</span><button class="toggle sec-autolock"></button></div>
        <div class="set-row"><span>Lock after</span><select class="select sec-lockmins"><option value="1">1 minute</option><option value="3">3 minutes</option><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option></select></div>
        <div class="set-row"><span></span><button class="btn ghost tiny sec-locknow">🔒 Lock now</button></div>
      </div>
      <div class="set-section"><h4>Quick scan</h4>
        <div class="set-row"><span class="sec-scan-status">Last scan: never</span><button class="btn tiny sec-scan">🔍 Scan now</button></div>
        <div class="bar-progress sec-scan-bar" hidden><div style="width:0%"></div></div>
      </div>
    </div>`,
  init(body){
    const statusEl=body.querySelector(".sec-status");
    const renderStatus=()=>{
      const s=Settings.get(),safe=s.realtimeProtection&&s.firewallOn;
      statusEl.innerHTML=`<div style="text-align:center;padding:6px 0 10px">
          <div style="font-size:40px;line-height:1">${safe?"🛡️":"⚠️"}</div>
          <div style="font-size:15px;font-weight:600;color:${safe?"var(--accent)":"#ff8a8a"}">${safe?"Protected":"At risk"}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">${safe?"Real-time protection and the firewall are both active.":"Turn on real-time protection and the firewall to stay protected."}</div>
        </div>`;
    };
    const T=(sel,key,label,extra)=>{
      const el=body.querySelector(sel);
      const sync=()=>el.classList.toggle("on",!!Settings.get()[key]);
      sync();
      el.addEventListener("click",()=>{
        const v=!Settings.get()[key];Settings.set({[key]:v});sync();renderStatus();
        NotifCenter.push("Security Center",`${label} ${v?"enabled":"disabled"}.`,"🛡️");
        if(extra)extra(v);
      });
    };
    T(".sec-realtime","realtimeProtection","Real-time protection");
    T(".sec-firewall","firewallOn","Firewall");
    T(".sec-camera","permCamera","Camera access");
    T(".sec-clipboard","permClipboard","Clipboard access");
    T(".sec-location","permLocation","Location access");
    T(".sec-lockboot","lockOnBoot","Lock on startup");
    T(".sec-autolock","autoLockEnabled","Auto-lock",()=>IdleLock.reset());
    renderStatus();
    const minsSel=body.querySelector(".sec-lockmins");
    minsSel.value=String(Settings.get().autoLockMinutes);
    minsSel.addEventListener("change",()=>{
      Settings.set({autoLockMinutes:Number(minsSel.value)});IdleLock.reset();
      NotifCenter.push("Security Center",`Auto-lock after ${minsSel.value} minute${minsSel.value==="1"?"":"s"}.`,"🔒");
    });
    body.querySelector(".sec-locknow").addEventListener("click",()=>Lock.show());
    const scanBtn=body.querySelector(".sec-scan"),scanStatus=body.querySelector(".sec-scan-status"),bar=body.querySelector(".sec-scan-bar"),fill=bar.querySelector("div");
    const showLastScan=()=>{const t=Store.get("security.lastScan",null);scanStatus.textContent=t?`Last scan: ${timeAgo(t)} — 0 threats found`:"Last scan: never"};
    showLastScan();
    scanBtn.addEventListener("click",()=>{
      if(scanBtn.disabled)return;
      scanBtn.disabled=true;bar.hidden=false;fill.style.width="0%";
      const files=VFS.count();let pct=0;
      const iv=setInterval(()=>{
        pct=Math.min(100,pct+10+Math.random()*15);
        fill.style.width=pct+"%";
        if(pct>=100){
          clearInterval(iv);
          Store.set("security.lastScan",Date.now());showLastScan();
          setTimeout(()=>{bar.hidden=true;scanBtn.disabled=false},400);
          NotifCenter.push("Security Center",`Scan complete — ${files} files checked, 0 threats found.`,"✅");
        }
      },180);
    });
  }
});
App.register("phonelink",{
  id:"phonelink",core:true,title:"Phone Link",icon:"📱",width:420,height:620,desc:"Simulated notification mirroring and shared clipboard with your phone",
  html:`<div class="settings-app">
      <div class="set-section pl-device"></div>
      <div class="set-section"><h4>Mirrored notifications</h4>
        <div class="pl-notifs" style="display:flex;flex-direction:column;gap:2px;max-height:150px;overflow-y:auto"></div>
        <button class="btn ghost tiny pl-simulate" style="margin-top:8px">📩 Simulate incoming notification</button>
      </div>
      <div class="set-section"><h4>Shared clipboard</h4>
        <div class="set-row"><span>Phone clipboard</span></div>
        <textarea class="input pl-phone-clip" rows="2" style="width:100%;resize:vertical" placeholder="Text “copied” on your phone…"></textarea>
        <div class="toolbar" style="margin-top:8px"><button class="btn ghost tiny pl-to-pc">⬆ Send to PC clipboard</button><button class="btn ghost tiny pl-from-pc">⬇ Pull from PC clipboard</button></div>
      </div>
    </div>`,
  init(body){
    const deviceEl=body.querySelector(".pl-device"),notifsEl=body.querySelector(".pl-notifs");
    let connected=Store.get("phonelink.connected",true);
    const battery=62,signal=3;
    const renderDevice=()=>{
      deviceEl.innerHTML=`
        <div class="set-row"><span>📱 My Phone</span><button class="toggle pl-conn${connected?" on":""}"></button></div>
        <div class="set-row"><span>Status</span><span style="color:${connected?"var(--accent)":"var(--muted)"}">${connected?"Connected":"Disconnected"}</span></div>
        <div class="set-row"><span>Battery</span><span>${connected?battery+"%":"—"}</span></div>
        <div class="set-row"><span>Signal</span><span>${connected?"📶".repeat(signal):"—"}</span></div>`;
      deviceEl.querySelector(".pl-conn").addEventListener("click",()=>{
        connected=!connected;Store.set("phonelink.connected",connected);renderDevice();
        NotifCenter.push("Phone Link",connected?"Phone connected.":"Phone disconnected.","📱");
      });
    };
    renderDevice();
    const NAMES=["Messages","Instagram","Gmail","WhatsApp","Calendar","Spotify"];
    const ICONS2={Messages:"💬",Instagram:"📸",Gmail:"📧",WhatsApp:"🟢",Calendar:"📅",Spotify:"🎧"};
    const TEXTS=["Mom: call me when you're free","New comment on your photo","Sign-in alert on your account","Sent you a voice message","Study group starts in 30 min","Added to your Discover Weekly"];
    let mirrored=Store.get("phonelink.notifs",[]);
    const renderNotifs=()=>{
      notifsEl.innerHTML=mirrored.length?mirrored.map(n=>`<div class="set-row"><span>${n.icon} <strong>${esc(n.app)}</strong> — ${esc(n.text)}</span><span style="color:var(--muted);font-size:11px;white-space:nowrap">${timeAgo(n.at)}</span></div>`).join(""):`<div style="color:var(--muted);font-size:12px;padding:6px 0">No notifications mirrored yet.</div>`;
    };
    renderNotifs();
    body.querySelector(".pl-simulate").addEventListener("click",()=>{
      if(!connected){NotifCenter.push("Phone Link","Connect your phone first.","📱");return}
      const app=NAMES[Math.floor(Math.random()*NAMES.length)];
      const n={app,icon:ICONS2[app],text:TEXTS[Math.floor(Math.random()*TEXTS.length)],at:Date.now()};
      mirrored=[n,...mirrored].slice(0,20);Store.set("phonelink.notifs",mirrored);renderNotifs();
      NotifCenter.push(app,n.text,n.icon);
    });
    const phoneClip=body.querySelector(".pl-phone-clip");
    body.querySelector(".pl-to-pc").addEventListener("click",async()=>{
      if(!Settings.get().permClipboard){NotifCenter.push("Phone Link","Clipboard access is blocked by Security Center.","🛡️");return}
      if(!connected){NotifCenter.push("Phone Link","Connect your phone first.","📱");return}
      try{await navigator.clipboard.writeText(phoneClip.value||"");NotifCenter.push("Phone Link","Copied to PC clipboard.","📋")}
      catch{NotifCenter.push("Phone Link","Couldn't reach the clipboard here — copy manually instead.","⚠️")}
    });
    body.querySelector(".pl-from-pc").addEventListener("click",async()=>{
      if(!Settings.get().permClipboard){NotifCenter.push("Phone Link","Clipboard access is blocked by Security Center.","🛡️");return}
      if(!connected){NotifCenter.push("Phone Link","Connect your phone first.","📱");return}
      try{const t=await navigator.clipboard.readText();phoneClip.value=t;NotifCenter.push("Phone Link","Pulled the PC clipboard into the phone box.","📋")}
      catch{NotifCenter.push("Phone Link","The browser blocked reading the clipboard — paste manually instead.","⚠️")}
    });
  }
});
App.register("photos",{
  id:"photos",core:true,title:"Photos",icon:"🖼️",width:640,height:520,desc:"Gallery for photos captured with the Camera app",
  html:`<div class="photos-app" style="display:flex;flex-direction:column;gap:10px;height:100%;position:relative">
      <div class="toolbar"><strong style="flex:1">Pictures</strong><button class="btn ghost tiny ph-refresh">🔄 Refresh</button></div>
      <div class="photos-grid" style="flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px"></div>
    </div>`,
  init(body){
    const grid=body.querySelector(".photos-grid"),root=body.querySelector(".photos-app");
    const render=()=>{
      const folder=VFS.resolve(["Pictures"]);
      const items=folder?Object.values(folder.children).filter(f=>f.type==="file"):[];
      if(!items.length){grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;color:var(--muted);padding:30px 10px">No photos yet — take one with 📷 Camera.</div>`;return}
      items.sort((a,b)=>b.created-a.created);
      grid.innerHTML=items.map(f=>`<div class="ph-tile" data-name="${esc(f.name)}" title="${esc(f.name)}" style="border-radius:10px;overflow:hidden;aspect-ratio:1;cursor:pointer;background:var(--control) center/cover no-repeat;background-image:url('${f.content}')"></div>`).join("");
    };
    grid.addEventListener("click",e=>{
      const t=e.target.closest(".ph-tile");if(!t)return;
      const folder=VFS.resolve(["Pictures"]);const f=folder&&folder.children[t.dataset.name];if(!f)return;
      const ov=document.createElement("div");
      ov.style.cssText="position:absolute;inset:0;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;z-index:5;border-radius:inherit";
      ov.innerHTML=`<img src="${f.content}" style="max-width:90%;max-height:78%;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.5)"><div style="display:flex;gap:8px"><button class="btn ghost tiny ph-close">Close</button><button class="btn ghost tiny ph-del">🗑️ Delete</button></div>`;
      root.appendChild(ov);
      ov.querySelector(".ph-close").addEventListener("click",()=>ov.remove());
      ov.querySelector(".ph-del").addEventListener("click",()=>{Trash.put(["Pictures"],f.name);ov.remove();render();refreshAll();NotifCenter.push("Photos","Photo moved to Recycle Bin.","🗑️")});
    });
    body.querySelector(".ph-refresh").addEventListener("click",render);
    render();
  }
});
App.register("terminal",{
  id:"terminal",title:"Terminal",icon:"⌨️",width:620,height:440,desc:"Command-line shell into your Web OS files",
  html:`<div class="terminal-app">
      <div class="term-output"></div>
      <div class="term-inputrow"><span class="term-prompt"></span><input class="term-input" autocomplete="off" spellcheck="false"></div>
    </div>`,
  init(body){
    const out=body.querySelector(".term-output"),input=body.querySelector(".term-input"),promptEl=body.querySelector(".term-prompt");
    let cwd=[];const hist=[];let histIdx=-1;
    const pathLabel=()=>"~/"+cwd.join("/");
    const print=(txt="",cls="")=>{const l=document.createElement("div");l.className="term-line "+cls;l.textContent=txt;out.appendChild(l);out.scrollTop=out.scrollHeight};
    const printHtml=(html,cls="")=>{const l=document.createElement("div");l.className="term-line "+cls;l.innerHTML=html;out.appendChild(l);out.scrollTop=out.scrollHeight};
    const resolve=arg=>{
      if(!arg||arg===".")return cwd.slice();
      if(arg==="~"||arg==="/")return[];
      let parts=arg.startsWith("/")?arg.slice(1).split("/"):cwd.concat(arg.split("/"));
      const stack=[];
      parts.forEach(p=>{if(p===""||p===".")return;if(p==="..")stack.pop();else stack.push(p)});
      return stack;
    };
    const splitPathName=arg=>{const full=resolve(arg);const name=full.pop();return{path:full,name}};
    const updPrompt=()=>promptEl.textContent=`webos:${pathLabel()}$`;
    const CMDS={
      help(){print("Commands: help, ls [path], cd <path>, pwd, cat <file>, echo <text>, mkdir <name>, touch <name>, rm <name>, mv <a> <b>, cp <a> <b>, clear, whoami, date, apps, open <appid>, neofetch, history, exit")},
      pwd(){print(pathLabel())},
      ls(args){
        const p=args[0]?resolve(args[0]):cwd;
        const node=VFS.resolve(p);
        if(!node||node.type!=="folder"){print(`ls: cannot access '${args[0]||"."}': No such directory`,"term-err");return}
        const items=Object.values(node.children);
        if(!items.length){print("(empty)");return}
        print(items.map(it=>it.type==="folder"?it.name+"/":it.name).sort().join("   "));
      },
      cd(args){
        if(!args[0]){cwd=[];updPrompt();return}
        const p=resolve(args[0]);const node=VFS.resolve(p);
        if(!node||node.type!=="folder"){print(`cd: ${args[0]}: No such directory`,"term-err");return}
        cwd=p;updPrompt();
      },
      cat(args){
        if(!args[0]){print("cat: missing file operand","term-err");return}
        const{path,name}=splitPathName(args[0]);
        const content=VFS.readFile(path,name);
        if(content==null){print(`cat: ${args[0]}: No such file`,"term-err");return}
        if(content.startsWith&&content.startsWith("data:")){print(`(binary file, ${fileSizeLabel(fileByteSize({type:"file",content}))})`);return}
        print(content);
      },
      echo(args){
        const line=args.join(" ");
        const gtIdx=line.indexOf(">");
        if(gtIdx>=0){
          const text=line.slice(0,gtIdx).trim(),fname=line.slice(gtIdx+1).trim();
          if(!fname){print("echo: missing filename after '>'","term-err");return}
          const{path,name}=splitPathName(fname);
          if(VFS.readFile(path,name)!=null)VFS.writeFile(path,name,text);
          else VFS.createFile(path,name,text);
          refreshAll();
        }else print(line);
      },
      mkdir(args){if(!args[0]){print("mkdir: missing operand","term-err");return}const{path,name}=splitPathName(args[0]);if(VFS.createFolder(path,name)){refreshAll()}else print(`mkdir: cannot create '${args[0]}'`,"term-err")},
      touch(args){if(!args[0]){print("touch: missing operand","term-err");return}const{path,name}=splitPathName(args[0]);if(VFS.readFile(path,name)==null){if(!VFS.createFile(path,name,""))print(`touch: cannot create '${args[0]}'`,"term-err")}refreshAll()},
      rm(args){if(!args[0]){print("rm: missing operand","term-err");return}const{path,name}=splitPathName(args[0]);if(VFS.delete(path,name)){refreshAll()}else print(`rm: cannot remove '${args[0]}'`,"term-err")},
      mv(args){if(args.length<2){print("mv: missing operand","term-err");return}const src=splitPathName(args[0]);const dest=splitPathName(args[1]);const f=VFS.resolve(src.path);if(f&&f.children[src.name]){VFS.rename(src.path,src.name,dest.name);if(JSON.stringify(src.path)!==JSON.stringify(dest.path))VFS.move(src.path,dest.name,dest.path);refreshAll()}else print(`mv: cannot stat '${args[0]}'`,"term-err")},
      cp(args){if(args.length<2){print("cp: missing operand","term-err");return}const src=splitPathName(args[0]);const content=VFS.readFile(src.path,src.name);if(content==null){print(`cp: cannot stat '${args[0]}'`,"term-err");return}const dest=splitPathName(args[1]);VFS.createFile(dest.path,dest.name,content);refreshAll()},
      clear(){out.innerHTML=""},
      whoami(){print(Settings.get().deviceName.toLowerCase().replace(/\s+/g,"-"))},
      date(){print(new Date().toString())},
      apps(){print(App.visible().map(d=>d.id).join("  "))},
      open(args){if(!args[0]||!App.get(args[0])){print(`open: unknown app '${args[0]||""}'`,"term-err");return}openApp(args[0]);print(`Opening ${args[0]}…`)},
      neofetch(){
        printHtml(`<pre style="margin:0;font-family:inherit">⬢ webos@${esc(Settings.get().deviceName)}
------------------------
OS: Web OS 4.5
Windows open: ${Object.keys(WM.windows).length}
Files: ${VFS.count()}
Uptime: ${Math.floor(performance.now()/1000)}s</pre>`);
      },
      history(){print(hist.join("\n")||"(empty)")},
      exit(){const w=WM.windows["win-terminal"];if(w)WM.close(w.id)}
    };
    const run=line=>{
      const trimmed=line.trim();
      print(`${promptEl.textContent} ${line}`,"term-echo");
      if(!trimmed)return;
      hist.push(trimmed);histIdx=hist.length;
      const parts=trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)||[];
      const cmd=parts[0],args=parts.slice(1).map(a=>a.replace(/^"|"$/g,""));
      if(CMDS[cmd])try{CMDS[cmd](args)}catch(err){print("error: "+err.message,"term-err")}
      else print(`command not found: ${cmd} (type 'help')`,"term-err");
    };
    input.addEventListener("keydown",e=>{
      if(e.key==="Enter"){const v=input.value;input.value="";run(v)}
      else if(e.key==="ArrowUp"){if(histIdx>0){histIdx--;input.value=hist[histIdx]||"";setTimeout(()=>input.setSelectionRange(input.value.length,input.value.length))}e.preventDefault()}
      else if(e.key==="ArrowDown"){if(histIdx<hist.length){histIdx++;input.value=hist[histIdx]||""}e.preventDefault()}
    });
    body.addEventListener("click",()=>input.focus());
    printHtml(`<pre style="margin:0;font-family:inherit">Web OS Terminal — type 'help' for commands.</pre>`);
    updPrompt();
    setTimeout(()=>input.focus(),50);
  }
});
App.register("editor",{
  id:"editor",title:"Code Editor",icon:"🧑‍💻",width:760,height:560,desc:"Spck-style code editor: file tree, create files & folders, run HTML/JS directly",
  html:`<div class="editor-app">
      <div class="toolbar editor-tabs"></div>
      <div class="editor-body">
        <div class="editor-sidebar">
          <div class="toolbar tiny-toolbar">
            <strong class="ed-tree-label">FILES</strong>
            <button class="wbtn ed-new-file" title="New file">📄<sup>+</sup></button>
            <button class="wbtn ed-new-folder" title="New folder">📂<sup>+</sup></button>
          </div>
          <div class="editor-tree"></div>
        </div>
        <div class="editor-main">
          <div class="editor-wrap">
            <div class="editor-gutter"></div>
            <pre class="editor-highlight"><code></code></pre>
            <textarea class="editor-area" spellcheck="false" autocomplete="off"></textarea>
          </div>
          <div class="toolbar">
            <button class="btn ghost tiny ed-toggle-tree">📁 Files</button>
            <button class="btn ghost tiny ed-save">💾 Save</button>
            <span style="flex:1"></span>
            <span class="ed-status" style="font-size:11px;color:var(--muted)"></span>
            <button class="btn tiny ed-run">▶ Run</button>
          </div>
        </div>
      </div>
    </div>`,
  init(body,win){
    const tabsEl=body.querySelector(".editor-tabs"),gutter=body.querySelector(".editor-gutter"),hl=body.querySelector(".editor-highlight code"),area=body.querySelector(".editor-area"),statusEl=body.querySelector(".ed-status"),treeEl=body.querySelector(".editor-tree"),sidebar=body.querySelector(".editor-sidebar");
    let tabs=[];let activeIdx=-1;let treeCwd=[];const expanded=new Set([""]);
    const langOf=name=>{const ext=(name.split(".").pop()||"").toLowerCase();if(["js","json"].includes(ext))return"js";if(ext==="html")return"html";if(ext==="css")return"css";return"plain"};
    const HL_RULES={
      js:[[/\/\/.*$/gm,"cm"],[/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g,"str"],[/\b(function|return|const|let|var|if|else|for|while|new|class|import|export|from|true|false|null|undefined|typeof|await|async|try|catch)\b/g,"kw"],[/\b\d+(\.\d+)?\b/g,"num"]],
      html:[[/(&lt;!--[\s\S]*?--&gt;)/g,"cm"],[/(&lt;\/?)([a-zA-Z0-9-]+)/g,(m,p1,p2)=>p1+`<span class="tk-kw">${p2}</span>`],[/([a-zA-Z-]+)(=)(".*?")/g,(m,a,eq,v)=>`<span class="tk-attr">${a}</span>${eq}<span class="tk-str">${v}</span>`]],
      css:[[/\/\*[\s\S]*?\*\//g,"cm"],[/([.#]?[a-zA-Z0-9_-]+)(\s*\{)/g,(m,a,b)=>`<span class="tk-kw">${a}</span>${b}`],[/(:\s*)([^;{}]+)(;)/g,(m,a,v,c)=>`${a}<span class="tk-str">${v}</span>${c}`]],
      plain:[]
    };
    const highlight=(text,lang)=>{
      let e=esc(text);
      const rules=HL_RULES[lang]||[];
      rules.forEach(([re,repl])=>{
        if(typeof repl==="string")e=e.replace(re,m=>`<span class="tk-${repl}">${m}</span>`);
        else e=e.replace(re,repl);
      });
      return e;
    };
    const renderGutter=()=>{const n=(area.value.match(/\n/g)||[]).length+1;let s="";for(let i=1;i<=n;i++)s+=i+"\n";gutter.textContent=s};
    const renderHl=()=>{const t=tabs[activeIdx];hl.innerHTML=highlight(area.value,t?langOf(t.name):"plain")+"\n"};
    const renderTabs=()=>{
      tabsEl.innerHTML=tabs.map((t,i)=>`<button class="ed-tab${i===activeIdx?" on":""}" data-i="${i}">${esc(t.name)}${t.dirty?" •":""}<span class="ed-tab-close" data-i="${i}">✕</span></button>`).join("")||`<span style="color:var(--muted);font-size:12px">No file open — pick one from Files, or 📄+</span>`;
    };
    const syncScroll=()=>{gutter.scrollTop=area.scrollTop;hl.parentElement.scrollTop=area.scrollTop;hl.parentElement.scrollLeft=area.scrollLeft};
    const loadTab=i=>{
      activeIdx=i;const t=tabs[i];if(!t)return;
      area.value=t.content;renderGutter();renderHl();renderTabs();renderTree();
      statusEl.textContent=(t.path.length?t.path.join("/")+"/":"")+t.name;
      area.focus();
    };
    const openFile=(path,name)=>{
      const existing=tabs.findIndex(t=>t.name===name&&JSON.stringify(t.path)===JSON.stringify(path));
      if(existing>=0){loadTab(existing);return}
      const content=VFS.readFile(path,name);
      if(content==null||(content.startsWith&&content.startsWith("data:"))){NotifCenter.push("Code Editor","Can't open a binary file here.","🧑‍💻");return}
      tabs.push({path,name,content,dirty:false});loadTab(tabs.length-1);
    };
    const closeTab=i=>{
      tabs.splice(i,1);
      if(activeIdx===i)activeIdx=-1;else if(activeIdx>i)activeIdx--;
      if(activeIdx<0&&tabs.length)activeIdx=Math.max(0,i-1);
      if(tabs[activeIdx])loadTab(activeIdx);else{area.value="";renderGutter();renderHl();renderTabs();renderTree();statusEl.textContent=""}
    };
    const newFile=(path)=>{const p=path||treeCwd;const name=uniqueChildName(VFS.resolve(p)||VFS.resolve([]),"untitled.txt");VFS.createFile(p,name,"");refreshAll();tabs.push({path:p,name,content:"",dirty:false});loadTab(tabs.length-1);sidebar.classList.remove("show")};
    const newFolder=(path)=>{const p=path||treeCwd;const name=uniqueChildName(VFS.resolve(p)||VFS.resolve([]),"New folder");VFS.createFolder(p,name);expanded.add([...p,name].join("/"));refreshAll();renderTree();};
    const save=()=>{
      const t=tabs[activeIdx];if(!t)return;
      t.content=area.value;
      if(VFS.readFile(t.path,t.name)!=null)VFS.writeFile(t.path,t.name,t.content);
      else VFS.createFile(t.path,t.name,t.content);
      t.dirty=false;renderTabs();refreshAll();
      NotifCenter.push("Code Editor",`Saved "${t.name}".`,"💾");
    };
    const renderTree=()=>{
      treeEl.innerHTML="";
      const walk=(path,node,depth)=>{
        const items=Object.values(node.children||{}).sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name):a.type==="folder"?-1:1);
        items.forEach(item=>{
          const itemPath=[...path,item.name],key=itemPath.join("/");
          const isOpenTab=item.type==="file"&&tabs[activeIdx]&&tabs[activeIdx].name===item.name&&JSON.stringify(tabs[activeIdx].path)===JSON.stringify(path);
          const row=document.createElement("div");
          row.className="ed-tree-row"+(item.type==="folder"&&treeCwd.join("/")===key?" cwd":"")+(isOpenTab?" open":"");
          row.style.paddingLeft=(depth*14+8)+"px";
          row.innerHTML=`<span>${item.type==="folder"?(expanded.has(key)?"📂":"📁"):fileIcon(item.name,false)}</span><span class="ed-tree-name">${esc(item.name)}</span>`;
          row.addEventListener("click",()=>{
            if(item.type==="folder"){treeCwd=itemPath;if(expanded.has(key))expanded.delete(key);else expanded.add(key);renderTree()}
            else{openFile(path,item.name);sidebar.classList.remove("show")}
          });
          treeEl.appendChild(row);
          if(item.type==="folder"&&expanded.has(key))walk(itemPath,item,depth+1);
        });
      };
      const root=VFS.resolve([]);if(root)walk([],root,0);
      if(!treeEl.children.length)treeEl.innerHTML=`<div style="padding:8px;color:var(--muted);font-size:12px">Empty</div>`;
    };
    body.querySelector(".ed-new-file").addEventListener("click",()=>newFile());
    body.querySelector(".ed-new-folder").addEventListener("click",()=>newFolder());
    body.querySelector(".ed-save").addEventListener("click",save);
    body.querySelector(".ed-toggle-tree").addEventListener("click",()=>sidebar.classList.toggle("show"));
    tabsEl.addEventListener("click",e=>{
      const x=e.target.closest(".ed-tab-close");if(x){e.stopPropagation();closeTab(Number(x.dataset.i));return}
      const b=e.target.closest(".ed-tab");if(!b)return;loadTab(Number(b.dataset.i));
    });
    area.addEventListener("input",()=>{
      renderGutter();renderHl();
      const t=tabs[activeIdx];if(t){t.dirty=true;renderTabs()}
    });
    area.addEventListener("scroll",syncScroll);
    area.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();save()}
      if(e.key==="Tab"){e.preventDefault();const s=area.selectionStart,en=area.selectionEnd;area.value=area.value.slice(0,s)+"  "+area.value.slice(en);area.selectionStart=area.selectionEnd=s+2;area.dispatchEvent(new Event("input"))}
    });
    const inlineHtml=(html,path)=>{
      return html
        .replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,(m,href)=>{
          if(/^https?:|^\/\//i.test(href))return m;
          const css=VFS.readFile(path,href.replace(/^\.\//,""));
          return css!=null?`<style>\n${css}\n</style>`:`<!-- couldn't find ${esc(href)} -->`;
        })
        .replace(/<script([^>]*)\ssrc=["']([^"']+)["']([^>]*)><\/script>/gi,(m,pre,src)=>{
          if(/^https?:|^\/\//i.test(src))return m;
          const js=VFS.readFile(path,src.replace(/^\.\//,""));
          return js!=null?`<script>\n${js}\n</script>`:`<!-- couldn't find ${esc(src)} -->`;
        });
    };
    body.querySelector(".ed-run").addEventListener("click",()=>{
      const t=tabs[activeIdx];if(!t){NotifCenter.push("Code Editor","Open a file first.","▶");return}
      t.content=area.value;
      const lang=langOf(t.name);
      if(lang==="html")RunPreview.open(t.name,inlineHtml(t.content,t.path),"html");
      else if(lang==="js")RunPreview.open(t.name,t.content,"js");
      else NotifCenter.push("Code Editor","Nothing to run for this file type — try an .html or .js file.","▶");
    });
    if(win.args&&win.args.path!==undefined&&win.args.name)openFile(win.args.path,win.args.name);
    else{renderTabs()}
    win.openFile=openFile;
    renderTree();
  }
});
const RunPreview={
  open(title,content,kind){
    const old=$("#runPreview");if(old)old.remove();
    const overlay=document.createElement("div");overlay.className="folder-picker-overlay";overlay.id="runPreview";
    overlay.innerHTML=`<div class="folder-picker run-preview">
      <div class="fp-head"><strong>▶ ${esc(title)}</strong><button class="wbtn close rp-close" title="Close">✕</button></div>
      <div class="rp-body">${kind==="html"?'<iframe class="rp-frame" sandbox="allow-scripts allow-forms allow-modals allow-popups"></iframe>':'<div class="rp-console"></div>'}</div>
    </div>`;
    document.body.appendChild(overlay);
    const close=()=>{window.removeEventListener("message",listener);overlay.remove()};
    let listener=()=>{};
    overlay.querySelector(".rp-close").addEventListener("click",close);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    if(kind==="html"){
      overlay.querySelector(".rp-frame").srcdoc=content;
      return;
    }
    const consoleEl=overlay.querySelector(".rp-console");
    consoleEl.innerHTML='<div class="rp-log rp-placeholder" style="color:var(--muted)">Running…</div>';
    const wrapped=`<script>
      const send=(type,args)=>parent.postMessage({__runlog:true,type,args:args.map(a=>{try{return typeof a==="object"?JSON.stringify(a):String(a)}catch{return String(a)}})},"*");
      ["log","warn","error","info"].forEach(m=>{const orig=console[m];console[m]=(...a)=>{send(m,a);orig&&orig.apply(console,a)}});
      window.onerror=(msg)=>{send("error",[String(msg)]);return true};
      try{
        ${content}
      }catch(e){send("error",[e.message])}
    </script>`;
    const hiddenFrame=document.createElement("iframe");hiddenFrame.style.display="none";hiddenFrame.sandbox="allow-scripts";
    overlay.appendChild(hiddenFrame);
    listener=e=>{
      if(!e.data||!e.data.__runlog)return;
      const ph=consoleEl.querySelector(".rp-placeholder");if(ph)ph.remove();
      const row=document.createElement("div");row.className="rp-log rp-log-"+e.data.type;
      row.textContent=e.data.args.join(" ");
      consoleEl.appendChild(row);consoleEl.scrollTop=consoleEl.scrollHeight;
    };
    window.addEventListener("message",listener);
    hiddenFrame.addEventListener("load",()=>{setTimeout(()=>{const ph=consoleEl.querySelector(".rp-placeholder");if(ph)ph.textContent="✓ Ran with no console output."},250)},{once:true});
    hiddenFrame.srcdoc=wrapped;
  }
};
App.register("pdfviewer",{
  id:"pdfviewer",title:"PDF Viewer",icon:"📕",width:520,height:620,desc:"View PDF documents with page navigation and zoom",
  html:`<div class="pdfviewer-app">
      <div class="toolbar">
        <button class="btn ghost tiny pv-open">📂 Open…</button>
        <span style="flex:1"></span>
        <button class="btn ghost tiny pv-zoomout">－</button>
        <span class="pv-zoom" style="font-size:12px;color:var(--muted)">100%</span>
        <button class="btn ghost tiny pv-zoomin">＋</button>
      </div>
      <div class="pv-canvas-wrap"><canvas class="pv-canvas"></canvas><div class="pv-empty">No PDF open — click Open… to choose one, or drag & drop a PDF from your computer onto File Manager.</div></div>
      <div class="toolbar">
        <button class="btn ghost tiny pv-prev">◀ Prev</button>
        <span class="pv-pageinfo" style="font-size:12px;color:var(--muted)">—</span>
        <button class="btn ghost tiny pv-next">Next ▶</button>
      </div>
    </div>`,
  init(body,win){
    const canvas=body.querySelector(".pv-canvas"),wrap=body.querySelector(".pv-canvas-wrap"),empty=body.querySelector(".pv-empty"),pageInfo=body.querySelector(".pv-pageinfo"),zoomLbl=body.querySelector(".pv-zoom");
    let pdfDoc=null,pageNum=1,zoom=1.0;
    const ensurePdfJs=()=>new Promise((resolve,reject)=>{
      if(window.pdfjsLib)return resolve(window.pdfjsLib);
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";resolve(window.pdfjsLib)};
      s.onerror=()=>reject(new Error("Could not load PDF engine (are you offline?)"));
      document.head.appendChild(s);
    });
    const renderPage=async()=>{
      if(!pdfDoc)return;
      const page=await pdfDoc.getPage(pageNum);
      const viewport=page.getViewport({scale:zoom});
      canvas.width=viewport.width;canvas.height=viewport.height;
      await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
      pageInfo.textContent=`Page ${pageNum} of ${pdfDoc.numPages}`;
      zoomLbl.textContent=Math.round(zoom*100)+"%";
    };
    const openPdf=async(path,name)=>{
      const content=VFS.readFile(path,name);
      if(!content||!content.startsWith("data:")){NotifCenter.push("PDF Viewer","That file isn't a PDF.","📕");return}
      try{
        empty.textContent="Loading PDF engine…";
        const lib=await ensurePdfJs();
        const base64=content.split(",")[1];
        const bin=atob(base64);const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
        pdfDoc=await lib.getDocument({data:bytes}).promise;
        pageNum=1;empty.style.display="none";canvas.style.display="block";
        await renderPage();
      }catch(err){empty.style.display="flex";canvas.style.display="none";empty.textContent="Couldn't open PDF: "+err.message}
    };
    body.querySelector(".pv-open").addEventListener("click",()=>FilePicker.open(".pdf",(path,name)=>openPdf(path,name)));
    body.querySelector(".pv-prev").addEventListener("click",()=>{if(pdfDoc&&pageNum>1){pageNum--;renderPage()}});
    body.querySelector(".pv-next").addEventListener("click",()=>{if(pdfDoc&&pageNum<pdfDoc.numPages){pageNum++;renderPage()}});
    body.querySelector(".pv-zoomin").addEventListener("click",()=>{zoom=Math.min(3,zoom+0.2);if(pdfDoc)renderPage();else zoomLbl.textContent=Math.round(zoom*100)+"%"});
    body.querySelector(".pv-zoomout").addEventListener("click",()=>{zoom=Math.max(0.4,zoom-0.2);if(pdfDoc)renderPage();else zoomLbl.textContent=Math.round(zoom*100)+"%"});
    canvas.style.display="none";
    if(win.args&&win.args.path!==undefined&&win.args.name)openPdf(win.args.path,win.args.name);
    win.openPdf=openPdf;
  }
});
const Widgets={
  iv:null,
  init(){
    Settings.get().widgets&&this.render();
    this.iv=setInterval(()=>this.tick(),1000);
    if(navigator.getBattery)navigator.getBattery().then(b=>{
      const upd=()=>{const el=$("#batTray");if(!el)return;el.hidden=false;$("#batLabel").textContent=Math.round(b.level*100)+"%";$("#batIcon").textContent=b.charging?"⚡":"🔋"};
      upd();b.addEventListener("levelchange",upd);b.addEventListener("chargingchange",upd);
    }).catch(()=>{});
  },
  render(){
    const root=$("#widgets");if(!root)return;
    if(!Settings.get().widgets){root.innerHTML="";this.syncSpace();return}
    root.innerHTML=`
      <div class="widget" id="widgetClock"><div class="widget-time">--:--</div><div class="widget-date"></div></div>
      <div class="widget"><div class="widget-title">System</div><div class="widget-row"><span>Windows</span><span id="wWins">0</span></div><div class="widget-row"><span>Storage</span><span id="wStore">0 KB</span></div><div class="widget-row"><span>Online</span><span id="wNet">—</span></div></div>`;
    this.tick();
    this.syncSpace();
  },
  syncSpace(){
    // Reserve room above the desktop icons so the widgets stack (clock/date/system
    // card) never overlaps or hides icon labels on narrow/phone-width screens.
    const el=$("#widgets");
    const h=(el&&Settings.get().widgets&&window.innerWidth<=768)?el.offsetHeight:0;
    document.documentElement.style.setProperty("--widgets-space",h?(h+18)+"px":"0px");
  },
  ticker(){this.tick()},
  tick(){
    const te=$("#widgetClock .widget-time");if(!te)return;
    const s=Settings.get(),now=new Date();
    let h=now.getHours();
    let txt;
    if(!s.clock24){const ap=h>=12?"PM":"AM";h=h%12||12;txt=h+":"+String(now.getMinutes()).padStart(2,"0")+(s.seconds?":"+String(now.getSeconds()).padStart(2,"0"):"")+" "+ap}
    else{txt=String(h).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0")+(s.seconds?":"+String(now.getSeconds()).padStart(2,"0"):"")}
    te.textContent=txt;
    const de=$("#widgetClock .widget-date");if(de)de.textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    const ww=$("#wWins");if(ww)ww.textContent=Object.keys(WM.windows).length;
    const ws=$("#wStore");if(ws)ws.textContent=(Store.bytes()/1024).toFixed(1)+" KB";
    const wn=$("#wNet");if(wn)wn.textContent=navigator.onLine?"Online":"Offline";
    const ne=$("#netLabel");if(ne)ne.textContent=navigator.onLine?"Online":"Offline";
    const ni=$("#netIcon");if(ni)ni.textContent=navigator.onLine?"📶":"📵";
  }
};
const Clock={
  iv:null,
  start(){this.update();this.iv=setInterval(()=>this.update(),1000)},
  update(){
    const cEl=$("#clock"),dEl=$("#clockDate");if(!cEl)return;
    const s=Settings.get(),now=new Date();
    let h=now.getHours();
    let t;
    if(!s.clock24){const ap=h>=12?"PM":"AM";h=h%12||12;t=h+":"+String(now.getMinutes()).padStart(2,"0")+(s.seconds?":"+String(now.getSeconds()).padStart(2,"0"):"")+" "+ap}
    else{t=String(h).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0")+(s.seconds?":"+String(now.getSeconds()).padStart(2,"0"):"")}
    cEl.textContent=t;
    dEl.textContent=now.toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
    Widgets.tick();
  },
  renderPanel(){
    const panel=$("#calPanel");if(!panel)return;
    const now=new Date();const y=now.getFullYear(),m=now.getMonth();
    const first=new Date(y,m,1).getDay();const dim=new Date(y,m+1,0).getDate();const dp=new Date(y,m,0).getDate();
    const monthName=new Date(y,m,1).toLocaleDateString(undefined,{month:"long",year:"numeric"});
    let cells="";
    for(let i=first-1;i>=0;i--)cells+=`<div class="day other">${dp-i}</div>`;
    for(let d=1;d<=dim;d++)cells+=`<div class="day${d===now.getDate()?" today":""}">${d}</div>`;
    const trail=(7-((first+dim)%7))%7;for(let d=1;d<=trail;d++)cells+=`<div class="day other">${d}</div>`;
    const dow=["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>`<div class="dow">${d}</div>`).join("");
    panel.innerHTML=`<div class="cal-big-time">${$("#clock").textContent}</div><div class="cal-big-date">${now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div><div class="cal-head"><strong>${esc(monthName)}</strong><span><button class="cal-nav cal-prev">‹</button> <button class="cal-nav cal-next">›</button></span></div><div class="cal-grid">${dow}${cells}</div>`;
    panel.querySelector(".cal-prev").addEventListener("click",()=>{const cur=new Date(panel.querySelector(".cal-head strong").textContent);const ny=cur.getFullYear(),nm=cur.getMonth()-1;if(nm<0){nm=11;ny--}renderCalAt(ny,nm)});
    panel.querySelector(".cal-next").addEventListener("click",()=>{const cur=new Date(panel.querySelector(".cal-head strong").textContent);const ny=cur.getFullYear(),nm=cur.getMonth()+1;if(nm>11){nm=0;ny++}renderCalAt(ny,nm)});
  }
};
function renderCalAt(y,m){
  const panel=$("#calPanel");const now=new Date();
  const first=new Date(y,m,1).getDay();const dim=new Date(y,m+1,0).getDate();const dp=new Date(y,m,0).getDate();
  const monthName=new Date(y,m,1).toLocaleDateString(undefined,{month:"long",year:"numeric"});
  let cells="";
  for(let i=first-1;i>=0;i--)cells+=`<div class="day other">${dp-i}</div>`;
  for(let d=1;d<=dim;d++)cells+=`<div class="day${d===now.getDate()&&m===now.getMonth()&&y===now.getFullYear()?" today":""}">${d}</div>`;
  const trail=(7-((first+dim)%7))%7;for(let d=1;d<=trail;d++)cells+=`<div class="day other">${d}</div>`;
  panel.querySelector(".cal-head strong").textContent=monthName;
  panel.querySelector(".cal-grid").innerHTML=["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=>`<div class="dow">${d}</div>`).join("")+cells;
}
const StartMenu={
  init(){
    renderStartApps();
    $("#startBtn").addEventListener("click",e=>{e.stopPropagation();this.toggle()});
    $("#searchInput").addEventListener("focus",()=>{$("#startBtn").click()});
    $("#searchInput").addEventListener("input",debounce(e=>this.search(e.target.value),100));
    $("#startSearch").addEventListener("input",e=>this.search(e.target.value));
    document.addEventListener("click",e=>{if(!$("#startMenu").contains(e.target)&&!e.target.closest("#startBtn")&&!e.target.closest("#searchInput"))$("#startMenu").classList.remove("show")});
  },
  toggle(){const m=$("#startMenu");if(m.classList.contains("show"))this.close();else{m.classList.add("show");$("#startSearch").value="";this.search("");setTimeout(()=>$("#startSearch").focus(),60)}},
  close(){$("#startMenu").classList.remove("show")},
  search(q){
    q=q.trim().toLowerCase();
    const tiles=$$(".app-tile");
    tiles.forEach(t=>{const def=App.get(t.dataset.app);const m=!q||def.title.toLowerCase().includes(q)||def.id.toLowerCase().includes(q);t.style.display=m?"":"none";t.classList.toggle("active",!!q&&m)});
    const fw=$("#startFilesWrap"),fb=$("#startFiles");
    fb.innerHTML="";
    if(!q){fw.hidden=true;return}
    fw.hidden=false;
    const hits=[];
    (function walk(node,path){
      if(hits.length>=12)return;
      Object.values(node.children||{}).forEach(c=>{
        if(hits.length<12&&c.name.toLowerCase().includes(q))hits.push({name:c.name,path:path.join("/")||"Home",isFile:c.type==="file"});
        if(c.type==="folder")walk(c,[...path,c.name]);
      });
    })(VFS.data,[]);
    if(!hits.length){fb.innerHTML=`<div class="file-hit" style="cursor:default;color:var(--muted)">No matching files</div>`;return}
    hits.forEach(h=>{
      const b=document.createElement("button");b.className="file-hit";
      b.innerHTML=`<span>${fileIcon(h.name,!h.isFile)}</span><span>${esc(h.name)}</span><span class="hit-path">${esc(h.path)}</span>`;
      b.addEventListener("click",()=>{
        this.close();
        if(h.name.startsWith("launch-")&&h.name.endsWith(".app")){
          const w=VFS.resolve(h.path==="Home"?[]:h.path.split("/"));const it=w&&w.children[h.name];
          const data=it&&parseAppFile(it);
          if(data){WM.open(data.appId);return}
        }
        if(h.isFile){
          const parts=h.path==="Home"?[]:h.path.split("/");
          const w=WM.open("notes");setTimeout(()=>{
            const t=w&&w.el.querySelector(".notes-title"),a=w&&w.el.querySelector(".notes-area");
            if(t)t.value=h.name;if(a)a.value=VFS.readFile(parts,h.name)||"";
          },50);
        }else WM.open("files");
      });
      fb.appendChild(b);
    });
  }
};
const Context={
  init(){
    const items=[
      {icon:"🖼️",label:"Open Settings",act:()=>openApp("settings")},
      {icon:"🎨",label:"Next wallpaper",act:()=>{const k=Object.keys(WALLPAPERS);const c=k.indexOf(Settings.get().wallpaper);const n=k[(c+1)%k.length];Settings.set({wallpaper:n});NotifCenter.push("Desktop",`Wallpaper: ${WALLPAPERS[n].label}.`,"🎨")}},
      {icon:"🎯",label:"Next accent color",act:()=>{const k=Object.keys(ACCENTS);const c=k.indexOf(Settings.get().accent);const n=k[(c+1)%k.length];Settings.set({accent:n});NotifCenter.push("Desktop",`Accent: ${n}.`,"🎯")}},
      {icon:"🧩",label:"Toggle widgets",act:()=>{Settings.set({widgets:!Settings.get().widgets});Settings.apply();NotifCenter.push("Desktop",Settings.get().widgets?"Widgets on.":"Widgets off.","🧩")}},
      {sep:true},
      {icon:"📝",label:"New note",act:()=>openApp("notes")},
      {icon:"📂",label:"Open File Manager",act:()=>openApp("files")},
      {icon:"🗑️",label:"Empty Recycle Bin",act:()=>{if(Trash.count()){Trash.empty();updateBadge();NotifCenter.push("Recycle Bin","Recycle Bin emptied.","🔥")}else NotifCenter.push("Recycle Bin","Already empty.","🗑️")}},
      {sep:true},
      {icon:"🔒",label:"Lock screen",act:()=>Lock.show()},
      {icon:"🔄",label:"Close all windows",act:()=>Object.keys(WM.windows).forEach(id=>WM.close(id))},
      {sep:true},
      {icon:"⏻",label:"Shut down",act:()=>Boot.shutdown()},
    ];
    const menu=$("#contextMenu");
    menu.innerHTML=items.map((it,i)=>it.sep?'<div class="context-sep"></div>':`<button class="context-item" data-idx="${i}"><span class="ctx-icon">${it.icon}</span><span>${esc(it.label)}</span></button>`).join("");
    menu.addEventListener("click",e=>{const it=e.target.closest(".context-item");if(!it)return;const a=items[Number(it.dataset.idx)];menu.classList.remove("show");if(a&&a.act)a.act()});
    $("#desktop").addEventListener("contextmenu",e=>{if(e.target.closest(".window")||e.target.closest(".taskbar")||e.target.closest(".context-menu"))return;e.preventDefault();menu.classList.add("show");menu.style.left=Math.min(e.clientX,window.innerWidth-menu.offsetWidth-8)+"px";menu.style.top=Math.min(e.clientY,window.innerHeight-menu.offsetHeight-8)+"px"});
    document.addEventListener("click",e=>{if(!menu.contains(e.target))menu.classList.remove("show")});
  }
};
const Panels={
  init(){
    const np=$("#notifPanel"),cp=$("#calPanel");
    const closeAll=ex=>{if(ex!==np)np.classList.remove("show");if(ex!==cp)cp.classList.remove("show")};
    $("#notifBell").addEventListener("click",e=>{e.stopPropagation();const s=!np.classList.contains("show");closeAll(np);if(s){NotifCenter.renderPanel();np.classList.add("show")}});
    $("#clockBtn").addEventListener("click",e=>{e.stopPropagation();const s=!cp.classList.contains("show");closeAll(cp);if(s){Clock.renderPanel();cp.classList.add("show")}});
    $("#notifClearBtn").addEventListener("click",()=>{NotifCenter.clearAll()});
    document.addEventListener("click",e=>{if(!np.contains(e.target)&&!e.target.closest("#notifBell"))np.classList.remove("show");if(!cp.contains(e.target)&&!e.target.closest("#clockBtn"))cp.classList.remove("show")});
  }
};
const Lock={
  el:null,timer:null,
  show(){
    if(this.el)return;
    Settings.apply();
    this.el=document.createElement("div");this.el.className="lock-screen";
    document.body.appendChild(this.el);
    this.tick();
    this.timer=setInterval(()=>this.tick(),1000);
    this.el.addEventListener("click",()=>this.hide());
  },
  hide(){
    if(!this.el)return;
    clearInterval(this.timer);
    this.el.remove();this.el=null;this.timer=null;
    IdleLock.reset();
  },
  tick(){
    if(!this.el)return;
    const now=new Date();
    const t=now.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
    const d=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    this.el.innerHTML=`<div class="lock-time">${t}</div><div style="color:rgba(255,255,255,0.7);font-size:15px">${d}</div><div class="lock-hint">Click to unlock</div>`;
  }
};
const IdleLock={
  timer:null,
  reset(){
    clearTimeout(this.timer);
    if(!Settings.get().autoLockEnabled||Lock.el)return;
    const mins=Math.max(1,Number(Settings.get().autoLockMinutes)||5);
    this.timer=setTimeout(()=>{if(!Lock.el)Lock.show()},mins*60000);
  },
  init(){
    ["mousemove","mousedown","keydown","touchstart","wheel"].forEach(evt=>window.addEventListener(evt,()=>this.reset(),{passive:true}));
    this.reset();
  }
};
const Boot={
  init(){
    const screen=$("#bootScreen");if(!screen)return;
    if(Store.get("powered",true)===false){
      screen.classList.remove("hide");screen.classList.add("shutdown");
      screen.innerHTML=`<div class="boot-logo">⏻</div><div class="boot-hint">Click to power on</div>`;
      screen.addEventListener("click",()=>{Store.set("powered",true);location.reload()},{once:true});
      return;
    }
    $("#restartBtn").addEventListener("click",()=>{Store.set("powered",true);location.reload()});
    $("#shutdownBtn").addEventListener("click",()=>Boot.shutdown());
    $("#lockBtn").addEventListener("click",()=>Lock.show());
    const finish=()=>{screen.classList.add("hide");if(Settings.get().lockOnBoot)setTimeout(()=>Lock.show(),350)};
    screen.addEventListener("click",finish,{once:true});
    setTimeout(finish,1700);
    setTimeout(()=>SFX.startup(),300);
  },
  shutdown(){
    Store.set("powered",false);location.reload();
  }
};
const AltTab={
  el:null,idx:0,order:[],
  build(){
    this.order=Object.values(WM.windows).sort((a,b)=>(parseFloat(b.el.style.zIndex)||0)-(parseFloat(a.el.style.zIndex)||0));
    return this.order.length>0;
  },
  show(){
    if(this.el)return;
    if(!this.build())return;
    this.idx=this.order.length>1?1:0;
    this.el=document.createElement("div");this.el.className="alttab-overlay";
    this.el.innerHTML=`<div class="alttab-panel"></div>`;
    document.body.appendChild(this.el);
    this.render();
  },
  render(){
    if(!this.el)return;
    const panel=this.el.querySelector(".alttab-panel");
    panel.innerHTML=this.order.map((w,i)=>{
      const def=App.get(w.app);
      return`<div class="alttab-item${i===this.idx?" on":""}"><span class="alttab-icon">${def?def.icon:"📦"}</span><span class="alttab-title">${esc(def?def.title:w.app)}</span></div>`;
    }).join("");
  },
  step(dir){
    if(!this.el)return;
    this.idx=(this.idx+dir+this.order.length)%this.order.length;
    this.render();
  },
  commit(){
    if(!this.el)return;
    const pick=this.order[this.idx];
    if(pick){if(pick.minimized)WM.restore(pick.id);else WM.focus(pick.id)}
    this.hide();
  },
  hide(){
    if(!this.el)return;
    this.el.remove();this.el=null;this.order=[];
  }
};
const Shortcuts={
  konamiBuf:[],
  konamiSeq:["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"],
  init(){
    document.addEventListener("keydown",e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();StartMenu.toggle();return}
      if(e.altKey&&e.key==="Tab"){
        e.preventDefault();
        if(!AltTab.el)AltTab.show();else AltTab.step(e.shiftKey?-1:1);
        return;
      }
      if(e.altKey&&e.key==="F4"){e.preventDefault();if(WM.focused())WM.close(WM.focused());return}
      if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key==="Escape"){e.preventDefault();openApp("taskmgr");return}
      if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key)&&WM.focused()){
        e.preventDefault();
        const map={ArrowLeft:"left",ArrowRight:"right",ArrowUp:"max",ArrowDown:"restore"};
        const region=map[e.key];
        if(region==="restore"){const w=WM.windows[WM.focused()];if(w){w.el.classList.remove("maximized");if(w.preMax){w.el.style.left=w.preMax.l;w.el.style.top=w.preMax.t;w.el.style.width=w.preMax.w;w.el.style.height=w.preMax.h}saveWinState()}}
        else WM.snap(WM.focused(),region);
        return;
      }
      if(e.key==="Escape"){$("#startMenu").classList.remove("show");$("#contextMenu").classList.remove("show");$("#notifPanel").classList.remove("show");$("#calPanel").classList.remove("show")}
      this.konami(e.key);
    });
    document.addEventListener("keyup",e=>{
      if(e.key==="Alt"&&AltTab.el)AltTab.commit();
    });
  },
  konami(k){
    if(k===this.konamiSeq[this.konamiBuf.length]){this.konamiBuf.push(k);if(this.konamiBuf.length===this.konamiSeq.length){this.konamiBuf=[];const ks=Object.keys(ACCENTS);const pick=ks[Math.floor(Math.random()*ks.length)];Settings.set({accent:pick});NotifCenter.push("🥚 Easter egg",`Konami code accepted! Accent: ${pick}.`,"🎮",true)}}else{this.konamiBuf=k===this.konamiSeq[0]?[k]:[]}
  }
};
document.addEventListener("DOMContentLoaded",()=>{
  VFS.load();VFS.ensureInstalledAppsFolder();
  WM.init();Taskbar.init();StartMenu.init();Panels.init();Shortcuts.init();
  Context.init();Widgets.init();Settings.apply();Clock.start();Boot.init();IdleLock.init();
  renderDesktopIcons();renderStartApps();
  setTimeout(()=>NotifCenter.push("Welcome to Web OS 4.5","New: a real lock screen (startup + idle auto-lock, in Security Center), opt-in desktop notifications that reach you even off-tab, and installable/offline support as a PWA.","🚀",true),2400);
});
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{navigator.serviceWorker.register("sw.js").catch(()=>{})});
}
window.addEventListener("online",()=>Widgets.tick());
window.addEventListener("offline",()=>Widgets.tick());
window.addEventListener("resize",()=>{
  Widgets.syncSpace();
  $$(".notif-panel,.cal-panel,.start-menu,.context-menu").forEach(el=>{
    if(el.classList.contains("show")){
      const rect=el.getBoundingClientRect();
      if(rect.right>window.innerWidth)el.style.left=(window.innerWidth-rect.width-12)+"px";
      if(rect.bottom>window.innerHeight)el.style.top=(window.innerHeight-rect.height-12)+"px";
    }
  });
});
})();
