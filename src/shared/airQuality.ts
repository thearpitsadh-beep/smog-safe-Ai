import type {
  AirQualityData,
  AqiBand,
  BudgetTier,
  CommuteMode,
  CopilotStructuredResponse,
  DailyPlan,
  DailySchedule,
  HouseholdProfile,
  IndoorTip,
  PlanAction,
  PlanBriefStructuredResponse,
  SustainableSwap,
} from './types.ts';
import { EMISSION_FACTORS } from './emissions.ts';
import { DEMO_CITIES, knownLocation, validCoordinates } from './location.ts';

export { DEMO_CITIES };

interface DemoAirScenario {
  usAqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  ozone: number;
  trend: readonly number[];
  regionalContext: string;
}

// Values are invented EXAMPLES, never measurements. Display an unmissable demo banner.
export const DEMO_AIR: Readonly<Record<string, DemoAirScenario>> = Object.freeze({
  'New Delhi': {
    usAqi: 184,
    pm25: 82.6,
    pm10: 140.4,
    no2: 33.1,
    ozone: 65,
    trend: [178, 184, 181, 177, 172, 166, 171, 176, 181, 190, 196, 188],
    regionalContext: 'Dense winter/urban traffic and regional dust episodes commonly raise morning and evening particle buildup.',
  },
  Pune: {
    usAqi: 112,
    pm25: 37.4,
    pm10: 72.1,
    no2: 18.6,
    ozone: 42,
    trend: [105, 109, 112, 114, 108, 101, 95, 92, 98, 105, 111, 106],
    regionalContext: 'Commuter traffic corridors and construction dust often create mid-day dips and evening spikes.',
  },
  Mumbai: {
    usAqi: 98,
    pm25: 32.1,
    pm10: 60.8,
    no2: 21.2,
    ozone: 36,
    trend: [92, 95, 98, 102, 108, 104, 98, 94, 89, 86, 90, 92],
    regionalContext: 'Coastal sea breezes can disperse afternoon haze, while arterial road corridors stay elevated during peak commute hours.',
  },
  Bengaluru: {
    usAqi: 76,
    pm25: 22.8,
    pm10: 41.6,
    no2: 19.0,
    ozone: 31,
    trend: [72, 76, 71, 69, 66, 63, 65, 69, 72, 74, 73, 70],
    regionalContext: 'Tree-lined neighborhood streets generally have lower particle loads than major ring-road traffic bottlenecks.',
  },
  Lucknow: {
    usAqi: 201,
    pm25: 98.3,
    pm10: 158.2,
    no2: 39.5,
    ozone: 57,
    trend: [192, 201, 206, 198, 195, 189, 185, 182, 194, 208, 215, 205],
    regionalContext: 'Calm wind inversions across the Indo-Gangetic plain can trap particulate pollution close to street level.',
  },
});

export function demoAir(city = 'New Delhi'): AirQualityData {
  const key = Object.hasOwn(DEMO_AIR, city) ? city : 'New Delhi';
  const data = DEMO_AIR[key];
  const cityMeta = knownLocation(key);
  const hours = data.trend.map((usAqi, i) => ({
    time: `${String((8 + i) % 24).padStart(2, '0')}:00`,
    usAqi,
    pm25: Number(((data.pm25 * usAqi) / data.usAqi).toFixed(1)),
  }));
  return {
    source: 'DEMO ONLY — invented example, not a real reading',
    live: false,
    scale: 'US AQI',
    scaleNotice: 'US EPA AQI scale (0–500+), which differs numerically from India NAQI.',
    locationLabel: key,
    ...(cityMeta ? { coordinates: { latitude: cityMeta.latitude, longitude: cityMeta.longitude } } : {}),
    hourTimezone: 'demo',
    timestamp: null,
    fetchedAt: null,
    expiresAt: null,
    current: {
      usAqi: data.usAqi,
      pm25: data.pm25,
      pm10: data.pm10,
      no2: data.no2,
      ozone: data.ozone,
    },
    hours,
  };
}

export function aqiBand(aqi: number | null | undefined): AqiBand {
  if (typeof aqi !== 'number' || !Number.isFinite(aqi) || aqi < 0) {
    return {
      label: 'Unavailable',
      level: 'unknown',
      description: 'Air-quality data unavailable.',
      color: '#47595e',
    };
  }
  if (aqi <= 50) {
    return {
      label: 'Good',
      level: 'good',
      description: 'Air quality is generally satisfactory under the US AQI scale.',
      color: '#1f7254',
    };
  }
  if (aqi <= 100) {
    return {
      label: 'Moderate',
      level: 'moderate',
      description: 'Unusually sensitive people may need extra care during prolonged outdoor exertion.',
      color: '#8f640d',
    };
  }
  if (aqi <= 150) {
    return {
      label: 'Unhealthy for sensitive groups',
      level: 'sensitive',
      description: 'Children, older adults, and people with respiratory or heart conditions may be more affected.',
      color: '#a34f0b',
    };
  }
  if (aqi <= 200) {
    return {
      label: 'Unhealthy',
      level: 'unhealthy',
      description: 'Consider reducing prolonged or strenuous outdoor activity for everyone.',
      color: '#b03428',
    };
  }
  if (aqi <= 300) {
    return {
      label: 'Very unhealthy',
      level: 'very-unhealthy',
      description: 'Health alert: reduce outdoor exposure; sensitive people need extra care indoors.',
      color: '#7f2f72',
    };
  }
  return {
    label: 'Hazardous',
    level: 'hazardous',
    description: 'Health warning: avoid outdoor exertion when possible and keep indoor air sealed/filtered.',
    color: '#6b2236',
  };
}

const CITY_INJECTION_REGEX =
  /\b(?:ignore\s+(?:all\s+)?(?:previous|system)|reveal\s+(?:the\s+|your\s+)?(?:system\s+prompt|api\s*key|secret|instructions))\b/i;

export function safeProfile(input: unknown = {}): HouseholdProfile {
  const raw: Record<string, unknown> =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const allowedCommute: readonly CommuteMode[] = ['car', 'bus', 'metro', 'walk', 'cycle', 'remote'];
  const allowedBudget: readonly BudgetTier[] = ['low', 'medium', 'flexible'];
  const allowedSchedule: readonly DailySchedule[] = ['school', 'office', 'home', 'mixed'];

  const str = (val: unknown, fallback: string, maxLen = 80): string => {
    if (typeof val !== 'string') return fallback;
    const clean = val
      .normalize('NFKC')
      .replace(/[\x00-\x1f<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLen);
    if (!clean || CITY_INJECTION_REGEX.test(clean)) return fallback;
    return clean;
  };

  const hasValidCoords = validCoordinates(raw.latitude, raw.longitude);

  return {
    city: str(raw.city, 'New Delhi', 80),
    country: typeof raw.country === 'string' ? str(raw.country, 'India', 80) : undefined,
    ...(hasValidCoords
      ? {
          latitude: Number(raw.latitude),
          longitude: Number(raw.longitude),
        }
      : {}),
    schedule: allowedSchedule.includes(raw.schedule as DailySchedule)
      ? (raw.schedule as DailySchedule)
      : 'mixed',
    commute: allowedCommute.includes(raw.commute as CommuteMode)
      ? (raw.commute as CommuteMode)
      : 'car',
    budget: allowedBudget.includes(raw.budget as BudgetTier)
      ? (raw.budget as BudgetTier)
      : 'low',
    children: raw.children === true,
    seniors: raw.seniors === true,
    sensitive: raw.sensitive === true,
    purifier: raw.purifier === true,
  };
}

function getCityRegionalNote(cityName: string): string {
  const match = DEMO_AIR[cityName];
  if (match) return match.regionalContext;
  return 'Local micro-environments vary significantly between arterial roads, construction zones, and quieter residential lanes.';
}

function getDataProvenanceLabel(inputAir: Partial<AirQualityData> | undefined, aqi: number | null): string {
  if (aqi === null) {
    return 'Assumption: no live or demo US AQI value available; conservative baseline guidance applied.';
  }
  const sourceType = inputAir?.live
    ? `Modeled Open-Meteo/CAMS forecast (${inputAir.timestamp ?? 'timestamp unavailable'})`
    : 'Illustrative demo scenario (not a live measurement)';
  const pmText = Number.isFinite(inputAir?.current?.pm25)
    ? `, PM2.5 ${Number(inputAir?.current?.pm25).toFixed(1)} µg/m³`
    : '';
  return `${sourceType}: US AQI ${Math.round(aqi)}${pmText}.`;
}

/**
 * Deterministic recommendation engine; AI chat is supplementary and never overrides safety rules.
 * Every recommendation includes: action, why, supportingData, impactWithUncertainty, impactDomain.
 */
export function makePlan(
  inputProfile: Record<string, unknown> | HouseholdProfile,
  inputAir?: Partial<AirQualityData>,
): DailyPlan {
  const p = safeProfile(inputProfile as Record<string, unknown>);
  const current = inputAir?.current;
  const aqi = typeof current?.usAqi === 'number' && Number.isFinite(current.usAqi) ? current.usAqi : null;
  const band = aqiBand(aqi);
  const moderate = aqi !== null && aqi > 50;
  const poor = aqi !== null && aqi > 100;
  const severe = aqi !== null && aqi > 150;
  const verySevere = aqi !== null && aqi > 200;
  const sensitiveGroup = p.children || p.seniors || p.sensitive;

  const memberList = [
    p.children ? 'children' : '',
    p.seniors ? 'older adults' : '',
    p.sensitive ? 'air-sensitive members' : '',
  ].filter(Boolean);
  const vulnerableText = memberList.length
    ? ` especially for ${memberList.join(', ')} in ${p.city}`
    : ` in ${p.city}`;

  const dataLabel = getDataProvenanceLabel(inputAir, aqi);
  const cityNote = getCityRegionalNote(p.city);

  // 1. MORNING ACTION (Exposure focus)
  const maskOption =
    p.budget === 'low'
      ? 'If affordable, a well-fitting N95/KF94 mask for unavoidable roadside travel helps filter fine particles.'
      : 'Use a well-fitting N95/FFP2 respirator during unavoidable roadside travel for teens/adults (check pediatric fit guidance for young children).';

  let morningAction: PlanAction;
  if (verySevere) {
    morningAction = {
      period: 'MORNING',
      title: `Shift ${p.schedule === 'school' ? 'school & play' : 'morning activity'} indoors in ${p.city}`,
      detail: `Avoid outdoor exercise and non-essential morning trips. ${maskOption} Keep car windows closed with recirculated AC on essential drives.`,
      why: `US AQI above 200 poses elevated risk to everyone${vulnerableText}. ${cityNote}`,
      tradeOff:
        'Trades outdoor active play/exercise and car cabin fresh-air ventilation for lower short-term particle intake; crack a window briefly only if indoor CO2/stuffiness builds.',
      supportingData: `${dataLabel} Household flags: ${memberList.length ? memberList.join(', ') : 'general adult'}; schedule: ${p.schedule}.`,
      impactWithUncertainty:
        'Staying indoors in a closed-window space typically lowers short-term outdoor PM2.5 exposure, though indoor infiltration depends on building sealing and indoor sources.',
      impactDomain: 'exposure',
      tag: 'Exposure reduction',
    };
  } else if (severe) {
    morningAction = {
      period: 'MORNING',
      title: 'Choose lower-exposure morning activities',
      detail: `Keep strenuous exercise indoors where practical in ${p.city}. If ${p.schedule === 'school' ? 'school travel' : 'work travel'} is essential, limit time near busy roads and monitor official local alerts.`,
      why: `US AQI in the Unhealthy band (151–200) increases respiratory strain during exertion${vulnerableText}. ${cityNote}`,
      tradeOff:
        'Swaps high-intensity outdoor workouts for indoor movement; slightly adds convenience planning around school/commute buffers.',
      supportingData: `${dataLabel} Household: ${memberList.length ? memberList.join(', ') : 'standard'}; budget: ${p.budget}.`,
      impactWithUncertainty:
        'Moving vigorous exertion indoors avoids higher breathing-rate outdoor particle intake; actual exposure reduction depends on indoor air cleanliness.',
      impactDomain: 'exposure',
      tag: 'Exposure reduction',
    };
  } else if (poor) {
    morningAction = {
      period: 'MORNING',
      title: 'Make outdoor time more intentional',
      detail: `Favor quieter residential lanes over main arterial roads in ${p.city}, and shorten strenuous outdoor play for sensitive family members. Check the hourly outlook before exercising.`,
      why: `US AQI 101–150 affects sensitive groups first${vulnerableText}. ${cityNote}`,
      tradeOff:
        'Quiet side routes can add a few extra minutes vs main arterial shortcuts, while avoiding sustained heavy-exertion outdoor bursts.',
      supportingData: `${dataLabel} Schedule: ${p.schedule}; sensitive household: ${sensitiveGroup ? 'yes' : 'no'}.`,
      impactWithUncertainty:
        'Reducing time near tailpipes and moderating exertion may lower peak particle intake, though there is no single guaranteed safe outdoor hour.',
      impactDomain: 'exposure',
      tag: 'Exposure reduction',
    };
  } else if (moderate && sensitiveGroup) {
    morningAction = {
      period: 'MORNING',
      title: 'Keep normal morning routine with gentle pacing',
      detail: `Normal outdoor routines are reasonable for most people in ${p.city}, while ${memberList.join(' and ')} should watch for coughing or irritation near busy traffic.`,
      why: `Moderate US AQI (51–100) is generally acceptable, though unusually sensitive individuals can still react near heavy traffic.`,
      tradeOff:
        'Preserves regular outdoor activity while pacing high-effort stretches for sensitive household members near peak intersections.',
      supportingData: `${dataLabel} Sensitive household flags active (${memberList.join(', ')}).`,
      impactWithUncertainty:
        'Choosing lower-traffic routes offers modest exposure buffering; effects vary widely by individual sensitivity and street canyon traffic.',
      impactDomain: 'exposure',
      tag: 'Exposure',
    };
  } else {
    morningAction = {
      period: 'MORNING',
      title: 'Plan outdoor time with the forecast',
      detail: `Normal morning outdoor activity is reasonable in ${p.city}; keep checking official advisories if wind or traffic conditions shift later.`,
      why: `Current US AQI is in the Good/Moderate range, making outdoor movement lower-risk${vulnerableText}.`,
      tradeOff:
        'Requires checking hourly updates before late-day plans because evening wind inversions can reverse clean morning conditions.',
      supportingData: `${dataLabel} City context: ${p.city}.`,
      impactWithUncertainty:
        'Maintaining awareness of hourly shifts helps catch sudden evening buildup; localized roadside dust can still exceed citywide modeled averages.',
      impactDomain: 'exposure',
      tag: 'Exposure awareness',
    };
  }

  // 2. AFTERNOON ACTION (Commute / Emissions + Exposure trade-off)
  const commuteFactor = EMISSION_FACTORS[p.commute];
  const commuteActions: Record<CommuteMode, { title: string; detail: string; why: string; tradeOff: string; impact: string }> = {
    car: {
      title: p.budget === 'flexible' ? 'Combine errands or switch suitable trips to rail/EV' : 'Combine essential car journeys',
      detail: `Group errands in ${p.city} into one loop and avoid engine idling while waiting at schools or markets. Swap short solo car hops for metro or shared transit when practical.`,
      why: `Private cars emit ~${commuteFactor.kgPerPkm} kg CO2e/km (solo) and add street-level NO2 and brake/exhaust particles near pedestrians.`,
      tradeOff:
        'Batching errands trades ad-hoc single trips for scheduled loops; enclosed AC cabin filters road dust slightly better than open sidewalks, yet still generates community tailpipe emissions.',
      impact:
        'Eliminating two 5 km cold-start errands saves ~1.7 kg CO2e/week (range 1.3–2.2 kg); does not directly lower your own indoor exposure unless trips are avoided.',
    },
    bus: {
      title: 'Use public bus transit with lower-exposure stops',
      detail: `Board at quieter stops set back from main intersections in ${p.city} when practical, and keep bus trips grouped rather than splitting errands.`,
      why: `Urban buses average ~${commuteFactor.kgPerPkm} kg CO2e/passenger-km (~54% lower than solo driving), though open-air stops carry roadside exposure.`,
      tradeOff:
        'Significantly reduces per-passenger emissions vs driving solo, but waiting at busy roadside stops exposes riders to curb-level exhaust (wear a mask on >150 AQI days).',
      impact:
        'Reduces per-person transport emissions roughly in half vs solo car (occupancy-dependent); personal inhaled exposure still depends on traffic queue time and bus ventilation.',
    },
    metro: {
      title: 'Maximize electric metro / rail corridors',
      detail: `Use metro for primary ${p.city} corridors and pair with lower-traffic last-mile feeder streets${severe ? '; limit brisk outdoor walking segments in high smog' : ''}.`,
      why: `Electric metro averages ~${commuteFactor.kgPerPkm} kg CO2e/passenger-km on India's grid (~76% below solo car) with zero tailpipe exhaust on the street.`,
      tradeOff:
        'Strong CO2e savings and zero street tailpipe emissions, though last-mile walking/waiting segments remain exposed to ambient smog on severe days.',
      impact:
        'Avoids ~0.13 kg CO2e per km vs solo driving (range 0.07–0.195 kg/km depending on regional power mix); personal exposure depends on station air and walking links.',
    },
    walk: {
      title: severe ? 'Reroute or shorten afternoon walking trips' : 'Choose lower-traffic walking routes',
      detail: severe
        ? `Walking emits zero tailpipe CO2e, but with US AQI >150 in ${p.city}, take enclosed transit for longer trips or choose calm inner lanes.`
        : `Use shaded, low-traffic residential lanes in ${p.city} and avoid idling vehicle queues while walking.`,
      why: `Walking has 0 tailpipe emissions, yet roadside walking during elevated AQI increases inhaled dose compared with away-from-traffic routes.`,
      tradeOff:
        'Saves 100% of tailpipe CO2e vs motorized travel, but increases personal PM2.5 inhalation along busy roads—shortening or shifting severe-day walks to metro balances both goals.',
      impact:
        'Maintains zero tailpipe emissions; moving one block off a congested road can noticeably cut peak black-carbon spikes, though background urban haze remains.',
    },
    cycle: {
      title: severe ? 'Pause intense cycling; choose transit or calm pace' : 'Cycle on protected low-traffic routes',
      detail: severe
        ? `At US AQI >150 in ${p.city}, elevated breathing rates increase particle intake—defer vigorous cycling or switch to enclosed metro/bus for essential commutes.`
        : `Stick to low-traffic streets in ${p.city} and keep a steady, non-strenuous pace during moderate/sensitive hours.`,
      why: `Cycling produces 0 tailpipe emissions, but higher ventilation rate during exertion multiplies inhaled particle dose in polluted corridors.`,
      tradeOff:
        'Zero operational transport CO2e, yet deep breathing during brisk cycling magnifies pollutant deposition when AQI >150—switching to transit temporarily protects lungs.',
      impact:
        'Zero operational transport CO2e vs solo car; moderating pace or switching on severe days prevents elevated particle deposition in airways.',
    },
    remote: {
      title: 'Keep your remote-work low-emission advantage',
      detail: `Use remote days in ${p.city} to skip peak-hour traffic completely and batch essential local errands outside rush hours.`,
      why: `Avoiding a commute eliminates associated vehicle CO2e and keeps you out of congested roadside pollutant plumes.`,
      tradeOff:
        'Avoids both road emissions and roadside exposure simultaneously; shifts slightly more daytime electricity demand to home cooling/filtration.',
      impact:
        'Saves ~0.17 kg CO2e per avoided solo-car km (uncertainty: excludes home electricity/AC load) and avoids traffic-corridor exposure.',
    },
  };

  const cSpec = commuteActions[p.commute];
  const afternoonAction: PlanAction = {
    period: 'AFTERNOON',
    title: cSpec.title,
    detail: cSpec.detail,
    why: cSpec.why,
    tradeOff: cSpec.tradeOff,
    supportingData: `${dataLabel} Primary commute mode: ${commuteFactor.label}; citation: ${commuteFactor.sourceCitation}.`,
    impactWithUncertainty: cSpec.impact,
    impactDomain: p.commute === 'walk' || p.commute === 'cycle' ? 'exposure' : 'emissions',
    tag: p.commute === 'walk' || p.commute === 'cycle' ? 'Emissions vs exposure' : 'Lower emissions',
  };

  // 3. EVENING ACTION (Indoor pollutant generation + Home care)
  let eveningAction: PlanAction;
  if (p.purifier || p.budget === 'flexible') {
    eveningAction = {
      period: 'EVENING',
      title: p.purifier ? 'Run HEPA filtration and seal indoor sources' : 'Target evening indoor filtration & source control',
      detail: `${p.purifier ? 'Run your appropriately sized HEPA purifier on medium/auto in the main bedroom or living room with doors closed.' : 'Prioritize clean cooking exhaust and consider a CADR-matched true HEPA unit for the main sleeping space.'} Skip incense, candles, and dry sweeping.`,
      why: `Evening inversion in cities like ${p.city} often raises outdoor PM2.5 while dinner cooking adds indoor particles${vulnerableText}.`,
      tradeOff:
        'Closing windows maximizes HEPA CADR efficiency while trading natural breeze—remember to vent cooking exhaust or air out briefly once outdoor AQI improves.',
      supportingData: `${dataLabel} Purifier owned: ${p.purifier ? 'yes' : 'no'}; budget: ${p.budget}; household: ${p.schedule}.`,
      impactWithUncertainty:
        'Combining cooking exhaust + source removal with correctly sized true HEPA filtration can substantially lower indoor PM2.5, depending on room sealing and filter condition.',
      impactDomain: 'indoor_generation',
      tag: 'Indoor pollutant generation',
    };
  } else if (p.schedule === 'school' || p.children) {
    eveningAction = {
      period: 'EVENING',
      title: 'Reset the home after school & play',
      detail: 'Leave dusty shoes and outerwear near the entrance, damp-wipe hard surfaces instead of dry sweeping, use kitchen exhaust while cooking, and keep indoor play smoke-free.',
      why: `Children spend hours close to floor dust, and evening cooking or incense can spike indoor PM2.5 above outdoor levels${vulnerableText}.`,
      tradeOff:
        'Zero-cost habit change taking ~10 minutes daily; cuts resuspended dust and indoor smoke, though sealed rooms without filtration still gradually equilibrate with outdoor haze.',
      supportingData: `${dataLabel} Household includes children / school schedule; budget: ${p.budget}.`,
      impactWithUncertainty:
        'Damp cleaning and eliminating indoor smoke prevent resuspended dust and combustion spikes at zero cost, though they do not filter incoming outdoor smog.',
      impactDomain: 'indoor_generation',
      tag: 'Indoor pollutant generation',
    };
  } else {
    eveningAction = {
      period: 'EVENING',
      title: 'Keep evening indoor air smoke-free',
      detail: 'Skip incense, mosquito coils, and candles; run kitchen exhaust or lid pans while frying, and check outdoor AQI before opening windows for cooling.',
      why: `Indoor combustion sources (incense, smoky cooking, coils) generate concentrated fine particles inside closed rooms.`,
      tradeOff:
        'Replacing traditional incense/coils with non-combustion alternatives eliminates strong fragrance/smoke emissions inside low-ventilation evening rooms.',
      supportingData: `${dataLabel} Schedule: ${p.schedule}; budget: ${p.budget}.`,
      impactWithUncertainty:
        'Eliminating indoor combustion avoids sharp indoor PM2.5 peaks; effectiveness of natural ventilation depends heavily on whether outdoor AQI is lower than indoor air.',
      impactDomain: 'indoor_generation',
      tag: 'Indoor pollutant generation',
    };
  }

  // Budget- and purifier-aware Indoor Guide
  const indoor: IndoorTip[] = [
    {
      title: 'Stop pollution at the source',
      detail: 'Skip incense, indoor smoking, mosquito coils, unnecessary candles, and smoky frying without exhaust. Use pot lids and clean cooking fuels.',
      why: 'Preventing indoor combustion avoids creating fine particles in enclosed rooms where family members breathe for hours.',
      tradeOff: 'Zero equipment cost; trades traditional fragrances or smoky searing for markedly lower indoor PM2.5 buildup.',
      supportingData: `Applies across all budgets (${p.budget}) and cities (${p.city}).`,
      impactWithUncertainty:
        'Source elimination prevents major indoor PM2.5 spikes; exact indoor levels still depend on outdoor air leakage.',
      impactDomain: 'indoor_generation',
      icon: 'source',
      category: 'Free or low cost',
    },
    {
      title: 'Control settled dust without resuspending it',
      detail: 'Damp-mop floors and damp-wipe shelves rather than dry sweeping or feather dusting; leave outdoor shoes at the door.',
      why: 'Dry sweeping kicks settled coarse and fine dust back into breathing height—especially relevant with children or seniors at home.',
      tradeOff: 'Requires wringing a damp cloth or mop rather than a quick dry broom, avoiding temporary dust clouds indoors.',
      supportingData: `Household profile: ${p.children ? 'children present' : p.seniors ? 'older adults present' : 'general household'}.`,
      impactWithUncertainty:
        'Reduces coarse dust (PM10) resuspension; does not remove sub-micron combustion smoke already suspended in air.',
      impactDomain: 'indoor_generation',
      icon: 'spark',
      category: 'Free habit',
    },
    {
      title: 'Time window ventilation to outdoor conditions',
      detail: severe
        ? `With US AQI >150 in ${p.city}, keep exterior windows mostly closed during peak haze and ventilate briefly only when cooking or if outdoor AQI dips.`
        : `Ventilate briefly during lower-traffic afternoon hours to clear indoor CO2 and cooking fumes, while watching for sudden evening smog.`,
      why: 'Natural cross-ventilation clears indoor-generated pollutants, but opening windows during severe outdoor smog brings outdoor PM2.5 indoors.',
      tradeOff: 'Keeping windows shut blocks outdoor smog inflow but lets cooking odors and CO2 accumulate unless vented selectively.',
      supportingData: `${dataLabel}`,
      impactWithUncertainty:
        'Balancing indoor buildup vs outdoor infiltration depends on local traffic timing and cooking frequency.',
      impactDomain: 'exposure',
      icon: 'wind',
      category: 'Situation dependent',
    },
    p.purifier
      ? {
          title: 'Run your existing HEPA purifier effectively',
          detail: 'Place your true HEPA purifier in the most-occupied bedroom with doors/windows shut, keep intake unobstructed, and inspect pre-filters monthly.',
          why: 'Mechanical HEPA media captures airborne fine particles without generating harmful ozone.',
          tradeOff: 'Continuous running adds modest electricity use (~25–55 W) and filter replacement cost, greatest benefit in closed bedrooms.',
          supportingData: 'Household indicated an existing HEPA purifier.',
          impactWithUncertainty:
            'Real-world CADR effectiveness depends on matching room volume, sealing drafts, and replacing saturated filters on schedule.',
          impactDomain: 'exposure',
          icon: 'filter',
          category: 'Existing equipment',
        }
      : p.budget === 'low'
        ? {
            title: 'Start with free source controls (no ozone/plant myths)',
            detail: 'Focus on eliminating indoor smoke and sealing window gaps before buying hardware. Do not rely on houseplants or ozone-generating ionizers.',
            why: 'Zero-cost behavioral controls prevent indoor pollution spikes; ozone purifiers can irritate lungs, and plants cannot filter smog fast enough.',
            tradeOff: 'Costs zero upfront budget while protecting against indoor smoke, though it cannot mechanically scrub leaked outdoor smog.',
            supportingData: `Budget preference: Keep it affordable (${p.budget}).`,
            impactWithUncertainty:
              'Prevents indoor-generated spikes at zero spend, though it cannot remove outdoor smoke that leaks indoors.',
            impactDomain: 'indoor_generation',
            icon: 'leaf',
            category: 'No equipment required',
          }
        : {
            title: p.budget === 'flexible' ? 'Choose a CADR-sized true HEPA purifier' : 'Compare affordable true-HEPA options',
            detail:
              p.budget === 'flexible'
                ? 'Size a true HEPA (non-ionizing, zero-ozone) purifier to your main bedroom CADR and check annual replacement-filter availability.'
                : 'Look for a simple, certified true-HEPA unit sized for one sleeping room (check filter replacement cost). Avoid ozone-generating devices.',
            why: 'True mechanical HEPA filtration safely lowers indoor PM2.5 in closed rooms without chemical byproducts.',
            tradeOff: 'Requires upfront device spend plus recurring replacement HEPA filter cartridges to maintain performance without ozone risk.',
            supportingData: `Budget tier: ${p.budget}; purifier owned: no; ${dataLabel}`,
            impactWithUncertainty:
              'Achieves meaningful indoor PM2.5 reduction in a closed room sized to the unit’s CADR; open doors or high leakage reduce efficiency.',
            impactDomain: 'exposure',
            icon: 'filter',
            category: p.budget === 'flexible' ? 'Recommended hardware' : 'Mid-budget option',
          },
  ];

  // City-, budget-, and commute-responsive sustainable swaps
  const swaps: SustainableSwap[] = [
    {
      title: p.commute === 'car' ? 'Batch errands into one warm-engine loop' : 'Group household errands into one low-traffic trip',
      effect: 'Fewer vehicle kilometres & cold-start emissions',
      description: `Coordinate groceries, school pickups, and appointments across ${p.city} to eliminate short standalone car/two-wheeler runs.`,
      supportingData: `Solo car baseline ~${EMISSION_FACTORS.car.kgPerPkm} kg CO2e/km (range 0.13–0.22 kg/km).`,
      impactWithUncertainty: 'Each avoided 10 km round-trip car errand saves ~1.7 kg CO2e (varies by vehicle & congestion).',
      impactDomain: 'emissions',
      icon: 'car',
    },
    {
      title:
        p.commute === 'metro'
          ? 'Pair metro rides with low-traffic feeder walks'
          : 'Shift suitable car corridors to metro or urban bus',
      effect: 'Lower per-passenger transport emissions',
      description: `Use ${p.city}'s metro or bus corridors for predictable daily commutes; check the Impact Lab for weekly kg CO2e ranges.`,
      supportingData: `Metro ~${EMISSION_FACTORS.metro.kgPerPkm} kg CO2e/pkm; Bus ~${EMISSION_FACTORS.bus.kgPerPkm} kg CO2e/pkm.`,
      impactWithUncertainty:
        'Lowers operational transport CO2e by ~54% (bus) to ~76% (metro) vs solo car; personal exposure depends on traffic waits and station air.',
      impactDomain: 'emissions',
      icon: 'train',
    },
    {
      title: 'Eliminate indoor incense, coil, and waste burning',
      effect: 'Lower indoor particle generation',
      description: 'Replace smoky indoor combustion habits with electric/non-smoke alternatives and ensure kitchen exhaust is vented.',
      supportingData: `Household schedule: ${p.schedule}; budget: ${p.budget}.`,
      impactWithUncertainty:
        'Prevents sharp indoor PM2.5 accumulation, especially in closed rooms during winter smog episodes.',
      impactDomain: 'indoor_generation',
      icon: 'home',
    },
  ];

  const note =
    aqi === null
      ? 'No reliable AQI available: recommendations are general baseline guidance, not based on live air conditions.'
      : `Based on ${inputAir?.live ? 'modeled Open-Meteo/CAMS forecast data' : 'illustrative demo example data'}: US AQI ${Math.round(aqi)} (${band.label.toLowerCase()}).`;

  return {
    status: band,
    note,
    profile: p,
    intensity: verySevere
      ? 'Stay indoors & protect sensitive lungs'
      : severe
        ? 'Take extra care today'
        : poor
          ? 'Plan thoughtfully today'
          : 'Make the most of your day',
    intro: verySevere
      ? `Severe modeled/demo air conditions suggest keeping activity indoors${vulnerableText}.`
      : severe
        ? `Pollution conditions suggest limiting unnecessary outdoor exertion${vulnerableText}.`
        : poor
          ? `A more cautious outdoor routine can help${vulnerableText}.`
          : `Build a practical, lower-emission routine around your household${vulnerableText}.`,
    actions: [morningAction, afternoonAction, eveningAction],
    indoor,
    swaps,
    disclaimer:
      'General environmental information, not medical advice. Official local alerts (e.g., CPCB/SAFAR in India) and a clinician’s advice take priority for health concerns.',
  };
}

export function fallbackAnswer(
  query: string,
  profileInput: Record<string, unknown> | HouseholdProfile = {},
  air: Partial<AirQualityData> = {},
): CopilotStructuredResponse {
  const q = String(query || '').toLowerCase();
  const profile = safeProfile(profileInput as Record<string, unknown>);
  const aqi = typeof air?.current?.usAqi === 'number' && Number.isFinite(air.current.usAqi) ? air.current.usAqi : null;
  const band = aqiBand(aqi);
  const dataLabel = air?.live ? 'modeled Open-Meteo forecast' : 'illustrative demo scenario';

  if (/api key|secret|system prompt|developer message|ignore previous|password|token|env/i.test(q)) {
    return {
      answer:
        'I can help with cleaner-air choices, daily routines, indoor air, and commute emissions, but I cannot disclose private settings, credentials, or internal instructions.',
      keyActions: ['Ask about indoor air habits, commuting trade-offs, or family planning.'],
      impactDomain: 'mixed',
      uncertaintyNote: 'Security guardrail active: private configuration is never exposed.',
      medicalDisclaimer: 'General environmental information only; not medical advice.',
    };
  }

  if (/asthma|pregnan|baby|infant|chest pain|breath|medical|hospital|medicine|inhaler|symptom|cough|wheez/i.test(q)) {
    return {
      answer: `Air pollution can affect sensitive people differently. In ${profile.city}, the current ${dataLabel} is ${aqi !== null ? `US AQI ${Math.round(aqi)} (${band.label})` : 'unavailable'}. Consider reducing outdoor exertion during high-pollution periods and follow official local alerts. I cannot diagnose symptoms or recommend medication—for concerning or urgent symptoms, seek professional medical care.`,
      keyActions: [
        'Reduce strenuous outdoor exertion when US AQI is elevated.',
        'Monitor official local health advisories and keep prescribed care plans handy.',
        'Consult a licensed clinician promptly for breathing symptoms or chest discomfort.',
      ],
      impactDomain: 'exposure',
      uncertaintyNote: 'Individual health responses vary; modeled or demo AQI is not a clinical risk score.',
      medicalDisclaimer: 'Not medical advice or diagnosis. Seek professional medical care for symptoms.',
    };
  }

  if (/indoor|room|home|window|purif|filter|plant|incense|ventilat|hepa|ozone/i.test(q)) {
    return {
      answer:
        'Begin with indoor source control: avoid smoke from incense, cigarettes, mosquito coils, and candles; damp-dust surfaces instead of dry sweeping; and use kitchen exhaust when cooking. An appropriately sized true HEPA purifier (never an ozone-generating ionizer) can reduce airborne particles in a closed room. Opening windows depends on outdoor conditions—during severe smog it lets outdoor PM2.5 inside, and houseplants alone cannot filter severe particle pollution.',
      keyActions: [
        'Eliminate indoor smoke sources (incense, coils, candles, smoky cooking).',
        'Damp-mop floors instead of dry sweeping.',
        profile.purifier || profile.budget !== 'low'
          ? 'Use a CADR-matched true HEPA purifier with zero ozone emission.'
          : 'Check outdoor AQI before opening windows; prioritize free source controls first.',
      ],
      impactDomain: 'indoor_generation',
      uncertaintyNote: 'Indoor air quality depends on room sealing, cooking ventilation, and outdoor infiltration.',
      medicalDisclaimer: 'General indoor environmental guidance only; not medical advice.',
    };
  }

  if (/commut|bus|metro|cycle|walk|travel|car|emission|carbon|co2/i.test(q)) {
    return {
      answer: `First ask whether the trip is necessary. For ${profile.city}, switching solo car commutes (~0.171 kg CO2e/km) to metro (~0.041 kg CO2e/pkm) or bus (~0.078 kg CO2e/pkm) lowers per-person emissions, as shown in the Impact Lab. However, lower emissions do NOT automatically mean lower personal inhaled exposure—walking or cycling along busy roads during poor AQI increases breathing rate and particle intake.`,
      keyActions: [
        'Combine errands to eliminate short solo car trips.',
        'Use electric metro or shared bus for longer corridors.',
        'On poor-AQI days, avoid strenuous roadside cycling or choose low-traffic lanes.',
      ],
      impactDomain: 'emissions',
      uncertaintyNote: 'Emission factors vary by occupancy, vehicle age, and regional electricity grid mix.',
      medicalDisclaimer: 'General environmental planning only; not medical advice.',
    };
  }

  if (/school|child|parent|senior|elder|kid|outdoor|run|exercise/i.test(q)) {
    return {
      answer: `For ${profile.city}, the current ${dataLabel} is ${aqi !== null ? `US AQI ${Math.round(aqi)} (${band.label.toLowerCase()})` : 'unavailable'}. Adjust prolonged outdoor exercise according to local official advisories, especially for children and older adults. Favor lower-traffic streets, shorter unavoidable outdoor stops, and indoor activities when conditions are poor.`,
      keyActions: [
        'Move vigorous sports or recess indoors when US AQI exceeds 150.',
        'Choose quieter residential lanes away from arterial traffic for unavoidable walks.',
        'Keep dusty shoes near the entrance and damp-clean indoor floors.',
      ],
      impactDomain: 'exposure',
      uncertaintyNote: 'Citywide modeled forecasts may miss hyper-local traffic or construction spikes.',
      medicalDisclaimer: 'Not medical advice. Follow school/local health notices and pediatric guidance.',
    };
  }

  if (/what|aqi|pollut|smog|pm2|scale|india/i.test(q)) {
    return {
      answer: `US AQI expresses outdoor air-quality conditions on the US EPA index, which uses different breakpoints from India's National AQI (NAQI)—always check which scale is shown. The currently selected ${dataLabel} for ${profile.city} is ${aqi !== null ? `US AQI ${Math.round(aqi)} (${band.label})` : 'unavailable'}. PM2.5 refers to fine inhalable particles measured in µg/m³. Check official local monitors (e.g., CPCB/SAFAR) alongside this forecast.`,
      keyActions: [
        'Check the source banner to confirm whether numbers are Demo or Modeled Forecast.',
        'Compare hourly US AQI trends before scheduling outdoor exercise.',
      ],
      impactDomain: 'exposure',
      uncertaintyNote: 'Modeled CAMS/Open-Meteo forecasts approximate regional air quality and differ from ground sensors.',
      medicalDisclaimer: 'General air-quality literacy only; not medical advice.',
    };
  }

  return {
    answer: `For your ${profile.city} household (${aqi !== null ? `US AQI ${Math.round(aqi)}, ${band.label.toLowerCase()}, ${dataLabel}` : dataLabel}), start with three steps: (1) check the forecast and official local alerts before outdoor exertion; (2) stop indoor smoke and damp-clean dust; (3) group car trips or use metro/bus when practical without confusing emissions avoided with reduced personal inhalation.`,
    keyActions: [
      'Check hourly outlook and official local alerts before outdoor plans.',
      'Keep indoor rooms free of incense, coils, and unvented cooking smoke.',
      'Group car errands or shift suitable corridors to metro/bus.',
    ],
    impactDomain: 'mixed',
    uncertaintyNote: `Guidance uses deterministic household rules grounded in the active ${dataLabel}.`,
    medicalDisclaimer: 'General environmental information, not medical advice.',
  };
}

export function fallbackPlanBrief(
  plan: DailyPlan,
  air: Partial<AirQualityData> = {},
): PlanBriefStructuredResponse {
  const aqi = typeof air?.current?.usAqi === 'number' && Number.isFinite(air.current.usAqi)
    ? Math.round(air.current.usAqi)
    : null;
  const band = aqiBand(aqi);
  const dataStatus = air?.live
    ? `modeled Open-Meteo/CAMS forecast (${air.timestamp ?? 'timestamp unavailable'})`
    : 'illustrative demo scenario (not a live measurement)';
  const morning = plan.actions[0];
  const afternoon = plan.actions[1];
  const evening = plan.actions[2];
  return {
    brief: `For your ${plan.profile.city} household under this ${dataStatus} (${aqi !== null ? `US AQI ${aqi}, ${band.label.toLowerCase()}` : 'AQI unavailable'}), prioritize ${morning.title.toLowerCase()} in the morning, ${afternoon.title.toLowerCase()} for daytime mobility, and ${evening.title.toLowerCase()} at home.`,
    keyFocus: `${plan.intensity} (${morning.tag} + ${evening.tag})`,
    uncertaintyNote: `Grounded in ${dataStatus} on the US AQI scale (distinct from India NAQI).`,
    medicalDisclaimer: 'General environmental planning only, not medical advice.',
  };
}
