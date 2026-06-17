const WorkCalendarHoliday = require("../models/WorkCalendarHoliday");

const WEEKLY_OFF_DAYS = [0, 6]; // Sunday, Saturday

const parseDateKeyAsUtcDate = (dateKey) => {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const isWeeklyOffDateKey = (dateKey) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return false;
  return WEEKLY_OFF_DAYS.includes(parseDateKeyAsUtcDate(dateKey).getUTCDay());
};

const getDateKeysBetween = (from, to) => {
  const keys = [];
  let cursor = parseDateKeyAsUtcDate(from);
  const end = parseDateKeyAsUtcDate(to);

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return keys;
};

const loadHolidayMap = async (dateKeys = []) => {
  const uniqueDateKeys = [...new Set(dateKeys.filter(Boolean))];
  if (!uniqueDateKeys.length) return new Map();

  const holidays = await WorkCalendarHoliday.find({ dateKey: { $in: uniqueDateKeys } }).lean();
  return new Map(holidays.map((holiday) => [holiday.dateKey, holiday]));
};

const getCalendarDay = (dateKey, holidayMap = new Map()) => {
  const customHoliday = holidayMap.get(dateKey);
  if (customHoliday) {
    return {
      isNonWorkingDay: true,
      status: "holiday",
      label: customHoliday.name || "Holiday",
      holiday: customHoliday,
    };
  }

  if (isWeeklyOffDateKey(dateKey)) {
    return {
      isNonWorkingDay: true,
      status: "off_day",
      label: "Weekly off",
      holiday: null,
    };
  }

  return {
    isNonWorkingDay: false,
    status: null,
    label: "",
    holiday: null,
  };
};

const getAttendanceStatusForCalendarDay = (baseStatus, workedSeconds, calendarDay) => {
  if (!calendarDay?.isNonWorkingDay) return baseStatus;
  return workedSeconds > 0 ? "worked_on_holiday" : calendarDay.status;
};

module.exports = {
  WEEKLY_OFF_DAYS,
  getAttendanceStatusForCalendarDay,
  getCalendarDay,
  getDateKeysBetween,
  isWeeklyOffDateKey,
  loadHolidayMap,
};
