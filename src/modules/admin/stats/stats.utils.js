// modules/admin/stats/stats.utils.js

/* ==================================================
   DATE RANGE HELPERS
================================================== */

export const rangeFromDate = (dateStr) => {
  const start = new Date(dateStr);

  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return { start, end };
};

export const rangeFromMonth = (
  monthStr
) => {
  const [year, month] =
    monthStr.split("-").map(Number);

  const start = new Date(
    year,
    month - 1,
    1
  );

  const end = new Date(
    year,
    month,
    1
  );

  return { start, end };
};

export const isoWeekStart = (
  year,
  week
) => {
  const simple = new Date(
    year,
    0,
    1 + (week - 1) * 7
  );

  const dow = simple.getDay();

  const ISOweekStart = simple;

  if (dow <= 4) {
    ISOweekStart.setDate(
      simple.getDate() -
        simple.getDay() +
        1
    );
  } else {
    ISOweekStart.setDate(
      simple.getDate() +
        8 -
        simple.getDay()
    );
  }

  return ISOweekStart;
};

export const rangeFromWeek = (
  weekStr
) => {
  const [year, week] =
    weekStr
      .replace("W", "-")
      .split("-");

  const start = isoWeekStart(
    Number(year),
    Number(week)
  );

  const end = new Date(start);

  end.setDate(end.getDate() + 7);

  return { start, end };
};
