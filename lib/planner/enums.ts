export const SUITABLE_CROWD_TAGS = [
  "couple",
  "family",
  "friends",
  "solo",
  "elderly",
  "photography",
  "self_drive_users",
  "pet_friendly"
] as const;

export const DESTINATION_TAGS = [
  "ancient_village",
  "mountain_view",
  "water_view",
  "forest",
  "bamboo",
  "flower_sea",
  "terrace",
  "pastoral",
  "camping",
  "hot_spring",
  "fruit_picking",
  "folk_custom",
  "intangible_heritage",
  "local_food",
  "photography",
  "hiking_light",
  "quiet_relax",
  "weekend_short_trip",
  "family_interaction",
  "summer_retreat",
  "autumn_view",
  "winter_scene"
] as const;

export const COORDINATE_PRECISIONS = [
  "exact",
  "village_approx",
  "township_approx",
  "district_approx",
  "unknown"
] as const;

export const KEY_VILLAGE_LEVELS = ["national", "provincial", "none"] as const;
export const SUGGESTED_DURATIONS = ["half_day", "one_day", "two_days", "flexible"] as const;
export const LODGING_LEVELS = ["none", "basic", "moderate", "rich"] as const;
export const DINING_LEVELS = ["none", "basic", "moderate", "rich"] as const;
export const TRANSPORT_MODES = ["self_drive", "public_transit", "either"] as const;
export const COMPANION_TYPES = ["solo", "couple", "family", "friends", "elderly"] as const;
export const CROWD_PREFERENCES = ["lively", "neutral", "avoid_crowds"] as const;
export const PACE_PREFERENCES = ["slow", "moderate", "multi_stop"] as const;
export const WEATHER_CONDITIONS = [
  "sunny",
  "cloudy",
  "light_rain",
  "heavy_rain",
  "thunder",
  "snow",
  "fog",
  "heat",
  "cold",
  "windy"
] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const PROFILE_KEYS = [
  "default",
  "family",
  "couple",
  "elderly",
  "self_drive_users",
  "budget_sensitive",
  "photography",
  "friends_group"
] as const;

export type SuitableCrowdTag = (typeof SUITABLE_CROWD_TAGS)[number];
export type DestinationTag = (typeof DESTINATION_TAGS)[number];
export type CoordinatePrecision = (typeof COORDINATE_PRECISIONS)[number];
export type KeyVillageLevel = (typeof KEY_VILLAGE_LEVELS)[number];
export type SuggestedDuration = (typeof SUGGESTED_DURATIONS)[number];
export type LodgingLevel = (typeof LODGING_LEVELS)[number];
export type DiningLevel = (typeof DINING_LEVELS)[number];
export type TransportMode = (typeof TRANSPORT_MODES)[number];
export type CompanionType = (typeof COMPANION_TYPES)[number];
export type CrowdPreference = (typeof CROWD_PREFERENCES)[number];
export type PacePreference = (typeof PACE_PREFERENCES)[number];
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];
export type Season = (typeof SEASONS)[number];
export type PlannerProfileKey = (typeof PROFILE_KEYS)[number];
