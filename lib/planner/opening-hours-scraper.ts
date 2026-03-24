import type { PlannerDestination } from "@/lib/planner/types";

type OpeningVerification = {
  openingHoursText: string | null;
  openStatus: "open" | "closed" | "unknown";
  note: string | null;
  sourceUrl: string | null;
  verifiedAt: string;
};

function cleanHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOpeningPhrase(text: string) {
  const patterns = [
    /(开放时间[:：]?\s*[^。；<]{4,120})/,
    /(营业时间[:：]?\s*[^。；<]{4,120})/,
    /(入园时间[:：]?\s*[^。；<]{4,120})/,
    /((?:全年|今日|周一至周日|周[一二三四五六日天])[^。；<]{0,80}(?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}|全天开放|闭园))/,
    /((?:\d{2}\/\d{2}\s*-\s*\d{2}\/\d{2}|202\d-\d{2}-\d{2}\s*至\s*202\d-\d{2}-\d{2})[^。；<]{0,80}(?:\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}|开放|闭园))/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function inferOpenStatus(text: string | null) {
  if (!text) return "unknown" as const;
  if (/闭园|暂停开放|停业|休馆/.test(text)) return "closed" as const;
  if (/开放|营业|全天开放|入园/.test(text)) return "open" as const;
  return "unknown" as const;
}

export async function fetchVerifiedOpeningInfo(destination: PlannerDestination): Promise<OpeningVerification | null> {
  const sourceUrl = destination.transportLinks?.ticketBookingUrl ?? null;
  if (!sourceUrl) return null;

  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; YouXiangJiBot/1.0)"
      }
    });
    if (!response.ok) return null;

    const html = await response.text();
    const text = cleanHtmlToText(html);
    const openingHoursText = extractOpeningPhrase(text);
    if (!openingHoursText) return null;

    const openStatus = inferOpenStatus(openingHoursText);
    return {
      openingHoursText,
      openStatus,
      note: `已从外部页面校验开放信息：${openingHoursText}`,
      sourceUrl,
      verifiedAt: new Date().toISOString()
    };
  } catch {
    return null;
  }
}
