import type { PlannerDestination } from "@/lib/planner/types";

type OpeningStatus = "open" | "closed" | "unknown";

type OpeningInfo = {
  status: OpeningStatus;
  openingHoursText: string | null;
  note: string | null;
};

function parseMonthDayDate(month: string, day: string, referenceYear: number) {
  return new Date(referenceYear, Number(month) - 1, Number(day));
}

function inRange(target: Date, start: Date, end: Date) {
  return target >= start && target <= end;
}

function normalizeTargetDate(travelDate: string) {
  const [yearText, monthText, dayText] = travelDate.split("-");
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function extractOpeningText(destination: PlannerDestination) {
  const sourceLines = [...destination.scenicFeatures, ...destination.closureRiskNotes];
  const match = sourceLines.find((line) => /开放时间|营业时间|闭园|全天开放|入园/.test(line));
  return match ? match.replace(/^(开放时间|营业时间)[:：]\s*/, "").trim() : null;
}

function parseSegmentStatus(segment: string, targetDate: Date) {
  const fullDateMatch = segment.match(/(\d{4})-(\d{2})-(\d{2})\s*至\s*(\d{4})-(\d{2})-(\d{2})/);
  if (fullDateMatch) {
    const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = fullDateMatch;
    const start = new Date(Number(startYear), Number(startMonth) - 1, Number(startDay));
    const end = new Date(Number(endYear), Number(endMonth) - 1, Number(endDay));
    if (inRange(targetDate, start, end)) {
      return /闭园|暂停开放|停业/.test(segment) ? "closed" : "open";
    }
  }

  const monthDayMatch = segment.match(/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})/);
  if (monthDayMatch) {
    const [, startMonth, startDay, endMonth, endDay] = monthDayMatch;
    const year = targetDate.getFullYear();
    const start = parseMonthDayDate(startMonth, startDay, year);
    const end = parseMonthDayDate(endMonth, endDay, year);
    if (inRange(targetDate, start, end)) {
      return /闭园|暂停开放|停业/.test(segment) ? "closed" : "open";
    }
  }

  if (/全年全天开放|全年开放|全天开放/.test(segment)) return "open";
  if (/闭园|暂停开放|停业/.test(segment)) return "closed";
  return null;
}

export function evaluateOpeningStatus(destination: PlannerDestination, travelDate: string): OpeningInfo {
  const openingHoursText = extractOpeningText(destination);
  if (!openingHoursText) {
    return { status: "unknown", openingHoursText: null, note: null };
  }

  const targetDate = normalizeTargetDate(travelDate);
  const segments = openingHoursText.split(/[；。]/).map((item) => item.trim()).filter(Boolean);

  for (const segment of segments) {
    const status = parseSegmentStatus(segment, targetDate);
    if (!status) continue;

    if (status === "closed") {
      return {
        status,
        openingHoursText,
        note: `按已记录的开放时间判断，${destination.name} 在 ${travelDate} 可能闭园或不对外开放。`
      };
    }

    return {
      status,
      openingHoursText,
      note: `开放时间参考：${openingHoursText}`
    };
  }

  if (/全天开放|开放/.test(openingHoursText)) {
    return {
      status: "open",
      openingHoursText,
      note: `开放时间参考：${openingHoursText}`
    };
  }

  return { status: "unknown", openingHoursText, note: null };
}
