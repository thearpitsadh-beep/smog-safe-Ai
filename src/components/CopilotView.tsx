import React, { useEffect, useRef, useState } from 'react';
import type {
  ChatApiResponse,
  GroundedPlaceSource,
  GroundedWebSource,
  ImpactDomain,
  MapsGroundingApiResponse,
  SearchGroundingApiResponse,
} from '../shared/types.ts';
import { Icon } from './Icons.tsx';

export type CopilotMode = 'plan' | 'search' | 'maps';

export interface ChatMessageItem {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  channel?: CopilotMode;
  keyActions?: string[];
  impactDomain?: ImpactDomain | 'mixed';
  uncertaintyNote?: string;
  medicalDisclaimer?: string;
  sources?: GroundedWebSource[];
  places?: GroundedPlaceSource[];
  mode?: ChatApiResponse['mode'] | SearchGroundingApiResponse['mode'] | MapsGroundingApiResponse['mode'];
}

interface CopilotViewProps {
  messages: ChatMessageItem[];
  chatModeLabel: string;
  chatBusy: boolean;
  copilotMode: CopilotMode;
  cityName: string;
  onModeChange: (mode: CopilotMode) => void;
  onSendMessage: (message: string, mode?: CopilotMode) => void;
}

const DOMAIN_BADGE: Record<ImpactDomain | 'mixed', string> = {
  exposure: 'Exposure focus',
  emissions: 'Emissions focus',
  indoor_generation: 'Indoor generation focus',
  mixed: 'Combined exposure & emissions',
};

const SUGGESTIONS_BY_MODE: Record<CopilotMode, ReadonlyArray<{ label: string; question: string }>> = {
  plan: [
    {
      label: 'Low-cost indoor ideas',
      question: 'How can I improve indoor air without buying expensive equipment?',
    },
    {
      label: 'Safer school routine',
      question: 'How should I plan school travel on smoggy days?',
    },
    {
      label: 'Lower-emission commute',
      question: 'How can I reduce commuting emissions without increasing exposure?',
    },
  ],
  search: [
    {
      label: 'Local GRAP / smog alerts',
      question: 'What are the latest winter smog GRAP advisories and school outdoor guidance?',
    },
    {
      label: 'Municipal air bulletins',
      question: 'Are there recent official air pollution advisories or transit advisories?',
    },
    {
      label: 'HEPA & indoor standards',
      question: 'What do recent public health bulletins recommend for indoor PM2.5 protection?',
    },
  ],
  maps: [
    {
      label: 'Indoor public libraries & museums',
      question: 'Find nearby public libraries, museums, or enclosed indoor spaces away from traffic.',
    },
    {
      label: 'Closest metro / rail stations',
      question: 'Find the nearest metro or rail transit stations for a lower-emission commute.',
    },
    {
      label: 'Nearby clinics & pharmacies',
      question: 'Find nearby community health clinics or pharmacies around these coordinates.',
    },
  ],
};

const MODE_LABELS: Record<CopilotMode, { label: string; placeholder: string; hint: string }> = {
  plan: {
    label: 'Grounded Plan Chat',
    placeholder: 'Ask about your air, routines or choices...',
    hint: 'Schema-checked guidance grounded strictly in your household context & active US AQI.',
  },
  search: {
    label: 'Live Web Search',
    placeholder: 'Search current GRAP alerts, school advisories, or pollution notices...',
    hint: 'Uses Gemini Google Search grounding and displays clickable web source links.',
  },
  maps: {
    label: 'Nearby Clean-Air Places',
    placeholder: 'Find nearby indoor libraries, metro stations, parks, or clinics...',
    hint: 'Uses Gemini Google Maps grounding around your selected city coordinates.',
  },
};

export const CopilotView: React.FC<CopilotViewProps> = ({
  messages,
  chatModeLabel,
  chatBusy,
  copilotMode,
  cityName,
  onModeChange,
  onSendMessage,
}) => {
  const [input, setInput] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length < 3) return;
    setInput('');
    onSendMessage(trimmed, copilotMode);
  };

  const activeConfig = MODE_LABELS[copilotMode];

  return (
    <section id="view-copilot" className="view" aria-labelledby="copilot-title">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            <span>YOUR FAMILY AIR COPILOT</span>
          </div>
          <h1 id="copilot-title">
            Ask away. <em>Breathe easier.</em>
          </h1>
          <p className="lead">
            Understand your options in plain language with built-in Gemini AI guidance, live Google Search advisories, Maps place grounding, and verified deterministic fallback.
          </p>
        </div>
      </div>

      <div className="chat-shell card">
        <div className="chat-head">
          <div className="chat-avatar">
            <Icon name="spark" />
          </div>
          <div>
            <strong>SmogSafe assistant · {cityName}</strong>
            <div className="chat-mode" id="chat-mode">
              <span className="chat-mode-dot" aria-hidden="true" />
              <span>{chatModeLabel}</span>
            </div>
          </div>
          <span className="source-pill">GUIDANCE, NOT DIAGNOSIS</span>
        </div>

        <div className="copilot-tabs" role="tablist" aria-label="Assistant mode">
          <button
            type="button"
            role="tab"
            id="copilot-tab-plan"
            aria-selected={copilotMode === 'plan'}
            className={`copilot-tab${copilotMode === 'plan' ? ' active' : ''}`}
            onClick={() => onModeChange('plan')}
          >
            <Icon name="message" />
            <span>{MODE_LABELS.plan.label}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="copilot-tab-search"
            aria-selected={copilotMode === 'search'}
            className={`copilot-tab${copilotMode === 'search' ? ' active' : ''}`}
            onClick={() => onModeChange('search')}
          >
            <Icon name="search" />
            <span>{MODE_LABELS.search.label}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="copilot-tab-maps"
            aria-selected={copilotMode === 'maps'}
            className={`copilot-tab${copilotMode === 'maps' ? ' active' : ''}`}
            onClick={() => onModeChange('maps')}
          >
            <Icon name="pin" />
            <span>{MODE_LABELS.maps.label}</span>
          </button>
        </div>
        <p className="copilot-mode-hint">{activeConfig.hint}</p>

        <div
          className="chat-messages"
          id="chat-messages"
          ref={logRef}
          aria-live="polite"
          aria-relevant="additions"
          role="log"
        >
          {messages.map((m) => (
            <div key={m.id} className={`message ${m.role}`}>
              <div className="message-identity">
                {m.role === 'assistant'
                  ? m.channel === 'search'
                    ? 'SmogSafe AI · Web Search Grounding'
                    : m.channel === 'maps'
                      ? 'SmogSafe AI · Google Maps Grounding'
                      : 'SmogSafe AI'
                  : 'You'}
              </div>
              <p>{m.text}</p>

              {m.keyActions && m.keyActions.length > 0 && (
                <ul className="message-actions">
                  {m.keyActions.map((act, idx) => (
                    <li key={idx}>{act}</li>
                  ))}
                </ul>
              )}

              {m.sources && m.sources.length > 0 && (
                <div className="grounding-citations" aria-label="Cited web sources">
                  <span className="grounding-heading">Verified web citations</span>
                  <div className="grounding-chip-list">
                    {m.sources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="grounding-link-chip"
                      >
                        <span>{src.title}</span>
                        <Icon name="external" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {m.places && m.places.length > 0 && (
                <div className="grounding-citations" aria-label="Google Maps place sources">
                  <span className="grounding-heading">Google Maps places</span>
                  <div className="grounding-places-list">
                    {m.places.map((place) => (
                      <div key={place.uri} className="grounding-place-card">
                        <a
                          href={place.uri}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="grounding-place-title"
                        >
                          <Icon name="pin" />
                          <span>{place.title}</span>
                          <Icon name="external" />
                        </a>
                        {place.reviewSnippets.length > 0 && (
                          <p className="grounding-place-snippet">
                            {place.reviewSnippets[0]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(m.impactDomain || m.uncertaintyNote || m.medicalDisclaimer) && (
                <div className="message-meta">
                  {m.impactDomain && (
                    <span>
                      <strong>Domain:</strong> {DOMAIN_BADGE[m.impactDomain]}
                    </span>
                  )}
                  {m.uncertaintyNote && (
                    <span>
                      <strong>Data &amp; uncertainty:</strong> {m.uncertaintyNote}
                    </span>
                  )}
                  {m.medicalDisclaimer && (
                    <span>
                      <strong>Note:</strong> {m.medicalDisclaimer}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="suggestion-chips" id="chat-suggestions">
          {SUGGESTIONS_BY_MODE[copilotMode].map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={chatBusy}
              onClick={() => onSendMessage(s.question, copilotMode)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form id="chat-form" className="chat-form" onSubmit={handleSubmit}>
          <label htmlFor="chat-input" className="sr-only">
            Ask SmogSafe AI a question
          </label>
          <input
            id="chat-input"
            type="text"
            placeholder={activeConfig.placeholder}
            maxLength={800}
            required
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" aria-label="Send your question" id="send-chat" disabled={chatBusy}>
            <Icon name="send" />
          </button>
        </form>
        <p className="chat-disclaimer">
          Never share personal medical records. AI-generated responses are schema-checked and grounded in visible context, but always verify critical health advisories.
        </p>
      </div>
    </section>
  );
};
