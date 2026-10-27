export const categories = ['공부', '개발', '운동', '생활', '독서'];
export const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric',month:'2-digit',day:'2-digit' }).format(date);
export function initialState() {
  return {version:1,profile:{name:'탐험가',job:'',message:'매일 조금씩 성장하기',email:'',avatar:''},settings:{reminder:true,rewards:true,report:false,focus:false},banner:true,account:null,tasks:[],user:null};
}
export function stats(state) {
  const earned = state.tasks.reduce((sum,t)=>sum+(t.done?t.xp:0),0);
  const level = state.user?.level ?? 1;
  const current = state.user?.exp ?? 0;
  const xp = (level-1)*100+current;
  const done = state.tasks.filter(t=>t.done).length;
  return {xp,level,goal:level*100,remaining:100-current,progress:current,done,total:state.tasks.length,rate:state.tasks.length?Math.round(done/state.tasks.length*100):0,earned};
}
export function createTask(values) {
  const title=String(values.title||'').trim();
  if (!title || title.length>100) throw Error('할 일 이름을 1~100자로 입력해주세요.');
  const xp=Number(values.xp ?? 30);
  if (![10,30,50].includes(xp)) throw Error('경험치는 10, 30, 50 XP 중 선택해주세요.');
  return {id:crypto.randomUUID(),title,category:categories.includes(values.category)?values.category:'공부',xp,note:String(values.note||'').trim().slice(0,1000),schedule:['오늘 마감','매일 반복','주간 목표'].includes(values.schedule)?values.schedule:'오늘 마감',date:dayKey(),done:false,star:false,checks:[]};
}
