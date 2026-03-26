import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown, Compass, MapPinned, Play, Route, Sparkles } from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getCurrentUser } from "@/lib/auth";
import { RECOMMENDED_ROUTES } from "@/lib/constants";
import { getHomeData } from "@/lib/repository";
import { isLikelyImageUrl, isRemoteHttpUrl } from "@/lib/utils";
import { getXianFeaturedSpots } from "@/lib/xian-topic";
import type { RuralSpotSeed, SearchHistoryItem } from "@/types";

const HERO_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80";
const HERO_VIDEO_SRC = "/media/home-hero.mp4";
const SHOWCASE_PRIORITY = [
  "袁家村",
  "长安唐村·南堡古寨",
  "张龙村竹海驿站",
  "任陈村畅心湾田园观赏区",
  "石砭峪新村",
  "汤峪镇塘子村",
  "太阳葡萄小镇",
  "太乙驿",
  "老县城村",
  "蔡家坡村",
  "源田梦工场·田园综合体",
  "芷阳村芷硕石榴休闲观光园",
  "白鹿原影视城",
  "太白山国家森林公园",
  "法门文化景区",
  "秦始皇帝陵博物院(兵马俑)",
  "华清宫",
  "西安城墙"
];
const ROUTE_COVER_PRIORITY = [
  "袁家村",
  "长安唐村·南堡古寨",
  "张龙村竹海驿站",
  "汤峪镇塘子村",
  "任陈村畅心湾田园观赏区"
];

function uniqueSpots(spots: RuralSpotSeed[]) {
  return spots.filter((spot, index, source) => source.findIndex((item) => item.id === spot.id) === index);
}

function resolveSpotImage(spot?: RuralSpotSeed | null) {
  if (!spot) return HERO_FALLBACK_IMAGE;
  if (spot.imageUrl && isLikelyImageUrl(spot.imageUrl)) return spot.imageUrl;
  if (spot.photoUrls?.[0] && isLikelyImageUrl(spot.photoUrls[0])) return spot.photoUrls[0];
  return HERO_FALLBACK_IMAGE;
}

function hasStableShowcaseImage(spot?: RuralSpotSeed | null) {
  if (!spot) return false;
  const image = resolveSpotImage(spot);
  if (!image || image === HERO_FALLBACK_IMAGE) return false;
  if (image.startsWith("/spot-assets/xian/")) return true;
  if (image.includes("dimg04.c-ctrip.com")) return true;
  if (image.includes("images.unsplash.com")) return false;
  if (image.includes("sxhm.com")) return false;
  return !isRemoteHttpUrl(image) || image.startsWith("/");
}

function isHomeShowcaseSpot(spot: RuralSpotSeed) {
  return spot.province === "陕西省" && hasStableShowcaseImage(spot);
}

function sortShowcaseSpots(spots: RuralSpotSeed[]) {
  return [...spots].sort((left, right) => {
    const leftPriority = SHOWCASE_PRIORITY.indexOf(left.name);
    const rightPriority = SHOWCASE_PRIORITY.indexOf(right.name);
    const normalizedLeft = leftPriority === -1 ? Number.MAX_SAFE_INTEGER : leftPriority;
    const normalizedRight = rightPriority === -1 ? Number.MAX_SAFE_INTEGER : rightPriority;
    if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;

    const leftHasLocalImage = resolveSpotImage(left).startsWith("/spot-assets/xian/");
    const rightHasLocalImage = resolveSpotImage(right).startsWith("/spot-assets/xian/");
    if (leftHasLocalImage !== rightHasLocalImage) return leftHasLocalImage ? -1 : 1;

    return left.name.localeCompare(right.name, "zh-CN");
  });
}

function pickSpotWindow(spots: RuralSpotSeed[], start: number, count: number) {
  const primary = spots.slice(start, start + count);
  if (primary.length >= count) return primary;
  return uniqueSpots([...primary, ...spots]).slice(0, count);
}

function pickPreferredSpot(spots: RuralSpotSeed[], preferredNames: string[]) {
  const matched = preferredNames
    .map((name) => spots.find((spot) => spot.name === name))
    .find((spot): spot is RuralSpotSeed => Boolean(spot));

  return matched ?? spots[0] ?? null;
}

function buildRecentLabel(item: SearchHistoryItem) {
  return item.query || [item.city, item.tag, item.province].filter(Boolean).join(" / ") || "周末灵感";
}

function buildSpotMeta(spot: RuralSpotSeed) {
  return [spot.city, spot.district].filter(Boolean).join(" / ") || spot.province;
}

function buildSeasonText(bestSeason: string[]) {
  if (bestSeason.length === 0) return "四季皆宜";
  const labelMap: Record<string, string> = {
    spring: "春季",
    summer: "夏季",
    autumn: "秋季",
    winter: "冬季"
  };
  return bestSeason.map((item) => labelMap[item] || item).join(" / ");
}

function formatMetric(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export default async function HomePage() {
  const [user, xianTopic] = await Promise.all([getCurrentUser(), getXianFeaturedSpots()]);
  const { featured, popular, recentSearches, platformStats } = await getHomeData(user);

  const showcaseSpots = sortShowcaseSpots(
    uniqueSpots([
      ...xianTopic,
      ...featured.filter(isHomeShowcaseSpot),
      ...popular.filter(isHomeShowcaseSpot)
    ]).filter(hasStableShowcaseImage)
  );
  const heroSpots = showcaseSpots.length > 0 ? showcaseSpots : sortShowcaseSpots(uniqueSpots([...featured, ...popular]).filter(hasStableShowcaseImage));
  const weekendStorySpots = pickSpotWindow(heroSpots, 1, 2);
  const matrixSpots = pickSpotWindow(heroSpots, 3, 2);
  const featuredRoute = RECOMMENDED_ROUTES[0];
  const featuredRouteCover = pickPreferredSpot(heroSpots, ROUTE_COVER_PRIORITY);
  const featuredRouteSpots = uniqueSpots([
    ...heroSpots.filter((spot) => spot.id !== featuredRouteCover?.id),
    ...weekendStorySpots,
    ...matrixSpots
  ]).slice(0, 3);
  const matrixPrimary = matrixSpots[0] || heroSpots[0] || null;
  const matrixSecondary = matrixSpots[1] || heroSpots[1] || matrixPrimary;
  const matrixSupport = uniqueSpots([...weekendStorySpots, ...heroSpots.slice(0, 4)]).slice(0, 2);
  const recentKeywords = recentSearches.slice(0, 4).map(buildRecentLabel);

  return (
    <div className="pb-24">
      <section className="px-3 pt-3 sm:px-4 lg:px-6">
        <div className="norway-hero relative min-h-[calc(100vh-1.5rem)] overflow-hidden rounded-[2.6rem]">
          <div className="norway-hero-media absolute inset-0">
            <video
              className="h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={resolveSpotImage(heroSpots[0])}
            >
              <source src={HERO_VIDEO_SRC} type="video/mp4" />
            </video>
          </div>

          <div className="norway-hero-overlay absolute inset-0" />

          <div className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1560px] flex-col justify-between px-5 py-6 text-white sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <ScrollReveal className="max-w-[860px] pt-10 md:pt-16 lg:pt-20">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/16 bg-black/18 px-4 py-2 text-xs font-medium tracking-[0.24em] text-white/82 backdrop-blur-md">
                <Play className="h-3.5 w-3.5 fill-current" />
                西安周末出行
              </div>

              <h1 className="font-display mt-6 max-w-5xl text-[2.9rem] font-semibold leading-[0.98] text-white sm:text-[4.1rem] md:text-[5rem] xl:text-[6rem]">
                把周末留给
                <br />
                真正值得出发的山野、
                <br />
                村落与城外风景。
              </h1>

              <p className="mt-6 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
                从地图找方向、从景点页看细节、从智能规划选路线，把零散的周末灵感整理成一套真正能用的出行入口。
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/spots"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-brand-950 shadow-[0_20px_36px_rgba(0,0,0,0.14)]"
                >
                  开始浏览目的地
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/map"
                  className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-md"
                >
                  <MapPinned className="h-4 w-4" />
                  先看地图分布
                </Link>
                <Link
                  href="/planner"
                  className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/10 px-6 py-3 text-sm font-medium text-white backdrop-blur-md"
                >
                  <Sparkles className="h-4 w-4" />
                  让 AI 帮我选
                </Link>
              </div>
            </ScrollReveal>

            <div className="grid gap-4 pb-2 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
              <ScrollReveal className="frost-panel rounded-[2rem] p-4 sm:p-5" delay={120}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="hero-kicker">平台速览</div>
                    <div className="mt-2 text-lg font-medium text-white">先看平台热度，再决定从哪一类周末开始</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-4">
                    <div className="text-3xl font-semibold">{formatMetric(platformStats.userCount)}</div>
                    <div className="mt-1 text-sm text-white/70">已注册用户数</div>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-4">
                    <div className="text-3xl font-semibold">{formatMetric(platformStats.todayViewCount)}</div>
                    <div className="mt-1 text-sm text-white/70">当日浏览数</div>
                  </div>
                  <div className="rounded-[1.6rem] border border-white/12 bg-white/8 p-4">
                    <div className="text-3xl font-semibold">{formatMetric(platformStats.spotCount)}</div>
                    <div className="mt-1 text-sm text-white/70">已录入景点数</div>
                  </div>
                </div>

                {recentKeywords.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recentKeywords.map((keyword) => (
                      <span key={keyword} className="rounded-full border border-white/12 bg-black/16 px-3 py-1 text-xs text-white/80 backdrop-blur">
                        {keyword}
                      </span>
                    ))}
                  </div>
                ) : null}
              </ScrollReveal>

              {heroSpots[0] ? (
                <ScrollReveal className="frost-panel overflow-hidden rounded-[2rem] p-0" delay={200}>
                  <Link href={`/spots/${heroSpots[0].id}`} className="block">
                    <div className="relative h-[260px] sm:h-[320px]">
                      <Image
                        src={resolveSpotImage(heroSpots[0])}
                        alt={heroSpots[0].name}
                        fill
                        priority
                        sizes="(max-width: 1024px) 100vw, 32vw"
                        unoptimized={isRemoteHttpUrl(resolveSpotImage(heroSpots[0]))}
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <div className="text-xs uppercase tracking-[0.26em] text-white/66">{buildSpotMeta(heroSpots[0])}</div>
                        <div className="font-display mt-2 text-[2rem] font-semibold leading-tight">{heroSpots[0].name}</div>
                        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/16 bg-black/18 px-3 py-2 text-xs text-white/84 backdrop-blur">
                          <Compass className="h-3.5 w-3.5" />
                          打开景点详情
                        </div>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              ) : null}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/16 px-4 py-2 text-xs tracking-[0.22em] text-white/72 backdrop-blur">
                向下浏览
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
          <ScrollReveal className="soft-card rounded-[2.4rem] p-6 md:p-8">
            <div className="section-kicker">周末故事</div>
            <h2 className="font-display mt-4 max-w-xl text-3xl font-semibold leading-tight text-brand-950 md:text-[3.25rem]">
              先看方向，再决定把周末交给哪一片风景。
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-8 text-slate-600 md:text-base">
              这一组更适合作为“从哪边开始逛”的入口，不必先做复杂决策，先把想去的气质筛出来，路线自然就清楚了。
            </p>

            <div className="mt-8 space-y-3">
              <Link href="/map" className="surface-card flex items-center justify-between rounded-full px-5 py-4 text-sm font-medium text-brand-950">
                <span className="inline-flex items-center gap-2">
                  <Compass className="h-4 w-4 text-brand-700" />
                  先看地图分布
                </span>
                <ArrowRight className="h-4 w-4 text-brand-700" />
              </Link>
              <Link href="/planner" className="surface-card flex items-center justify-between rounded-full px-5 py-4 text-sm font-medium text-brand-950">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-700" />
                  直接生成周末推荐
                </span>
                <ArrowRight className="h-4 w-4 text-brand-700" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid gap-5 md:grid-cols-2">
            {weekendStorySpots.map((spot, index) => {
              const imageSrc = resolveSpotImage(spot);

              return (
                <ScrollReveal key={spot.id || spot.name} delay={index * 90}>
                  <Link href={`/spots/${spot.id}`} className="soft-card group block overflow-hidden rounded-[2.2rem]">
                    <div className="relative h-[320px] overflow-hidden">
                      <Image
                        src={imageSrc}
                        alt={spot.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        unoptimized={isRemoteHttpUrl(imageSrc)}
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <div className="text-sm font-medium text-white/80">0{index + 3}</div>
                        <div className="font-display mt-2 text-[2rem] font-semibold leading-tight">{spot.name}</div>
                        <div className="mt-2 text-sm text-white/82">{buildSpotMeta(spot)}</div>
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="line-clamp-2 text-sm leading-7 text-slate-600">{spot.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {spot.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                        <span>{spot.suggestedDuration ?? "1天"}</span>
                        <span className="font-medium text-brand-800">查看详情</span>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="space-y-5">
          <ScrollReveal className="soft-card overflow-hidden rounded-[2.6rem] p-6 md:p-8">
            <div className="grid gap-6 xl:grid-cols-[0.8fr,1.2fr]">
              <div className="flex h-full flex-col justify-between rounded-[2.2rem] bg-[linear-gradient(160deg,#15382d,#1f4b3b)] p-6 text-white md:p-8">
                <div>
                  <div className="section-kicker !text-white/58">目的地矩阵</div>
                  <h2 className="font-display mt-4 max-w-xl text-3xl font-semibold leading-[1.06] md:text-[3.2rem]">
                    先把想去的气质挑出来，
                    <br />
                    再决定这个周末往哪边走。
                  </h2>
                  <p className="mt-5 max-w-lg text-sm leading-8 text-white/76 md:text-base">
                    不必一上来就看一长串景点。先从山路、古寨、竹海、田园和近郊轻度假里找到你更想要的那种感觉，路线会自然清晰很多。
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  <div className="inline-flex w-fit rounded-full border border-white/16 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur">
                    首页主推 {heroSpots.length} 个精选景点
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Link
                      href="/map"
                      className="inline-flex items-center justify-between rounded-[1.45rem] border border-white/14 bg-white/8 px-4 py-4 text-sm font-medium text-white/92 backdrop-blur"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Compass className="h-4 w-4" />
                        去地图里找方向
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/planner"
                      className="inline-flex items-center justify-between rounded-[1.45rem] border border-white/14 bg-white/8 px-4 py-4 text-sm font-medium text-white/92 backdrop-blur"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        直接生成推荐
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
                {matrixPrimary ? (
                  <Link
                    href={`/spots/${matrixPrimary.id}`}
                    className="group relative block min-h-[420px] overflow-hidden rounded-[2.2rem] lg:min-h-[520px]"
                  >
                    <Image
                      src={resolveSpotImage(matrixPrimary)}
                      alt={matrixPrimary.name}
                      fill
                      sizes="(max-width: 1280px) 100vw, 42vw"
                      unoptimized={isRemoteHttpUrl(resolveSpotImage(matrixPrimary))}
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,29,24,0.05),rgba(15,29,24,0.8))]" />
                    <div className="absolute inset-0 flex flex-col justify-end p-6 text-white md:p-8">
                      <div className="text-xs uppercase tracking-[0.24em] text-white/66">编辑精选</div>
                      <div className="font-display mt-3 max-w-xl text-[2.5rem] font-semibold leading-[1.02] md:text-[3rem]">
                        {matrixPrimary.name}
                      </div>
                      <div className="mt-3 text-sm text-white/78">{buildSpotMeta(matrixPrimary)}</div>
                      <p className="mt-4 max-w-xl text-sm leading-7 text-white/78">{matrixPrimary.description}</p>
                    </div>
                  </Link>
                ) : null}

                <div className="grid gap-4">
                  {matrixSecondary ? (
                    <Link
                      href={`/spots/${matrixSecondary.id}`}
                      className="group relative block min-h-[250px] overflow-hidden rounded-[2rem]"
                    >
                      <Image
                        src={resolveSpotImage(matrixSecondary)}
                        alt={matrixSecondary.name}
                        fill
                        sizes="(max-width: 1280px) 100vw, 28vw"
                        unoptimized={isRemoteHttpUrl(resolveSpotImage(matrixSecondary))}
                        className="object-cover transition duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/12 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                        <div className="text-xs uppercase tracking-[0.22em] text-white/66">特别推荐</div>
                        <div className="font-display mt-2 text-[2rem] font-semibold leading-tight">{matrixSecondary.name}</div>
                        <div className="mt-2 text-sm text-white/78">{buildSpotMeta(matrixSecondary)}</div>
                      </div>
                    </Link>
                  ) : null}

                  <div className="grid gap-3">
                    {matrixSupport.map((spot) => (
                      <Link
                        key={spot.id || spot.name}
                        href={`/spots/${spot.id}`}
                        className="surface-card flex items-center justify-between gap-4 rounded-[1.7rem] px-5 py-4"
                      >
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-brand-700/58">{buildSpotMeta(spot)}</div>
                          <div className="mt-2 text-lg font-semibold leading-snug text-brand-950">{spot.name}</div>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-brand-700" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="soft-card overflow-hidden rounded-[2.6rem] p-6 md:p-8">
            <div className="flex flex-col gap-6">
              <Link
                href={featuredRouteCover?.id ? `/spots/${featuredRouteCover.id}` : "/spots"}
                className="group relative block min-h-[360px] overflow-hidden rounded-[2.3rem] md:min-h-[500px]"
              >
                {featuredRouteCover ? (
                  <>
                    <Image
                      src={resolveSpotImage(featuredRouteCover)}
                      alt={featuredRouteCover.name}
                      fill
                      sizes="100vw"
                      unoptimized={isRemoteHttpUrl(resolveSpotImage(featuredRouteCover))}
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,24,19,0.05),rgba(12,24,19,0.84))]" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[linear-gradient(135deg,#28503f,#132b21)]" />
                )}

                <div className="absolute inset-0 flex flex-col justify-between p-6 text-white md:p-9">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/16 px-3 py-1.5 text-xs font-medium tracking-[0.2em] text-white/84 backdrop-blur">
                      <Route className="h-3.5 w-3.5" />
                      周末路线
                    </div>
                    <div className="rounded-full border border-white/18 bg-black/16 px-3 py-1.5 text-xs text-white/74 backdrop-blur">
                      {featuredRouteCover?.city ?? "西安周边"}
                    </div>
                  </div>

                  <div>
                    <div className="font-display max-w-3xl text-[2.8rem] font-semibold leading-[1.02] md:text-[4rem]">
                      {featuredRoute.title}
                    </div>
                    <p className="mt-5 max-w-2xl text-sm leading-8 text-white/82 md:text-base">{featuredRoute.summary}</p>
                  </div>
                </div>
              </Link>

              <div className="grid gap-6 xl:grid-cols-[0.84fr,1.16fr]">
                <div className="flex flex-col gap-5">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800">
                      <Route className="h-3.5 w-3.5" />
                      路线灵感
                    </div>
                    <h3 className="mt-4 max-w-xl text-2xl font-semibold leading-tight text-brand-950 md:text-[2.2rem]">
                      把玩法、时长和节点放在同一张图里，决定会更快。
                    </h3>
                    <p className="mt-4 max-w-xl text-sm leading-8 text-slate-600">{featuredRoute.summary}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[1.7rem] bg-[#f4ecde] p-5">
                      <div className="text-xs tracking-[0.18em] text-slate-400">推荐玩法</div>
                      <div className="mt-3 text-lg font-semibold leading-9 text-brand-900">
                        {featuredRouteCover?.tags.slice(0, 3).join(" / ") || "田园观景 / 周边一日游"}
                      </div>
                    </div>
                    <div className="rounded-[1.7rem] bg-[#f4ecde] p-5">
                      <div className="text-xs tracking-[0.18em] text-slate-400">建议时长</div>
                      <div className="mt-3 text-lg font-semibold text-brand-900">{featuredRouteCover?.suggestedDuration ?? "1天左右"}</div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {featuredRouteSpots.map((spot) => (
                      <Link
                        key={spot.id || spot.name}
                        href={spot.id ? `/spots/${spot.id}` : "/spots"}
                        className="rounded-[1.6rem] border border-brand-100 bg-white/84 p-4 shadow-[0_18px_40px_rgba(21,47,37,0.06)]"
                      >
                        <div className="text-xs uppercase tracking-[0.18em] text-brand-700/58">{buildSpotMeta(spot)}</div>
                        <div className="mt-2 line-clamp-2 text-lg font-semibold leading-snug text-brand-950">{spot.name}</div>
                        <div className="mt-3 text-sm text-slate-500">{spot.suggestedDuration ?? "半天至1天"}</div>
                      </Link>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link href="/planner" className="rounded-full bg-brand-900 px-5 py-3 text-sm font-medium text-white">
                      用这个思路去规划
                    </Link>
                    {featuredRouteCover?.id ? (
                      <Link
                        href={`/spots/${featuredRouteCover.id}`}
                        className="rounded-full border border-brand-200 px-5 py-3 text-sm font-medium text-brand-900"
                      >
                        先看代表景点
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4">
                  {featuredRouteSpots.map((spot, index) => (
                    <div
                      key={spot.id || `${spot.name}-${index}`}
                      className="rounded-[1.8rem] border border-brand-100 bg-white/88 p-5 shadow-[0_18px_45px_rgba(21,47,37,0.05)] md:p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-semibold text-white">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-lg font-semibold text-brand-950">{spot.name}</div>
                          <div className="mt-2 text-sm leading-8 text-slate-500">
                            {spot.description || `${spot.city} 周边适合停留的周末节点。`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="mx-auto mt-14 max-w-[1480px] px-4 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {heroSpots.slice(2, 5).map((spot, index) => {
            const imageSrc = resolveSpotImage(spot);

            return (
              <ScrollReveal key={spot.id || spot.name} delay={index * 80}>
                <Link href={`/spots/${spot.id}`} className="destination-story group block overflow-hidden rounded-[2.2rem]">
                  <div className="relative h-[320px]">
                    <Image
                      src={imageSrc}
                      alt={spot.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized={isRemoteHttpUrl(imageSrc)}
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/8 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <div className="text-xs uppercase tracking-[0.24em] text-white/62">{buildSeasonText(spot.bestSeason)}</div>
                      <div className="font-display mt-2 text-3xl font-semibold leading-tight">{spot.name}</div>
                      <div className="mt-2 text-sm text-white/78">{buildSpotMeta(spot)}</div>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </section>
    </div>
  );
}
