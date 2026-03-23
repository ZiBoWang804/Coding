export interface NearbyItem {
  name: string;
  type?: string;
  note?: string;
}

export interface RuralSpotSeed {
  id?: string;
  name: string;
  province: string;
  city: string;
  district?: string | null;
  township?: string | null;
  village?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinatePrecision?: "exact" | "village_approx" | "township_approx" | "district_approx" | "unknown";
  geoSource?: string | null;
  isNationalKeyVillage?: boolean;
  keyVillageLevel?: "national" | "provincial" | "none";
  batch?: string | null;
  source: string;
  sourceUrl?: string | null;
  lastVerifiedAt?: string | null;
  description: string;
  scenicFeatures?: string[];
  tags: string[];
  suitableCrowds?: string[];
  bestSeason: string[];
  suggestedDuration?: string | null;
  photoUrls?: string[];
  photoSourceUrls?: string[];
  rating?: number | null;
  crowdLevel?: number | null;
  avgCost?: number | null;
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
  transportInfo?: string | null;
  transportSummary?: string | null;
  nearestRailStation?: string | null;
  lastMileDifficulty?: number | null;
  roadRiskLevel?: number | null;
  parkingConvenience?: number | null;
  roundTripFeasibleInOneDay?: boolean;
  imageUrl?: string | null;
  ticketBookingUrl?: string | null;
  hotelBookingUrl?: string | null;
  gaodeNavigationUrl?: string | null;
  lodgingSummary?: string | null;
  lodgingLevel?: "none" | "basic" | "moderate" | "rich";
  lodgingPriceMin?: number | null;
  lodgingPriceMax?: number | null;
  lodgingFitCouples?: boolean | null;
  lodgingFitFamilies?: boolean | null;
  diningSummary?: string | null;
  diningLevel?: "none" | "basic" | "moderate" | "rich";
  localFoodAvailable?: boolean | null;
  diningPriceMin?: number | null;
  diningPriceMax?: number | null;
  cautionNotes?: string[];
  seasonalWarnings?: string[];
  closureRiskNotes?: string[];
  accommodationTips?: NearbyItem[];
  diningTips?: NearbyItem[];
  routeHighlights?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PlannerInput {
  departure: string;
  days: 1 | 2 | 3;
  budgetMin?: number;
  budgetMax?: number;
  travelMode: "自驾" | "公共交通";
  groupType: "情侣" | "亲子" | "朋友" | "独自旅行";
  preferences: string[];
}

export interface RankedSpot {
  spot: RuralSpotSeed;
  score: number;
  reasons: string[];
  dimensionScores: Record<string, number>;
}

export interface PlannerResult {
  topMatches: RankedSpot[];
  itinerary: string[];
  budgetEstimate: string;
  notes: string[];
  summary: string;
  aiSummary?: string;
  aiDetail?: string;
  aiProvider?: string;
  packingList?: string[];
  routeChecklist?: string[];
}

export interface UserSummary {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: "USER" | "ADMIN";
  preferences: string[];
  homeCity?: string | null;
}

export interface UserSpotState {
  wantToGo: boolean;
  visited: boolean;
  favorite: boolean;
}

export interface SearchHistoryItem {
  id: string;
  query?: string | null;
  province?: string | null;
  city?: string | null;
  tag?: string | null;
  preferences: string[];
  resultIds: string[];
  createdAt: string;
}

export interface CommunityPostItem {
  id: string;
  title: string;
  content: string;
  images: string[];
  tags: string[];
  type: "STORY" | "GUIDE";
  createdAt: string;
  likeCount: number;
  commentCount: number;
  likedByCurrentUser?: boolean;
  author: {
    id: string;
    nickname: string;
    avatarUrl?: string | null;
  };
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      nickname: string;
    };
  }>;
}

export interface CheckInItem {
  id: string;
  content?: string | null;
  imageUrls: string[];
  visitDate?: string | null;
  createdAt: string;
  author: {
    id: string;
    nickname: string;
  };
}

export interface SpotSubmissionItem {
  id: string;
  name: string;
  province: string;
  city: string;
  district?: string | null;
  description: string;
  tags: string[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerNotes?: string | null;
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    email: string;
  };
}
