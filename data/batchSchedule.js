export const WEEK_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIMES = ["9:00 AM TO 10:00 AM","10:00 AM TO 11:00 AM","11:00 AM TO 12:00 PM","12:00 PM TO 1:00 PM","1:00 PM TO 2:00 PM","2:00 PM TO 3:00 PM","3:00 PM TO 4:00 PM","4:00 PM TO 5:00 PM","5:00 PM TO 6:00 PM","6:00 PM TO 7:00 PM"];
const SLOTS = ["T1","T2","L1/L2","L3/L4"];

function makePair(a, b, swap) { return swap ? [b[0],b[1],a[0],a[1]] : [a[0],a[1],b[0],b[1]]; }
function makeABRow(hour, dayIndex) {
  const base = 1 + dayIndex * 8;
  if (hour >= 8) {
    const s = 1 + dayIndex * 4;
    const a = [`S${s}`,`S${s+2}`], b = [`S${s+1}`,`S${s+3}`];
    const vals = makePair(a,b,hour === 9);
    return Object.fromEntries(SLOTS.map((k,i)=>[k,vals[i]]));
  }
  const pair = Math.floor(hour / 2) * 2 + 1;
  const a = [`A${base + pair - 1}`,`A${base + pair}`];
  const b = [`B${base + pair - 1}`,`B${base + pair}`];
  const vals = makePair(a,b,hour % 2 === 1);
  return Object.fromEntries(SLOTS.map((k,i)=>[k,vals[i]]));
}
function makeCRow(hour) {
  const pair = Math.floor(hour / 2) * 4 + 1;
  const a = [`C${pair}`,`C${pair+1}`], b = [`C${pair+2}`,`C${pair+3}`];
  const vals = makePair(a,b,hour % 2 === 1);
  return Object.fromEntries(SLOTS.map((k,i)=>[k,vals[i]]));
}

// Exact logical representation of BATCH SCHEDULE COMPLETED.xlsx supplied for RCLD.
export const WEEKLY_SERIES_TABLE = TIMES.map((time, hour) => ({
  time,
  days: Object.fromEntries(WEEK_DAYS.map((day, dayIndex) => [
    day,
    day === "Sunday" ? makeCRow(hour) : makeABRow(hour, dayIndex)
  ]))
}));

export const SERIES_CATALOG = Array.from(new Set(
  WEEKLY_SERIES_TABLE.flatMap((row) => WEEK_DAYS.flatMap((day) => Object.values(row.days[day] || {})))
)).filter(Boolean).sort((a,b) => a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1)));

export function getSeriesSlots(series) {
  return WEEKLY_SERIES_TABLE.flatMap((row) => WEEK_DAYS.flatMap((day) => {
    const room = Object.entries(row.days[day] || {}).find(([, value]) => value === series);
    return room ? [{ day, time: row.time, slot: room[0], series }] : [];
  }));
}
