(()=>{
const ICONS={"pumpkin": "<svg viewBox=\"0 0 120 104\" aria-hidden=\"true\"><path d=\"M57 25Q55 7 70 5L78 12Q63 14 65 29\" fill=\"#805136\"/><g fill=\"#f57b16\" stroke=\"#1b0d08\" stroke-width=\"3\"><ellipse cx=\"36\" cy=\"61\" rx=\"29\" ry=\"37\"/><ellipse cx=\"83\" cy=\"61\" rx=\"29\" ry=\"37\"/><ellipse cx=\"59\" cy=\"62\" rx=\"33\" ry=\"39\"/></g><g class=\"face\" stroke=\"#201208\" stroke-width=\"2.5\" stroke-linejoin=\"round\"><path d=\"M29 53L42 33L50 55ZM70 55L79 33L94 53ZM59 53L53 63L65 63ZM27 68L41 75L44 70L53 78L63 78L73 70L78 75L95 67Q85 92 72 88L67 83L53 83L48 88Q34 86 27 68Z\"/></g></svg>", "ghost": "<svg class=\"ghost-icon\" viewBox=\"0 0 64 84\" aria-hidden=\"true\"><path d=\"M8 73V31C8 0 56 0 56 31V73L45 65L34 76L23 65Z\" fill=\"#f3eaff\" stroke=\"#a667d1\" stroke-width=\"3\" stroke-linejoin=\"round\"/><ellipse cx=\"24\" cy=\"32\" rx=\"4\" ry=\"6\" fill=\"#332140\"/><ellipse cx=\"41\" cy=\"32\" rx=\"4\" ry=\"6\" fill=\"#332140\"/><path d=\"M28 48Q33 55 38 48\" fill=\"none\" stroke=\"#332140\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>", "web": "<svg class=\"web\" viewBox=\"0 0 140 110\"><g fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.5\"><path d=\"M0 0H140M0 0L138 34M0 0L111 70M0 0L60 105M0 0V110M0 0L25 110M0 28Q18 39 18 25Q38 28 38 10L40 0M0 58Q35 77 35 51Q78 55 78 20L84 0M0 94Q60 118 59 85Q126 90 126 31L138 0\"/></g></svg>"};
(() => {
 const preview=window.GRUMPYS_THEME_PREVIEW===true;
 const key=preview?'grumpys-appearance-preview':'grumpys-appearance';
 const listeners=new Set();
 let current='halloween', ref=null, readError=null;
 const valid=v=>v==='halloween'?'halloween':'regular';
 try { const saved=localStorage.getItem(key); if(saved)current=valid(saved); } catch {}
 if(preview&&new URLSearchParams(location.search).get('theme')==='original')current='regular';
 function decorate(){
  if(document.querySelector('.halloween-corners'))return;
  const decor=document.createElement('div');decor.className='halloween-corners';decor.setAttribute('aria-hidden','true');decor.innerHTML=ICONS.web+ICONS.web.replace('class="web"','class="web right"')+'<svg class="bat" viewBox="0 0 120 50"><path fill="currentColor" d="M0 3Q21 6 37 25L43 22L47 9L54 17L65 17L73 9L77 22L84 25Q102 6 120 3L106 22Q92 18 91 33Q80 28 77 40L62 49L48 40Q43 28 30 33Q28 18 14 22Z"/></svg>';document.body.prepend(decor);
  document.querySelectorAll('.brand-lockup,.mobile-brand,.promo-left,.main-panel,.control-brand,.profile-identity').forEach(parent=>{
   if([...parent.children].some(e=>e.classList.contains('halloween-mark')))return;
   const mark=document.createElement('div');mark.className='halloween-mark';mark.innerHTML=ICONS.pumpkin+ICONS.ghost+'<span>Halloween at Grumpy’s</span>';parent.append(mark);
  });
 }
 function apply(mode){
  current=valid(mode);if(current==='halloween')decorate();
  document.body.classList.toggle('theme-halloween',current==='halloween');
  if(preview){const sheet=document.querySelector('link[href="halloween.css"]');if(sheet)sheet.disabled=current!=='halloween';}
  document.querySelectorAll('.halloween-corners,.halloween-mark').forEach(e=>e.style.display=current==='halloween'?'':'none');
  try{if(!preview||new URLSearchParams(location.search).get('theme')!=='original')localStorage.setItem(key,current);}catch{}
  listeners.forEach(fn=>fn(current));
 }
 async function save(mode){
  if(!['regular','halloween'].includes(mode))throw new Error('Choose Regular or Halloween.');
  if(preview){localStorage.setItem(key,mode);apply(mode);return;}
  if(!ref)throw new Error('Theme service is unavailable. Try again.');
  await ref.set({theme:mode,updatedAt:firebase.database.ServerValue.TIMESTAMP});
  apply(mode);
 }
 window.GrumpysAppearance={get:()=>current,save,subscribe(fn){listeners.add(fn);fn(current);return()=>listeners.delete(fn);},isPreview:preview};
 apply(current);
 addEventListener('storage',e=>{if(e.key===key)apply(e.newValue||'regular');});
 if(!preview&&typeof db!=='undefined'){
  ref=db.ref('settings/appearance');
  ref.on('value',snap=>{readError=null;apply(snap.val()?.theme||'halloween');},error=>{readError=error;const help=document.getElementById('appearanceHelp');if(help){help.textContent='The shared theme could not be loaded. Check the theme setting permission and try again.';help.classList.add('theme-save-error');}});
 }
 const button=document.getElementById('applyThemeBtn');if(!button)return;
 const choices=[...document.querySelectorAll('.appearance-choice')],label=document.getElementById('currentThemeLabel'),status=document.getElementById('themeSaveStatus'),help=document.getElementById('appearanceHelp');
 let draft=current,busy=false;
 function render(){choices.forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.theme===draft)));label.textContent=current==='halloween'?'Halloween':'Regular';button.disabled=busy||draft===current;}
 choices.forEach(el=>el.addEventListener('click',()=>{if(busy)return;draft=el.dataset.theme;status.textContent=draft===current?'Not changed':'Unsaved selection';help.textContent='Choose a theme, then apply it.';help.className='appearance-help';render();}));
 window.GrumpysAppearance.subscribe(mode=>{draft=mode;render();});
 button.addEventListener('click',async()=>{
  if(busy||draft===current)return;busy=true;const requested=draft;render();status.textContent='Applying…';help.className='appearance-help';
  try{await save(requested);status.textContent='Applied';help.textContent=preview?'Preview screens updated. The live game is unchanged.':'Theme applied to everyone. Open screens update automatically.';help.classList.add('theme-save-success');}
  catch(error){status.textContent='Not saved';help.textContent='Theme could not be applied. '+error.message;help.classList.add('theme-save-error');}
  finally{busy=false;render();}
 });
})();

})();
