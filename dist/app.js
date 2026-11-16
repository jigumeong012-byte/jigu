import { categories, initialState, stats, createTask, dayKey } from './model.js?v=login-fix-2';
import { api, toTask, request } from './api.js?v=login-fix-2';

let installPrompt = null;
window.addEventListener('beforeinstallprompt', event => {
 event.preventDefault();
 installPrompt = event;
});
window.addEventListener('appinstalled', () => { installPrompt = null; toast('LifeQuest가 설치되었어요.'); });
if ('serviceWorker' in navigator) {
 window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(() => {}));
}

let KEY = 'lifequest.api.v1';
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
let state;
try { state = null; } catch {}
if (!state || state.version !== 1 || !Array.isArray(state.tasks)) state = initialState();
let cachedTasks = [];
state.tasks = [];
state.user = null;
let serverReady = false, connectionError = '', mutationPending = false, checkingSession = true;

function loadUserState(user) {
 KEY = `lifequest.user.${user.id}`;
 try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
 if (!state || state.version !== 1 || !Array.isArray(state.tasks)) state = initialState();
 cachedTasks = state.tasks; state.tasks = []; state.user = user;
 if (!localStorage.getItem(KEY)) state.profile.name = user.username;
}
async function refreshRemote() {
 const quests = await api.quests();
 const user = await api.user();
 const local = new Map([...cachedTasks, ...state.tasks].map(t => [t.id, t]));
 state.user = user;
 state.tasks = quests.map(q => toTask(q, local.get(String(q.id))));
 serverReady = true; connectionError = ''; save();
}
async function connect() {
 checkingSession = true; connectionError = ''; render();
 try { const user = await api.user(); loadUserState(user); await refreshRemote(); } catch(error) { serverReady = false; if(error.status !== 401) connectionError = error.message; }
 checkingSession = false;
 if (!serverReady) go('/login');
 render();
}
async function mutate(work) {
 if (mutationPending) return false;
 mutationPending = true;
 try {
  await work(); save();
  await refreshRemote();
  render(); return true;
 } catch(error) {
  if (!error.status || error.status >= 500) {
   serverReady = false; connectionError = `${error.message} 서버 상태를 다시 불러온 뒤 계속해주세요.`;
   if (modal.open) closeModal();
   render();
  }
  throw error;
 } finally { mutationPending = false; }
}

let filter = '전체', homeFilter = '전체', sort = 'priority', quickCategory = '공부', period = 30, authMode = 'login';
let timer = {taskId:null,remaining:1500,running:false,end:null};
let lastFocus, toastTimeout, avatarDraft;
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt = number => Number(number).toLocaleString('ko-KR');
const paths = {
 check:'m5 12 4 4L19 6', plus:'M12 5v14M5 12h14', close:'m6 6 12 12M6 18 18 6', chevron:'m9 5 7 7-7 7', down:'m6 9 6 6 6-6', back:'m12 5-7 7 7 7M5 12h14',
 calendar:'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z', clock:'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 medal:'M8 3h8v8l-4 3-4-3ZM12 3v11M9 14l-1 7 4-3 4 3-1-7', bolt:'m13 2-9 12h7l-1 8 10-13h-7Z', flame:'M12 3c3 5-2 5 2 8 2-1 3-3 3-3 5 6 4 13-5 13S2 13 7 8c0 4 3 4 3 4s-2-4 2-9Z',
 star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z', more:'M12 5h.01M12 12h.01M12 19h.01', edit:'m15 4 5 5M4 16 16 4a2 2 0 0 1 4 4L8 20H4Z',
 book:'M12 5v16M12 5C8 2 3 3 3 3v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2Z', code:'m8 6-6 6 6 6m8-12 6 6-6 6m-3-14-2 16', exercise:'m4 7 13 13M2 9l7-7m6 20 7-7M2 5l3-3m14 20 3-3', leaf:'M20 3C7 1 1 10 5 17S24 22 20 3ZM5 20 16 9',
 bulb:'M9 18h6M9 22h6M8 15a7 7 0 1 1 8 0l-1 3H9Z', shield:'m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6ZM8 12l3 3 5-6', lock:'M6 10h12v12H6ZM8 10V6a4 4 0 0 1 8 0v4M12 15v3',
 download:'M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6', camera:'M3 7h4l2-3h6l2 3h4v14H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0', upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',
 play:'m8 4 12 8-12 8Z', pause:'M8 4v16M16 4v16', reset:'M3 11a9 9 0 1 1 1 6M3 4v7h7', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 sparkle:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z', logout:'M9 3H3v18h6M10 12h12m-5-5 5 5-5 5', bell:'M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 22h4', trend:'m3 17 6-6 4 4 8-11m-6 0h6v6', mail:'M2 4h20v16H2Zm0 0 10 9L22 4', trash:'M3 6h18M5 6l1 15h12l1-15M9 6V2h6v4M10 10v7M14 10v7', save:'M4 3h14l3 3v15H3V3ZM7 3v6h10V3M7 21v-8h10v8', flag:'M4 22V3c5-4 10 4 16 0v10c-6 4-11-4-16 0', home:'m2 10 10-8 10 8M5 9v12h14V9M9 21v-8h6v8'
};
function icon(name, cls='') { return `<svg class="${cls}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.sparkle}"/></svg>`; }
const categoryIcon = c => ({공부:'book',개발:'code',운동:'exercise',생활:'leaf',독서:'book'}[c]);
function save() { try { localStorage.setItem(KEY,JSON.stringify(state)); return true; } catch { toast('저장 공간이 부족해요. 프로필 사진 크기를 줄이거나 데이터를 내보내 주세요.'); return false; } }
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('show'),3500); }
const currentRoute = () => location.hash.slice(1) || '/';
const go = route => { if(currentRoute()===route) render(); else location.hash=route; };

function avatar(cls='') { return state.profile.avatar ? `<img class="avatar ${cls}" src="${esc(state.profile.avatar)}" alt="프로필 사진">` : `<span class="avatar ${cls}" aria-label="프로필">${esc(state.profile.name.slice(0,2))}</span>`; }
function progress(value) { return `<div class="progress" role="progressbar" aria-valuenow="${Math.max(0,Math.min(100,value))}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0,Math.min(100,value))}%"></i></div>`; }
function header() {
 const route=currentRoute(), s=stats(state);
 const selected=route.startsWith('/task')?'tasks':route.startsWith('/growth')?'growth':route.startsWith('/settings')||route==='/profile'?'settings':'home';
 return `<header class="header"><div class="header-inner"><div class="row"><a class="brand" href="#/" aria-label="LifeQuest 홈"><img src="./icon.svg" alt="">LifeQuest</a><nav class="nav" aria-label="주 메뉴">${[['home','/','홈'],['tasks','/tasks','내 할 일'],['growth','/growth','성장'],['settings','/settings','설정']].map(([id,path,label])=>`<a href="#${path}" ${selected===id?'class="active" aria-current="page"':''}>${label}</a>`).join('')}</nav></div><div class="row"><a href="#/growth" class="level-tag">${icon('medal')} Lv. ${s.level} Explorer</a><button class="profile-button row" data-action="profile-menu" aria-label="프로필 메뉴">${avatar()}${icon('down')}</button></div></div></header>`;
}
function footer() { return `<footer class="footer"><div><strong>LifeQuest</strong> © ${new Date().getFullYear()} LifeQuest. 매일 조금씩 성장하는 나.</div><div class="row"><button data-action="install-app">앱 설치</button><button data-action="info" data-kind="terms">이용약관</button><button data-action="info" data-kind="privacy">개인정보처리방침</button><button data-action="info" data-kind="support">고객지원</button></div></footer>`; }
function render() {
 const route=currentRoute();
 if (!serverReady && checkingSession && route !== '/login') {
  app.innerHTML = `<main><section class="card empty"><h1>LifeQuest</h1><p class="space-top" role="status">${esc(connectionError || '퀘스트와 성장 기록을 불러오고 있어요…')}</p>${connectionError ? '<button class="btn primary space-top" data-action="reconnect">다시 연결</button> <a class="btn secondary space-top" href="#/login">로그인 / 회원가입</a>' : ''}</section></main>`;
  return;
 }
 const auth=route==='/login' || !serverReady;
 document.body.classList.toggle('auth-page',auth);
 document.body.classList.toggle('focus-mode',state.settings.focus && timer.running);
 let body=auth?login():route==='/'?home():route==='/tasks'?tasksPage():route==='/growth'?growth():route==='/settings'?settings():route==='/profile'?profile():route.startsWith('/task/')?detail(decodeURIComponent(route.slice(6))):`<div class="empty"><h1>페이지를 찾을 수 없어요</h1><a class="btn primary space-top" href="#/">홈으로 돌아가기</a></div>`;
 app.innerHTML=`${auth?'':header()}<main id="main">${body}</main>${footer()}`;
 const names={'/':'홈','/tasks':'내 할 일','/growth':'성장','/settings':'설정','/profile':'프로필 수정','/login':'로그인'};
 document.title=`${names[route] || '퀘스트 상세'} · LifeQuest`;
}
function summaryCard() {
 const s=stats(state), remain=state.tasks.filter(t=>!t.done).reduce((n,t)=>n+t.xp,0);
 return `<section class="card xp-card"><div class="row between"><div><div class="row"><h2>레벨 ${s.level}</h2><span class="pill">Explorer</span></div><p class="muted small" style="margin-top:8px">다음 레벨 ${s.level+1}까지 <b class="blue">${fmt(s.remaining)} XP</b> 남았어요</p></div><div class="icon-bubble square">${icon('medal')}</div></div><div><div class="progress-label"><span class="muted">현재 경험치 진척도</span><b class="blue">${s.progress}%</b></div>${progress(s.progress)}<div class="row between small muted" style="margin-top:12px"><span>${fmt(s.xp)} XP 달성</span><span>목표 ${fmt(s.goal)} XP</span></div></div><div class="soft-box row between small"><span>오늘 획득 가능한 추가 XP</span><b class="blue">+${remain} XP</b></div></section>`;
}
function home() {
 const s=stats(state), date=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(new Date());
 const remainingHours=24-Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
 const list=state.tasks.filter(t=>homeFilter==='전체'||(homeFilter==='완료됨'?t.done:!t.done));
 return `${state.banner?`<div class="banner"><div class="icon-bubble">${icon('sparkle')}</div><div class="grow"><strong>레벨 ${s.level+1}이 눈앞이에요! 오늘의 작은 성장을 응원해요 🎉</strong><p class="muted small">하나씩 완료할 때마다 나만의 경험치가 차곡차곡 쌓여요.</p></div><button class="icon-button" data-action="dismiss-banner" aria-label="응원 알림 닫기">${icon('close')}</button></div>`:''}
 <div class="hero-grid"><section class="card welcome"><div><span class="pill gray"><span class="dot" style="width:6px;height:6px"></span> 오늘도 평온하고 생산적인 하루</span><h1>오늘도 하나씩<br>완성해 볼까요?</h1><p class="muted">작은 성취가 모여 큰 변화를 만듭니다. 오늘의 퀘스트를 달성해보세요.</p></div><div class="date-line"><span>${icon('calendar')} ${date}</span><span class="remaining-hours">${icon('clock')} 오늘 남은 시간 ${remainingHours}시간</span></div></section>${summaryCard()}</div>
 <div class="columns"><section class="stack"><div class="card section-toolbar"><div class="row"><h2>오늘의 할 일</h2><span class="pill">${s.total-s.done}개 남음</span><div class="mini-tabs" aria-label="완료 상태 필터">${['전체','진행중','완료됨'].map(v=>`<button class="${homeFilter===v?'active':''}" data-action="home-filter" data-value="${v}">${v}</button>`).join('')}</div></div><button class="btn primary" data-action="add">${icon('plus')} 할 일 추가</button></div><div class="card task-list home-tasks">${taskRows(list,true)}</div></section><aside class="stack">${weeklyCard()}${chartCard()}<div class="tip row"><div class="icon-bubble">${icon('bulb')}</div><div><h3 style="font-size:13px">“꾸준함이 비범함을 만듭니다”</h3><p class="muted">오늘의 작은 실천 하나가 내일의 나를 바꿔요.</p></div></div></aside></div>`;
}
function taskRows(list,compact=false) {
 if(!list.length)return `<div class="empty">${icon('check')}<h3>여기는 아직 비어 있어요</h3><p class="small">새로운 할 일을 추가하거나 다른 필터를 선택해보세요.</p><button class="btn secondary space-top" data-action="add">${icon('plus')} 할 일 추가</button></div>`;
 return list.map(t=>`<div class="task-row ${t.done?'completed':''}"><button class="check ${t.done?'checked':''}" data-action="complete" data-id="${t.id}" aria-label="${esc(t.title)} ${t.done?'완료됨':'완료'}" aria-pressed="${t.done}">${t.done?icon('check'):''}</button><a class="task-link grow" href="#/task/${t.id}"><div class="task-title">${esc(t.title)} ${compact?`<span class="pill gray small" style="font-size:10px;padding:2px 8px;font-weight:500">${esc(t.category)}</span>`:''}</div><div class="task-meta">${compact?esc(t.note||'작은 성취를 쌓아보세요.'):`<span class="pill">${esc(t.category)}</span><span class="blue">+${t.xp} XP</span><span>${t.done?'✓ 완료됨':esc(t.schedule)}</span>`}</div></a>${compact?`<span class="small ${t.done?'muted':'blue'} xp-label">${t.done?'완료됨':`+${t.xp} XP`}</span><a class="icon-button" href="#/task/${t.id}" aria-label="${esc(t.title)} 상세 보기">${icon('chevron')}</a>`:`<div class="row"><button class="icon-button ${t.star?'starred':''}" data-action="star" data-id="${t.id}" aria-label="${esc(t.title)} 중요 표시" aria-pressed="${t.star}">${icon('star')}</button><button class="icon-button" data-action="task-menu" data-id="${t.id}" aria-label="${esc(t.title)} 더보기">${icon('more')}</button></div>`}</div>`).join('');
}
function weeklyCard() {const s=stats(state);return `<section class="card"><h3>저장된 퀘스트 현황</h3><div class="metrics"><div class="metric"><span>완료한 퀘스트</span><strong>${s.done}<small>개</small></strong></div><div class="metric"><span>전체 퀘스트</span><strong>${s.total}<small>개</small></strong></div></div><div class="soft-box row between space-top"><span>누적 경험치</span><h2 class="blue">${s.xp} XP</h2></div></section>`;}
function chartCard() {
 const rate=stats(state).rate, day=(Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',weekday:'short'}).format(new Date()).replace(/Sun|Mon|Tue|Wed|Thu|Fri|Sat/g,v=>({Sun:6,Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5}[v]))));
 const history=[70,85,100,60,90,80,75];
 return `<section class="card"><div class="row between"><h3>이번 주 요일별 달성률</h3><b class="small blue">오늘 ${rate}%</b></div><div class="chart" role="img" aria-label="요일별 달성률, 오늘 ${rate}퍼센트">${['월','화','수','목','금','토','일'].map((d,i)=>`<div class="bar-column"><i class="${i<=day?'current':''}" style="height:${i<day?history[i]:i===day?Math.max(rate,5):5}%" title="${d}요일 ${i<day?history[i]:i===day?rate:0}%"></i><span>${d}</span></div>`).join('')}</div><p class="small muted" style="font-size:10px;margin-top:14px">이전 활동은 미리보기 데이터예요.</p></section>`;
}
function categoryProgress() {return categories.filter(c=>state.tasks.some(t=>t.category===c)).map(c=>{const all=state.tasks.filter(t=>t.category===c), done=all.filter(t=>t.done).length, rate=Math.round(done/all.length*100);return `<div class="category-line"><div class="row between"><span>${c} (${done}/${all.length})</span><span class="muted">${rate}%</span></div>${progress(rate)}</div>`;}).join('');}
function tasksPage() {
 const s=stats(state);let list=state.tasks.filter(t=>filter==='전체'||filter===t.category);
 list=[...list].sort(sort==='priority'?(a,b)=>Number(a.done)-Number(b.done)||Number(b.star)-Number(a.star):sort==='xp'?(a,b)=>b.xp-a.xp:()=>0);if(sort==='recent')list.reverse();
 return `<section class="quest-overview"><div class="ring" style="--value:${s.rate}"><strong>${s.rate}%</strong></div><div class="grow"><div class="row wrap"><h2>전체 퀘스트 달성도</h2><span class="pill">${s.done}/${s.total} 완료</span></div><p class="muted" style="margin-top:8px;font-size:13px">조금만 더 힘내면 오늘의 성취에 한 걸음 더 가까워져요!</p></div><div class="overview-stat"><span class="small muted">목록의 완료 XP</span><strong class="blue">+${s.earned} XP</strong></div><div class="overview-stat"><span class="small muted">다음 레벨까지</span><strong>${s.remaining} XP</strong></div><button class="btn primary" data-action="add">${icon('plus')} 할 일 추가</button></section>
 <div class="columns"><section><div class="filters row between"><div class="chips" aria-label="카테고리 필터">${['전체',...categories].map(c=>`<button class="chip ${filter===c?'active':''}" data-action="filter" data-value="${c}">${c} ${state.tasks.filter(t=>c==='전체'||c===t.category).length}</button>`).join('')}</div><select class="sort" id="sort" aria-label="할 일 정렬"><option value="priority" ${sort==='priority'?'selected':''}>우선순위순</option><option value="recent" ${sort==='recent'?'selected':''}>최신 등록순</option><option value="xp" ${sort==='xp'?'selected':''}>경험치 높은 순</option></select></div><div class="card task-list">${taskRows(list)}</div></section><aside class="stack"><section class="card"><div class="row between"><h3>${icon('edit','blue')} 빠른 퀘스트 등록</h3><span class="pill gray">+30 XP</span></div><p class="muted small space-top">지금 떠오른 작은 목표를 바로 추가해보세요.</p><form id="quick-form" class="quick-form"><input name="title" aria-label="빠른 할 일 이름" placeholder="어떤 목표를 실행할까요?" required maxlength="72"><div class="chips">${categories.map(c=>`<button type="button" class="chip blue-active ${quickCategory===c?'active':''}" data-action="quick-category" data-value="${c}">${c}</button>`).join('')}</div><button class="btn primary full" type="submit">${icon('plus')} 바로 추가하기</button></form></section><section class="card"><div class="row between"><h3>카테고리별 달성 현황</h3><span class="small blue">전체 ${s.rate}%</span></div>${categoryProgress()}</section><div class="tip row"><span class="icon-bubble">${icon('sparkle')}</span><div><p>“시작하는 방법은 그만 말하고 실행하는 것이다.”</p><p class="small muted">월트 디즈니 · 오늘의 한마디</p></div></div></aside></div>`;
}
function growth() {
 const s=stats(state), since=dayKey(new Date(Date.now()-(period-1)*86400000));
 const data=categories.map(c=>{const tasks=state.tasks.filter(t=>t.category===c&&t.done&&t.date>=since);return {c,n:tasks.length,xp:tasks.reduce((n,t)=>n+t.xp,0)};});
 const total=data.reduce((n,x)=>n+x.n,0),days=Math.ceil(s.remaining/85),eta=new Date(Date.now()+days*86400000);
 const recent=state.tasks.filter(t=>t.done).slice(-3).reverse();
 return `<div class="page-heading row between"><div><div class="eyebrow">● GROWTH OVERVIEW</div><h1>성장</h1><p>꾸준한 실천으로 쌓아온 나의 변화를 확인해보세요.</p></div><select class="sort report-range" id="period" aria-label="성장 분석 기간"><option value="30" ${period===30?'selected':''}>최근 30일 등록 퀘스트</option><option value="7" ${period===7?'selected':''}>최근 7일 등록 퀘스트</option></select></div><div class="growth-grid"><div class="stack"><section class="card"><div class="row between"><span class="pill">현재 레벨</span><div class="icon-bubble square">${icon('medal')}</div></div><div class="row"><strong class="growth-level">레벨 ${s.level}</strong><span class="small blue">꾸준히 성장하고 있어요</span></div><p class="muted">다음 레벨(Lv. ${s.level+1})까지 <b>${s.remaining} XP</b> 남았어요.</p><div class="space-top"><div class="progress-label"><span class="muted">진척도 (${fmt(s.xp)} / ${fmt(s.goal)} XP)</span><b class="blue">${s.progress}%</b></div>${progress(s.progress)}</div><div class="growth-stats"><div><span class="small muted">⚡ 총 획득 경험치</span><strong>${fmt(s.xp)} XP</strong></div><div><span class="small muted">✓ 완료한 할 일</span><strong>${s.done}개</strong></div><div><span class="small muted">남은 퀘스트</span><strong>${s.total-s.done}개</strong></div></div></section><section class="card"><div class="row between"><h2>카테고리별 활동 요약</h2><span class="pill">최근 ${period}일</span></div><p class="small muted" style="margin-top:8px">전체 완료 항목 중 가장 많은 비중을 차지한 루틴입니다.</p><div class="growth-split">${data.map((x,i)=>`<i style="width:${total?x.n/total*100:0}%;opacity:${1-i*.17}"></i>`).join('')}</div>${data.filter(x=>x.n).map(x=>`<a class="category-card" href="#/tasks" data-action="category-link" data-value="${x.c}"><span class="icon-bubble">${icon(categoryIcon(x.c))}</span><div class="grow"><h3>${x.c}</h3><p>${x.n}개 완료 · ${x.xp} XP 획득</p></div><b class="blue">${Math.round(x.n/total*100)}%</b></a>`).join('')}<p class="small muted" style="font-size:10px;margin-top:18px">선택 기간에 등록된 퀘스트 중 현재 완료된 항목을 집계합니다. 삭제한 퀘스트는 제외됩니다.</p></section></div><div class="stack"><section class="tip" style="padding:28px"><div class="row"><span class="icon-bubble">${icon('shield')}</span><div><h3>다음 마일스톤 예측</h3><p class="muted small">일평균 85 XP 달성 기준</p></div></div><p class="space-top">지금처럼 꾸준히 실천한다면 <b class="blue">약 ${days}일 뒤</b>에 레벨 ${s.level+1}에 도달할 수 있어요.</p><div class="row between small" style="border-top:1px solid #dfe7f6;padding-top:20px;margin-top:20px"><span class="muted">예상 도달일</span><b>${new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',dateStyle:'medium'}).format(eta)}</b></div></section><section class="card"><h2>최근 달성 기록</h2><p class="small muted" style="margin-top:7px">의미 있는 마일스톤 타임라인</p><div class="timeline">${recent.map(t=>`<button data-action="open-task" data-id="${t.id}"><span class="dot"></span><div class="grow"><h3>${esc(t.title)}</h3><p class="small muted">퀘스트 완료 · +${t.xp} XP</p></div>${icon('chevron')}</button>`).join('')}<button data-action="achievement" data-value="레벨 7 달성"><span class="dot" style="opacity:.5"></span><div class="grow"><h3>레벨 7 달성</h3><p class="small muted">경험치 1,500 XP 누적 · 이전 활동 예시</p></div>${icon('chevron')}</button></div></section><section class="card"><div class="row between"><h3>칭호 및 뱃지 미리보기</h3><span class="small blue">예시 컬렉션</span></div><div class="badges">${[['medal','루틴 정복자'],['code','열정 코더'],['bolt','스프린터'],['lock','Lv.10 도전']].map(([i,t])=>`<button class="badge" data-action="badge" data-value="${t}"><span class="icon-bubble">${icon(i)}</span>${t}</button>`).join('')}</div></section></div></div>`;
}
function settings() {
 const rows=[['reminder','오늘의 할 일 리마인더','남아 있는 할 일을 잊지 않도록 알려드려요.'],['rewards','레벨 업 및 보상 알림','작은 성취와 기쁜 순간을 함께 축하해요.'],['report','주간 성장 리포트 요약','일주일 동안 쌓아온 성장을 돌아보세요.']];
 return `<div class="settings-wrap"><div class="page-heading"><div class="eyebrow">MY PREFERENCES</div><h1>설정</h1><p>나에게 맞는 LifeQuest를 만들어보세요.</p></div><section class="card settings-card"><h2>내 프로필</h2><div class="row profile-row"><div class="photo-upload">${avatar('large')}<button class="camera" data-action="photo" aria-label="프로필 사진 변경">${icon('camera')}</button></div><div class="profile-details grow"><h3>${esc(state.profile.name)}</h3><p class="muted small">${esc(state.profile.job)}</p><p class="small">${esc(state.profile.message)}</p></div><a class="btn secondary" href="#/profile">수정 ${icon('edit')}</a></div><button class="btn ghost small" data-action="photo" style="margin-left:90px">사진 변경</button></section><section class="card settings-card"><h2>알림 설정</h2>${rows.map(([key,title,desc])=>`<div class="setting-row"><div><h3>${title}</h3><p>${desc}</p></div><button class="toggle ${state.settings[key]?'on':''}" role="switch" aria-checked="${state.settings[key]}" aria-label="${title}" data-action="toggle-setting" data-value="${key}"><i></i></button></div>`).join('')}<p class="small muted" style="font-size:10px;margin-top:20px">알림 선호도는 이 브라우저에 저장돼요. 푸시·이메일 발송은 서버 연결 후 제공됩니다.</p></section><section class="card settings-card"><h2>계정 및 보안</h2><button class="setting-row setting-link" data-action="export"><div class="row"><span class="icon-bubble">${icon('download')}</span><div><h3>데이터 백업 및 내보내기</h3><p>내 퀘스트와 활동 기록을 JSON 형식으로 내려받기</p></div></div>${icon('chevron')}</button><div class="setting-actions"><button class="btn ghost" data-action="logout">${icon('logout')} 로그아웃</button></div></section></div>`;
}
function profile() {
 avatarDraft=state.profile.avatar;
 return `<div class="settings-wrap"><a class="back-link" href="#/settings">${icon('back')} 설정으로 돌아가기</a><div class="page-heading"><h1>프로필 정보 수정</h1><p>나를 표현하는 프로필을 완성해보세요.</p></div><form id="profile-form"><section class="card settings-card"><div class="row photo-row"><div id="avatar-preview">${avatar('xlarge')}</div><div><h3>프로필 사진</h3><p class="small muted" style="margin-top:8px">JPG, PNG, WebP 형식 · 최대 5MB</p><div class="photo-controls"><button class="btn secondary" type="button" data-action="photo">${icon('upload')} 사진 변경</button><button class="btn ghost" type="button" data-action="reset-photo">기본 이미지로 변경</button></div></div></div></section><section class="card settings-card"><h2>기본 정보</h2><label class="field">닉네임 / 사용자명<input name="name" value="${esc(state.profile.name)}" placeholder="2~12자 이내로 입력하세요" required minlength="2" maxlength="12"><small>서비스에서 표시되는 이름이에요. <span id="name-count">${state.profile.name.length}</span>/12</small></label><label class="field">직무 및 관심 분야<input name="job" value="${esc(state.profile.job)}" maxlength="60" placeholder="예: 프론트엔드 개발자, 디자이너, 대학생"></label><label class="field" style="margin-bottom:0">한 줄 각오 / 상태 메시지<input name="message" value="${esc(state.profile.message)}" maxlength="50" placeholder="오늘의 다짐을 한 줄로 적어보세요"><small><span id="message-count">${state.profile.message.length}</span>/50</small></label></section><section class="card settings-card"><h2>계정 정보</h2><div class="setting-row"><div><span class="small muted">이메일 주소</span><p class="account-value">${esc(state.profile.email)}</p></div></div></section><div class="form-actions"><a class="btn secondary" href="#/settings">취소</a><button class="btn primary" type="submit">${icon('save')} 변경사항 저장하기</button></div></form><div class="tip row space-top"><span class="icon-bubble">${icon('shield')}</span><div><h3>개인정보 보호 및 데이터 보안</h3><p class="muted">프로필은 이 브라우저에, 퀘스트와 성장 기록은 MySQL에 저장됩니다.</p><a class="blue small" href="#/settings">보안 설정 더보기 ›</a></div></div></div>`;
}
function detail(id) {
 const t=state.tasks.find(t=>t.id===id),s=stats(state);if(!t)return `<div class="empty"><h2>삭제되었거나 존재하지 않는 퀘스트예요.</h2><a href="#/tasks" class="btn primary space-top">내 할 일 목록으로 돌아가기</a></div>`;
 const checks=t.checks.filter(x=>x.done).length;
 return `<div class="detail-head"><div><div class="breadcrumb"><a href="#/tasks">내 할 일</a>　›　퀘스트 세부 설정</div><h1>오늘의 퀘스트를 다듬어보세요</h1></div><div class="row"><button class="btn secondary" data-action="save-task" data-id="${t.id}">변경사항 임시저장</button><button class="btn primary" data-action="complete-detail" data-id="${t.id}">${icon('check')} ${t.done?'이미 완료한 퀘스트':'오늘 즉시 완료 체크'}</button></div></div><div class="columns"><div class="stack"><section class="card"><div class="row wrap"><span class="pill">${esc(t.category)} · 나의 성장</span><span class="pill gray">${esc(t.schedule)}</span><span class="pill">${icon('bolt')} 기본 +${t.xp} XP</span></div><label class="field space-top" style="margin-bottom:0"><span class="small muted">퀘스트 제목</span><input id="detail-title" class="detail-title" maxlength="72" required value="${esc(t.title)}"></label><label class="field space-top" style="margin-bottom:0"><span class="small muted">상세 메모</span><textarea id="detail-note" maxlength="1000">${esc(t.note)}</textarea></label><div class="detail-metrics"><div class="soft-box"><span class="small muted">예상 소요 시간</span><strong>50분 (2 뽀모도로)</strong></div><div class="soft-box"><span class="small muted">연결 역량 뱃지</span><strong>${esc(t.category)} 전문가</strong></div><div class="soft-box"><span class="small muted">체크리스트 기록</span><strong class="blue">추가 경험치 없음</strong></div></div></section><section class="card"><div class="row"><span class="icon-bubble">${icon('clock')}</span><div><h2>집중 타이머 연동</h2><p class="small muted">25분 동안 몰입하고 작은 성취를 쌓아보세요.</p></div></div><div class="timer-box"><div class="timer-ring" id="timer-display">${timerText(t.id)}</div><div class="grow"><span class="small blue">나를 위한 집중 시간</span><h3 style="margin-top:6px">한 번에 하나씩, 천천히</h3><p class="small muted">${state.settings.focus?'집중 모드가 켜져 있어요.':'지금 이 순간에 집중해보세요.'}</p></div><button class="btn primary" data-action="timer" data-id="${t.id}" id="timer-button">${icon(timer.running&&timer.taskId===t.id?'pause':'play')} ${timer.running&&timer.taskId===t.id?'일시정지':'타이머 시작'}</button><button class="icon-button" data-action="reset-timer" data-id="${t.id}" aria-label="타이머 초기화">${icon('reset')}</button></div></section><section class="card"><div class="row between"><div><h2>실행 세부 체크리스트</h2><p class="small muted" style="margin-top:5px">체크리스트는 이 브라우저에 저장돼요. 경험치는 퀘스트 완료 시 지급됩니다.</p></div><span class="pill">진행도 ${checks}/${t.checks.length}</span></div><div class="checklist">${t.checks.map(c=>`<div class="check-item"><button class="check ${c.done?'checked':''}" data-action="check-item" data-id="${t.id}" data-check="${c.id}" aria-label="${esc(c.text)} ${c.done?'완료 취소':'완료'}" aria-pressed="${c.done}">${c.done?icon('check'):''}</button><span class="grow ${c.done?'done':''}">${esc(c.text)}</span><span class="small muted">개인 기록</span><button class="icon-button" data-action="delete-check" data-id="${t.id}" data-check="${c.id}" aria-label="${esc(c.text)} 삭제">${icon('close')}</button></div>`).join('')||'<p class="small muted">작게 나눠서 시작해볼까요? 첫 번째 단계를 추가해보세요.</p>'}</div><form id="subtask-form" class="subtask-form" data-id="${t.id}"><input name="text" required maxlength="150" aria-label="추가할 하위 작업" placeholder="추가할 하위 작업을 입력하세요..."><button class="btn secondary" type="submit">${icon('plus')} 추가</button></form></section><div class="detail-actions"><a class="btn secondary" href="#/tasks">내 할 일 목록으로 돌아가기</a><div class="row"><button class="btn ghost" data-action="delete-task" data-id="${t.id}">퀘스트 삭제</button><button class="btn primary" data-action="save-task-close" data-id="${t.id}">설정 저장 완료</button></div></div></div><aside class="stack"><section class="card"><div class="row between"><h3>오늘의 퀘스트 현황</h3><span class="small blue">${s.rate}% 달성</span></div><div class="space-top">${progress(s.rate)}</div><div class="metrics"><div class="metric"><span>완료한 퀘스트</span><strong style="font-size:21px">${s.done}<small>/ ${s.total}개</small></strong></div><div class="metric"><span>획득 예정 XP</span><strong class="blue" style="font-size:21px">${state.tasks.filter(x=>!x.done).reduce((n,x)=>n+x.xp,0)}<small>XP</small></strong></div></div></section><section class="card"><div class="row between small muted"><span>이번 주 나의 목표</span>${icon('flag')}</div><h3 class="space-top">매일의 작은 실천을 습관으로</h3><p class="small muted" style="margin-top:12px">차근차근 완료하며 나만의 성장 여정을 이어가세요.</p><div class="soft-box row between small space-top"><span>오늘 달성도 (${s.done}/${s.total})</span><b class="blue">${s.rate}%</b></div></section><section class="tip"><h3 class="blue">${icon('bulb')} 빠른 실행 팁</h3><p class="muted" style="margin-top:13px">부담스럽다면 ‘3분 동안만 시작하기’를 목표로 해보세요. 시작이 쌓이면 어느새 습관이 됩니다.</p><div class="soft-box row between space-top" style="background:white"><span class="small muted">집중 모드</span><button class="blue small" data-action="focus">${state.settings.focus?'설정 끄기':'설정 켜기'}</button></div></section></aside></div>`;
}
function login() {
 const signup=authMode==='signup';
 return `<div class="auth-wrap"><div class="auth-brand"><a href="#/"><img src="./icon.svg" alt="LifeQuest"><h1>LifeQuest</h1></a><p>매일의 성장을 경험으로 만드는 곳</p></div><div class="auth-tabs"><button class="${!signup?'active':''}" data-action="auth-tab" data-value="login">로그인</button><button class="${signup?'active':''}" data-action="auth-tab" data-value="signup">회원가입</button></div><form id="auth-form">${signup?'<label class="field">이름<input name="name" required minlength="2" maxlength="12" placeholder="어떻게 불러드릴까요?" autocomplete="nickname"></label>':''}<label class="field">이메일<input name="email" type="email" required placeholder="example@lifequest.io" autocomplete="email"></label><label class="field">비밀번호<div class="password-wrap"><input name="password" type="password" required minlength="8" maxlength="72" placeholder="영문, 숫자 포함 8자 이상" autocomplete="${signup?'new-password':'current-password'}"><button class="icon-button" type="button" data-action="reveal" aria-label="비밀번호 표시">${icon('eye')}</button></div></label>${signup?'<label class="field">비밀번호 확인<input name="confirm" type="password" required minlength="8" maxlength="72" placeholder="비밀번호를 한 번 더 입력해주세요" autocomplete="new-password"></label><label class="checkbox-label"><input name="agree" type="checkbox" required>서비스 이용약관 및 개인정보 처리방침에 동의합니다.</label>':`<div class="row between"></div>`}<p class="error" id="auth-error" role="alert"></p><button class="btn primary full" type="submit">${signup?'회원가입':'로그인'} ${icon('chevron')}</button></form><p class="auth-extra">${signup?'이미 계정이 있으신가요?':'아직 계정이 없으신가요?'} <button data-action="auth-tab" data-value="${signup?'login':'signup'}">${signup?'로그인하기':'회원가입하기'}</button></p></div>`;
}
function openModal(content,wide=false) { lastFocus=document.activeElement; modal.innerHTML=content; modal.style.width=wide?'min(660px, calc(100vw - 32px))':'';if(!modal.open)modal.showModal(); document.body.style.overflow='hidden'; }
function closeModal() { modal.close();document.body.style.overflow='';lastFocus?.focus?.(); }
modal.addEventListener('close',()=>{document.body.style.overflow='';});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
function modalHeader(title,subtitle='') {return `<div class="modal-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close" aria-label="닫기">${icon('close')}</button></div>`;}
function radioChips(name,values,selected) {return `<div class="chips radio-chips">${values.map(v=>`<label class="chip"><input type="radio" name="${name}" value="${v}" ${String(v)===String(selected)?'checked':''}>${name==='xp'?`${{10:'쉬움',30:'보통',50:'어려움'}[v]} · +${v} XP`:v}</label>`).join('')}</div>`;}
function addModal(task=null) {
 openModal(`<div class="eyebrow">${icon('check')} QUICK QUEST</div>${modalHeader(task?'할 일 수정':'새로운 할 일 등록','매일의 작은 실천이 모여 큰 레벨업이 됩니다.')}<form id="task-form" data-id="${task?.id||''}"><label class="field"><span class="field-caption">할 일 이름 <span class="blue">*</span></span><input name="title" value="${esc(task?.title||'')}" required maxlength="72" placeholder="예: 알고리즘 문제 2개 풀기" autofocus></label><div class="field">카테고리${radioChips('category',categories,task?.category||'개발')}</div><label class="field"><span class="field-caption">상세 메모 <small>(선택)</small></span><textarea name="note" maxlength="1000" placeholder="목표를 조금 더 구체적으로 적어보세요">${esc(task?.note||'')}</textarea></label><div class="field">언제 실천할까요?${radioChips('schedule',['오늘 마감','매일 반복','주간 목표'],task?.schedule||'오늘 마감')}</div><div class="field">완료 보상${task?.done?`<p class="small muted">완료한 퀘스트의 보상은 ${task.xp} XP로 고정됩니다.</p>`:radioChips('xp',[10,30,50],task?.xp||30)}</div><div class="form-actions"><button type="button" class="btn secondary" data-action="close">취소</button><button type="submit" class="btn primary">${icon(task?'save':'plus')} ${task?'변경사항 저장':'할 일 추가하기'}</button></div></form>`,true);
}
function info(kind) {
 const content={terms:['Terms','LifeQuest','Manage your tasks and progress.',''],privacy:['Privacy','Data storage','Accounts, quests and progress are stored in the database.','Profile details and notes are stored in this browser.'],support:['Support','LifeQuest','Create and complete tasks to track your progress.','']};
 const [title,sub,...paragraphs]=content[kind];openModal(`${modalHeader(title,sub)}<div class="modal-text legal">${paragraphs.map(p=>`<p>${p}</p>`).join('')}</div><button class="btn primary full space-top" data-action="close">확인</button>`);
}
function confirmModal(title,text,action,id='',label='확인') {openModal(`${modalHeader(title)}<p class="modal-text">${text}</p><div class="form-actions"><button class="btn secondary" data-action="close">취소</button><button class="btn ${action.includes('delete')?'danger':'primary'}" data-action="${action}" data-id="${id}">${label}</button></div>`);}
function captureDetail() {const t=state.tasks.find(t=>currentRoute()===`/task/${t.id}`); const title=document.querySelector('#detail-title'),note=document.querySelector('#detail-note');if(t&&title){if(!title.value.trim()){title.setCustomValidity('퀘스트 제목을 입력해주세요.');title.reportValidity();return false;}t.title=title.value.trim();t.note=note.value.trim();}return true;}
function timerText(id) {const seconds=timer.taskId===id?timer.remaining:1500;return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
setInterval(()=>{if(!timer.running)return;timer.remaining=Math.max(0,Math.ceil((timer.end-Date.now())/1000));const el=document.querySelector('#timer-display');if(el&&currentRoute()===`/task/${timer.taskId}`)el.textContent=timerText(timer.taskId);if(timer.remaining===0){timer.running=false;document.body.classList.remove('focus-mode');toast('25분 집중 완료! 잠깐 쉬고 체크리스트를 완료해보세요.');if(currentRoute()===`/task/${timer.taskId}`){captureDetail();render();}}},250);

document.addEventListener('click', async e=>{
 if(e.target.closest('.skip')){e.preventDefault();const main=document.querySelector('#main');main?.setAttribute('tabindex','-1');main?.focus();return;}
 const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.dataset.id,value=b.dataset.value;
 if(a==='category-link'){filter=value;return;}
 e.preventDefault();
 const task=state.tasks.find(t=>t.id===id);
 try {
 switch(a){
 case 'reconnect':await connect();break;
 case 'install-app': {
  if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) {
   toast('이미 앱으로 사용하고 있어요.'); break;
  }
  if (installPrompt) {
   const prompt = installPrompt; installPrompt = null;
   await prompt.prompt();
  } else {
   openModal(`${modalHeader('홈 화면에 LifeQuest 추가하기')}<div class="modal-text legal"><p><b>iPhone / iPad:</b> Safari에서 공유 버튼을 누르고 ‘홈 화면에 추가’를 선택하세요.</p><p><b>Android:</b> Chrome 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.</p><p>설치 메뉴는 브라우저와 기기 설정에 따라 다를 수 있어요. 퀘스트를 이용하려면 인터넷 연결이 필요합니다.</p></div><button class="btn primary full space-top" data-action="close">확인</button>`);
  }
  break;
 }
 case 'close':closeModal();break;
 case 'add':addModal();break;
 case 'dismiss-banner':state.banner=false;save();render();break;
 case 'home-filter':homeFilter=value;render();break;
 case 'filter':filter=value;render();break;
 case 'quick-category':quickCategory=value;b.parentElement.querySelectorAll('button').forEach(el=>el.classList.toggle('active',el===b));break;
 case 'complete':case 'complete-detail':{if(!task)break;if(a==='complete-detail'&&!captureDetail())break;if(task.done){toast('이미 완료한 퀘스트예요. 경험치는 한 번만 지급됩니다.');break;}const before=state.user.level;if(await mutate(async()=>{if(a==='complete-detail')await api.update(task);const result=await api.complete(id);Object.assign(task,toTask(result,task));})){if(state.settings.rewards)toast(state.user.level>before?`레벨 ${state.user.level} 달성! +${task.xp} XP 🎉`:`퀘스트 완료! +${task.xp} XP를 획득했어요 🎉`);}break;}
 case 'star':if(task){task.star=!task.star;save();render();toast(task.star?'중요한 퀘스트로 표시했어요.':'중요 표시를 해제했어요.');}break;
 case 'task-menu':if(task)openModal(`${modalHeader('퀘스트 관리',esc(task.title))}<div class="menu-list"><button class="btn secondary" data-action="open-task" data-id="${id}">${icon('edit')} 상세 보기 및 타이머</button><button class="btn secondary" data-action="edit-task" data-id="${id}">${icon('edit')} 내용 수정</button><button class="btn secondary" data-action="duplicate" data-id="${id}">${icon('plus')} 복제하기</button><button class="btn danger" data-action="delete-task" data-id="${id}">${icon('trash')} 삭제하기</button></div>`);break;
 case 'open-task':if(modal.open)closeModal();go(`/task/${id}`);break;
 case 'edit-task':if(task)addModal(task);break;
 case 'duplicate':if(task){if(await mutate(async()=>{const copy=createTask({...task,title:`${task.title.slice(0,94)} (복사)`});copy.checks=task.checks.map(c=>({...c,id:crypto.randomUUID(),done:false}));state.tasks.push(toTask(await api.create(copy),copy));})){closeModal();toast('퀘스트를 복제했어요.');}}break;
 case 'delete-task':if(task)confirmModal('퀘스트를 삭제할까요?',`‘${esc(task.title)}’와 하위 체크리스트가 삭제되며, 이미 획득한 경험치는 유지됩니다.`,'confirm-delete-task',id,'삭제하기');break;
 case 'confirm-delete-task':if(await mutate(async()=>{await api.remove(id);state.tasks=state.tasks.filter(t=>t.id!==id);})){if(timer.taskId===id)timer={taskId:null,remaining:1500,running:false,end:null};closeModal();currentRoute().startsWith('/task/')?go('/tasks'):render();toast('퀘스트를 삭제했어요. 획득한 경험치는 유지됩니다.');}break;
 case 'save-task':case 'save-task-close':if(task&&captureDetail()){if(await mutate(async()=>{Object.assign(task,toTask(await api.update(task),task));})){toast('퀘스트 설정을 저장했어요.');if(a==='save-task-close')go('/tasks');}}break;
 case 'check-item':if(task&&captureDetail()){const c=task.checks.find(c=>c.id===b.dataset.check);if(c){c.done=!c.done;save();render();toast(c.done?'체크리스트에 완료를 기록했어요.':'체크를 취소했어요.');}}break;
 case 'delete-check':if(task&&captureDetail()){task.checks=task.checks.filter(c=>c.id!==b.dataset.check);save();render();toast('하위 작업을 삭제했어요.');}break;
 case 'timer':if(captureDetail()){if(timer.taskId!==id){timer={taskId:id,remaining:1500,running:false,end:null};}timer.running=!timer.running;if(timer.running){if(!timer.remaining)timer.remaining=1500;timer.end=Date.now()+timer.remaining*1000;}render();toast(timer.running?'25분 집중 시간을 시작해요.':'타이머를 잠시 멈췄어요.');}break;
 case 'reset-timer':if(captureDetail()){timer={taskId:id,remaining:1500,running:false,end:null};render();toast('타이머를 25분으로 초기화했어요.');}break;
 case 'focus':captureDetail();state.settings.focus=!state.settings.focus;save();render();toast(state.settings.focus?'집중 모드를 켰어요. 타이머 실행 중 주변 UI가 흐려집니다.':'집중 모드를 껐어요.');break;
 case 'toggle-setting':state.settings[value]=!state.settings[value];save();render();toast('알림 설정을 저장했어요.');break;
 case 'profile-menu':openModal(`${modalHeader(esc(state.profile.name),'오늘도 나의 속도로 성장해요.')}<div class="menu-list"><a class="btn secondary" href="#/profile" data-action="navigate" data-value="/profile">${icon('edit')} 프로필 수정</a><a class="btn secondary" href="#/settings" data-action="navigate" data-value="/settings">${icon('shield')} 설정 및 보안</a><button class="btn ghost" data-action="logout">${icon('logout')} 로그아웃</button></div>`);break;
 case 'navigate':closeModal();go(value);break;
 case 'photo':choosePhoto();break;
 case 'reset-photo':avatarDraft='';document.querySelector('#avatar-preview').innerHTML=`<span class="avatar xlarge">${esc(state.profile.name.slice(0,2))}</span>`;toast('저장하면 기본 이미지가 적용돼요.');break;
 case 'export':{const data={...state,account:undefined,exportedAt:new Date().toISOString()};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`lifequest-backup-${dayKey()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('내 퀘스트와 프로필을 내보냈어요.');break;}
 case 'logout': await request('/auth/logout',{method:'POST'}); serverReady=false; state=initialState(); cachedTasks=[]; timer.running=false; if(modal.open)closeModal(); go('/login'); toast('\uB85C\uADF8\uC544\uC6C3\uD588\uC5B4\uC694.'); break;
 case 'confirm-logout':request('/auth/logout',{method:'POST'}).catch(()=>{});serverReady=false;state=initialState();localStorage.removeItem('lifequest.session');sessionStorage.removeItem('lifequest.session');timer.running=false;closeModal();go('/login');toast('로그아웃했어요.');break;
 case 'info':info(b.dataset.kind);break;
 case 'achievement':openModal(`${modalHeader(value)}<div class="icon-bubble square">${icon('medal')}</div><p class="modal-text space-top">경험치 1,500 XP를 모아 레벨 7 Explorer에 도달했어요. 오늘의 작은 성취를 계속 이어가보세요.</p><p class="small muted space-top">이전 활동을 보여주는 예시 기록입니다.</p><button class="btn primary full space-top" data-action="close">계속 성장하기</button>`);break;
 case 'badge':{const texts={'루틴 정복자':'5일 연속으로 할 일을 완료하면 받을 수 있어요.','열정 코더':'개발 카테고리 퀘스트 20개 완료를 기념하는 뱃지예요.','스프린터':'집중 타이머로 나만의 몰입 시간을 만들어보세요.','Lv.10 도전':'레벨 10에 도달하면 열리는 새로운 도전이에요.'};openModal(`${modalHeader(value)}<div class="icon-bubble square">${icon(value==='Lv.10 도전'?'lock':'medal')}</div><p class="modal-text space-top">${texts[value]}</p><p class="small muted space-top">뱃지 컬렉션 미리보기</p><button class="btn primary full space-top" data-action="close">확인</button>`);break;}
 case 'auth-tab':authMode=value;render();break;
 case 'signup':authMode='signup';if(modal.open)closeModal();go('/login');break;
 case 'reveal':{const input=b.previousElementSibling;input.type=input.type==='password'?'text':'password';b.setAttribute('aria-label',input.type==='password'?'비밀번호 표시':'비밀번호 숨기기');b.setAttribute('aria-pressed',input.type==='text');break;}
 }
 } catch(error) { toast(error.message || '요청을 처리하지 못했어요.'); }
});
document.addEventListener('change',e=>{if(e.target.id==='sort'){sort=e.target.value;render();}if(e.target.id==='period'){period=Number(e.target.value);render();}});
document.addEventListener('input',e=>{if(e.target.id==='detail-title')e.target.setCustomValidity('');if(e.target.closest('#profile-form')){const count=document.querySelector(`#${e.target.name==='name'?'name':e.target.name==='message'?'message':'none'}-count`);if(count)count.textContent=e.target.value.length;}});
document.addEventListener('submit', async e=>{
 const form=e.target, data=new FormData(form);e.preventDefault();
 try {
 if(form.id==='task-form'){const values=Object.fromEntries(data);const existing=state.tasks.find(t=>t.id===form.dataset.id);if(existing?.done)values.xp=existing.xp;const fresh=createTask(values),t=state.tasks.find(t=>t.id===form.dataset.id);if(await mutate(async()=>{if(t){const updated={...t,title:fresh.title,note:fresh.note,category:fresh.category,schedule:fresh.schedule,xp:fresh.xp};Object.assign(t,toTask(await api.update(updated),updated));}else state.tasks.push(toTask(await api.create(fresh),fresh));})){closeModal();filter='전체';render();toast(t?'퀘스트를 수정했어요.':'새로운 퀘스트를 추가했어요!');}}
 if(form.id==='quick-form'){const task=createTask({title:data.get('title'),category:quickCategory,xp:30});if(await mutate(async()=>{state.tasks.push(toTask(await api.create(task),task));})){filter='전체';render();toast('새로운 퀘스트를 추가했어요!');}}
 if(form.id==='subtask-form'){if(!captureDetail())return;const text=String(data.get('text')).trim();if(!text)throw Error('하위 작업을 입력해주세요.');const task=state.tasks.find(t=>t.id===form.dataset.id);task.checks.push({id:crypto.randomUUID(),text,done:false});save();render();toast('하위 작업을 추가했어요.');}
 if(form.id==='profile-form'){const name=String(data.get('name')).trim();if(name.length<2)throw Error('닉네임을 2자 이상 입력해주세요.');Object.assign(state.profile,{name,job:String(data.get('job')).trim(),message:String(data.get('message')).trim(),avatar:avatarDraft});if(save()){go('/settings');toast('프로필을 저장했어요.');}}
 if(form.id==='email-form'){state.profile.email=String(data.get('email')).trim().toLowerCase();if(state.account)state.account.email=state.profile.email;save();closeModal();render();toast('프로필 이메일을 변경했어요.');}
 if(form.id==='auth-form')await handleAuth(form,data);
 } catch(error) {toast(error.message||'입력 내용을 다시 확인해주세요.');}
});
const validPassword=pw=>pw.length>=8&&/[a-zA-Z]/.test(pw)&&/\d/.test(pw);
async function hashPassword(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),{name:'PBKDF2'},false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');}
async function handleAuth(form,data){
 const email=String(data.get('email')).trim().toLowerCase(), password=String(data.get('password')), error=document.querySelector('#auth-error');
 try {
  if(authMode==='signup') {
   if(!validPassword(password) || password !== data.get('confirm')) { error.textContent='\uBE44\uBC00\uBC88\uD638\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694.'; return; }
   await request('/auth/signup',{method:'POST',body:JSON.stringify({email,password,name:String(data.get('name')).trim()})});
   authMode='login'; render(); toast('\uD68C\uC6D0\uAC00\uC785\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.'); return;
  }
  const user=await request('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
  loadUserState(user); state.profile.email=email;
  await refreshRemote(); go('/'); toast(`${user.username}\uB2D8, \uD658\uC601\uD569\uB2C8\uB2E4.`);
 } catch(e) { error.textContent=e.message; }
}
function choosePhoto(){
 const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
 input.addEventListener('change',()=>{const file=input.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('JPG, PNG, WebP 이미지를 선택해주세요.');return;}if(file.size>5*1024*1024){toast('5MB 이하의 사진을 선택해주세요.');return;}
 const reader=new FileReader();reader.onload=()=>{const picture=new Image();picture.onload=()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=240;const ctx=canvas.getContext('2d');const side=Math.min(picture.width,picture.height);ctx.drawImage(picture,(picture.width-side)/2,(picture.height-side)/2,side,side,0,0,240,240);const url=canvas.toDataURL('image/jpeg',.85);if(currentRoute()==='/profile'){avatarDraft=url;document.querySelector('#avatar-preview').innerHTML=`<img class="avatar xlarge" src="${url}" alt="변경할 프로필 사진">`;toast('사진을 선택했어요. 저장하면 적용됩니다.');}else{state.profile.avatar=url;save();render();toast('프로필 사진을 변경했어요.');}};picture.onerror=()=>toast('이미지를 읽을 수 없어요. 다른 파일을 선택해주세요.');picture.src=String(reader.result);};reader.readAsDataURL(file);});input.click();
}
window.addEventListener('lifequest-session-expired',()=>{ if(!serverReady)return; serverReady=false; state=initialState(); cachedTasks=[]; timer.running=false; if(modal.open)closeModal(); go('/login'); toast('\uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC5B4\uC694. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574\uC8FC\uC138\uC694.'); });
window.addEventListener('hashchange',()=>{if(modal.open)closeModal();render();window.scrollTo({top:0});});
connect();
