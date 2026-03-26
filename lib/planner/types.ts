import type {
  CompanionType,
  CoordinatePrecision,
  CrowdPreference,
  DestinationTag,
  DiningLevel,
  KeyVillageLevel,
  LodgingLevel,
  PacePreference,
  PlannerProfileKey,
  Season,
  SuggestedDuration,
  SuitableCrowdTag,
  TransportMode,
  WeatherCondition
} from "@/lib/planner/enums";
import type { RuralSpotSeed } from "@/types";

export interface PlannerRouteStep {
  mode: "walk" | "bus" | "subway" | "drive" | "taxi" | "railway";
  title: string;
  detail: string;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  stops?: number | null;
}

export interface PlannerRoutePlan {
  mode: "self_drive" | "public_transit";
  summary: string;
  durationMinutes: number;
  distanceKm: number;
  walkingDistanceKm?: number | null;
  cost?: number | null;
  caution?: string | null;
  steps: PlannerRouteStep[];
}

export interface PlannerDestination {
  id: string;
  name: string;
  province: string;
  city: string;
  district?: string | null;
  township?: string | null;
  village?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinatePrecision: CoordinatePrecision;
  geoSource?: string | null;
  isNationalKeyVillage: boolean;
  keyVillageLevel: KeyVillageLevel;
  batch?: string | null;
  source: string;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  description: string;
  scenicFeatures: string[];
  tags: DestinationTag[];
  originalTags: string[];
  suitableCrowds: SuitableCrowdTag[];
  bestSeason: Season[];
  suggestedDuration: SuggestedDuration;
  photoUrls: string[];
  photoSourceUrls: string[];
  rating?: number | null;
  crowdLevel?: number | null;
  avgCostMin?: number | null;
  avgCostMax?: number | null;
  photoScore?: number | null;
  cultureScore?: number | null;
  familyFriendlyScore?: number | null;
  selfDriveFriendlyScore?: number | null;
  publicTransitFriendlyScore?: number | null;
  elderlyFriendlyScore?: number | null;
  quietRelaxScore?: number | null;
  activityRichnessScore?: number | null;
  transportSummary?: string | null;
  nearestRailStation?: string | null;
  lastMileDifficulty?: number | null;
  roadRiskLevel?: number | null;
  parkingConvenience?: number | null;
  roundTripFeasibleInOneDay: boolean;
  lodgingSummary?: string | null;
  lodgingLevel: LodgingLevel;
  lodgingPriceMin?: number | null;
  lodgingPriceMax?: number | null;
  lodgingFitCouples?: boolean | null;
  lodgingFitFamilies?: boolean | null;
  diningSummary?: string | null;
  diningLevel: DiningLevel;
  localFoodAvailable?: boolean | null;
  diningPriceMin?: number | null;
  diningPriceMax?: number | null;
  cautionNotes: string[];
  seasonalWarnings: string[];
  closureRiskNotes: string[];
  openStatus?: "open" | "closed" | "unknown";
  openingHoursText?: string | null;
  openingSourceUrl?: string | null;
  openingVerifiedAt?: string | null;
  openingVerificationNote?: string | null;
  aiHotelSummary?: string | null;
  aiTicketSummary?: string | null;
  liveTravelMinutes?: number | null;
  liveDistanceKm?: number | null;
  liveTrafficStatus?: string | null;
  routePlans?: PlannerRoutePlan[];
  transportLinks?: {
    ticketBookingUrl?: string | null;
    hotelBookingUrl?: string | null;
    gaodeNavigationUrl?: string | null;
  };
  rawSource?: RuralSpotSeed | Record<string, unknown>;
}

export interface WeatherContext {
  date: string;
  condition: WeatherCondition;
  temperatureHigh?: number | null;
  temperatureLow?: number | null;
  precipitationProbability?: number | null;
  windLevel?: number | null;
  aqi?: number | null;
  severeWeatherAlert: boolean;
  weatherSummary?: string | null;
}

export type DepartureTimePreference = "early_morning" | "morning" | "noon" | "after_work" | "flexible";
export type BookingPreference = "avoid_reservations" | "can_book" | "must_bookable";
export type TicketPreference = "free_or_low_cost" | "balanced" | "premium_ok";

export interface TrafficContext {
  isWeekend: boolean;
  isHoliday: boolean;
  congestionLevel: number;
  roadClosureRisk: number;
  parkingStress: number;
  nightReturnRisk: number;
}

export interface SeasonalContext {
  currentSeason: Season;
  flowerSeasonActive: boolean;
  autumnViewActive: boolean;
  summerRetreatActive: boolean;
  campingFriendly: boolean;
  waterAreaRisk: boolean;
  mountainTrailRisk: boolean;
}

export interface UserContext {
  origin: string;
  destinationQuery?: string | null;
  includeLiveSignals?: boolean;
  travelDate: string;
  days: number;
  budgetMin?: number;
  budgetMax?: number;
  transportMode: TransportMode;
  companions: CompanionType;
  preferenceTags: string[];
  crowdPreference: CrowdPreference;
  pacePreference: PacePreference;
  lodgingPreference?: string | null;
  diningPreference?: string | null;
  departureTimePreference?: DepartureTimePreference | null;
  bookingPreference?: BookingPreference | null;
  ticketPreference?: TicketPreference | null;
  specialConstraints: string[];
  historicalProfile?: Record<string, unknown> | null;
}

export interface PlannerRuntimeContext {
  user: UserContext;
  weather: WeatherContext;
  traffic: TrafficContext;
  seasonal: SeasonalContext;
}

export interface FilterDecision {
  passed: boolean;
  rejectionReasons: string[];
  penalty: number;
  warnings: string[];
}

export interface ScoreWeights {
  timeFit: number;
  transportFit: number;
  companionFit: number;
  weatherFit: number;
  budgetFit: number;
  seasonFit: number;
  lodgingFit: number;
  diningFit: number;
  tagFit: number;
}

export interface ScoreBreakdown {
  timeFit: number;
  transportFit: number;
  companionFit: number;
  weatherFit: number;
  budgetFit: number;
  seasonFit: number;
  lodgingFit: number;
  diningFit: number;
  tagFit: number;
}

export interface AdjustmentImpact {
  scoreDelta: number;
  reasons: string[];
  hardBlock?: boolean;
}

export interface BudgetEstimate {
  transport: number;
  lodging: number;
  dining: number;
  activities: number;
  totalMin: number;
  totalMax: number;
}

export interface ItineraryItem {
  day: number;
  title: string;
  startTime: string;
  endTime: string;
  description: string;
  location?: string;
  transportTip?: string;
  mealTip?: string;
  stayTip?: string;
}

export interface AlternativeOption {
  destinationId: string;
  destinationName: string;
  reason: string;
}

export interface RankedPlan {
  destinationId: string;
  destinationName: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
  rankingReason: string[];
  whyFitUser: string[];
  weatherAdjustmentReason: string[];
  crowdAdjustmentReason: string[];
  budgetEstimate: BudgetEstimate;
  transportSummary: string;
  lodgingSummary: string;
  diningSummary: string;
  risks: string[];
  itinerary: ItineraryItem[];
  alternativeOptions: AlternativeOption[];
  filterDecision: FilterDecision;
  mappedDestination: PlannerDestination;
}

export interface PlannerEngineOutput {
  recommendedPlans: RankedPlan[];
  readableSummary: {
    headline: string;
    recommendation: string[];
    dynamicImpact: string[];
    cautions: string[];
    alternatives: string[];
  };
  runtimeInsights?: {
    weather: string;
    traffic: string;
    destinationQuery?: string | null;
  };
  summaryMeta?: {
    source: "rules" | "ai";
    provider?: string | null;
    candidateCount?: number;
    enrichedCount?: number;
  };
  debug?: {
    filteredOut: Array<{ destinationId: string; destinationName: string; reasons: string[] }>;
    profileKey: PlannerProfileKey;
  };
}

export interface PlannerProviderOptions {
  forceMock?: boolean;
  origin?: string;
  referenceLocation?: string;
}

export interface LegacyPlannerInput {
  departure: string;
  days: 1 | 2 | 3;
  budgetMin?: number;
  budgetMax?: number;
  travelMode: "自驾" | "公共交通";
  groupType: "情侣" | "亲子" | "朋友" | "独自旅行";
  preferences: string[];
}

export interface PlannerApiInput {
  origin: string;
  destinationQuery?: string | null;
  includeLiveSignals?: boolean;
  travelDate: string;
  days: number;
  budgetMin?: number;
  budgetMax?: number;
  transportMode: TransportMode;
  companions: CompanionType;
  preferenceTags: string[];
  crowdPreference: CrowdPreference;
  pacePreference: PacePreference;
  lodgingPreference?: string | null;
  diningPreference?: string | null;
  departureTimePreference?: DepartureTimePreference | null;
  bookingPreference?: BookingPreference | null;
  ticketPreference?: TicketPreference | null;
  specialConstraints?: string[];
  weather?: Partial<WeatherContext>;
  traffic?: Partial<TrafficContext>;
}
