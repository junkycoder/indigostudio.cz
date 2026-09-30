const slug = document.body.dataset.tool;
const root = document.querySelector('#tool');
const title = document.querySelector('#title');
const description = document.querySelector('#description');
const nf = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });
const money = n => `${nf.format(n)} Kč`;
const num = id => Number(document.getElementById(id)?.value || 0);
const val = id => document.getElementById(id)?.value || '';
const out = (value, detail = '') => { const e = document.querySelector('#result'); if (e) e.innerHTML = `<strong>${value}</strong>${detail ? `<div class="breakdown">${detail}</div>` : ''}`; };
const row = (name, value) => `<div><span>${name}</span><b>${value}</b></div>`;
const field = (id, label, value = '', type = 'number', extra = '') => `<label class="field"><span>${label}</span><input id="${id}" type="${type}" value="${value}" ${extra}></label>`;
const select = (id, label, values) => `<label class="field"><span>${label}</span><select id="${id}">${values.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;
const panel = content => `<section class="panel">${content}</section>`;
const result = () => '<div id="result" class="result" role="status"></div>';
const updateOnInput = fn => { root.addEventListener('input', fn); root.addEventListener('change', fn); fn(); };
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

// Náhled v iframe hlásí rozcestníku výšku obsahu, karta pak roste bez posuvníku.
const HUB_ORIGIN = 'https://nastroje.indigostudio.cz';
const TOOL_ORIGIN = /^https:\/\/[a-z0-9-]+\.indigostudio\.cz$/;
if (document.body.classList.contains('embed') && parent !== window) {
  const page = document.querySelector('.page');
  new ResizeObserver(() => parent.postMessage({ type: 'tool-height', height: Math.ceil(page.getBoundingClientRect().height) }, HUB_ORIGIN)).observe(page);
}

function showCatalog() {
  addEventListener('message', e => {
    if (!TOOL_ORIGIN.test(e.origin) || e.data?.type !== 'tool-height' || !Number.isFinite(e.data.height)) return;
    const frame = [...root.querySelectorAll('iframe')].find(f => f.contentWindow === e.source);
    if (frame) frame.style.height = `${e.data.height}px`;
  });
}

function calculator() {
  root.innerHTML = panel('<input id="display" class="display" aria-label="Výraz" value="0" inputmode="decimal">' + `<div class="keypad">${['C','(',')','÷','7','8','9','×','4','5','6','−','1','2','3','+','0',',','⌫','='].map(k => `<button type="button" data-key="${k}" class="${k==='='?'equals':''}">${k}</button>`).join('')}</div><p id="calc-status" class="status" role="status"></p>`);
  const display = document.querySelector('#display');
  const status = document.querySelector('#calc-status');
  const calculate = () => {
    const expression = display.value.replaceAll('×','*').replaceAll('÷','/').replaceAll('−','-').replaceAll(',','.');
    if (!/^[0-9+*/().\s-]+$/.test(expression)) { status.textContent = 'Zadejte platný výraz.'; return; }
    try { const value = Function(`"use strict"; return (${expression})`)(); if (!Number.isFinite(value)) throw Error(); display.value = String(Number(value.toPrecision(12))).replace('.',','); status.textContent = ''; }
    catch { status.textContent = 'Výraz se nepodařilo spočítat.'; }
  };
  root.addEventListener('click', e => { const key = e.target.closest('[data-key]')?.dataset.key; if (!key) return; if (key === 'C') display.value = '0'; else if (key === '⌫') display.value = display.value.slice(0,-1) || '0'; else if (key === '=') calculate(); else display.value = (display.value === '0' && /[0-9]/.test(key) ? '' : display.value) + key; });
  display.addEventListener('keydown', e => { if (e.key === 'Enter') calculate(); });
}

function percentages() {
  root.innerHTML = panel(`<div class="tabs"><button class="active" aria-pressed="true" data-mode="part">Kolik je % z čísla</button><button aria-pressed="false" data-mode="share">Jaký je podíl</button><button aria-pressed="false" data-mode="change">Procentní změna</button></div><div class="grid">${field('a','První hodnota',20)}${field('b','Druhá hodnota',150)}</div>${result()}`);
  let mode = 'part';
  const update = () => { const a=num('a'),b=num('b'); const n=mode==='part'?b*a/100:mode==='share'?(b?100*a/b:NaN):(a?100*(b-a)/a:NaN); out(Number.isFinite(n) ? `${nf.format(n)}${mode==='part'?'':' %'}` : 'Nelze dělit nulou.'); };
  root.addEventListener('click', e => { if (!e.target.dataset.mode) return; mode=e.target.dataset.mode; root.querySelectorAll('[data-mode]').forEach(b => { const active=b.dataset.mode===mode; b.classList.toggle('active',active); b.setAttribute('aria-pressed',String(active)); }); const labels={part:['Procenta (%)','Základ'],share:['Část','Celek'],change:['Původní hodnota','Nová hodnota']}; document.querySelectorAll('.field span').forEach((s,i)=>s.textContent=labels[mode][i]); update(); });
  updateOnInput(update);
}

function ruleOfThree() {
  root.innerHTML = panel(`<div class="tabs"><button data-mode="direct" class="active" aria-pressed="true">Přímá úměra</button><button data-mode="inverse" aria-pressed="false">Nepřímá úměra</button></div><div class="grid three">${field('a','A odpovídá',2)}${field('b','B',6)}${field('c','C odpovídá',5)}</div><p class="hint">Když A odpovídá B, kolik odpovídá C?</p>${result()}`);
  let inverse=false;
  const update=()=>{let denominator=inverse?num('c'):num('a');out(denominator?nf.format(inverse?num('a')*num('b')/denominator:num('c')*num('b')/denominator):'Zadejte nenulovou hodnotu.');};
  root.addEventListener('click',e=>{if(!e.target.dataset.mode)return;inverse=e.target.dataset.mode==='inverse';root.querySelectorAll('[data-mode]').forEach(b=>{const active=b===e.target;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});update();});
  updateOnInput(update);
}

function vat() {
  root.innerHTML=panel(`<div class="grid">${field('amount','Částka',1000)}${select('rate','Sazba DPH',[['21','21 %'],['12','12 %'],['0','0 %']])}</div><div class="tabs" style="margin-top:1.2rem"><button data-mode="add" class="active" aria-pressed="true">Přičíst DPH</button><button data-mode="remove" aria-pressed="false">Odečíst DPH</button></div>${result()}`)+'<p class="note">Sazby pro ČR. Ověřte, která sazba se vztahuje k vašemu zboží nebo službě. <a href="https://financnisprava.gov.cz/cs/dane/danovy-system-cr/popis-systemu">Zdroj: Finanční správa</a>.</p>';
  let add=true; const update=()=>{let n=num('amount'),r=num('rate')/100,b=add?n:n/(1+r),t=add?n*(1+r):n;out(money(add?t:b),row('Základ',money(b))+row('DPH',money(t-b))+row('Celkem s DPH',money(t)));};
  root.addEventListener('click',e=>{if(!e.target.dataset.mode)return;add=e.target.dataset.mode==='add';root.querySelectorAll('[data-mode]').forEach(b=>{const active=b===e.target;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});update();});updateOnInput(update);
}

function tip() {
  root.innerHTML=panel(`<div class="grid three">${field('bill','Účet',850)}${field('percent','Spropitné (%)',10)}${field('people','Počet osob',2,'number','min="1" step="1"')}</div>${result()}`);
  updateOnInput(()=>{let b=num('bill'),p=num('percent'),people=Math.max(1,Math.floor(num('people')));out(money((b+b*p/100)/people),row('Spropitné celkem',money(b*p/100))+row('Celkem k úhradě',money(b+b*p/100))+row('Na osobu',money((b+b*p/100)/people)));});
}

const units = {
  'Délka': [['mm',.001],['cm',.01],['m',1],['km',1000],['in',.0254],['ft',.3048],['mi',1609.344]],
  'Hmotnost': [['mg',.000001],['g',.001],['kg',1],['t',1000],['lb',.45359237]],
  'Plocha': [['cm²',.0001],['m²',1],['km²',1000000],['ha',10000],['ft²',.09290304]],
  'Objem': [['ml',.001],['l',1],['m³',1000],['gal (US)',3.785411784]],
  'Rychlost': [['m/s',1],['km/h',1/3.6],['mph',.44704]],
  'Teplota': [['°C',0],['°F',1],['K',2]],
};
function unitConverter() {
  root.innerHTML=panel(`<div class="grid">${select('kind','Veličina',Object.keys(units).map(x=>[x,x]))}${field('amount','Hodnota',1)}</div><div class="grid" style="margin-top:1rem"><label class="field"><span>Z jednotky</span><select id="from"></select></label><label class="field"><span>Na jednotku</span><select id="to"></select></label></div>${result()}`);
  const kind=document.querySelector('#kind'),from=document.querySelector('#from'),to=document.querySelector('#to');
  const fill=()=>{let opts=units[kind.value].map(([u])=>`<option>${u}</option>`).join('');from.innerHTML=opts;to.innerHTML=opts;to.selectedIndex=1;update();};
  const update=()=>{let list=units[kind.value],a=list[from.selectedIndex],b=list[to.selectedIndex],v=num('amount');if(!a||!b)return;let r;if(kind.value==='Teplota'){let c=from.selectedIndex===0?v:from.selectedIndex===1?(v-32)*5/9:v-273.15;r=to.selectedIndex===0?c:to.selectedIndex===1?c*9/5+32:c+273.15;}else r=v*a[1]/b[1];out(`${nf.format(r)} ${b[0]}`);};
  kind.addEventListener('change',fill);root.addEventListener('input',update);root.addEventListener('change',update);fill();
}

async function currencies() {
  const names={CZK:'Česká koruna',EUR:'Euro',USD:'Americký dolar',GBP:'Britská libra',PLN:'Polský zlotý',CHF:'Švýcarský frank',HUF:'Maďarský forint',JPY:'Japonský jen',SEK:'Švédská koruna',NOK:'Norská koruna',DKK:'Dánská koruna'};
  root.innerHTML=panel(`<div class="grid three">${field('amount','Částka',1000)}<label class="field"><span>Z měny</span><select id="from"></select></label><label class="field"><span>Na měnu</span><select id="to"></select></label></div>${result()}<p id="rate-note" class="hint">Načítám kurzy ECB…</p>`);
  try {let response=await fetch('/api/kurzy');if(!response.ok)throw Error();let {date,rates}=await response.json();let options=Object.entries(names).filter(([code])=>rates[code]).map(([code,name])=>`<option value="${code}">${code} · ${name}</option>`).join('');document.querySelector('#from').innerHTML=options;document.querySelector('#to').innerHTML=options;document.querySelector('#to').value='EUR';document.querySelector('#rate-note').innerHTML=`Referenční kurz ECB k ${escapeHtml(date)}. Pro skutečnou směnu se může lišit. <a href="https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html">Zdroj kurzů</a>.`;const update=()=>{let from=val('from'),to=val('to');out(`${nf.format(num('amount')/rates[from]*rates[to])} ${to}`);};updateOnInput(update);}catch{document.querySelector('#rate-note').textContent='Kurzy se nepodařilo načíst. Zkuste to později.';out('Nedostupné');}
}

function timeZones() {
  const zones=[['Europe/Prague','Praha'],['Europe/London','Londýn'],['America/New_York','New York'],['America/Los_Angeles','Los Angeles'],['Asia/Tokyo','Tokio'],['Asia/Dubai','Dubaj'],['Australia/Sydney','Sydney'],['UTC','UTC']];
  root.innerHTML=panel(`${select('zone','Město',zones)}<div id="time" class="result"></div><div class="grid" style="margin-top:1rem">${field('date','Vybraný den',today(),'date')}${field('clock','Čas v Praze','12:00','time')}</div><div id="other" class="result"></div>`);
  const update=()=>{let zone=val('zone'),d=new Date();document.querySelector('#time').innerHTML=`<strong>${new Intl.DateTimeFormat('cs-CZ',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(d)}</strong><small>${new Intl.DateTimeFormat('cs-CZ',{timeZone:zone,dateStyle:'full'}).format(d)}</small>`;let asUtc=Date.parse(`${val('date')}T${val('clock')}:00Z`);if(!Number.isFinite(asUtc))return;let offsetText=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Prague',timeZoneName:'shortOffset'}).formatToParts(new Date(asUtc)).find(p=>p.type==='timeZoneName')?.value||'GMT+1';let match=offsetText.match(/GMT([+-])(\d+)(?::(\d+))?/),offset=match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0)):0;let instant=new Date(asUtc-offset*60000);document.querySelector('#other').innerHTML=`<small>Ve vybraném pásmu v uvedený okamžik</small><strong>${new Intl.DateTimeFormat('cs-CZ',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(instant)}</strong>`;};updateOnInput(update);setInterval(update,1000);
}

function clothing() {
  const sizes={damske:[['XS','EU 32–34','UK 4–6','US 0–2'],['S','EU 36–38','UK 8–10','US 4–6'],['M','EU 40–42','UK 12–14','US 8–10'],['L','EU 44–46','UK 16–18','US 12–14'],['XL','EU 48–50','UK 20–22','US 16–18']],panske:[['XS','EU 44','UK/US 34'],['S','EU 46–48','UK/US 36–38'],['M','EU 50–52','UK/US 40–42'],['L','EU 54–56','UK/US 44–46'],['XL','EU 58–60','UK/US 48–50']]};
  root.innerHTML=panel(`<div class="grid">${select('kind','Oblečení',[['damske','Dámské'],['panske','Pánské']])}${select('size','Velikost',sizes.damske.map(x=>[x[0],x[0]]))}</div>${result()}`)+'<p class="note">Velikosti se mezi značkami liší. Před nákupem zkontrolujte tabulku konkrétního výrobce.</p>';
  const update=()=>{let data=sizes[val('kind')],v=val('size');if(!data.some(x=>x[0]===v)){document.querySelector('#size').innerHTML=data.map(x=>`<option>${x[0]}</option>`).join('');v=val('size');}out(v,data.find(x=>x[0]===v).slice(1).map(x=>row(x.split(' ')[0],x)).join(''));};updateOnInput(update);
}

function salary() {
  root.innerHTML=panel(`<div class="grid">${field('gross','Hrubá měsíční mzda',45000)}${select('discount','Prohlášení poplatníka',[['yes','Podepsané'],['no','Nepodepsané']])}</div>${result()}`)+'<p class="note">Orientační výpočet pro běžný pracovní poměr v ČR v roce 2026. Nezahrnuje děti, další slevy, dohody, exekuce ani doplatek zdravotního pojištění při mzdě pod minimem. <a href="https://financnisprava.gov.cz/cs/dane/dane/dan-z-prijmu/zamestnanci-zamestnavatele/obecne-informace">Finanční správa</a> · <a href="https://www.cssz.gov.cz/web/cz/placeni-pojistneho-snadne-a-prehledne">ČSSZ</a> · <a href="https://www.vzp.cz/platci/informace/povinnosti-platcu-metodika/2-4-platce-pojistneho-zamestnavatel">VZP</a>.</p>';
  updateOnInput(()=>{let gross=Math.max(0,num('gross')),soc=Math.ceil(gross*.071),health=Math.ceil(gross*.045),base=Math.ceil(gross/100)*100,tax=Math.ceil(Math.min(base,146901)*.15+Math.max(0,base-146901)*.23),discount=val('discount')==='yes'?2570:0,taxDue=Math.max(0,tax-discount),net=gross-soc-health-taxDue;out(money(net),row('Sociální pojištění',money(soc))+row('Zdravotní pojištění',money(health))+row('Záloha na daň po slevě',money(taxDue)));});
}

function hourlyRate() {
  root.innerHTML=panel(`<div class="grid three">${field('target','Měsíční cíl po nákladech',60000)}${field('costs','Měsíční náklady a rezerva',15000)}${field('hours','Fakturovatelné hodiny',100)}</div>${result()}`)+'<p class="note">Výsledek je orientační sazba bez DPH. Daně a odvody zahrňte do položky náklady a rezerva.</p>';
  updateOnInput(()=>out(num('hours')>0?`${money((num('target')+num('costs'))/num('hours'))} / hod`:'Zadejte počet hodin.'));
}

function interest() {
  root.innerHTML=panel(`<div class="grid">${field('principal','Počáteční částka',100000)}${field('rate','Roční úrok (%)',5)}${field('years','Počet let',5)}${select('kind','Typ úročení',[['compound','Složené'],['simple','Jednoduché']])}</div>${result()}`);
  updateOnInput(()=>{let p=num('principal'),r=num('rate')/100,y=num('years'),total=val('kind')==='compound'?p*Math.pow(1+r,y):p*(1+r*y);out(Number.isFinite(total)?money(total):'Neplatný výpočet',row('Získaný úrok',money(total-p)));});
}

function payments() {
  root.innerHTML=panel(`<div class="grid three">${field('principal','Výše úvěru',1000000)}${field('rate','Roční úrok (%)',5)}${field('years','Doba splácení (roky)',10)}</div>${result()}`)+'<p class="note">Anuitní splácení se stálou sazbou; bez poplatků a pojištění. Skutečná nabídka banky se může lišit.</p>';
  updateOnInput(()=>{let p=num('principal'),r=num('rate')/1200,n=Math.round(num('years')*12);if(n<1)return out('Zadejte dobu splácení.');let payment=r?p*r/(1-Math.pow(1+r,-n)):p/n;out(money(payment),row('Celkem zaplatíte',money(payment*n))+row('Úroky celkem',money(payment*n-p)));});
}

function invoice() {
  root.innerHTML=panel(`<div class="grid three">${field('number','Číslo faktury','','text')}${field('issued','Datum vystavení',today(),'date')}${field('due','Datum splatnosti',new Date(Date.now()+14*86400000).toISOString().slice(0,10),'date')}${field('price','Cena za položku',1000)}${field('quantity','Počet',1)}${select('vat','DPH',[['0','Bez DPH'],['21','21 %'],['12','12 %']])}</div><div class="grid" style="margin-top:1rem">${field('supplier','Dodavatel','','text')}${field('customer','Odběratel','','text')}${field('ico','IČO dodavatele','','text')}${field('item','Položka','Služba','text')}${field('account','Číslo účtu','','text')}${field('symbol','Variabilní symbol','','text')}</div>${result()}<div class="actions"><button id="print" class="button">Vytisknout / uložit PDF</button></div>`)+`<article id="invoice-print" class="invoice-print"></article><p class="note no-print">Jednoduchý tiskový doklad. Před použitím ověřte povinné náležitosti faktury pro svou situaci.</p>`;
  const update=()=>{let base=num('price')*num('quantity'),vat=base*num('vat')/100,total=base+vat;out(money(total),row('Základ',money(base))+row('DPH',money(vat)));document.querySelector('#invoice-print').innerHTML=`<h1>Faktura ${escapeHtml(val('number'))}</h1><p>Vystaveno: ${escapeHtml(val('issued'))} &nbsp; Splatnost: ${escapeHtml(val('due'))}</p><p><b>Dodavatel</b><br>${escapeHtml(val('supplier'))}<br>IČO: ${escapeHtml(val('ico'))}</p><p><b>Odběratel</b><br>${escapeHtml(val('customer'))}</p><table><thead><tr><th>Položka</th><th>Počet</th><th>Cena</th><th>DPH</th><th>Celkem</th></tr></thead><tbody><tr><td>${escapeHtml(val('item'))}</td><td>${num('quantity')}</td><td>${money(num('price'))}</td><td>${val('vat')} %</td><td>${money(total)}</td></tr></tbody></table><p class="total"><b>K úhradě: ${money(total)}</b></p><p>Účet: ${escapeHtml(val('account'))}<br>Variabilní symbol: ${escapeHtml(val('symbol'))}</p>`;};
  updateOnInput(update);document.querySelector('#print').addEventListener('click',()=>window.print());
}

function calendar() {
  let date=new Date();date.setDate(1);
  root.innerHTML=panel('<div class="actions" style="justify-content:space-between;margin:0 0 1rem"><button class="button secondary" id="prev" aria-label="Předchozí měsíc">←</button><h2 id="month" style="margin:0"></h2><button class="button secondary" id="next" aria-label="Následující měsíc">→</button></div><div id="calendar" class="calendar"></div>');
  const draw=()=>{let y=date.getFullYear(),m=date.getMonth(),first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate(),now=new Date();document.querySelector('#month').textContent=new Intl.DateTimeFormat('cs-CZ',{month:'long',year:'numeric'}).format(date);document.querySelector('#calendar').innerHTML=['Po','Út','St','Čt','Pá','So','Ne'].map(d=>`<span class="weekday">${d}</span>`).join('')+Array.from({length:first},()=>'<span></span>').join('')+Array.from({length:days},(_,i)=>`<span class="${now.getFullYear()===y&&now.getMonth()===m&&now.getDate()===i+1?'today':''}">${i+1}</span>`).join('');};document.querySelector('#prev').onclick=()=>{date.setMonth(date.getMonth()-1);draw();};document.querySelector('#next').onclick=()=>{date.setMonth(date.getMonth()+1);draw();};draw();
}

function dateTool() {
  root.innerHTML=panel(`<div class="grid">${field('start','První datum',today(),'date')}${field('end','Druhé datum',today(),'date')}${field('shift','Posun prvního data (dny)',30)}</div>${result()}`);
  updateOnInput(()=>{let a=Date.parse(val('start')+'T12:00:00Z'),b=Date.parse(val('end')+'T12:00:00Z');if(!Number.isFinite(a)||!Number.isFinite(b))return out('Vyberte obě data.');let diff=Math.round((b-a)/86400000),shifted=new Date(a+num('shift')*86400000);out(`${Math.abs(diff)} dní`,row('Rozdíl',diff<0?'Druhé datum je dříve':diff===0?'Stejný den':'Druhé datum je později')+row('Posunuté datum',new Intl.DateTimeFormat('cs-CZ',{dateStyle:'long',timeZone:'UTC'}).format(shifted)));});
}

function easter(year) {let a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(Date.UTC(year,month-1,day));}
function czHolidays(year) {let fixed=['01-01','05-01','05-08','07-05','07-06','09-28','10-28','11-17','12-24','12-25','12-26'].map(x=>`${year}-${x}`),e=easter(year);return new Set([...fixed,new Date(e.getTime()-2*86400000).toISOString().slice(0,10),new Date(e.getTime()+86400000).toISOString().slice(0,10)]);}
function workdays() {
  root.innerHTML=panel(`<div class="grid">${field('start','Od',today(),'date')}${field('end','Do',today(),'date')}</div><label class="field" style="margin-top:1rem"><span><input id="holidays" type="checkbox" checked style="width:auto;min-height:0"> Odečíst české státní svátky</span></label>${result()}`)+'<p class="note">Počítá oba zadané dny. České státní svátky zahrnují Velký pátek a Velikonoční pondělí.</p>';
  updateOnInput(()=>{let start=Date.parse(val('start')+'T12:00:00Z'),end=Date.parse(val('end')+'T12:00:00Z');if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return out('Vyberte platné pořadí dat.');if((end-start)/86400000>36525)return out('Rozsah je příliš dlouhý.');let count=0,holidays=new Map();for(let t=start;t<=end;t+=86400000){let d=new Date(t),weekday=d.getUTCDay();if(weekday===0||weekday===6)continue;let year=d.getUTCFullYear();if(!holidays.has(year))holidays.set(year,czHolidays(year));if(document.querySelector('#holidays').checked&&holidays.get(year).has(d.toISOString().slice(0,10)))continue;count++;}out(`${nf.format(count)} ${count===1?'pracovní den':count>=2&&count<=4?'pracovní dny':'pracovních dnů'}`);});
}

function countdown() {
  const tomorrow=new Date(Date.now()+86400000);root.innerHTML=panel(`<div class="grid">${field('target','Datum',tomorrow.toISOString().slice(0,10),'date')}${field('time','Čas','12:00','time')}</div>${result()}`);
  const update=()=>{let target=new Date(`${val('target')}T${val('time')}:00`).getTime(),seconds=Math.max(0,Math.floor((target-Date.now())/1000));if(!Number.isFinite(seconds))return out('Vyberte datum a čas.');let d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;out(`${d} d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);};updateOnInput(update);setInterval(update,1000);
}

function stopwatch() {
  root.innerHTML=panel(`<div class="display" id="watch" role="timer">00:00.00</div><div class="actions"><button class="button" id="toggle">Spustit</button><button class="button secondary" id="lap">Mezičas</button><button class="button secondary" id="reset">Vynulovat</button></div><ol id="laps"></ol>`);
  let elapsed=0,started=0,running=false;const format=ms=>{let c=Math.floor(ms/10)%100,s=Math.floor(ms/1000)%60,m=Math.floor(ms/60000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(c).padStart(2,'0')}`;};const draw=()=>document.querySelector('#watch').textContent=format(elapsed+(running?performance.now()-started:0));document.querySelector('#toggle').onclick=()=>{if(running){elapsed+=performance.now()-started;running=false;}else{started=performance.now();running=true;}document.querySelector('#toggle').textContent=running?'Pozastavit':'Spustit';draw();};document.querySelector('#lap').onclick=()=>{if(running){let li=document.createElement('li');li.textContent=format(elapsed+performance.now()-started);document.querySelector('#laps').prepend(li);}};document.querySelector('#reset').onclick=()=>{running=false;elapsed=0;document.querySelector('#toggle').textContent='Spustit';document.querySelector('#laps').replaceChildren();draw();};setInterval(draw,50);
}

function timer() {
  root.innerHTML=panel(`<div class="grid">${field('minutes','Minuty',5,'number','min="0" max="999" step="1"')}${field('seconds','Sekundy',0,'number','min="0" max="59" step="1"')}</div><div class="display" id="watch" role="timer">05:00</div><div class="actions"><button class="button" id="toggle">Spustit</button><button class="button secondary" id="reset">Vynulovat</button></div><p class="hint">Po uplynutí času zazní krátké upozornění.</p>`);
  let remaining=300000,ends=0,running=false;const configured=()=>Math.max(0,num('minutes')*60+num('seconds'))*1000;const draw=()=>{let ms=running?Math.max(0,ends-Date.now()):remaining,s=Math.ceil(ms/1000);document.querySelector('#watch').textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;if(running&&ms===0){running=false;remaining=0;document.querySelector('#toggle').textContent='Spustit';try{let c=new AudioContext(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=880;g.gain.value=.1;o.start();o.stop(c.currentTime+.25);}catch{}}};root.addEventListener('input',()=>{if(!running){remaining=configured();draw();}});document.querySelector('#toggle').onclick=()=>{if(running){remaining=Math.max(0,ends-Date.now());running=false;}else{if(!remaining)remaining=configured();ends=Date.now()+remaining;running=true;}document.querySelector('#toggle').textContent=running?'Pozastavit':'Spustit';draw();};document.querySelector('#reset').onclick=()=>{running=false;remaining=configured();document.querySelector('#toggle').textContent='Spustit';draw();};setInterval(draw,200);draw();
}

function wordCounter() {
  root.innerHTML=panel(`<label class="field"><span>Text</span><textarea id="text" placeholder="Vložte nebo napište text…"></textarea></label>${result()}`);
  updateOnInput(()=>{let t=val('text'),words=t.trim()?t.trim().split(/\s+/u).length:0,chars=[...t].length,noSpaces=[...t.replace(/\s/gu,'')].length,sentences=(t.match(/[.!?]+(?=\s|$)/gu)||[]).length;out(`${nf.format(words)} slov`,row('Znaky včetně mezer',nf.format(chars))+row('Znaky bez mezer',nf.format(noSpaces))+row('Věty (odhad)',nf.format(sentences))+row('Doba čtení',`${Math.max(1,Math.ceil(words/220))} min`));});
}

function textFormat() {
  root.innerHTML=panel(`<label class="field"><span>Vstupní text</span><textarea id="input" placeholder="Vložte text…"></textarea></label><div class="actions"><button class="button secondary" data-action="upper">VELKÁ PÍSMENA</button><button class="button secondary" data-action="lower">malá písmena</button><button class="button secondary" data-action="title">Začátky Slov</button><button class="button secondary" data-action="trim">Odstranit nadbytečné mezery</button><button class="button secondary" data-action="lines">Odstranit prázdné řádky</button></div><label class="field" style="margin-top:1.2rem"><span>Výsledek</span><textarea id="output" readonly></textarea></label><div class="actions"><button class="button" id="copy">Kopírovat výsledek</button><span id="status" class="status" role="status"></span></div>`);
  root.addEventListener('click',async e=>{let action=e.target.dataset.action;if(action){let s=val('input'),r=action==='upper'?s.toLocaleUpperCase('cs-CZ'):action==='lower'?s.toLocaleLowerCase('cs-CZ'):action==='title'?s.toLocaleLowerCase('cs-CZ').replace(/(^|\s)(\p{L})/gu,(_,sp,c)=>sp+c.toLocaleUpperCase('cs-CZ')):action==='trim'?s.replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').trim():s.split('\n').filter(x=>x.trim()).join('\n');document.querySelector('#output').value=r;}if(e.target.id==='copy'){try{await navigator.clipboard.writeText(val('output'));document.querySelector('#status').textContent='Zkopírováno.';}catch{document.querySelector('#status').textContent='Kopírování se nezdařilo.';}}});
}

function qrCode() {
  root.innerHTML=panel(`<label class="field"><span>Odkaz nebo krátký text</span><input id="text" type="text" value="https://indigostudio.cz" maxlength="500"></label><div class="actions"><button class="button" id="download">Stáhnout PNG</button></div><canvas id="qr" width="512" height="512" class="preview" aria-label="Vygenerovaný QR kód"></canvas><p id="status" class="status" role="status"></p>`);
  qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
  const draw=()=>{let text=val('text'),canvas=document.querySelector('#qr'),ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,512,512);if(!text)return;try{let code=qrcode(0,'M');code.addData(text);code.make();let count=code.getModuleCount(),cell=Math.floor(512/(count+8)),size=cell*count,offset=Math.floor((512-size)/2);ctx.fillStyle='#111';for(let y=0;y<count;y++)for(let x=0;x<count;x++)if(code.isDark(y,x))ctx.fillRect(offset+x*cell,offset+y*cell,cell,cell);document.querySelector('#status').textContent='QR kód je připravený.';}catch{document.querySelector('#status').textContent='Text je pro QR kód příliš dlouhý.';}};document.querySelector('#text').addEventListener('input',draw);document.querySelector('#download').onclick=()=>{let a=document.createElement('a');a.download='qr-kod.png';a.href=document.querySelector('#qr').toDataURL('image/png');a.click();};draw();
}

function password() {
  root.innerHTML=panel(`<div class="grid">${field('length','Délka hesla',20,'number','min="8" max="128" step="1"')}${field('count','Počet hesel',3,'number','min="1" max="10" step="1"')}</div><div class="actions"><label><input id="symbols" type="checkbox" checked> Speciální znaky</label><label><input id="digits" type="checkbox" checked> Číslice</label></div><div class="actions"><button class="button" id="generate">Vygenerovat</button></div><div id="passwords" class="result" style="overflow-wrap:anywhere"></div><p class="hint">Hesla vznikají ve vašem prohlížeči pomocí kryptograficky bezpečného generátoru.</p>`);
  const choose=alphabet=>{let limit=Math.floor(256/alphabet.length)*alphabet.length,byte=new Uint8Array(1);do{crypto.getRandomValues(byte);}while(byte[0]>=limit);return alphabet[byte[0]%alphabet.length];};
  const generate=()=>{let length=Math.min(128,Math.max(8,Math.floor(num('length')))),count=Math.min(10,Math.max(1,Math.floor(num('count')))),alphabet='abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';if(document.querySelector('#digits').checked)alphabet+='23456789';if(document.querySelector('#symbols').checked)alphabet+='!@#$%&*-_+=';document.querySelector('#passwords').replaceChildren(...Array.from({length:count},()=>{let p=document.createElement('p');p.textContent=Array.from({length},()=>choose(alphabet)).join('');return p;}));};document.querySelector('#generate').onclick=generate;generate();
}

function hexRgb(hex) {let h=hex.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}
function luminance(hex) {let rgb=hexRgb(hex).map(x=>{let v=x/255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
function hsl(rgb) {let [r,g,b]=rgb.map(x=>x/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2,s=d?d/(1-Math.abs(2*l-1)):0,h=0;if(d){switch(max){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}h*=60;if(h<0)h+=360;}return [Math.round(h),Math.round(s*100),Math.round(l*100)];}
function colors() {
  root.innerHTML=panel(`<div class="grid">${field('color','Vyberte barvu','#4454aa','color')}${field('hex','HEX','#4454aa','text')}</div><div id="swatch" class="swatch" style="margin-top:1.2rem"></div>${result()}`);
  const update=(source)=>{let hex=val(source).trim();if(!/^#[0-9a-f]{6}$/i.test(hex))return out('Zadejte šestimístný HEX kód.');document.querySelector(source==='color'?'#hex':'#color').value=hex;let rgb=hexRgb(hex),[h,s,l]=hsl(rgb),swatch=document.querySelector('#swatch');swatch.style.backgroundColor=hex;swatch.style.color=luminance(hex)>.45?'#111':'#fff';swatch.textContent=hex.toUpperCase();out(hex.toUpperCase(),row('RGB',rgb.join(', '))+row('HSL',`${h}°, ${s} %, ${l} %`));};root.addEventListener('input',e=>{if(e.target.id==='color'||e.target.id==='hex')update(e.target.id);});update('color');
}

function contrast() {
  root.innerHTML=panel(`<div class="grid">${field('foreground','Barva textu','#192331','color')}${field('background','Barva pozadí','#fffdfa','color')}</div><div id="swatch" class="swatch" style="margin-top:1.2rem">Ukázka čitelnosti</div>${result()}`)+'<p class="note">Podle WCAG 2.2 je pro běžný text úroveň AA od poměru 4,5 : 1, pro velký text od 3 : 1. <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">Pravidlo kontrastu W3C</a>.</p>';
  updateOnInput(()=>{let f=val('foreground'),b=val('background'),a=luminance(f),c=luminance(b),ratio=(Math.max(a,c)+.05)/(Math.min(a,c)+.05),swatch=document.querySelector('#swatch');swatch.style.color=f;swatch.style.backgroundColor=b;out(`${ratio.toFixed(2).replace('.',',')} : 1`,row('Běžný text AA',ratio>=4.5?'Splňuje':'Nesplňuje')+row('Velký text AA',ratio>=3?'Splňuje':'Nesplňuje')+row('Běžný text AAA',ratio>=7?'Splňuje':'Nesplňuje'));});
}

function imageDimensions() {
  root.innerHTML=panel(`<label class="field"><span>Vyberte obrázek</span><input id="file" type="file" accept="image/*"></label><div id="preview-slot"></div>${result()}<p class="hint">Soubor zůstává ve vašem zařízení.</p>`);
  let currentUrl;document.querySelector('#file').onchange=async e=>{let file=e.target.files[0];if(!file)return;if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(file);let img=new Image();img.className='preview';img.alt='Náhled vybraného obrázku';img.src=currentUrl;document.querySelector('#preview-slot').replaceChildren(img);try{await img.decode();let w=img.naturalWidth,h=img.naturalHeight,gcd=(a,b)=>b?gcd(b,a%b):a,d=gcd(w,h);out(`${w} × ${h} px`,row('Poměr stran',`${w/d}:${h/d}`)+row('Velikost souboru',`${nf.format(file.size/1024)} kB`)+row('Typ',escapeHtml(file.type||'Neznámý')));}catch{out('Obrázek nelze přečíst.');}};
}

function compressImage() {
  root.innerHTML=panel(`<label class="field"><span>Vyberte obrázek</span><input id="file" type="file" accept="image/*"></label><div class="grid" style="margin-top:1rem">${field('max','Nejdelší strana (px)',1600,'number','min="100" max="8000"')}${field('quality','Kvalita JPEG (%)',80,'number','min="10" max="100"')}</div><div class="actions"><button id="compress" class="button">Zmenšit obrázek</button><a id="download" class="button secondary" hidden download="obrazek.jpg">Stáhnout JPEG</a></div>${result()}<p class="hint">Zpracování probíhá ve vašem prohlížeči. Průhledné pozadí se při převodu na JPEG změní na bílé.</p>`);
  let objectUrl;document.querySelector('#compress').onclick=async()=>{let file=document.querySelector('#file').files[0];if(!file)return out('Vyberte obrázek.');let source=URL.createObjectURL(file);try{let img=new Image();img.src=source;await img.decode();let max=Math.min(8000,Math.max(100,num('max'))),scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;let ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);let quality=Math.min(1,Math.max(.1,num('quality')/100));let blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(!blob)throw Error();if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(blob);let link=document.querySelector('#download');link.href=objectUrl;link.hidden=false;out(`${nf.format(blob.size/1024)} kB`,row('Rozměry',`${w} × ${h} px`)+row('Původní velikost',`${nf.format(file.size/1024)} kB`)+row('Změna',`${nf.format((1-blob.size/file.size)*100)} %`));}catch{out('Obrázek se nepodařilo zpracovat.');}finally{URL.revokeObjectURL(source);}};
}

function metadata() {
  root.innerHTML=panel(`<label class="field"><span>Vyberte soubor</span><input id="file" type="file"></label>${result()}<p class="hint">Údaje se čtou pouze ve vašem prohlížeči.</p>`);
  document.querySelector('#file').onchange=async e=>{let file=e.target.files[0];if(!file)return;let detail=row('Typ',escapeHtml(file.type||'Neznámý'))+row('Velikost',`${nf.format(file.size/1024)} kB`)+row('Poslední změna',new Intl.DateTimeFormat('cs-CZ',{dateStyle:'medium',timeStyle:'short'}).format(file.lastModified));if(file.type.startsWith('image/')){let url=URL.createObjectURL(file);try{let img=new Image();img.src=url;await img.decode();detail+=row('Rozměry',`${img.naturalWidth} × ${img.naturalHeight} px`);}catch{}finally{URL.revokeObjectURL(url);}}out(escapeHtml(file.name),detail);};
}

const EXIF_LABELS = {
  ifd0: { 0x010E:'Popis', 0x010F:'Výrobce', 0x0110:'Model', 0x0112:'Orientace', 0x0131:'Software', 0x0132:'Datum změny', 0x013B:'Autor', 0x8298:'Autorská práva' },
  exif: { 0x9003:'Datum pořízení', 0x9004:'Datum digitalizace', 0x9010:'Časový posun', 0x829A:'Expozice', 0x829D:'Clona', 0x8827:'ISO', 0x920A:'Ohnisková vzdálenost', 0xA405:'Ohnisko pro 35 mm', 0x9204:'Korekce expozice', 0x9209:'Blesk', 0xA433:'Výrobce objektivu', 0xA434:'Objektiv', 0xA430:'Vlastník fotoaparátu', 0xA431:'Sériové číslo', 0xA002:'Šířka', 0xA003:'Výška', 0x9286:'Komentář' },
  gps: { 0x0006:'Nadmořská výška', 0x001D:'Datum GPS' },
};
const ORIENTATION = { 1:'Normální', 2:'Zrcadlově', 3:'Otočeno o 180°', 4:'Zrcadlově, otočeno o 180°', 5:'Zrcadlově, otočeno o 90°', 6:'Otočeno o 90° doprava', 7:'Zrcadlově, otočeno o 270°', 8:'Otočeno o 90° doleva' };
async function exifTool() {
  root.innerHTML=panel(`<label class="field"><span>Vyberte fotografii JPEG</span><input id="file" type="file" accept="image/jpeg"></label><div id="exif-form" hidden><div class="grid" style="margin-top:1rem">${field('artist','Autor','','text')}${field('copyright','Autorská práva','','text')}</div><div class="grid three" style="margin-top:1rem">${field('taken','Datum pořízení','','datetime-local','step="1"')}${field('make','Výrobce','','text')}${field('model','Model','','text')}</div><label class="field" style="margin-top:1rem"><span>Popis</span><input id="exif-description" type="text"></label><div class="actions"><label><input id="drop-gps" type="checkbox"> Odstranit polohu GPS</label></div><div class="actions"><button id="save" class="button">Uložit upravenou kopii</button><button id="strip" class="button secondary">Uložit kopii bez metadat</button></div></div><p id="status" class="status" role="status"></p>${result()}<p class="hint">Fotografie zůstává ve vašem zařízení. Úpravy se uloží jako nová kopie souboru.</p>`);
  const { isJpeg, readExif, entryValue, setText, encodeExifSegment, rebuildJpeg } = await import('./exif.js');
  const inputs = { artist:['ifd0',0x013B], copyright:['ifd0',0x8298], make:['ifd0',0x010F], model:['ifd0',0x0110], 'exif-description':['ifd0',0x010E] };
  const status = document.querySelector('#status');
  let bytes, meta, name = 'fotografie';
  const describe = (group, tag, entry) => {
    const v = entryValue(entry, meta.little), rational = entry.type === 5 || entry.type === 10, n = rational && entry.count === 1 ? (v[1] ? v[0] / v[1] : 0) : v;
    if (group === 'exif' && tag === 0x829A) return n >= 1 || !n ? `${nf.format(n)} s` : `1/${Math.round(1 / n)} s`;
    if (group === 'exif' && tag === 0x829D) return `f/${nf.format(n)}`;
    if (group === 'exif' && (tag === 0x920A || tag === 0xA405)) return `${nf.format(n)} mm`;
    if (group === 'exif' && tag === 0x9204) return `${nf.format(n)} EV`;
    if (group === 'exif' && tag === 0x9209) return n & 1 ? 'Použit' : 'Nepoužit';
    if (group === 'exif' && (tag === 0xA002 || tag === 0xA003)) return `${n} px`;
    if (group === 'exif' && tag === 0x9286 && v instanceof Uint8Array) return new TextDecoder(String.fromCharCode(...v.subarray(0, 7)) === 'UNICODE' ? (meta.little ? 'utf-16le' : 'utf-16be') : 'utf-8').decode(v.subarray(8)).replace(/\0+$/, '').trim();
    if (group === 'ifd0' && tag === 0x0112) return ORIENTATION[n] || String(n);
    if (group === 'gps' && tag === 0x0006) return `${nf.format(n)} m`;
    if (typeof n === 'string') return n.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$3. $2. $1');
    if (n instanceof Uint8Array) return n.every(b => b === 0 || (b >= 32 && b < 127)) ? String.fromCharCode(...n.filter(Boolean)) : `${nf.format(n.length)} B`;
    if (rational) return (entry.count === 1 ? [v] : v).map(([a, b]) => nf.format(b ? a / b : 0)).join(', ');
    return [].concat(n).join(', ');
  };
  const position = () => {
    const part = (tag, refTag, negative) => { const e = meta.gps.get(tag); if (!e || e.type !== 5 || e.count !== 3) return null; const [d, m, s] = entryValue(e, meta.little).map(([a, b]) => b ? a / b : 0), ref = meta.gps.has(refTag) ? entryValue(meta.gps.get(refTag), meta.little) : ''; return (ref === negative ? -1 : 1) * (d + m / 60 + s / 3600); };
    const lat = part(2, 1, 'S'), lon = part(4, 3, 'W');
    return lat === null || lon === null ? null : [lat.toFixed(6), lon.toFixed(6)];
  };
  const show = () => {
    document.querySelector('#exif-form').hidden = false;
    for (const [id, [group, tag]] of Object.entries(inputs)) document.getElementById(id).value = meta[group].has(tag) ? entryValue(meta[group].get(tag), meta.little) : '';
    const taken = meta.exif.get(0x9003);
    document.querySelector('#taken').value = taken ? entryValue(taken, meta.little).replace(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}:\d{2}:\d{2}).*/, '$1-$2-$3T$4') : '';
    const gps = document.querySelector('#drop-gps'), place = position();
    gps.checked = false; gps.disabled = !meta.gps.size;
    let rows = place ? row('Poloha', `<a href="https://www.openstreetmap.org/?mlat=${place[0]}&amp;mlon=${place[1]}#map=16/${place[0]}/${place[1]}" target="_blank" rel="noopener">${place.join(', ')}</a>`) : '', all = '', count = 0;
    for (const group of ['ifd0', 'exif', 'gps']) for (const [tag, label] of Object.entries(EXIF_LABELS[group])) { const e = meta[group].get(Number(tag)); if (e) rows += row(label, escapeHtml(describe(group, Number(tag), e))); }
    for (const [group, title] of [['ifd0','Snímek'],['exif','EXIF'],['gps','GPS'],['interop','Kompatibilita'],['ifd1','Náhled']]) for (const [tag, e] of meta[group]) { if ([0x8769, 0x8825, 0xA005].includes(tag)) continue; count++; all += row(`${title} · ${escapeHtml(EXIF_LABELS[group]?.[tag] || `0x${tag.toString(16).toUpperCase().padStart(4, '0')}`)}`, escapeHtml(describe(group, tag, e))); }
    out(escapeHtml(name), count ? `${rows}<details><summary>Všechny údaje (${count})</summary><div class="breakdown">${all}</div></details>` : row('EXIF', 'Fotografie neobsahuje údaje EXIF.'));
  };
  const download = (data, suffix) => { const url = URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })), a = document.createElement('a'); a.href = url; a.download = `${name.replace(/\.jpe?g$/i, '')}-${suffix}.jpg`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const apply = (next, suffix, message) => { bytes = next; meta = readExif(bytes); show(); download(bytes, suffix); status.textContent = message; };
  document.querySelector('#file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    name = file.name; status.textContent = '';
    try { bytes = new Uint8Array(await file.arrayBuffer()); if (!isJpeg(bytes)) throw Error('Úpravy EXIF podporujeme u fotografií JPEG.'); meta = readExif(bytes); show(); }
    catch (error) { document.querySelector('#exif-form').hidden = true; out('Soubor nelze přečíst.', row('Důvod', escapeHtml(error.message))); }
  };
  document.querySelector('#save').onclick = () => {
    try {
      for (const [id, [group, tag]] of Object.entries(inputs)) setText(meta[group], tag, val(id).trim());
      const taken = val('taken').replace('T', ' ').replaceAll('-', ':');
      setText(meta.exif, 0x9003, taken && (taken.length === 16 ? `${taken}:00` : taken));
      if (meta.exif.has(0x9004) && taken) setText(meta.exif, 0x9004, meta.exif.has(0x9003) ? entryValue(meta.exif.get(0x9003), meta.little) : '');
      const dropGps = document.querySelector('#drop-gps').checked;
      if (dropGps) meta.gps.clear();
      apply(rebuildJpeg(bytes, { exif: encodeExifSegment(meta), dropXmp: dropGps && /GPS(Latitude|Longitude)/.test(meta.xmp) }), 'upraveno', 'Upravená kopie je uložená ve stažených souborech.');
    } catch (error) { status.textContent = `Uložení se nezdařilo: ${error.message}`; }
  };
  document.querySelector('#strip').onclick = () => apply(rebuildJpeg(bytes, { stripAll: true }), 'bez-metadat', 'Kopie bez metadat je uložená ve stažených souborech.');
}

function imageEditor() {
  const range = (id, label) => `<label class="field"><span>${label} <output id="${id}-value">100 %</output></span><input id="${id}" type="range" min="0" max="200" value="100"></label>`;
  root.innerHTML=panel(`<label class="field"><span>Vyberte obrázek</span><input id="file" type="file" accept="image/*"></label><div id="editor" hidden><div class="actions"><button class="button secondary" data-turn="270">Otočit doleva</button><button class="button secondary" data-turn="90">Otočit doprava</button><button class="button secondary" data-flip="x">Převrátit vodorovně</button><button class="button secondary" data-flip="y">Převrátit svisle</button></div><div class="grid three" style="margin-top:1.2rem">${select('crop','Ořez',[['0','Bez ořezu'],['1','1 : 1'],['1.3333','4 : 3'],['1.5','3 : 2'],['1.7778','16 : 9'],['0.5625','9 : 16']])}${field('width','Šířka (px)','','number','min="1" max="16000" step="1"')}${field('height','Výška (px)','','number','min="1" max="16000" step="1"')}</div><div class="grid three" style="margin-top:1rem">${range('brightness','Jas')}${range('contrast','Kontrast')}${range('saturation','Sytost')}</div><div class="actions"><label><input id="grayscale" type="checkbox"> Černobílý</label><label><input id="sepia" type="checkbox"> Sépie</label></div><div class="grid" style="margin-top:1rem">${select('format','Uložit jako',[['image/jpeg','JPEG'],['image/png','PNG'],['image/webp','WebP']])}${field('quality','Kvalita (%)',90,'number','min="10" max="100"')}</div><canvas id="canvas" class="preview" aria-label="Náhled upraveného obrázku"></canvas><div class="actions"><button id="download" class="button">Stáhnout obrázek</button><button id="reset" class="button secondary">Vrátit změny</button><span id="status" class="status" role="status"></span></div></div>${result()}<p class="hint">Obrázek se upravuje jen ve vašem prohlížeči a nikam se neodesílá.</p>`);
  let img, name = 'obrazek', turn = 0, flipX = false, flipY = false, size = null;
  const $ = id => document.getElementById(id);
  // Výřez ve zdrojových souřadnicích; poměr stran platí pro výsledek, proto se u otočení na výšku obrací.
  const geometry = () => {
    const sw = img.naturalWidth, sh = img.naturalHeight, sideways = turn % 180 !== 0, ratio = Number(val('crop'));
    let cw = sw, ch = sh;
    if (ratio) { const r = sideways ? 1 / ratio : ratio; if (sw / sh > r) cw = Math.round(sh * r); else ch = Math.round(sw / r); }
    return { cx: (sw - cw) / 2, cy: (sh - ch) / 2, cw, ch, sideways, ow: sideways ? ch : cw, oh: sideways ? cw : ch };
  };
  const draw = (canvas, scale) => {
    const g = geometry(), [w, h] = size.map(n => Math.max(1, Math.round(n * scale))), ctx = canvas.getContext('2d');
    canvas.width = w; canvas.height = h;
    if (val('format') === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.filter = `brightness(${val('brightness')}%) contrast(${val('contrast')}%) saturate(${val('saturation')}%)${$('grayscale').checked ? ' grayscale(1)' : ''}${$('sepia').checked ? ' sepia(1)' : ''}`;
    ctx.translate(w / 2, h / 2); ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1); ctx.rotate(turn * Math.PI / 180);
    const [dw, dh] = g.sideways ? [h, w] : [w, h];
    ctx.drawImage(img, g.cx, g.cy, g.cw, g.ch, -dw / 2, -dh / 2, dw, dh);
  };
  const resize = () => { const g = geometry(); size = [g.ow, g.oh]; $('width').value = g.ow; $('height').value = g.oh; };
  const update = () => {
    if (!img) return;
    ['brightness', 'contrast', 'saturation'].forEach(id => { $(`${id}-value`).textContent = `${val(id)} %`; });
    $('quality').disabled = val('format') === 'image/png';
    draw($('canvas'), Math.min(1, 1000 / Math.max(...size)));
    out(`${size[0]} × ${size[1]} px`, row('Původní rozměry', `${img.naturalWidth} × ${img.naturalHeight} px`));
  };
  const reset = () => { turn = 0; flipX = flipY = false; ['brightness', 'contrast', 'saturation'].forEach(id => { $(id).value = 100; }); $('crop').value = '0'; $('grayscale').checked = $('sepia').checked = false; resize(); update(); };
  $('file').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file), next = new Image(); next.src = url;
    try { await next.decode(); img = next; name = file.name.replace(/\.[^.]+$/, '') || 'obrazek'; $('editor').hidden = false; $('status').textContent = ''; reset(); }
    catch { out('Obrázek nelze přečíst.'); }
  };
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-turn],[data-flip]'); if (!b || !img) return;
    if (b.dataset.turn) { turn = (turn + Number(b.dataset.turn)) % 360; resize(); }
    else if ((b.dataset.flip === 'x') !== (turn % 180 !== 0)) flipX = !flipX; else flipY = !flipY;
    update();
  });
  root.addEventListener('input', e => {
    if (!img) return;
    const g = geometry(), ratio = g.ow / g.oh;
    if (e.target.id === 'width') { size = [Math.max(1, num('width')), Math.max(1, Math.round(num('width') / ratio))]; $('height').value = size[1]; }
    else if (e.target.id === 'height') { size = [Math.max(1, Math.round(num('height') * ratio)), Math.max(1, num('height'))]; $('width').value = size[0]; }
    update();
  });
  root.addEventListener('change', e => { if (e.target.id === 'crop') resize(); if (img && e.target.id !== 'file') update(); });
  $('reset').onclick = reset;
  $('download').onclick = () => {
    const canvas = document.createElement('canvas'), type = val('format'), ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    draw(canvas, 1);
    canvas.toBlob(blob => {
      if (!blob) { $('status').textContent = 'Obrázek se nepodařilo uložit.'; return; }
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${name}-upraveno.${ext}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      $('status').textContent = blob.type === type ? `Uloženo, ${nf.format(blob.size / 1024)} kB.` : `Prohlížeč formát nepodporuje, uloženo jako PNG (${nf.format(blob.size / 1024)} kB).`;
    }, type, Math.min(1, Math.max(.1, num('quality') / 100)));
  };
}

async function deviceInfo() {
  const nav = navigator, yes = ok => ok ? 'Ano' : 'Ne', media = q => matchMedia(q).matches;
  const brands = nav.userAgentData?.brands?.filter(b => !/not.a.brand/i.test(b.brand)).map(b => `${b.brand} ${b.version}`).join(', ');
  let gpu = 'Neuvedeno';
  try { const gl = document.createElement('canvas').getContext('webgl'); if (gl) { gpu = gl.getParameter(gl.RENDERER); gl.getExtension('WEBGL_lose_context')?.loseContext(); } } catch {}
  const battery = await nav.getBattery?.().then(b => `${Math.round(b.level * 100)} %${b.charging ? ', nabíjí se' : ''}`).catch(() => null);
  const quota = await nav.storage?.estimate?.().then(s => `${nf.format(s.quota / 1024 ** 3)} GB`).catch(() => null);
  const sections = [
    ['Prohlížeč', [['Prohlížeč', brands || 'Neuvedeno'], ['Systém', nav.userAgentData?.platform || nav.platform || 'Neuvedeno'], ['Jazyky', (nav.languages || [nav.language]).join(', ')], ['Časové pásmo', Intl.DateTimeFormat().resolvedOptions().timeZone], ['Cookies', yes(nav.cookieEnabled)], ['Připojeno k internetu', yes(nav.onLine)], ['User agent', nav.userAgent]]],
    ['Obrazovka', [['Rozlišení obrazovky', `${screen.width} × ${screen.height} px`], ['Hustota pixelů', `${nf.format(devicePixelRatio)}×`], ['Velikost okna stránky', `${innerWidth} × ${innerHeight} px`], ['Barevná hloubka', `${screen.colorDepth} bitů`], ['Orientace', screen.orientation?.type?.startsWith('portrait') ? 'Na výšku' : 'Na šířku'], ['Barevný režim', media('(prefers-color-scheme: dark)') ? 'Tmavý' : 'Světlý'], ['Omezit animace', yes(media('(prefers-reduced-motion: reduce)'))], ['Hlavní ovládání', media('(pointer: coarse)') ? 'Dotyk' : 'Myš nebo touchpad'], ['Dotykové body', nav.maxTouchPoints ?? 0]]],
    ['Zařízení', [['Vlákna procesoru', nav.hardwareConcurrency || 'Neuvedeno'], ['Operační paměť', nav.deviceMemory ? `alespoň ${nav.deviceMemory} GB` : 'Neuvedeno'], ['Grafika', gpu], ['Připojení', nav.connection ? `${nav.connection.effectiveType || '?'}, přibližně ${nav.connection.downlink} Mb/s, odezva ${nav.connection.rtt} ms` : 'Neuvedeno'], ['Baterie', battery || 'Neuvedeno'], ['Úložiště pro weby', quota || 'Neuvedeno']]],
    ['Podporované funkce', [['Bluetooth (Web Bluetooth)', 'bluetooth' in nav], ['USB (WebUSB)', 'usb' in nav], ['Sériový port (Web Serial)', 'serial' in nav], ['Vstupní zařízení (WebHID)', 'hid' in nav], ['NFC (Web NFC)', 'NDEFReader' in window], ['MIDI', 'requestMIDIAccess' in nav], ['Herní ovladače', 'getGamepads' in nav], ['Vibrace', 'vibrate' in nav], ['Sdílení (Web Share)', 'share' in nav], ['Schránka', Boolean(nav.clipboard)], ['Oznámení', 'Notification' in window], ['Poloha', 'geolocation' in nav], ['Kamera a mikrofon', Boolean(nav.mediaDevices?.getUserMedia)], ['Rozpoznávání řeči', 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window], ['Předčítání textu', 'speechSynthesis' in window], ['Přístupové klíče (WebAuthn)', 'PublicKeyCredential' in window], ['Platby (Payment Request)', 'PaymentRequest' in window], ['Zabránit uspání (Wake Lock)', 'wakeLock' in nav], ['Práce se soubory na disku', 'showOpenFilePicker' in window], ['Kapátko barev', 'EyeDropper' in window], ['WebGPU', 'gpu' in nav], ['WebAssembly', typeof WebAssembly === 'object'], ['Práce offline (Service Worker)', 'serviceWorker' in nav], ['Container queries', CSS.supports('container-type: inline-size')]].map(([n, ok]) => [n, yes(ok)])],
  ];
  // V náhledu na rozcestníku je rozbalená jen první sekce, aby karta nebyla příliš vysoká.
  const embed = document.body.classList.contains('embed');
  root.innerHTML=sections.map(([heading, rows], i) => `<details class="panel"${embed && i ? '' : ' open'}><summary><h2>${heading}</h2></summary><div class="breakdown${rows.length > 12 ? ' columns' : ''}">${rows.map(([n, v]) => row(n, escapeHtml(v))).join('')}</div></details>`).join('')+`<div class="actions"><button id="copy" class="button">Kopírovat přehled</button>${'vibrate' in nav ? '<button id="vibrate" class="button secondary">Vyzkoušet vibraci</button>' : ''}<span id="status" class="status" role="status"></span></div><p class="note">Údaje zjišťuje jen váš prohlížeč, stránka je nikam neodesílá. V náhledu na rozcestníku odpovídá velikost okna velikosti náhledu.</p>`;
  document.querySelector('#copy').onclick = async () => { try { await nav.clipboard.writeText(sections.map(([h, rows]) => `${h}\n${rows.map(([n, v]) => `${n}: ${v}`).join('\n')}`).join('\n\n')); document.querySelector('#status').textContent = 'Zkopírováno.'; } catch { document.querySelector('#status').textContent = 'Kopírování se nezdařilo.'; } };
  document.querySelector('#vibrate')?.addEventListener('click', () => nav.vibrate(200));
}

const BLE_SERVICES = { 0x1800:'Obecný přístup', 0x1801:'Obecné atributy', 0x1802:'Okamžité upozornění', 0x1803:'Ztráta spojení', 0x1804:'Vysílací výkon', 0x1805:'Aktuální čas', 0x1808:'Glukóza', 0x1809:'Teploměr', 0x180A:'Informace o zařízení', 0x180D:'Tepová frekvence', 0x180F:'Baterie', 0x1810:'Krevní tlak', 0x1814:'Běh', 0x1816:'Cyklistika, rychlost a kadence', 0x1818:'Cyklistika, výkon', 0x181A:'Senzory prostředí', 0x181C:'Uživatelská data', 0x181D:'Váha', 0x1826:'Fitness stroj' };
const BLE_INFO = { 0x2A29:'Výrobce', 0x2A24:'Model', 0x2A26:'Firmware', 0x2A27:'Hardware', 0x2A28:'Software' };
async function bluetooth() {
  root.innerHTML=panel(`<p id="ble-support" class="hint" style="margin-top:0"></p><div class="actions"><button id="scan" class="button">Vyhledat zařízení</button><button id="disconnect" class="button secondary" hidden>Odpojit</button></div>${result()}`)+'<p class="note">Web Bluetooth funguje v Chrome a Edge na počítači a v Chrome na Androidu, Safari ani Firefox jej nepodporují. Zařízení vybíráte sami v okně prohlížeče. Stránka čte jen standardní služby (baterie, informace o zařízení, tep a další) a nic neodesílá.</p>';
  const support = document.querySelector('#ble-support'), scan = document.querySelector('#scan'), disconnect = document.querySelector('#disconnect');
  const short = uuid => /^0000[0-9a-f]{4}-0000-1000-8000-00805f9b34fb$/.test(uuid) ? parseInt(uuid.slice(4, 8), 16) : null;
  const hex = n => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
  if (!navigator.bluetooth) { support.textContent = 'Tento prohlížeč Web Bluetooth nepodporuje.'; scan.disabled = true; return; }
  const available = await navigator.bluetooth.getAvailability?.().catch(() => true) ?? true;
  support.textContent = available ? 'Bluetooth je k dispozici. Zapněte na zařízení párovací nebo vysílací režim a vyhledejte ho.' : 'Bluetooth je vypnutý nebo zařízení nemá adaptér.';
  let device;
  const rows = new Map(), render = () => out(escapeHtml(device.name || 'Zařízení bez názvu'), [...rows.values()].join(''));
  disconnect.onclick = () => device?.gatt.connected && device.gatt.disconnect();
  scan.onclick = async () => {
    try { device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: Object.keys(BLE_SERVICES).map(Number).filter(n => n > 0x1801) }); }
    catch (error) { if (error.name !== 'NotFoundError') out('Hledání se nezdařilo.', row('Důvod', escapeHtml(error.message))); return; }
    rows.clear(); rows.set('state', row('Stav', 'Připojuji…')); render();
    device.addEventListener('gattserverdisconnected', () => { rows.set('state', row('Stav', 'Odpojeno')); disconnect.hidden = true; render(); });
    try {
      const server = await device.gatt.connect();
      rows.set('state', row('Stav', 'Připojeno')); disconnect.hidden = false; render();
      const services = await server.getPrimaryServices().catch(() => []);
      rows.set('services', row('Dostupné služby', services.length ? services.map(s => escapeHtml(BLE_SERVICES[short(s.uuid)] || s.uuid)).join(', ') : 'Žádná ze standardních služeb')); render();
      for (const service of services) {
        const id = short(service.uuid), characteristics = await service.getCharacteristics().catch(() => []);
        for (const c of characteristics) {
          const cid = short(c.uuid);
          try {
            if (id === 0x180F && cid === 0x2A19) rows.set('battery', row('Baterie', `${(await c.readValue()).getUint8(0)} %`));
            else if (id === 0x180A && BLE_INFO[cid]) rows.set(cid, row(BLE_INFO[cid], escapeHtml(new TextDecoder().decode(await c.readValue()).replace(/\0+$/, ''))));
            else if (id === 0x180D && cid === 0x2A37) { c.addEventListener('characteristicvaluechanged', e => { const v = e.target.value, bpm = v.getUint8(0) & 1 ? v.getUint16(1, true) : v.getUint8(1); rows.set('hr', row('Tep', `${bpm} tepů/min`)); render(); }); await c.startNotifications(); rows.set('hr', row('Tep', 'Čekám na měření…')); }
            else rows.set(c.uuid, row(`${escapeHtml(BLE_SERVICES[id] || hex(id ?? 0))} · ${cid === null ? escapeHtml(c.uuid) : hex(cid)}`, Object.entries({ read: 'čtení', write: 'zápis', notify: 'odběr' }).filter(([p]) => c.properties[p]).map(([, t]) => t).join(', ') || 'jen informace'));
          } catch {}
          render();
        }
      }
    } catch (error) { rows.set('state', row('Stav', `Spojení se nezdařilo: ${escapeHtml(error.message)}`)); render(); }
  };
}

// Převod dat mezi formáty. CSV a TSV pracují se seznamem objektů (první řádek = názvy sloupců).
const FORMATS = [['json','JSON','application/json'],['yaml','YAML','application/yaml'],['csv','CSV','text/csv'],['csv-semicolon','CSV se středníkem (Excel)','text/csv'],['tsv','TSV','text/tab-separated-values'],['xml','XML','application/xml'],['query','Query string (URL)','text/plain']];
const typed = s => /^-?(0|[1-9]\d*)(\.\d+)?$/.test(s) ? Number(s) : s === 'true' ? true : s === 'false' ? false : s;
function parseDelimited(text, sep) {
  const rows = []; let cells = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c !== '"') cell += c; else if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
    else if (c === '"' && !cell) quoted = true;
    else if (c === sep) { cells.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cells.push(cell); rows.push(cells); cells = []; cell = ''; }
    else cell += c;
  }
  if (cell || cells.length) { cells.push(cell); rows.push(cells); }
  const [head = [], ...body] = rows.filter(r => r.some(Boolean));
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, typed(r[i] ?? '')])));
}
function toDelimited(data, sep) {
  const list = Array.isArray(data) ? data : [data];
  const cell = v => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return s.includes(sep) || /["\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; };
  if (list.every(Array.isArray)) return list.map(r => r.map(cell).join(sep)).join('\n');
  const head = [...new Set(list.flatMap(r => r && typeof r === 'object' ? Object.keys(r) : ['hodnota']))];
  return [head, ...list.map(r => head.map(h => r && typeof r === 'object' ? r[h] : r))].map(r => r.map(cell).join(sep)).join('\n');
}
function fromXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('Neplatné XML.');
  const convert = el => {
    const obj = {}, text = [...el.childNodes].filter(n => n.nodeType === 3 || n.nodeType === 4).map(n => n.nodeValue).join('').trim();
    if (!el.children.length && !el.attributes.length) return typed(text);
    for (const a of el.attributes) obj[`@${a.name}`] = typed(a.value);
    for (const c of el.children) obj[c.tagName] = Object.hasOwn(obj, c.tagName) ? [].concat(obj[c.tagName], [convert(c)]) : convert(c);
    if (text) obj['#text'] = typed(text);
    return obj;
  };
  return { [doc.documentElement.tagName]: convert(doc.documentElement) };
}
function toXml(data) {
  const name = n => String(n).replace(/[^\w.-]/g, '_').replace(/^(?=[\d.-]|$)/, '_');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[c]);
  const node = (tag, v, pad) => {
    if (Array.isArray(v)) return v.map(x => node(tag, x, pad)).join('');
    if (!v || typeof v !== 'object') return `${pad}<${tag}>${v === null || v === undefined ? '' : esc(v)}</${tag}>\n`;
    const entries = Object.entries(v), attrs = entries.filter(([k]) => k.startsWith('@')).map(([k, x]) => ` ${name(k.slice(1))}="${esc(x)}"`).join('');
    const kids = entries.filter(([k]) => !k.startsWith('@') && k !== '#text'), text = v['#text'] === undefined ? '' : esc(v['#text']);
    return kids.length ? `${pad}<${tag}${attrs}>\n${text ? `${pad}  ${text}\n` : ''}${kids.map(([k, x]) => node(name(k), x, `${pad}  `)).join('')}${pad}</${tag}>\n` : `${pad}<${tag}${attrs}>${text}</${tag}>\n`;
  };
  const keys = data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [];
  const body = keys.length === 1 && !keys[0].startsWith('@') && !Array.isArray(data[keys[0]]) ? node(name(keys[0]), data[keys[0]], '') : node('root', Array.isArray(data) ? { item: data } : data, '');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`.trimEnd();
}
async function formatConverter() {
  const sample = '[\n  { "nastroj": "Kalkulačka", "adresa": "kalkulacka.indigostudio.cz", "oblibeny": true },\n  { "nastroj": "QR kód", "adresa": "qr-kod.indigostudio.cz", "oblibeny": false }\n]';
  root.innerHTML=panel(`<div class="grid">${select('from','Z formátu',[['auto','Rozpoznat automaticky'],...FORMATS])}${select('to','Na formát',FORMATS)}</div><label class="field" style="margin-top:1rem"><span>Vstup</span><textarea id="input" class="code" spellcheck="false">${escapeHtml(sample)}</textarea></label><div class="actions"><button id="swap" class="button secondary">Prohodit vstup a výsledek</button></div><label class="field" style="margin-top:1rem"><span>Výsledek</span><textarea id="output" class="code" readonly spellcheck="false"></textarea></label><div class="actions"><button id="copy" class="button">Kopírovat výsledek</button><button id="download" class="button secondary">Stáhnout</button><span id="status" class="status" role="status"></span></div>`)+'<p class="note">Převod probíhá ve vašem prohlížeči. CSV a TSV převádí seznam objektů na řádky, vnořené hodnoty zapíše jako JSON. U XML se atributy značí @ a text prvku #text.</p>';
  const yaml = await import('./js-yaml.js');
  const input = document.querySelector('#input'), output = document.querySelector('#output'), status = document.querySelector('#status'), label = id => FORMATS.find(f => f[0] === id)?.[1] || id;
  document.querySelector('#to').value = 'yaml';
  const detect = text => { const t = text.trim(), first = t.split('\n')[0]; if (/^[[{]/.test(t)) return 'json'; if (t.startsWith('<')) return 'xml'; if (!t.includes('\n') && (/^https?:\/\/\S*\?/.test(t) || /^\??[^\s:=&]+=\S*(&|$)/.test(t))) return 'query'; if (first.includes('\t')) return 'tsv'; if (t.includes('\n') && /[,;]/.test(first) && !/^\s*-|:\s/.test(first)) return 'csv'; return 'yaml'; };
  const parse = {
    json: t => JSON.parse(t), yaml: t => yaml.load(t), xml: fromXml, tsv: t => parseDelimited(t, '\t'),
    csv: t => { const first = t.trim().split('\n')[0]; return parseDelimited(t.trim(), first.split(';').length > first.split(',').length ? ';' : ','); },
    query: t => { const obj = {}; for (const [k, v] of new URLSearchParams(t.trim().replace(/^[^?]*\?/, '').replace(/#.*$/, ''))) obj[k] = Object.hasOwn(obj, k) ? [].concat(obj[k], typed(v)) : typed(v); return obj; },
  };
  parse['csv-semicolon'] = parse.csv;
  const serialize = {
    json: d => JSON.stringify(d, null, 2) ?? '', yaml: d => yaml.dump(d, { lineWidth: -1, noRefs: true }).trimEnd(), xml: toXml,
    csv: d => toDelimited(d, ','), 'csv-semicolon': d => toDelimited(d, ';'), tsv: d => toDelimited(d, '\t'),
    query: d => { if (!d || typeof d !== 'object' || Array.isArray(d)) throw Error('Query string potřebuje objekt s klíči a hodnotami.'); const p = new URLSearchParams(); for (const [k, v] of Object.entries(d)) for (const x of [].concat(v)) p.append(k, x && typeof x === 'object' ? JSON.stringify(x) : x ?? ''); return p.toString(); },
  };
  let detected;
  const convert = () => {
    const text = input.value;
    status.classList.remove('error');
    if (!text.trim()) { output.value = ''; status.textContent = ''; return; }
    detected = val('from') === 'auto' ? detect(text) : val('from');
    let data;
    try { data = parse[detected](text); }
    catch (error) { output.value = ''; status.classList.add('error'); status.textContent = `Vstup se nepodařilo přečíst jako ${label(detected)}: ${error.message}`; return; }
    try { output.value = serialize[val('to')](data); status.textContent = val('from') === 'auto' ? `Rozpoznaný vstup: ${label(detected)}.` : ''; }
    catch (error) { output.value = ''; status.classList.add('error'); status.textContent = `Převod na ${label(val('to'))} se nezdařil: ${error.message}`; }
  };
  input.addEventListener('input', convert);
  root.addEventListener('change', convert);
  document.querySelector('#swap').onclick = () => { const to = val('to'); input.value = output.value; document.querySelector('#to').value = detected && detected !== to ? detected : 'json'; document.querySelector('#from').value = to; convert(); };
  document.querySelector('#copy').onclick = async () => { try { await navigator.clipboard.writeText(output.value); status.textContent = 'Zkopírováno.'; } catch { status.textContent = 'Kopírování se nezdařilo.'; } };
  document.querySelector('#download').onclick = () => { const [id, , type] = FORMATS.find(f => f[0] === val('to')), url = URL.createObjectURL(new Blob([output.value], { type })), a = document.createElement('a'); a.href = url; a.download = `prevod.${{ yaml: 'yaml', xml: 'xml', json: 'json', tsv: 'tsv', query: 'txt' }[id] || 'csv'}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  convert();
}

const tools={
  nastroje:showCatalog,kalkulacka:calculator,procenta:percentages,trojclenka:ruleOfThree,dph:vat,spropitne:tip,
  'prevody-jednotek':unitConverter,'prevody-men':currencies,'casova-pasma':timeZones,'velikosti-obleceni':clothing,
  'cista-mzda':salary,'hodinova-sazba':hourlyRate,fakturace:invoice,uroky:interest,splatky:payments,
  kalendar:calendar,datum:dateTool,'pracovni-dny':workdays,odpocet:countdown,stopky:stopwatch,casovac:timer,
  'pocitadlo-slov':wordCounter,'formatovani-textu':textFormat,'qr-kod':qrCode,'generator-hesel':password,
  barvy:colors,kontrast:contrast,'rozmery-obrazku':imageDimensions,'komprese-obrazku':compressImage,metadata,
  exif:exifTool,'upravy-obrazku':imageEditor,'prevod-formatu':formatConverter,prohlizec:deviceInfo,bluetooth,
};

const fail = error => { console.error(error); root.innerHTML=panel('<p>Nástroj se nepodařilo spustit. Obnovte prosím stránku.</p>'); };
try { Promise.resolve(tools[slug]?.()).catch(fail); }
catch (error) { fail(error); }
