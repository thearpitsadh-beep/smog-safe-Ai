import type {
  AirQualityData,
  BudgetTier,
  CommuteMode,
  DailyPlan,
  DailySchedule,
  HouseholdProfile,
} from '../shared/types.ts';

const VALID_ID_RE = /^[a-zA-Z0-9_-]{1,128}$/;
const SCHEDULES = new Set<DailySchedule>(['school', 'office', 'home', 'mixed']);
const COMMUTES = new Set<CommuteMode>(['car', 'bus', 'metro', 'walk', 'cycle', 'remote']);
const BUDGETS = new Set<BudgetTier>(['low', 'medium', 'flexible']);

export interface SavedPlanPayload {
  uid: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  dataStatus: 'modeled-live-forecast' | 'illustrative-demo';
  scale: 'US AQI';
  usAqi: number;
  pm25: number;
  forecastTimestamp: string;
  sourceLabel: string;
  intensity: string;
  actionTitles: string[];
  schedule: DailySchedule;
  commute: CommuteMode;
  budget: BudgetTier;
}

export interface AirLogPayload {
  uid: string;
  city: string;
  usAqi: number;
  dataStatus: 'modeled-live-forecast' | 'illustrative-demo';
  actionTaken: string;
  note: string;
}

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && VALID_ID_RE.test(id);
}

export function buildPrivateProfileData(
  uid: string,
  email: string,
  displayName: string,
  profile: HouseholdProfile,
) {
  if (!isValidFirestoreId(uid)) {
    throw new Error('Invalid user UID.');
  }
  const lat = Number(profile.latitude);
  const lon = Number(profile.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Invalid coordinates.');
  }
  return {
    uid,
    email: String(email || '').trim().slice(0, 254),
    displayName: String(displayName || '').trim().slice(0, 80),
    city: String(profile.city || 'New Delhi').trim().slice(0, 80) || 'New Delhi',
    country: String(profile.country || 'India').trim().slice(0, 60) || 'India',
    latitude: lat,
    longitude: lon,
    schedule: SCHEDULES.has(profile.schedule) ? profile.schedule : 'mixed',
    commute: COMMUTES.has(profile.commute) ? profile.commute : 'car',
    budget: BUDGETS.has(profile.budget) ? profile.budget : 'low',
    children: Boolean(profile.children),
    seniors: Boolean(profile.seniors),
    sensitive: Boolean(profile.sensitive),
    purifier: Boolean(profile.purifier),
  };
}

export function buildSavedPlanData(
  uid: string,
  profile: HouseholdProfile,
  air: AirQualityData,
  plan: DailyPlan,
): SavedPlanPayload {
  if (!isValidFirestoreId(uid)) {
    throw new Error('Invalid user UID.');
  }
  const lat = Number(air.coordinates?.latitude ?? profile.latitude ?? 28.6139);
  const lon = Number(air.coordinates?.longitude ?? profile.longitude ?? 77.209);
  const usAqi = Math.max(0, Math.min(500, Math.round(Number(air.current.usAqi) || 0)));
  const pm25 = Math.max(0, Math.min(1500, Number(air.current.pm25 ?? 0) || 0));
  const titles = plan.actions
    .slice(0, 3)
    .map((a) => String(a.title || '').trim().slice(0, 160))
    .filter(Boolean);

  return {
    uid,
    city: String(profile.city || air.locationLabel || 'New Delhi').trim().slice(0, 80) || 'New Delhi',
    country: String(profile.country || 'India').trim().slice(0, 60) || 'India',
    latitude: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : 28.6139,
    longitude: Number.isFinite(lon) && lon >= -180 && lon <= 180 ? lon : 77.209,
    dataStatus: air.live ? 'modeled-live-forecast' : 'illustrative-demo',
    scale: 'US AQI',
    usAqi,
    pm25,
    forecastTimestamp: String(air.timestamp ?? '').slice(0, 64),
    sourceLabel: String(air.source || 'Demo data').trim().slice(0, 140) || 'Demo data',
    intensity: String(plan.intensity || 'Household routine').trim().slice(0, 100) || 'Household routine',
    actionTitles: titles.length > 0 ? titles : ['Follow cleaner daily routine'],
    schedule: SCHEDULES.has(profile.schedule) ? profile.schedule : 'mixed',
    commute: COMMUTES.has(profile.commute) ? profile.commute : 'car',
    budget: BUDGETS.has(profile.budget) ? profile.budget : 'low',
  };
}

export function buildAirLogData(
  uid: string,
  city: string,
  air: AirQualityData,
  actionTaken: string,
  note: string,
): AirLogPayload {
  if (!isValidFirestoreId(uid)) {
    throw new Error('Invalid user UID.');
  }
  const cleanAction = actionTaken.trim().slice(0, 120);
  const cleanNote = note.trim().slice(0, 300);
  if (!cleanAction || !cleanNote) {
    throw new Error('Action taken and note are required.');
  }
  return {
    uid,
    city: String(city || 'New Delhi').trim().slice(0, 80) || 'New Delhi',
    usAqi: Math.max(0, Math.min(500, Math.round(Number(air.current.usAqi) || 0))),
    dataStatus: air.live ? 'modeled-live-forecast' : 'illustrative-demo',
    actionTaken: cleanAction,
    note: cleanNote,
  };
}
