export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(15000)
    });
  } catch {
    throw Error('서버에 연결할 수 없어요. 연결 상태를 확인한 뒤 새로고침해주세요.');
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = Error(error.message || `요청을 처리하지 못했어요. (${response.status})`);
    failure.status = response.status;
    if (response.status === 401 && (!path.startsWith('/auth/') || path === '/auth/me' || path.startsWith('/auth/me?'))) globalThis.dispatchEvent?.(new Event('lifequest-session-expired'));
    throw failure;
  }
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

export function difficultyFor(xp) {
  const difficulty = {10:'쉬움',30:'보통',50:'어려움'}[xp];
  if (!difficulty) throw Error('보상은 쉬움 10, 보통 30, 어려움 50 XP 중 선택해주세요.');
  return difficulty;
}

export function toTask(quest, local = {}) {
  return {
    ...local,
    id: String(quest.id), title: quest.title, category: quest.category,
    xp: quest.rewardExp, difficulty: quest.difficulty, done: quest.completed,
    completedAt: quest.completedAt || null,
    date: quest.createdAt.slice(0,10),
    note: local.note || '', schedule: local.schedule || '오늘 마감',
    star: Boolean(local.star), checks: local.checks || []
  };
}

function payload(task) {
  return { title: task.title, category: task.category, difficulty: difficultyFor(task.xp) };
}

export const api = {
  user: (rememberedOnly = false) => request(rememberedOnly ? '/auth/me?rememberedOnly=true' : '/auth/me'),
  quests: () => request('/quests'),
  create: task => request('/quests', {method:'POST', body:JSON.stringify(payload(task))}),
  update: task => request(`/quests/${task.id}`, {method:'PUT', body:JSON.stringify(payload(task))}),
  complete: id => request(`/quests/${id}/complete`, {method:'POST'}),
  uncomplete: id => request(`/quests/${id}/complete`, {method:'DELETE'}),
  remove: id => request(`/quests/${id}`, {method:'DELETE'})
};
