export const WEEK_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const TIMES = ["9:00 AM TO 10:00 AM","10:00 AM TO 11:00 AM","11:00 AM TO 12:00 PM","12:00 PM TO 1:00 PM","1:00 PM TO 2:00 PM","2:00 PM TO 3:00 PM","3:00 PM TO 4:00 PM","4:00 PM TO 5:00 PM","5:00 PM TO 6:00 PM","6:00 PM TO 7:00 PM"];
const SLOTS = ["T1","T2","L1/L2","L3/L4"];

function makeABRow(hour, dayIndex) {
  const base = 1 + dayIndex * 8;

  if (hour >= 8) {
    const s = 1 + dayIndex * 4;
    return {
      T1: `S${s}`,
      T2: `S${s + 1}`,
      "L1/L2": `S${s + 2}`,
      "L3/L4": `S${s + 3}`,
    };
  }

  const pair = Math.floor(hour / 2) * 2 + 1;
  const firstNumber = base + pair - 1;
  const secondNumber = base + pair;

  // RCLD series rule:
  // A-series always belongs to T1 and L1/L2.
  // B-series always belongs to T2 and L3/L4.
  // The paired A/B series swap between theory and lab on the second hour,
  // but never cross into the other series family's slot columns.
  const swap = hour % 2 === 1;

  return {
    T1: `A${swap ? secondNumber : firstNumber}`,
    T2: `B${swap ? secondNumber : firstNumber}`,
    "L1/L2": `A${swap ? firstNumber : secondNumber}`,
    "L3/L4": `B${swap ? firstNumber : secondNumber}`,
  };
}

function makeCRow(hour) {
  const pair = Math.floor(hour / 2) * 4 + 1;
  const firstPair = [`C${pair}`, `C${pair + 1}`];
  const secondPair = [`C${pair + 2}`, `C${pair + 3}`];
  const swap = hour % 2 === 1;

  const values = swap
    ? [secondPair[0], secondPair[1], firstPair[0], firstPair[1]]
    : [firstPair[0], firstPair[1], secondPair[0], secondPair[1]];

  return Object.fromEntries(SLOTS.map((slot, index) => [slot, values[index]]));
}

export const WEEKLY_SERIES_TABLE = TIMES.map((time, hour) => ({
  time,
  days: Object.fromEntries(
    WEEK_DAYS.map((day, dayIndex) => [
      day,
      day === "Sunday" ? makeCRow(hour) : makeABRow(hour, dayIndex),
    ])
  ),
}));

export const SERIES_CATALOG = Array.from(
  new Set(
    WEEKLY_SERIES_TABLE.flatMap((row) =>
      WEEK_DAYS.flatMap((day) => Object.values(row.days[day] || {}))
    )
  )
)
  .filter(Boolean)
  .sort(
    (a, b) =>
      a[0].localeCompare(b[0]) || Number(a.slice(1)) - Number(b.slice(1))
  );

export function getSeriesSlots(series) {
  return WEEKLY_SERIES_TABLE.flatMap((row) =>
    WEEK_DAYS.flatMap((day) => {
      const room = Object.entries(row.days[day] || {}).find(
        ([, value]) => value === series
      );

      return room
        ? [{ day, time: row.time, slot: room[0], series }]
        : [];
    })
  );
}
