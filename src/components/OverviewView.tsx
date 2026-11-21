import React, { useState } from 'react';
import { aqiBand } from '../shared/airQuality.ts';
import type {
  AirQualityData,
  CityLocation,
  DailyPlan,
  HouseholdProfile,
  ViewId,
} from '../shared/types.ts';
import { Icon, type IconName } from './Icons.tsx';
import { AirQualityMapCard } from './AirQualityMapCard.tsx';
import { CloudSyncCard } from './CloudSyncCard.tsx';

interface OverviewViewProps {
  city: CityLocation;
  air: AirQualityData;
  profile: HouseholdProfile;
  plan: DailyPlan;
  cityQuery: string;
  searchResults: CityLocation[] | null;
  liveLoading: boolean;
  liveError: string | null;
  mapsApiKey: string;
  onCityQueryChange: (q: string) => void;
  onSearchCity: (e: React.FormEvent) => void;
  onSelectCity: (city: CityLocation) => void;
  onUseGeo: () => void;
  onLoadLive: () => void;
  onLoadLiveCoords: (lat: number, lon: number, label: string) => void;
  onProfileChange: (next: HouseholdProfile) => void;
  onProfileSubmit: (e: React.FormEvent) => void;
  onApplySavedProfile: (profile: HouseholdProfile) => void;
  onNotify: (msg: string) => void;
  onDownloadPlan: () => void;
  onNavigate: (view: ViewId) => void;
}

const ACTION_ICONS: readonly IconName[] = ['sun', 'cloud', 'moon'];

function formatShortTime(iso: string | null): string {
  if (!iso) return 'time unavailable';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  city,
  air,
  profile,
  plan,
  cityQuery,
  searchResults,
  liveLoading,
  liveError,
  mapsApiKey,
  onCityQueryChange,
  onSearchCity,
  onSelectCity,
  onUseGeo,
  onLoadLive,
  onLoadLiveCoords,
  onProfileChange,
  onProfileSubmit,
  onApplySavedProfile,
  onNotify,
  onDownloadPlan,
  onNavigate,
}) => {
  const [showTable, setShowTable] = useState(false);

  const current = air.current;
  const band = aqiBand(current.usAqi);
  const live = air.live === true;
  const points = (air.hours || []).filter((p) => Number.isFinite(p.usAqi)).slice(0, 12);

  // SVG chart math
  const width = 720;
  const height = 190;
  const left = 40;
  const right = 20;
  const top = 18;
  const bottom = 42;
  const maxVal = points.length
    ? Math.max(200, Math.ceil((Math.max(...points.map((p) => p.usAqi)) * 1.12) / 50) * 50)
    : 200;
  const yPos = (v: number) => top + (height - top - bottom) * (1 - v / maxVal);
  const sectionWidth = points.length ? (width - left - right) / points.length : 1;
  const barWidth = Math.min(35, sectionWidth * 0.56);

  const isUtc = air.hourTimezone === 'UTC' || live;
  const chartAriaLabel = points.length
    ? `${live ? 'Modeled' : 'Illustrative demo'} hourly US AQI${isUtc ? ' (UTC)' : ''}: ${points
        .map((x) => `${x.time}: ${Math.round(x.usAqi)}`)
        .join(', ')}`
    : 'No hourly data available';

  return (
    <section id="view-overview" className="view" aria-labelledby="overview-title">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            <span>YOUR AIR, MADE UNDERSTANDABLE</span>
          </div>
          <h1 id="overview-title">
            Breathe better, <em>together.</em>
          </h1>
          <p className="lead">
            A little clarity goes a long way. Make confident, cleaner choices for your family every day.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-quiet" id="overview-share" onClick={onDownloadPlan}>
            <Icon name="download" /> Download plan
          </button>
        </div>
      </div>

      <div className="location-bar">
        <div className="location-main">
          <div className="location-icon">
            <Icon name="pin" />
          </div>
          <div>
            <span className="tiny-label">YOUR LOCATION</span>
            <div className="location-name" id="selected-location">
              {[city.name, city.admin1, city.country].filter(Boolean).join(', ')}
            </div>
          </div>
        </div>
        <div className="location-controls">
          <form id="city-form" className="city-search" onSubmit={onSearchCity}>
            <label htmlFor="city-input" className="sr-only">
              Search a city
            </label>
            <input
              id="city-input"
              name="city"
              placeholder="Search another city"
              autoComplete="off"
              minLength={2}
              maxLength={80}
              value={cityQuery}
              onChange={(e) => onCityQueryChange(e.target.value)}
            />
            <button aria-label="Search city" className="city-submit" type="submit">
              <Icon name="arrow" />
            </button>
          </form>
          <button
            type="button"
            id="use-location"
            className="btn btn-line"
            title="Only used when you give permission"
            onClick={onUseGeo}
          >
            <Icon name="pin" /> My location
          </button>
          <button
            type="button"
            id="try-live"
            className="btn btn-primary"
            disabled={liveLoading}
            aria-busy={liveLoading}
            onClick={onLoadLive}
          >
            <Icon name="refresh" /> {liveLoading ? 'Loading forecast…' : 'Load live forecast'}
          </button>
        </div>
      </div>

      {searchResults !== null && (
        <div id="search-results" className="search-results" role="region" aria-label="City search results">
          {searchResults.length === 0 ? (
            <p>No cities found. Try New Delhi, Pune, Mumbai, Bengaluru or Lucknow.</p>
          ) : (
            searchResults.slice(0, 5).map((item, idx) => (
              <button
                key={`${item.name}-${item.latitude}-${idx}`}
                type="button"
                onClick={() => onSelectCity(item)}
              >
                <Icon name="pin" />
                <span>{[item.name, item.admin1, item.country].filter(Boolean).join(', ')}</span>
              </button>
            ))
          )}
        </div>
      )}

      {liveError && (
        <div className="error-banner" role="alert">
          <span>{liveError}</span>
          <button type="button" className="btn btn-line" onClick={onLoadLive}>
            Retry live forecast
          </button>
        </div>
      )}

      <div className={`notice ${live ? 'live-notice' : 'demo-notice'}`} id="source-notice" role="status">
        <div className="notice-left">
          <span className="demo-dot" aria-hidden="true" />
          <strong id="source-title">{live ? 'MODELED FORECAST ACTIVE' : 'ILLUSTRATIVE DEMO'}</strong>
          <span id="source-subtitle">
            {live
              ? `Open-Meteo/CAMS (${air.locationLabel || city.name}${air.coordinates ? ` · ${air.coordinates.latitude.toFixed(2)}°, ${air.coordinates.longitude.toFixed(2)}°` : ''}) · Provider time: ${air.timestamp || 'unavailable'} · Valid until ${formatShortTime(air.expiresAt)} · US AQI (distinct from India NAQI)`
              : 'Values are invented examples—not measured pollution or current conditions. Scale: US AQI (distinct from India NAQI).'}
          </span>
        </div>
        <span className="source-pill" id="source-pill">
          {live ? 'US AQI · FORECAST' : 'DEMO DATA'}
        </span>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="metrics-grid">
            <article className="aqi-tile card">
              <div className="tile-top">
                <span className="tile-label">US AIR QUALITY INDEX</span>
                <Icon name="wind" />
              </div>
              <div className="aqi-contents">
                <div>
                  <div className="aqi-number" id="current-aqi">
                    {Number.isFinite(current.usAqi) ? Math.round(current.usAqi) : '—'}
                  </div>
                  <div className="aqi-status">
                    <span className="aqi-status-dot" aria-hidden="true" />
                    <span id="current-band">{band.label}</span>
                  </div>
                </div>
                <div className="aqi-meter" id="aqi-meter" aria-hidden="true">
                  <div className="aqi-meter-inner">
                    <Icon name="wind" />
                  </div>
                </div>
              </div>
              <p id="aqi-description" className="metric-foot">
                {band.description}
              </p>
            </article>

            <article className="pollutant-tile card">
              <div className="tile-top">
                <span className="tile-label">FINE PARTICLES</span>
                <span className="tile-symbol">PM₂.₅</span>
              </div>
              <div className="pollutant-value">
                <strong id="current-pm25">
                  {current.pm25 !== null && Number.isFinite(current.pm25) ? current.pm25.toFixed(1) : '—'}
                </strong>
                <span>µg/m³</span>
              </div>
              <div className="mini-line" aria-hidden="true">
                <svg viewBox="0 0 200 32" preserveAspectRatio="none">
                  <path
                    d="M0 24 Q20 8 38 18 T75 12 T112 21 T154 8 T200 14"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="metric-foot">Small particles that can enter deep into the lungs.</p>
            </article>

            <article className="pollutant-tile card">
              <div className="tile-top">
                <span className="tile-label">COARSE PARTICLES</span>
                <span className="tile-symbol">PM₁₀</span>
              </div>
              <div className="pollutant-value">
                <strong id="current-pm10">
                  {current.pm10 !== null && Number.isFinite(current.pm10) ? current.pm10.toFixed(1) : '—'}
                </strong>
                <span>µg/m³</span>
              </div>
              <div className="mini-line mini-line-amber" aria-hidden="true">
                <svg viewBox="0 0 200 32" preserveAspectRatio="none">
                  <path
                    d="M0 25 Q18 25 35 12 T80 16 T110 8 T150 23 T200 6"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <p className="metric-foot">Larger particles from dust and other sources.</p>
            </article>
          </div>

          <article className="card chart-card">
            <div className="section-card-head">
              <div>
                <div className="eyebrow-mini">WHAT&apos;S NEXT</div>
                <h2>Hourly air outlook</h2>
              </div>
              <div className="chart-key">
                <span className="chart-key-dot" aria-hidden="true" />
                <span>{isUtc ? 'US AQI · next 12 hours (UTC)' : 'US AQI · next 12 hours (demo)'}</span>
              </div>
            </div>

            <div className="chart-frame">
              <svg
                id="forecast-chart"
                className="forecast-chart"
                role="img"
                aria-label={chartAriaLabel}
                viewBox="0 0 720 190"
                preserveAspectRatio="none"
              >
                {[0, Math.round(maxVal / 2), maxVal].map((val) => {
                  const yy = yPos(val);
                  return (
                    <g key={val}>
                      <line
                        x1={left}
                        y1={yy}
                        x2={width - right}
                        y2={yy}
                        stroke="#dce6e2"
                        strokeWidth={1}
                        strokeDasharray="4,5"
                      />
                      <text
                        x={left - 8}
                        y={yy + 4}
                        textAnchor="end"
                        fill="#445d61"
                        fontSize={11}
                        fontFamily="Arial, sans-serif"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}
                {points.map((p, i) => {
                  const xx = left + i * sectionWidth + (sectionWidth - barWidth) / 2;
                  const yy = yPos(p.usAqi);
                  const fill =
                    p.usAqi <= 50
                      ? '#2d8a68'
                      : p.usAqi <= 100
                        ? '#46946b'
                        : p.usAqi <= 150
                          ? '#c47d2b'
                          : p.usAqi <= 200
                            ? '#c25542'
                            : '#8c4673';
                  return (
                    <g key={`${p.time}-${i}`}>
                      <rect
                        x={xx}
                        y={yy}
                        width={barWidth}
                        height={Math.max(2, height - bottom - yy)}
                        rx={6}
                        fill={fill}
                      />
                      <text
                        x={xx + barWidth / 2}
                        y={yy - 6}
                        textAnchor="middle"
                        fill="#122b31"
                        fontSize={11}
                        fontWeight={700}
                        fontFamily="Arial, sans-serif"
                      >
                        {Math.round(p.usAqi)}
                      </text>
                      {(i % 2 === 0 || points.length <= 7) && (
                        <text
                          x={xx + barWidth / 2}
                          y={height - 16}
                          textAnchor="middle"
                          fill="#445d61"
                          fontSize={11}
                          fontFamily="Arial, sans-serif"
                        >
                          {p.time}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="chart-footer">
              <span>
                <Icon name="info" />
                <span id="forecast-detail">
                  {live
                    ? 'Modeled Open-Meteo/CAMS forecast; check official local alerts (CPCB/SAFAR).'
                    : 'Illustrative demo example, not a real observation or forecast.'}
                </span>
              </span>
              <button
                type="button"
                className="chart-table-toggle"
                aria-expanded={showTable}
                aria-controls="hourly-data-table-wrap"
                onClick={() => setShowTable((prev) => !prev)}
              >
                {showTable ? 'Hide hourly data table' : 'Show hourly data table'}
              </button>
            </div>

            {showTable && (
              <div id="hourly-data-table-wrap" className="chart-table-wrap">
                <table className="hourly-table">
                  <caption>
                    {live ? 'Modeled hourly US AQI outlook' : 'Illustrative demo hourly US AQI values'} for {city.name}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{isUtc ? 'Time (UTC)' : 'Time'}</th>
                      <th scope="col">US AQI</th>
                      <th scope="col">Category</th>
                      <th scope="col">PM₂.₅ (µg/m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((p, idx) => (
                      <tr key={`${p.time}-row-${idx}`}>
                        <td>{p.time}</td>
                        <td>{Math.round(p.usAqi)}</td>
                        <td>{aqiBand(p.usAqi).label}</td>
                        <td>{p.pm25 !== null ? p.pm25.toFixed(1) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <div className="insight-banner">
            <div className="insight-icon">
              <Icon name="spark" />
            </div>
            <div>
              <span className="insight-kicker">TODAY&apos;S INSIGHT</span>
              <h2 id="insight-title">{plan.intensity}</h2>
              <p id="insight-text">{plan.intro}</p>
            </div>
            <button
              type="button"
              className="insight-action"
              aria-label="View your daily plan"
              onClick={() => onNavigate('plan')}
            >
              <Icon name="arrow" />
            </button>
          </div>

          <AirQualityMapCard
            mapsApiKey={mapsApiKey}
            selectedCity={city}
            air={air}
            onSelectCity={onSelectCity}
            onLoadLiveCoords={onLoadLiveCoords}
          />

          <CloudSyncCard
            profile={profile}
            air={air}
            plan={plan}
            onApplySavedProfile={onApplySavedProfile}
            onSelectSavedCity={onSelectCity}
            onNotify={onNotify}
          />
        </div>

        <aside className="dashboard-side" aria-label="Your home profile and highlights">
          <article className="card profile-card">
            <div className="section-card-head">
              <div>
                <div className="eyebrow-mini">MADE FOR YOUR PEOPLE</div>
                <h2>Your household</h2>
              </div>
              <div className="card-corner-icon">
                <Icon name="people" />
              </div>
            </div>
            <p className="profile-lead">
              Tell us a little about your day to get useful, realistic advice.
            </p>
            <form id="profile-form" className="profile-form" onSubmit={onProfileSubmit}>
              <label htmlFor="schedule">Daily routine</label>
              <select
                id="schedule"
                name="schedule"
                value={profile.schedule}
                onChange={(e) =>
                  onProfileChange({
                    ...profile,
                    schedule: e.target.value as HouseholdProfile['schedule'],
                  })
                }
              >
                <option value="school">School + family</option>
                <option value="office">Office commute</option>
                <option value="home">Mostly at home</option>
                <option value="mixed">Mixed routine</option>
              </select>

              <label htmlFor="commute">Primary transport</label>
              <select
                id="commute"
                name="commute"
                value={profile.commute}
                onChange={(e) =>
                  onProfileChange({
                    ...profile,
                    commute: e.target.value as HouseholdProfile['commute'],
                  })
                }
              >
                <option value="car">Private car</option>
                <option value="bus">Bus</option>
                <option value="metro">Metro / rail</option>
                <option value="walk">Walking</option>
                <option value="cycle">Cycling</option>
                <option value="remote">Remote / no commute</option>
              </select>

              <label htmlFor="budget">Household budget</label>
              <select
                id="budget"
                name="budget"
                value={profile.budget}
                onChange={(e) =>
                  onProfileChange({
                    ...profile,
                    budget: e.target.value as HouseholdProfile['budget'],
                  })
                }
              >
                <option value="low">Keep it affordable</option>
                <option value="medium">Some flexibility</option>
                <option value="flexible">Flexible budget</option>
              </select>

              <fieldset>
                <legend>In your household</legend>
                <label className="checkrow" htmlFor="children">
                  <input
                    type="checkbox"
                    name="children"
                    id="children"
                    checked={profile.children}
                    onChange={(e) => onProfileChange({ ...profile, children: e.target.checked })}
                  />
                  <span>Children</span>
                </label>
                <label className="checkrow" htmlFor="seniors">
                  <input
                    type="checkbox"
                    name="seniors"
                    id="seniors"
                    checked={profile.seniors}
                    onChange={(e) => onProfileChange({ ...profile, seniors: e.target.checked })}
                  />
                  <span>Older adults</span>
                </label>
                <label className="checkrow" htmlFor="sensitive">
                  <input
                    type="checkbox"
                    name="sensitive"
                    id="sensitive"
                    checked={profile.sensitive}
                    onChange={(e) => onProfileChange({ ...profile, sensitive: e.target.checked })}
                  />
                  <span>Air-sensitive family member</span>
                </label>
                <label className="checkrow" htmlFor="purifier">
                  <input
                    type="checkbox"
                    name="purifier"
                    id="purifier"
                    checked={profile.purifier}
                    onChange={(e) => onProfileChange({ ...profile, purifier: e.target.checked })}
                  />
                  <span>Have a HEPA purifier</span>
                </label>
              </fieldset>

              <button type="submit" className="btn btn-primary btn-block">
                Update my plan <Icon name="arrow" />
              </button>
            </form>
          </article>

          <article className="card quick-tip">
            <span className="quick-tip-icon">
              <Icon name="leaf" />
            </span>
            <div>
              <span className="tiny-label">A QUICK THOUGHT</span>
              <h3>Better habits begin at home.</h3>
              <p>Avoiding unnecessary indoor smoke can help without buying expensive equipment.</p>
            </div>
          </article>
        </aside>
      </div>

      <div className="lower-head">
        <div>
          <span className="eyebrow-mini">YOUR NEXT STEPS</span>
          <h2>
            Small actions. <em>Real intention.</em>
          </h2>
        </div>
        <button className="text-link" type="button" onClick={() => onNavigate('plan')}>
          Explore your full daily plan <Icon name="arrow" />
        </button>
      </div>

      <div id="overview-actions" className="overview-actions">
        {plan.actions.map((action, idx) => (
          <article key={action.period} className="card overview-action">
            <span className="action-small-icon">
              <Icon name={ACTION_ICONS[idx] ?? 'leaf'} />
            </span>
            <div>
              <div className="action-time">{action.period}</div>
              <h3>{action.title}</h3>
              <p>{action.detail}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
