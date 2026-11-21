import React from 'react';
import type { ImpactDomain, IndoorTip } from '../shared/types.ts';
import { Icon, type IconName } from './Icons.tsx';

interface IndoorGuideViewProps {
  indoorTips: IndoorTip[];
}

const TIP_ICONS: Record<IndoorTip['icon'], IconName> = {
  source: 'shield',
  spark: 'home',
  wind: 'wind',
  filter: 'spark',
  leaf: 'leaf',
};

const DOMAIN_LABELS: Record<ImpactDomain, string> = {
  exposure: 'Exposure reduction',
  emissions: 'Emissions reduction',
  indoor_generation: 'Indoor pollutant generation',
};

export const IndoorGuideView: React.FC<IndoorGuideViewProps> = ({ indoorTips }) => {
  return (
    <section id="view-indoor" className="view" aria-labelledby="indoor-title">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            <span>HEALTHIER HABITS AT HOME</span>
          </div>
          <h1 id="indoor-title">
            Make indoors <em>matter.</em>
          </h1>
          <p className="lead">
            Evidence-aware ways to limit indoor particle sources and manage exposure based on your budget and equipment.
          </p>
        </div>
      </div>

      <div className="indoor-feature">
        <div className="indoor-feature-icon">
          <Icon name="home" />
        </div>
        <div>
          <span className="eyebrow-mini">START WITH THE BASICS</span>
          <h2>Cleaner air isn&apos;t always about buying more.</h2>
          <p>
            Reducing smoke sources and controlling dust are sensible zero-cost first steps. Ventilation and HEPA filtration choices depend on outdoor AQI and your budget.
          </p>
        </div>
      </div>

      <div id="indoor-grid" className="indoor-grid">
        {indoorTips.map((tip) => (
          <article key={tip.title} className="card indoor-guide-card">
            <span className="guide-icon">
              <Icon name={TIP_ICONS[tip.icon] ?? 'leaf'} />
            </span>
            <div>
              <span className="indoor-category">{tip.category.toUpperCase()}</span>
              <h3>{tip.title}</h3>
              <p>{tip.detail}</p>
              <div className="indoor-meta">
                <span>
                  <strong>Why:</strong> {tip.why}
                </span>
                <span>
                  <strong>Trade-off:</strong> {tip.tradeOff}
                </span>
                <span>
                  <strong>Data / Assumption:</strong> {tip.supportingData}
                </span>
                <span>
                  <strong>Impact &amp; Uncertainty:</strong> {tip.impactWithUncertainty}
                </span>
              </div>
              <div className={`plan-tag domain-${tip.impactDomain}`}>
                {DOMAIN_LABELS[tip.impactDomain]}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="two-note-grid">
        <article className="card caution-card">
          <span className="eyebrow-mini">IMPORTANT LIMITATION</span>
          <h3>Plants are lovely—not a HEPA substitute.</h3>
          <p>
            Houseplants do not clear severe particulate pollution indoors at meaningful rates. Prioritize source control and, where budget permits, non-ozone true HEPA filtration.
          </p>
        </article>
        <article className="card caution-card">
          <span className="eyebrow-mini">THE WINDOW QUESTION</span>
          <h3>Opening windows is a trade-off.</h3>
          <p>
            Outdoor smog enters through open windows, yet sealed rooms trap cooking smoke and CO₂. Check current AQI and use kitchen exhaust before deciding when to ventilate.
          </p>
        </article>
      </div>
    </section>
  );
};
