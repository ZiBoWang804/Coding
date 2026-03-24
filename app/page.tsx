import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Compass, MapPinned, Route, Sparkles, Trees } from "lucide-react";
import { HomeCarousel } from "@/components/home-carousel";
import { ScrollReveal } from "@/components/scroll-reveal";
import { SpotCard } from "@/components/spot-card";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORY_TAGS, HERO_SLIDES, RECOMMENDED_ROUTES } from "@/lib/constants";
import { getHomeData } from "@/lib/repository";
import { isLikelyImageUrl, isRemoteHttpUrl } from "@/lib/utils";
import { getXianFeaturedSpots } from "@/lib/xian-topic";
import type { RuralSpotSeed, SearchHistoryItem } from "@/types";

const HERO_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80";

function uniqueSpots(spots: RuralSpotSeed[]) {
  return spots.filter((spot, index, source) => source.findIndex((item) => item.id === spot.id) === index);
}

function resolveSpotImage(spot?: RuralSpotSeed | null) {
  if (!spot) return HERO_FALLBACK_IMAGE;
  if (spot.imageUrl && isLikelyImageUrl(spot.imageUrl)) return spot.imageUrl;
  if (spot.photoUrls?.[0] && isLikelyImageUrl(spot.photoUrls[0])) return spot.photoUrls[0];
  return HERO_FALLBACK_IMAGE;
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

export default async function HomePage() {
  const [user, xianTopic] = await Promise.all([getCurrentUser(), getXianFeaturedSpots()]);
  const { featured, popular, personalized, recentSearches } = await getHomeData(user);

  const recommendationSpots = user && personalized.length > 0 ? personalized.slice(0, 4) : featured.slice(0, 4);
  const heroDeck = uniqueSpots([...xianTopic, ...featured, ...popular]).slice(0, 5);
  const discoveryDeck = uniqueSpots([...recommendationSpots, ...featured, ...popular]).slice(0, 4);
  const matrixDeck = uniqueSpots([...(xianTopic.length > 0 ? xianTopic : featured), ...popular]).slice(0, 6);
  const mapReadyCount = featured.filter((spot) => spot.latitude != null && spot.longitude != null).length;
  const recentKeywords = recentSearches.slice(0, 4).map(buildRecentLabel);
  const routeDeck = RECOMMENDED_ROUTES.map((route, index) => ({
    ...route,
    cover: matrixDeck[index] || discoveryDeck[index] || featured[index] || null
  }));

  return (
    <div className="mx-auto max-w-[1480px] px-4 pb-20 pt-6 sm:px-6 lg:px-8">
      <section className="hero-stage rounded-[2.8rem] px-6 py-8 text-white md:px-10 md:py-10 lg:px-12 lg:py-12">
        <div className="relative grid gap-8 lg:grid-cols-[0.96fr,1.04fr] lg:items-center">
          <ScrollReveal className="relative z-[1]">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/14 bg-white/10 px-4 py-2 text-xs font-medium text-white/78 backdrop-blur">
              <span className="travel-pill">西安近郊</span>
              <span className="travel-pill">地图选点</span>
              <span className="travel-pill">AI 路线建议</span>
            </div>

            <p className="hero-kicker mt-8">Rural Weekend Platform</p>
            <h1 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.06] text-[#f5efe3] md:text-6xl xl:text-[5.4rem]">
              把周末交给山野和村落，
              <br />
              一眼挑出真正想去的地方。
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/72 md:text-lg">
              从竹海、古寨、温泉到亲子农园，把能当天往返和适合住一晚的乡野目的地，做成一套更像成熟旅游平台的浏览、地图与规划入口。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/spots"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-brand-950 shadow-[0_18px_36px_rgba(0,0,0,0.12)]"
              >
                浏览目的地
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/map"
                className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-6 py-3 text-sm font-medium text-white backdrop-blur"
              >
                <MapPinned className="h-4 w-4" />
                去地图里找方向
              </Link>
              <Link
                href="/planner"
                className="inline-flex items-center gap-2 rounded-full border border-white/16 bg-white/8 px-6 py-3 text-sm font-medium text-white backdrop-blur"
              >
                <Sparkles className="h-4 w-4" />
                让 AI 帮我选
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="feature-metric rounded-[1.5rem] p-4">
                <div className="text-3xl font-semibold">{featured.length}+</div>
                <div className="mt-1 text-sm text-white/66">已整理景点</div>
              </div>
              <div className="feature-metric rounded-[1.5rem] p-4">
                <div className="text-3xl font-semibold">{mapReadyCount}</div>
                <div className="mt-1 text-sm text-white/66">地图点位已校准</div>
              </div>
              <div className="feature-metric rounded-[1.5rem] p-4">
                <div className="text-3xl font-semibold">{xianTopic.length || featured.length}</div>
                <div className="mt-1 text-sm text-white/66">西安周边精选</div>
              </div>
            </div>

            <div className="mt-8 max-w-2xl">
              <HomeCarousel slides={HERO_SLIDES} />
            </div>
          </ScrollReveal>

          <div className="grid gap-4 md:grid-cols-12">
            {heroDeck.slice(0, 5).map((spot, index) => {
              const imageSrc = resolveSpotImage(spot);
              const largeCard = index === 0;
              const wideCard = index === 3;

              return (
                <ScrollReveal
                  key={spot.id || spot.name}
                  delay={index * 80}
                  className={[
                    "image-panel group",
                    largeCard ? "md:col-span-7 md:row-span-2 h-[460px]" : wideCard ? "md:col-span-7 h-[220px]" : "md:col-span-5 h-[220px]"
                  ].join(" ")}
                >
                  <Link href={`/spots/${spot.id}`} className="block h-full w-full">
                    <Image
                      src={imageSrc}
                      alt={spot.name}
                      fill
                      sizes={largeCard ? "(max-width: 1024px) 100vw, 48vw" : "(max-width: 1024px) 100vw, 28vw"}
                      priority={index < 2}
                      unoptimized={isRemoteHttpUrl(imageSrc)}
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-x-0 bottom-0 z-[1] p-5 text-white">
                      <div className="text-xs uppercase tracking-[0.28em] text-white/56">{buildSpotMeta(spot)}</div>
                      <div className="font-display mt-2 text-2xl font-semibold leading-tight md:text-[2rem]">{spot.name}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {spot.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full border border-white/16 bg-black/24 px-3 py-1 text-xs text-white/88 backdrop-blur">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[0.38fr,0.62fr]">
        <ScrollReveal className="soft-card h-fit rounded-[2.4rem] p-6 lg:sticky lg:top-24">
          <div className="section-kicker">Weekend Stories</div>
          <h2 className="font-display mt-3 text-3xl font-semibold leading-tight text-brand-950 md:text-4xl">
            先看方向，再决定把周末交给哪一片风景。
          </h2>
          <p className="mt-4 text-sm leading-8 text-slate-600">
            这一组更适合当作“从哪边开始逛”的入口，不必先做复杂决策，先把想去的气质筛出来，路线自然就清楚了。
          </p>

          {recentKeywords.length > 0 ? (
            <div className="mt-6">
              <div className="text-xs uppercase tracking-[0.28em] text-brand-700/58">你最近在看</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentKeywords.map((keyword) => (
                  <span key={keyword} className="rounded-full bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 grid gap-3">
            <Link href="/map" className="surface-card flex items-center justify-between rounded-[1.6rem] px-4 py-4 text-sm text-brand-950">
              <span className="inline-flex items-center gap-2">
                <Compass className="h-4 w-4 text-brand-700" />
                先看地图分布
              </span>
              <ArrowRight className="h-4 w-4 text-brand-700" />
            </Link>
            <Link href="/planner" className="surface-card flex items-center justify-between rounded-[1.6rem] px-4 py-4 text-sm text-brand-950">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-700" />
                直接生成周末推荐
              </span>
              <ArrowRight className="h-4 w-4 text-brand-700" />
            </Link>
          </div>
        </ScrollReveal>

        <div className="grid gap-6 md:grid-cols-2">
          {discoveryDeck.map((spot, index) => {
            const imageSrc = resolveSpotImage(spot);

            return (
              <ScrollReveal key={spot.id || spot.name} delay={index * 80}>
                <Link href={`/spots/${spot.id}`} className="soft-card group block overflow-hidden rounded-[2.2rem]">
                  <div className="relative h-[300px] overflow-hidden">
                    <Image
                      src={imageSrc}
                      alt={spot.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      unoptimized={isRemoteHttpUrl(imageSrc)}
                      className="object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/16 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <div className="text-sm text-white/64">0{index + 1}</div>
                      <div className="font-display mt-2 text-3xl font-semibold leading-tight">{spot.name}</div>
                      <div className="mt-2 text-sm text-white/78">{buildSpotMeta(spot)}</div>
                    </div>
                  </div>
                  <div className="grid gap-4 p-5">
                    <p className="line-clamp-2 text-sm leading-7 text-slate-600">{spot.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {spot.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="rounded-full bg-[#f5efe3] px-3 py-1 text-xs font-medium text-brand-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>{spot.suggestedDuration || "建议 1 天"}</span>
                      <span className="font-medium text-brand-700">查看详情</span>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <section className="mt-12 grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <ScrollReveal className="soft-card overflow-hidden rounded-[2.5rem] p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="section-kicker">Destination Matrix</div>
              <h2 className="font-display mt-3 text-3xl font-semibold leading-tight text-brand-950 md:text-4xl">
                像翻旅游杂志一样，看一组值得立即出发的地方。
              </h2>
            </div>
            <div className="rounded-full bg-brand-900 px-4 py-2 text-xs font-medium text-white">
              已整理 {matrixDeck.length} 个首页主推点位
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-12">
            {matrixDeck.slice(0, 5).map((spot, index) => {
              const imageSrc = resolveSpotImage(spot);
              const className =
                index === 0
                  ? "md:col-span-7 h-[360px]"
                  : index === 1
                    ? "md:col-span-5 h-[360px]"
                    : index === 2
                      ? "md:col-span-4 h-[220px]"
                      : index === 3
                        ? "md:col-span-4 h-[220px]"
                        : "md:col-span-4 h-[220px]";

              return (
                <Link key={spot.id || spot.name} href={`/spots/${spot.id}`} className={`image-panel group ${className}`}>
                  <Image
                    src={imageSrc}
                    alt={spot.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 40vw"
                    unoptimized={isRemoteHttpUrl(imageSrc)}
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 z-[1] p-5 text-white">
                    <div className="text-xs uppercase tracking-[0.28em] text-white/56">{buildSeasonText(spot.bestSeason)}</div>
                    <div className="font-display mt-2 text-2xl font-semibold">{spot.name}</div>
                    <div className="mt-1 text-sm text-white/76">{spot.tags.slice(0, 2).join(" / ") || "乡野出发地"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </ScrollReveal>

        <div className="grid gap-6">
          {routeDeck.map((route, index) => {
            const cover = route.cover;
            const coverImage = resolveSpotImage(cover);

            return (
              <ScrollReveal key={route.title} delay={index * 100} className="soft-card overflow-hidden rounded-[2.3rem]">
                <div className="grid gap-0 md:grid-cols-[0.9fr,1.1fr]">
                  <div className="relative min-h-[220px]">
                    <Image
                      src={coverImage}
                      alt={cover?.name || route.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 30vw"
                      unoptimized={isRemoteHttpUrl(coverImage)}
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/12 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <div className="text-xs uppercase tracking-[0.28em] text-white/58">Route 0{index + 1}</div>
                      <div className="font-display mt-2 text-2xl font-semibold">{route.title}</div>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-800">
                      <Route className="h-3.5 w-3.5" />
                      周末路线灵感
                    </div>
                    <p className="mt-4 text-sm leading-8 text-slate-600">{route.summary}</p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[1.5rem] bg-[#f5efe3] px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.24em] text-brand-700/60">推荐玩法</div>
                        <div className="mt-2 text-sm font-medium text-brand-950">
                          {cover?.tags.slice(0, 2).join(" / ") || "慢逛 / 轻徒步"}
                        </div>
                      </div>
                      <div className="rounded-[1.5rem] bg-[#f5efe3] px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.24em] text-brand-700/60">建议时长</div>
                        <div className="mt-2 text-sm font-medium text-brand-950">{cover?.suggestedDuration || "1 天左右"}</div>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link href="/planner" className="rounded-full bg-brand-900 px-5 py-3 text-sm font-medium text-white">
                        用这个思路去规划
                      </Link>
                      {cover?.id ? (
                        <Link href={`/spots/${cover.id}`} className="rounded-full border border-brand-200 px-5 py-3 text-sm font-medium text-brand-900">
                          先看代表景点
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <ScrollReveal className="hero-panel rounded-[2.4rem] p-6 text-white md:p-8">
          <div className="hero-kicker">Map First</div>
          <h3 className="font-display mt-3 text-3xl font-semibold leading-tight md:text-4xl">
            如果你还没想好去哪，
            <br />
            先把地图打开。
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-8 text-white/74">
            更适合先看分布、再看距离和方向。地图页已经补了核心点位，适合快速判断这周末该往哪一边走。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/map" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-brand-950">
              打开乡野地图
            </Link>
            <div className="rounded-full border border-white/14 px-4 py-3 text-sm text-white/78">已有 {mapReadyCount} 个可视化点位</div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="soft-card rounded-[2.4rem] p-6 md:p-8">
          <div className="section-kicker">Plan With Intent</div>
          <h3 className="font-display mt-3 text-3xl font-semibold leading-tight text-brand-950 md:text-4xl">
            想要更省心，
            <br />
            直接把条件交给智能规划。
          </h3>
          <p className="mt-4 max-w-xl text-sm leading-8 text-slate-600">
            根据预算、出行方式、天数、同行人群和偏好标签，优先给出更像真正出行建议的答案，而不是只堆几个景点名字。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.5rem] bg-[#f5efe3] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.24em] text-brand-700/58">出行方式</div>
              <div className="mt-2 text-sm font-medium text-brand-950">自驾 / 公共交通</div>
            </div>
            <div className="rounded-[1.5rem] bg-[#f5efe3] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.24em] text-brand-700/58">动态因素</div>
              <div className="mt-2 text-sm font-medium text-brand-950">天气 / 路况 / 开放状态</div>
            </div>
            <div className="rounded-[1.5rem] bg-[#f5efe3] px-4 py-4">
              <div className="text-xs uppercase tracking-[0.24em] text-brand-700/58">结果重点</div>
              <div className="mt-2 text-sm font-medium text-brand-950">推荐理由 / 备选方案</div>
            </div>
          </div>
          <div className="mt-7">
            <Link href="/planner" className="inline-flex items-center gap-2 rounded-full bg-brand-900 px-5 py-3 text-sm font-medium text-white">
              开始生成推荐
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </ScrollReveal>
      </section>

      <section className="mt-12">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Browse By Mood</div>
            <h2 className="font-display mt-3 text-3xl font-semibold leading-tight text-brand-950 md:text-4xl">
              这次想怎么玩，就从这里开始缩小范围。
            </h2>
          </div>
          <div className="text-sm text-slate-500">不是每次都需要复杂规划，有时候先选一种心情就够了。</div>
        </ScrollReveal>

        <div className="mt-6 flex flex-wrap gap-3">
          {CATEGORY_TAGS.map((tag, index) => (
            <ScrollReveal key={tag} delay={index * 40} className="inline-flex">
              <Link
                href={`/spots?tag=${encodeURIComponent(tag)}`}
                className={[
                  "rounded-full px-4 py-3 text-sm font-medium transition hover:-translate-y-0.5",
                  index % 3 === 0
                    ? "bg-brand-900 text-white"
                    : index % 3 === 1
                      ? "bg-white text-brand-900 shadow-[0_16px_34px_rgba(19,36,29,0.06)]"
                      : "bg-[#efe1bc] text-brand-950"
                ].join(" ")}
              >
                {tag}
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <ScrollReveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">More To Explore</div>
            <h2 className="font-display mt-3 text-3xl font-semibold leading-tight text-brand-950 md:text-4xl">
              继续往下翻，总能遇到下一处值得出发的地方。
            </h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800">
            <Trees className="h-4 w-4" />
            本周热门目的地
          </div>
        </ScrollReveal>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {popular.slice(0, 4).map((spot, index) => (
            <ScrollReveal key={spot.id || spot.name} delay={index * 80}>
              <SpotCard spot={spot} />
            </ScrollReveal>
          ))}
        </div>
      </section>
    </div>
  );
}
