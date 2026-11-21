import type {
  CommuteMode,
  EmissionFactorSpec,
  TravelImpactInput,
  TravelImpactResult,
} from './types.ts';

/**
 * Sourced commute emission factors (kg CO2e per passenger-km) for urban India context.
 * Ranges reflect fleet age, occupancy, fuel mix, and regional grid carbon intensity.
 * Always distinguish tailpipe/grid GHG emissions from personal PM2.5 inhalation exposure.
 */
export const EMISSION_FACTORS: Readonly<Record<CommuteMode, EmissionFactorSpec>> = Object.freeze({
  car: {
    mode: 'car',
    label: 'Solo passenger car',
    kgPerPkm: 0.171,
    minKgPerPkm: 0.13,
    maxKgPerPkm: 0.22,
    sourceCitation:
      'WRI India GHG Program historical baseline (2018–2021) & UK DESNZ urban mid-size passenger car baseline (single occupant)',
    exposureComparison:
      'Cabin reduces direct windblown dust slightly only with recirculated AC + clean cabin filter, while tailpipe adds to neighborhood traffic pollution.',
    isIllustrativeZero: false,
  },
  bus: {
    mode: 'bus',
    label: 'Urban bus',
    kgPerPkm: 0.078,
    minKgPerPkm: 0.055,
    maxKgPerPkm: 0.105,
    sourceCitation:
      'WRI India / MoEFCC historical urban public bus reference range (2018–2021, occupancy-dependent)',
    exposureComparison:
      'Lowers per-person road emissions vs solo driving, though waiting at busy bus stops and open-window buses still expose riders to roadside PM2.5.',
    isIllustrativeZero: false,
  },
  metro: {
    mode: 'metro',
    label: 'Metro / electric rail',
    kgPerPkm: 0.041,
    minKgPerPkm: 0.025,
    maxKgPerPkm: 0.06,
    sourceCitation:
      'CEA India historical grid emission factor (~0.716 kg CO2/kWh, 2018–2021 reference range) applied to urban electric metro traction',
    exposureComparison:
      'Eliminates tailpipe emissions along the corridor and often lowers roadside exposure compared with open traffic, depending on station ventilation and last-mile walk.',
    isIllustrativeZero: false,
  },
  walk: {
    mode: 'walk',
    label: 'Walking',
    kgPerPkm: 0,
    minKgPerPkm: 0,
    maxKgPerPkm: 0,
    sourceCitation:
      'Zero operational tailpipe or traction CO2e (excludes dietary/lifecycle factors)',
    exposureComparison:
      'Zero tailpipe emissions, but walking along congested roads during high US AQI (>100) increases personal pollution inhalation compared with enclosed filtered transit.',
    isIllustrativeZero: true,
  },
  cycle: {
    mode: 'cycle',
    label: 'Cycling',
    kgPerPkm: 0,
    minKgPerPkm: 0,
    maxKgPerPkm: 0,
    sourceCitation:
      'Zero operational tailpipe CO2e for non-motorized bicycle (excludes manufacturing lifecycle)',
    exposureComparison:
      'Zero tailpipe emissions, but higher breathing rate during brisk cycling elevates inhaled PM2.5 dose in unhealthy air unless routed away from traffic.',
    isIllustrativeZero: true,
  },
  remote: {
    mode: 'remote',
    label: 'Remote / avoid trip',
    kgPerPkm: 0,
    minKgPerPkm: 0,
    maxKgPerPkm: 0,
    sourceCitation:
      'Zero commute-transport CO2e avoided trip boundary (excludes incremental home electricity/HVAC use)',
    exposureComparison:
      'Avoids both commute emissions and roadside outdoor pollution exposure; indoor air quality then depends on home source control and filtration.',
    isIllustrativeZero: true,
  },
});

export const SOURCED_KG_PER_KM: Readonly<Record<CommuteMode, number>> = Object.freeze({
  car: EMISSION_FACTORS.car.kgPerPkm,
  bus: EMISSION_FACTORS.bus.kgPerPkm,
  metro: EMISSION_FACTORS.metro.kgPerPkm,
  walk: EMISSION_FACTORS.walk.kgPerPkm,
  cycle: EMISSION_FACTORS.cycle.kgPerPkm,
  remote: EMISSION_FACTORS.remote.kgPerPkm,
});

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function travelImpact(input: TravelImpactInput = {}): TravelImpactResult {
  const km = Number(input.distanceKm ?? 12);
  const days = Number(input.daysPerWeek ?? 5);
  const option = (input.option ?? 'metro') as CommuteMode;

  if (!Number.isFinite(km) || km < 0 || km > 300 || !Number.isInteger(days) || days < 0 || days > 7) {
    throw new RangeError('Distance must be 0–300 km and travel days must be an integer 0–7.');
  }
  if (!Object.hasOwn(EMISSION_FACTORS, option)) {
    throw new RangeError('Unsupported transport mode.');
  }

  const validateFactorOverride = (raw: unknown, label: string): number | null => {
    if (raw === undefined || raw === null || raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 2) {
      throw new RangeError(`${label} must be between 0 and 2.0 kg CO2e/km.`);
    }
    return Math.round(n * 1000) / 1000;
  };

  const customCarFactor = validateFactorOverride(input.carFactor, 'Solo car factor');
  const customOptionFactor = validateFactorOverride(input.optionFactor, 'Alternative mode factor');
  const usedCustomFactors = customCarFactor !== null || customOptionFactor !== null;

  const country = typeof input.country === 'string' ? input.country.trim() : 'India';
  const isIndiaContext = !country || /india/i.test(country);
  const regionalConfidence: TravelImpactResult['regionalConfidence'] = isIndiaContext
    ? 'india-reference'
    : 'illustrative-proxy';

  const baseSpec = EMISSION_FACTORS.car;
  const optSpec = EMISSION_FACTORS[option];

  const baselineFactor: EmissionFactorSpec =
    customCarFactor === null
      ? baseSpec
      : {
          ...baseSpec,
          kgPerPkm: customCarFactor,
          minKgPerPkm: Math.max(0, round1(customCarFactor * 0.85)),
          maxKgPerPkm: Math.min(2, round1(customCarFactor * 1.15)),
          sourceCitation: `User-specified solo car factor (${customCarFactor} kg CO2e/km)`,
        };

  const factorUsed: EmissionFactorSpec =
    customOptionFactor === null
      ? optSpec
      : {
          ...optSpec,
          kgPerPkm: customOptionFactor,
          minKgPerPkm: Math.max(0, round1(customOptionFactor * 0.85)),
          maxKgPerPkm: Math.min(2, round1(customOptionFactor * 1.15)),
          sourceCitation: `User-specified ${optSpec.label.toLowerCase()} factor (${customOptionFactor} kg CO2e/pkm)`,
          isIllustrativeZero: customOptionFactor === 0,
        };

  const weeklyKm = round1(km * 2 * days);

  const baselineKg = round1(weeklyKm * baselineFactor.kgPerPkm);
  const optionKg = round1(weeklyKm * factorUsed.kgPerPkm);
  const savedKg = round1(baselineKg - optionKg);

  // Conservative/optimistic uncertainty interval around avoided emissions
  const savedMinKg =
    option === 'car' && !usedCustomFactors
      ? 0
      : round1(Math.max(0, weeklyKm * (baselineFactor.minKgPerPkm - factorUsed.maxKgPerPkm)));
  const savedMaxKg =
    option === 'car' && !usedCustomFactors
      ? 0
      : round1(Math.max(0, weeklyKm * (baselineFactor.maxKgPerPkm - factorUsed.minKgPerPkm)));

  const scopeNotice = usedCustomFactors
    ? `Uses your user-edited custom emission factors (${baselineFactor.kgPerPkm} vs ${factorUsed.kgPerPkm} kg CO2e/km) — non-cited custom scenario; WRI/CEA reference citations do not apply.`
    : isIndiaContext
      ? `Uses historical Indian urban reference factors (${factorUsed.sourceCitation}).`
      : `Selected location (${country}) lacks a verified local grid/fleet factor here; showing historical Indian urban reference values (2018–2021) as an illustrative proxy only.`;

  return {
    weeklyKm,
    baselineKg,
    optionKg,
    savedKg,
    savedMinKg,
    savedMaxKg,
    option,
    optionLabel: factorUsed.label,
    regionalConfidence,
    usedCustomFactors,
    factorUsed,
    baselineFactor,
    factors: SOURCED_KG_PER_KM,
    exposureWarning: factorUsed.exposureComparison,
    note: `${scopeNotice} Formula: one-way km × 2 × days/week. These are estimated GHG emissions changes (kg CO2e), NOT personal inhaled-pollution reductions.`,
  };
}
