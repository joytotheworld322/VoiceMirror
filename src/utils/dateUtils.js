export function isWithinWeeks(isoString, weeks) {
  if (!isoString) return false;
  const date    = new Date(isoString);
  const cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  return date >= cutoff;
}

export function getWeekStart() {
  const now  = new Date();
  const day  = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const mon  = new Date(now);
  mon.setDate(now.getDate() - diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

export function formatDate(isoString) {
  const d = new Date(isoString);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}
