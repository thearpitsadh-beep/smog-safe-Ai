export type ViewId = 'overview' | 'plan' | 'indoor' | 'impact' | 'copilot' | 'scene3d';

export type AqiLevel =
  | 'unknown'
  | 'good'
  | 'moderate'
  | 'sensitive'
  | 'unhealthy'
  | 'very-unhealthy'
  | 'hazardous';

export interface AqiBand {
  label: string;
  level: AqiLevel;
  description: string;
  color: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type CommuteMode = 'car' | 'bus' | 'metro' | 'walk' | 'cycle' | 'remote';
export type BudgetTier = 'low' | 'medium' | 'flexible';
export type DailySchedule = 'school' | 'office' | 'home' | 'mixed';

export interface HouseholdProfile {
  city: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  schedule: DailySchedule;
  commute: CommuteMode;
  budget: BudgetTier;
  children: boolean;
  seniors: boolean;
  sensitive: boolean;
  purifier: boolean;
}

export interface CityLocation {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface HourlyAirPoint {
  time: string;
  usAqi: number;
  pm25: number | null;
}

export interface AirMeasurements {
  usAqi: number;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  ozone: number | null;
}

export interface AirQualityData {
  live: boolean;
  source: string;
  scale: 'US AQI';
  scaleNotice: string;
  locationLabel?: string;
  coordinates?: Coordinates;
  hourTimezone?: 'UTC' | 'demo';
  timestamp: string | null;
  fetchedAt: string | null;
  expiresAt: string | null;
  verificationToken?: string;
  cacheHit?: boolean;
  current: AirMeasurements;
  hours: HourlyAirPoint[];
  providerLink?: string;
  disclaimer?: string;
}

export type ImpactDomain = 'exposure' | 'emissions' | 'indoor_generation';

export interface PlanAction {
  period: 'MORNING' | 'AFTERNOON' | 'EVENING';
  title: string;
  detail: string;
  why: string;
  tradeOff: string;
  supportingData: string;
  impactWithUncertainty: string;
  impactDomain: ImpactDomain;
  tag: string;
}

export interface IndoorTip {
  title: string;
  detail: string;
  why: string;
  tradeOff: string;
  supportingData: string;
  impactWithUncertainty: string;
  impactDomain: ImpactDomain;
  icon: 'source' | 'spark' | 'wind' | 'filter' | 'leaf';
  category: string;
}

export interface SustainableSwap {
  title: string;
  effect: string;
  description: string;
  supportingData: string;
  impactWithUncertainty: string;
  impactDomain: ImpactDomain;
  icon: 'car' | 'train' | 'home';
}

export interface DailyPlan {
  status: AqiBand;
  note: string;
  profile: HouseholdProfile;
  intensity: string;
  intro: string;
  actions: PlanAction[];
  indoor: IndoorTip[];
  swaps: SustainableSwap[];
  disclaimer: string;
}

export interface EmissionFactorSpec {
  mode: CommuteMode;
  label: string;
  kgPerPkm: number;
  minKgPerPkm: number;
  maxKgPerPkm: number;
  sourceCitation: string;
  exposureComparison: string;
  isIllustrativeZero: boolean;
}

export interface TravelImpactInput {
  distanceKm?: number;
  daysPerWeek?: number;
  option?: CommuteMode;
  country?: string;
  carFactor?: number;
  optionFactor?: number;
}

export interface TravelImpactResult {
  weeklyKm: number;
  baselineKg: number;
  optionKg: number;
  savedKg: number;
  savedMinKg: number;
  savedMaxKg: number;
  option: CommuteMode;
  optionLabel: string;
  regionalConfidence: 'india-reference' | 'illustrative-proxy';
  usedCustomFactors: boolean;
  factorUsed: EmissionFactorSpec;
  baselineFactor: EmissionFactorSpec;
  factors: Record<CommuteMode, number>;
  exposureWarning: string;
  note: string;
}

export interface CopilotStructuredResponse {
  answer: string;
  keyActions: string[];
  impactDomain: ImpactDomain | 'mixed';
  uncertaintyNote: string;
  medicalDisclaimer: string;
}

export interface ChatApiResponse extends CopilotStructuredResponse {
  mode: 'gemini' | 'rules-fallback';
  dataMode: 'modeled-live-forecast' | 'illustrative-demo';
  fallbackReason?: string;
}

export interface PlanBriefStructuredResponse {
  brief: string;
  keyFocus: string;
  uncertaintyNote: string;
  medicalDisclaimer: string;
}

export interface PlanBriefApiResponse extends PlanBriefStructuredResponse {
  mode: 'gemini' | 'rules-fallback';
  dataMode: 'modeled-live-forecast' | 'illustrative-demo';
  fallbackReason?: string;
}

export interface GroundedWebSource {
  title: string;
  uri: string;
}

export interface GroundedPlaceSource {
  title: string;
  uri: string;
  reviewSnippets: string[];
}

export interface SearchGroundingApiResponse {
  answer: string;
  sources: GroundedWebSource[];
  mode: 'gemini-search' | 'fallback';
  dataMode: 'modeled-live-forecast' | 'illustrative-demo';
  uncertaintyNote: string;
  medicalDisclaimer: string;
  fallbackReason?: string;
}

export interface MapsGroundingApiResponse {
  answer: string;
  places: GroundedPlaceSource[];
  mode: 'gemini-maps' | 'fallback';
  dataMode: 'modeled-live-forecast' | 'illustrative-demo';
  uncertaintyNote: string;
  medicalDisclaimer: string;
  fallbackReason?: string;
}
