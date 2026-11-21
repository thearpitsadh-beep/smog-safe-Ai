import React, { useMemo, useState } from 'react';
import { EMISSION_FACTORS, travelImpact } from '../shared/emissions.ts';
import type { CommuteMode } from '../shared/types.ts';
import { Icon } from './Icons.tsx';

interface ImpactLabViewProps {
  country: string;
}

export const ImpactLabView: React.FC<ImpactLabViewProps> = ({ country }) => {
  const [distance, setDistance] = useState<string>('12');
  const [days, setDays] = useState<number>(5);
  const [option, setOption] = useState<CommuteMode>('metro');
  const [customCarFactor, setCustomCarFactor] = useState<string>('');
  const [customOptionFactor, setCustomOptionFactor] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const parsedCarFactor = customCarFactor.trim() === '' ? undefined : Number(customCarFactor);
  const parsedOptionFactor =
    customOptionFactor.trim() === '' ? undefined : Number(customOptionFactor);

  const result = useMemo(() => {
    const km = Number(distance);
    if (!Number.isFinite(km) || km < 0 || km > 300) {
      return null;
    }
    try {
      return travelImpact({
        distanceKm: km,
        daysPerWeek: days,
        option,
        country,
        carFactor: parsedCarFactor,
        optionFactor: parsedOptionFactor,
      });
    } catch {
      return null;
    }
  }, [distance, days, option, country, parsedCarFactor, parsedOptionFactor]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const km = Number(distance);
    try {
      travelImpact({
        distanceKm: km,
        daysPerWeek: days,
        option,
        country,
        carFactor: parsedCarFactor,
        optionFactor: parsedOptionFactor,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enter valid commute inputs.');
    }
  };

  const optionPercent =
    result && result.baselineKg > 0
      ? Math.max(0, Math.min(100, (100 * result.optionKg) / result.baselineKg))
      : 0;

  return (
    <section id="view-impact" className="view" aria-labelledby="impact-title">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            <span>SUSTAINABLE CHOICES, EXPLAINED</span>
          </div>
          <h1 id="impact-title">
            See the <em>difference.</em>
          </h1>
          <p className="lead">
            Compare sourced weekly travel emissions for everyday commutes—while keeping GHG emissions separate from personal inhalation exposure.
          </p>
        </div>
      </div>

      <div className="impact-layout">
        <div className="card impact-input">
          <span className="eyebrow-mini">YOUR COMMUTE</span>
          <h2>Compare your travel choice</h2>
          <form id="impact-form" onSubmit={handleSubmit}>
            <label htmlFor="distance">One-way distance (km)</label>
            <input
              type="number"
              id="distance"
              name="distance"
              value={distance}
              min={0}
              max={300}
              step={0.5}
              required
              onChange={(e) => {
                setDistance(e.target.value);
                setError(null);
              }}
            />

            <label htmlFor="days">Travel days per week</label>
            <input
              type="range"
              id="days"
              name="days"
              min={0}
              max={7}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            />
            <output id="days-output" htmlFor="days">
              {days} {days === 1 ? 'day' : 'days'} / week
            </output>

            <label htmlFor="impact-option">Alternative to solo car</label>
            <select
              id="impact-option"
              name="impact-option"
              value={option}
              onChange={(e) => setOption(e.target.value as CommuteMode)}
            >
              <option value="metro">Metro / electric rail (0.041 kg/pkm)</option>
              <option value="bus">Urban bus (0.078 kg/pkm)</option>
              <option value="cycle">Cycling (0 kg operational)</option>
              <option value="walk">Walking (0 kg operational)</option>
              <option value="remote">Remote / avoid trip (0 kg commute)</option>
              <option value="car">Continue driving solo (0.171 kg/km)</option>
            </select>

            <details className="custom-factors-details">
              <summary>Optional custom emission factors (kg CO₂e/km)</summary>
              <div className="custom-factors-grid">
                <div>
                  <label htmlFor="car-factor">Solo car factor</label>
                  <input
                    type="number"
                    id="car-factor"
                    name="carFactor"
                    min={0}
                    max={2}
                    step={0.005}
                    placeholder={String(EMISSION_FACTORS.car.kgPerPkm)}
                    value={customCarFactor}
                    onChange={(e) => {
                      setCustomCarFactor(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="option-factor">Alternative factor</label>
                  <input
                    type="number"
                    id="option-factor"
                    name="optionFactor"
                    min={0}
                    max={2}
                    step={0.005}
                    placeholder={String(EMISSION_FACTORS[option].kgPerPkm)}
                    value={customOptionFactor}
                    onChange={(e) => {
                      setCustomOptionFactor(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
                {(customCarFactor !== '' || customOptionFactor !== '') && (
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    onClick={() => {
                      setCustomCarFactor('');
                      setCustomOptionFactor('');
                      setError(null);
                    }}
                  >
                    Reset to Indian reference defaults
                  </button>
                )}
              </div>
            </details>

            {error && (
              <div className="error-banner" role="alert">
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-block" type="submit">
              Calculate impact <Icon name="arrow" />
            </button>
          </form>
        </div>

        <div className="impact-results">
          <div className="impact-result-hero">
            <span className="eyebrow-mini">ESTIMATED WEEKLY EMISSIONS AVOIDED</span>
            <div className="impact-number">
              <strong id="saved-emissions">{result ? result.savedKg.toFixed(1) : '—'}</strong>
              <span>kg CO₂e</span>
            </div>
            <p id="impact-explain">
              {result
                ? `Estimated saving vs driving solo across ${result.weeklyKm.toFixed(0)} km/week (uncertainty range: ${result.savedMinKg.toFixed(1)}–${result.savedMaxKg.toFixed(1)} kg CO₂e).`
                : 'Enter a valid commute distance (0–300 km) and factors (0–2 kg/km).'}
            </p>
            <div className="impact-badge">
              <Icon name="leaf" />
              <span>
                {result?.usedCustomFactors
                  ? 'Non-cited custom scenario · range reflects ±15%'
                  : result?.regionalConfidence === 'india-reference'
                    ? 'Historical WRI/CEA reference (2018–2021) · range shown'
                    : 'Illustrative proxy factors · outside India'}
              </span>
            </div>
          </div>

          <div className="card compare-card">
            <h3>Side-by-side emissions vs personal exposure</h3>
            <div className="compare-row">
              <span>
                Solo car baseline ({result ? result.baselineFactor.kgPerPkm : EMISSION_FACTORS.car.kgPerPkm} kg CO₂e/km)
              </span>
              <strong id="baseline-value">{result ? `${result.baselineKg.toFixed(1)} kg` : '—'}</strong>
            </div>
            <div className="compare-track">
              <span id="baseline-bar" className="baseline-bar" style={{ width: '100%' }} />
            </div>

            <div className="compare-row">
              <span id="option-label">
                {result ? `${result.optionLabel} (${result.factorUsed.kgPerPkm} kg CO₂e/pkm)` : option}
              </span>
              <strong id="option-value">{result ? `${result.optionKg.toFixed(1)} kg` : '—'}</strong>
            </div>
            <div className="compare-track">
              <span id="option-bar" className="option-bar" style={{ width: `${optionPercent}%` }} />
            </div>

            <div className="compare-foot">
              <Icon name="info" />
              <div>
                <strong>Personal exposure note (separate from CO₂e):</strong>{' '}
                {result
                  ? result.exposureWarning
                  : 'Emissions avoided are not the same as personal inhaled pollution reduction.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="impact-method card">
        <h3>Methodology, citations, and boundary conditions</h3>
        <p>{result?.note}</p>
        <p>
          <strong>Citations:</strong> Car (0.171 kg CO₂e/km, range 0.13–0.22) and Bus (0.078 kg CO₂e/pkm, range 0.055–0.105) reflect historical WRI India GHG Program (2018–2021) &amp; UK DESNZ urban passenger averages (
          <a
            href="https://www.wri.org/sustainability-wri/dashboard/methodology"
            target="_blank"
            rel="noopener noreferrer"
          >
            WRI commuting methodology reference
          </a>
          ). Metro (0.041 kg CO₂e/pkm, range 0.025–0.060) reflects CEA India historical grid intensity (~0.716 kg CO₂/kWh). Custom overrides switch to an explicit non-cited scenario.
        </p>
      </div>
    </section>
  );
};
