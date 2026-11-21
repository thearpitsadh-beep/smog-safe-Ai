import React from 'react';
import type {
  AirQualityData,
  DailyPlan,
  ImpactDomain,
  PlanBriefApiResponse,
} from '../shared/types.ts';
import { Icon, type IconName } from './Icons.tsx';

interface DailyPlanViewProps {
  plan: DailyPlan;
  air: AirQualityData;
  brief: PlanBriefApiResponse | null;
  briefBusy: boolean;
  briefError: string | null;
  onGenerateBrief: () => void;
  onDownloadPlan: () => void;
}

const ACTION_ICONS: readonly IconName[] = ['sun', 'cloud', 'moon'];

const DOMAIN_LABELS: Record<ImpactDomain, string> = {
  exposure: 'Exposure reduction',
  emissions: 'Emissions reduction',
  indoor_generation: 'Indoor pollutant generation',
};

export const DailyPlanView: React.FC<DailyPlanViewProps> = ({
  plan,
  air,
  brief,
  briefBusy,
  briefError,
  onGenerateBrief,
  onDownloadPlan,
}) => {
  return (
    <section id="view-plan" className="view" aria-labelledby="plan-title">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            <span>MADE FOR YOUR DAY</span>
          </div>
          <h1 id="plan-title">
            Your cleaner-air <em>routine.</em>
          </h1>
          <p className="lead">
            Practical decisions for morning, afternoon and evening, adapted to your city, budget, commute, and household.
          </p>
        </div>
        <button type="button" className="btn btn-primary" id="download-plan" onClick={onDownloadPlan}>
          <Icon name="download" /> Export my plan
        </button>
      </div>

      <div className="plan-hero card">
        <div>
          <span className="eyebrow-mini">YOUR CURRENT FOCUS</span>
          <h2 id="plan-intensity">{plan.intensity}</h2>
          <p id="plan-intro">{plan.intro}</p>
          <span className="soft-badge" id="plan-source-badge">
            {air.live ? 'MODELED OPEN-METEO FORECAST · US AQI' : 'DEMO SCENARIO · US AQI'}
          </span>
        </div>
        <div className="plan-hero-art" aria-hidden="true">
          <svg viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="72" fill="none" stroke="currentColor" opacity=".2" strokeWidth="2" />
            <circle cx="90" cy="90" r="50" fill="none" stroke="currentColor" opacity=".25" strokeWidth="2" />
            <path
              d="M42 96C65 57 105 138 141 79M45 114C74 93 98 134 135 102"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      <article id="plan-brief-card" className="card brief-card" aria-live="polite">
        <div className="brief-head">
          <div>
            <span className="eyebrow-mini">AI FAMILY BRIEF</span>
            <h2>Plain-language routine summary</h2>
          </div>
          <button
            type="button"
            id="generate-brief"
            className="btn btn-line"
            disabled={briefBusy}
            aria-busy={briefBusy}
            onClick={onGenerateBrief}
          >
            <Icon name="spark" /> {briefBusy ? 'Generating brief…' : 'Generate AI family brief'}
          </button>
        </div>
        {briefError && (
          <div className="error-banner" role="alert">
            <span>{briefError}</span>
          </div>
        )}
        {brief ? (
          <div className="brief-body">
            <div className="brief-badges">
              <span className={`source-pill${brief.mode === 'gemini' ? ' gemini-pill' : ''}`}>
                {brief.mode === 'gemini' ? 'GEMINI BRIEF · SCHEMA CHECKED' : 'DETERMINISTIC BRIEF'}
              </span>
              <span className="brief-focus">{brief.keyFocus}</span>
            </div>
            <p className="brief-text">{brief.brief}</p>
            <div className="brief-meta">
              <span>
                <strong>Data &amp; uncertainty:</strong> {brief.uncertaintyNote}
              </span>
              <span>
                <strong>Note:</strong> {brief.medicalDisclaimer}
              </span>
            </div>
          </div>
        ) : (
          <p className="brief-placeholder">
            Summarize your morning, commute, and evening plan into a plain-language household briefing grounded in your selected profile and air-quality status.
          </p>
        )}
      </article>

      <div id="plan-action-list" className="plan-action-list">
        {plan.actions.map((a, idx) => (
          <article key={a.period} className="card plan-card">
            <div className="plan-period">
              <span>{a.period}</span>
              <Icon name={ACTION_ICONS[idx] ?? 'leaf'} />
            </div>
            <h3>{a.title}</h3>
            <p>{a.detail}</p>
            <div className="why-box">
              <div className="why-item">
                <strong>WHY THIS IS APPROPRIATE</strong>
                <span>{a.why}</span>
              </div>
              <div className="why-item">
                <strong>TRADE-OFF</strong>
                <span>{a.tradeOff}</span>
              </div>
              <div className="why-item">
                <strong>SUPPORTING DATA / ASSUMPTION</strong>
                <span>{a.supportingData}</span>
              </div>
              <div className="why-item">
                <strong>LIKELY IMPACT &amp; UNCERTAINTY</strong>
                <span>{a.impactWithUncertainty}</span>
              </div>
            </div>
            <div className={`plan-tag domain-${a.impactDomain}`}>
              {DOMAIN_LABELS[a.impactDomain]}
            </div>
          </article>
        ))}
      </div>

      <div className="swaps-section">
        <div className="eyebrow-mini">SUSTAINABLE ALTERNATIVES</div>
        <h2>Tailored low-emission swaps for {plan.profile.city}</h2>
        <div className="swaps-grid">
          {plan.swaps.map((swap) => (
            <article key={swap.title} className="card swap-card">
              <span className={`plan-tag domain-${swap.impactDomain}`} style={{ marginTop: 0 }}>
                {DOMAIN_LABELS[swap.impactDomain]}
              </span>
              <h3>{swap.title}</h3>
              <p>{swap.description}</p>
              <div className="why-box">
                <div className="why-item">
                  <strong>SUPPORTING DATA</strong>
                  <span>{swap.supportingData}</span>
                </div>
                <div className="why-item">
                  <strong>LIKELY IMPACT &amp; UNCERTAINTY</strong>
                  <span>{swap.impactWithUncertainty}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="fine-print">
        <Icon name="shield" />
        <span>{plan.disclaimer}</span>
      </div>
    </section>
  );
};
