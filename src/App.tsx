import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEMO_CITIES,
  aqiBand,
  demoAir,
  fallbackAnswer,
  fallbackPlanBrief,
  makePlan,
  safeProfile,
} from './shared/airQuality.ts';
import type {
  AirQualityData,
  ChatApiResponse,
  CityLocation,
  HouseholdProfile,
  MapsGroundingApiResponse,
  PlanBriefApiResponse,
  SearchGroundingApiResponse,
  ViewId,
} from './shared/types.ts';
import { CopilotView, type ChatMessageItem, type CopilotMode } from './components/CopilotView.tsx';
import { DailyPlanView } from './components/DailyPlanView.tsx';
import { Icon } from './components/Icons.tsx';
import { ImpactLabView } from './components/ImpactLabView.tsx';
import { IndoorGuideView } from './components/IndoorGuideView.tsx';
import { OverviewView } from './components/OverviewView.tsx';
import { NAV_ITEMS, Sidebar } from './components/Sidebar.tsx';
import { useFirebaseSync } from './context/FirebaseContext.tsx';

const LazySmogScene3DView = React.lazy(() =>
  import('./components/SmogScene3DView.tsx').then((mod) => ({ default: mod.SmogScene3DView })),
);

const NAV_LABELS: Record<ViewId, string> = {
  overview: 'Overview',
  plan: 'My daily plan',
  indoor: 'Indoor air guide',
  scene3d: '3D Smog Twin',
  impact: 'Impact lab',
  copilot: 'Ask SmogSafe AI',
};

class ApiRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function fetchApiJson<T>(path: string, init?: RequestInit, timeoutMs = 16000): Promise<T> {
  const response = await fetch(path, {
    signal: AbortSignal.timeout(timeoutMs),
    ...init,
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError('Service returned an invalid response.', response.status);
  }
  if (!response.ok) {
    const errMsg =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Service unavailable.';
    throw new ApiRequestError(errMsg, response.status);
  }
  return body as T;
}

export default function App() {
  const [activeView, setActiveView] = useState<ViewId>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [city, setCity] = useState<CityLocation>({ ...DEMO_CITIES[0] });
  const [air, setAir] = useState<AirQualityData>(() => demoAir(DEMO_CITIES[0].name));
  const [profile, setProfile] = useState<HouseholdProfile>(() =>
    safeProfile({
      city: DEMO_CITIES[0].name,
      country: DEMO_CITIES[0].country,
      latitude: DEMO_CITIES[0].latitude,
      longitude: DEMO_CITIES[0].longitude,
      children: true,
      schedule: 'mixed',
      commute: 'car',
      budget: 'low',
    }),
  );

  const [cityQuery, setCityQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CityLocation[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  const [brief, setBrief] = useState<PlanBriefApiResponse | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const forecastRequestVersionRef = useRef<number>(0);
  const menuToggleRef = useRef<HTMLButtonElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || '',
  );
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const { user } = useFirebaseSync();

  const [copilotMode, setCopilotMode] = useState<CopilotMode>('plan');
  const [chatModeLabel, setChatModeLabel] = useState('SmogSafe AI assistant ready');
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hi there! I'm here to help you make practical cleaner-air choices. Ask me about your commute, indoor air, family routines, or what US AQI means.",
    },
  ]);

  const plan = useMemo(() => makePlan(profile, air), [profile, air]);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    setToastVisible(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastVisible(false);
    }, 3700);
  }, []);

  const enforceForecastFreshness = useCallback(
    (notify = true): AirQualityData => {
      if (!air.live || !air.expiresAt) {
        return air;
      }
      const expiresMs = Date.parse(air.expiresAt);
      if (Number.isFinite(expiresMs) && Date.now() <= expiresMs) {
        return air;
      }
      const fallbackDemo = demoAir(city.name);
      setAir(fallbackDemo);
      const expiredMsg =
        'Live forecast snapshot expired after its freshness window. Showing clearly labeled demo data until refreshed.';
      setLiveError(expiredMsg);
      if (notify) showToast(expiredMsg);
      return fallbackDemo;
    },
    [air, city.name, showToast],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (air.live) enforceForecastFreshness(true);
    }, 30_000);
    const onVis = () => {
      if (!document.hidden && air.live) enforceForecastFreshness(true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [air.live, enforceForecastFreshness]);

  useEffect(() => {
    setBrief(null);
    setBriefError(null);
  }, [city.name, city.latitude, city.longitude, air.live, air.timestamp, profile]);

  useEffect(() => {
    const onQuotaExceeded = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);

    let cancelled = false;

    fetchApiJson<{
      ok: boolean;
      geminiConfigured?: boolean;
      mapsApiKey?: string;
    }>('/api/health')
      .then((h) => {
        if (cancelled) return;
        if (h.mapsApiKey) {
          setMapsApiKey((prev) => prev || h.mapsApiKey || '');
        }
        setChatModeLabel(
          h.geminiConfigured
            ? 'Built-in Gemini AI assistant ready'
            : 'Deterministic rule-based guidance active',
        );
      })
      .catch(() => {
        if (!cancelled) setChatModeLabel('SmogSafe AI assistant ready');
      });

    // Smooth initial open: quietly upgrade initial default city unless user already switched cities
    const initialVersion = ++forecastRequestVersionRef.current;
    const defaultCity = DEMO_CITIES[0];
    fetchApiJson<AirQualityData>(
      `/api/air?lat=${encodeURIComponent(defaultCity.latitude)}&lon=${encodeURIComponent(defaultCity.longitude)}&label=${encodeURIComponent(defaultCity.name)}`,
    )
      .then((forecast) => {
        if (!cancelled && forecastRequestVersionRef.current === initialVersion) {
          setAir(forecast);
        }
      })
      .catch(() => {
        // Keep clearly labeled illustrative demo active on initial open if offline
      });

    return () => {
      cancelled = true;
      window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleSelectView = useCallback((view: ViewId) => {
    setActiveView(view);
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, []);

  const handleCloseMobile = useCallback(() => {
    setMobileOpen(false);
    menuToggleRef.current?.focus();
  }, []);

  const handleSelectCity = useCallback(
    (chosen: CityLocation) => {
      if (!Number.isFinite(chosen.latitude) || !Number.isFinite(chosen.longitude)) {
        showToast('Could not use this location.');
        return;
      }
      forecastRequestVersionRef.current += 1;
      const nextCity: CityLocation = {
        name: chosen.name || 'Current location',
        admin1: chosen.admin1 || '',
        country: chosen.country || '',
        latitude: chosen.latitude,
        longitude: chosen.longitude,
      };
      setCity(nextCity);
      setAir(demoAir(nextCity.name));
      setProfile((prev) =>
        safeProfile({
          ...prev,
          city: nextCity.name,
          country: nextCity.country || 'India',
          latitude: nextCity.latitude,
          longitude: nextCity.longitude,
        }),
      );
      setCityQuery('');
      setSearchResults(null);
      setLiveError(null);
      setLiveLoading(false);
      showToast(`Selected ${nextCity.name}. Showing illustrative demo data until you load a live forecast.`);
    },
    [showToast],
  );

  const handleSearchCity = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = cityQuery.trim();
      if (q.length < 2) {
        showToast('Please type at least two letters.');
        return;
      }
      const localMatches = DEMO_CITIES.filter((c) =>
        `${c.name} ${c.admin1}`.toLowerCase().includes(q.toLowerCase()),
      );
      if (localMatches.length > 0) {
        setSearchResults([...localMatches]);
        return;
      }
      try {
        const res = await fetchApiJson<{ results: CityLocation[] }>(
          `/api/locations?q=${encodeURIComponent(q)}`,
        );
        setSearchResults(res.results ?? []);
      } catch (err) {
        setSearchResults([]);
        showToast(err instanceof Error ? err.message : 'City lookup unavailable.');
      }
    },
    [cityQuery, showToast],
  );

  const loadLiveForCoords = useCallback(
    async (lat: number, lon: number, label: string) => {
      const requestVersion = ++forecastRequestVersionRef.current;
      setLiveLoading(true);
      setLiveError(null);
      try {
        const forecast = await fetchApiJson<AirQualityData>(
          `/api/air?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&label=${encodeURIComponent(label)}`,
        );
        if (forecastRequestVersionRef.current !== requestVersion) {
          return;
        }
        setAir(forecast);
        showToast('Modeled US AQI forecast loaded. Source, timestamp, and expiry are visible.');
      } catch (err) {
        if (forecastRequestVersionRef.current !== requestVersion) {
          return;
        }
        setAir(demoAir(label || city.name));
        const msg =
          err instanceof Error
            ? `${err.message} Illustrative demo scenario remains clearly labeled.`
            : 'Live forecast unavailable. Illustrative demo scenario remains clearly labeled.';
        setLiveError(msg);
        showToast(msg);
      } finally {
        if (forecastRequestVersionRef.current === requestVersion) {
          setLiveLoading(false);
        }
      }
    },
    [city.name, showToast],
  );

  const handleLoadLive = useCallback(() => {
    void loadLiveForCoords(city.latitude, city.longitude, city.name);
  }, [city.latitude, city.longitude, city.name, loadLiveForCoords]);

  const handleUseGeo = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Geolocation unavailable; please search by city.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geoCity: CityLocation = {
          name: 'Your coordinates',
          admin1: 'Browser geolocation',
          country: '',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        handleSelectCity(geoCity);
        void loadLiveForCoords(geoCity.latitude, geoCity.longitude, geoCity.name);
      },
      () => {
        showToast('Location unavailable or permission denied. Use city search instead.');
      },
      { enableHighAccuracy: false, timeout: 8500, maximumAge: 600_000 },
    );
  }, [handleSelectCity, loadLiveForCoords, showToast]);

  const handleProfileSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const activeAir = enforceForecastFreshness(false);
      try {
        await fetchApiJson('/api/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile, air: activeAir }),
        });
        showToast('Your household plan has been personalized.');
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 400 || err.status === 409) && activeAir.live) {
          setAir(demoAir(city.name));
          setLiveError(`${err.message} Reverted to labeled demo data.`);
        }
        showToast(
          err instanceof Error
            ? err.message
            : 'Updated locally; server validation notice.',
        );
      }
    },
    [city.name, enforceForecastFreshness, profile, showToast],
  );

  const handleGenerateBrief = useCallback(async () => {
    if (briefBusy) return;
    const activeAir = enforceForecastFreshness(false);
    setBriefBusy(true);
    setBriefError(null);
    try {
      const res = await fetchApiJson<PlanBriefApiResponse>(
        '/api/brief',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile, air: activeAir }),
        },
        24000,
      );
      setBrief(res);
    } catch (err) {
      if (err instanceof ApiRequestError && (err.status === 400 || err.status === 409) && activeAir.live) {
        const fallbackAir = demoAir(city.name);
        setAir(fallbackAir);
        setLiveError(`${err.message} Reverted to labeled demo data.`);
      }
      const fallback = fallbackPlanBrief(makePlan(profile, activeAir), activeAir);
      setBrief({
        ...fallback,
        mode: 'rules-fallback',
        dataMode: activeAir.live ? 'modeled-live-forecast' : 'illustrative-demo',
        fallbackReason: err instanceof Error ? err.message : 'Service unavailable.',
      });
      setBriefError(
        err instanceof Error
          ? `${err.message} Showing deterministic summary instead.`
          : 'Live AI brief unavailable; showing deterministic summary instead.',
      );
    } finally {
      setBriefBusy(false);
    }
  }, [briefBusy, city.name, enforceForecastFreshness, profile]);

  const handleDownloadPlan = useCallback(() => {
    const activeAir = enforceForecastFreshness(false);
    const activePlan = makePlan(profile, activeAir);
    const lines = [
      'SMOGSAFE AI — DAILY PLAN',
      `Location: ${city.name} (${city.latitude.toFixed(3)}, ${city.longitude.toFixed(3)})`,
      `Data: ${
        activeAir.live
          ? `MODELED FORECAST • ${activeAir.timestamp ?? 'time unavailable'} (expires ${activeAir.expiresAt ?? 'N/A'})`
          : 'DEMO EXAMPLE (NOT LIVE)'
      }`,
      'Scale: US AQI (distinct from India NAQI)',
      `US AQI: ${activeAir.current.usAqi} (${aqiBand(activeAir.current.usAqi).label})`,
      `Household: ${JSON.stringify(profile)}`,
      '',
      activePlan.intensity,
      activePlan.intro,
      '',
    ];
    for (const item of activePlan.actions) {
      lines.push(
        `${item.period} — ${item.title} [${item.impactDomain}]`,
        item.detail,
        `Why: ${item.why}`,
        `Trade-off: ${item.tradeOff}`,
        `Supporting data: ${item.supportingData}`,
        `Impact & uncertainty: ${item.impactWithUncertainty}`,
        '',
      );
    }
    lines.push('INDOOR AIR GUIDE');
    for (const tip of activePlan.indoor) {
      lines.push(`• ${tip.title} [${tip.impactDomain}]: ${tip.detail} (Trade-off: ${tip.tradeOff})`);
    }
    lines.push(
      '',
      activePlan.disclaimer,
      'Data source when live: Open-Meteo / Copernicus CAMS (modeled US AQI, not India NAQI).',
    );
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SmogSafe_AI_Family_Plan.txt';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    showToast('Your current plan has been downloaded.');
  }, [city.latitude, city.longitude, city.name, enforceForecastFreshness, profile, showToast]);

  const handleSendChat = useCallback(
    async (rawMessage: string, modeOverride?: CopilotMode) => {
      const targetMode = modeOverride ?? copilotMode;
      const q = rawMessage.trim();
      if (chatBusy || q.length < 3) {
        if (q.length < 3) showToast('Ask at least three characters.');
        return;
      }
      const activeAir = enforceForecastFreshness(false);
      setChatBusy(true);
      const userMsgId = `u-${Date.now()}`;
      const pendingId = `a-${Date.now() + 1}`;
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: 'user', text: q, channel: targetMode },
        {
          id: pendingId,
          role: 'assistant',
          channel: targetMode,
          text:
            targetMode === 'search'
              ? 'Checking live web advisories via Google Search grounding…'
              : targetMode === 'maps'
                ? 'Searching nearby places around your coordinates via Google Maps grounding…'
                : 'Thinking through a grounded answer…',
        },
      ]);

      try {
        if (targetMode === 'search') {
          const res = await fetchApiJson<SearchGroundingApiResponse>(
            '/api/search-grounding',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: q, profile, air: activeAir }),
            },
            30000,
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    channel: 'search',
                    text: res.answer,
                    sources: res.sources,
                    uncertaintyNote: res.uncertaintyNote,
                    medicalDisclaimer: res.medicalDisclaimer,
                    mode: res.mode,
                  }
                : m,
            ),
          );
          setChatModeLabel(
            res.mode === 'gemini-search'
              ? 'Gemini Google Search grounding active'
              : 'Local guidance active (no fabricated search links)',
          );
        } else if (targetMode === 'maps') {
          const res = await fetchApiJson<MapsGroundingApiResponse>(
            '/api/maps-grounding',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: q, profile, air: activeAir }),
            },
            30000,
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    channel: 'maps',
                    text: res.answer,
                    places: res.places,
                    uncertaintyNote: res.uncertaintyNote,
                    medicalDisclaimer: res.medicalDisclaimer,
                    mode: res.mode,
                  }
                : m,
            ),
          );
          setChatModeLabel(
            res.mode === 'gemini-maps'
              ? 'Gemini Google Maps grounding active'
              : 'Coordinate guidance active (no fabricated place links)',
          );
        } else {
          const res = await fetchApiJson<ChatApiResponse>(
            '/api/chat',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: q, profile, air: activeAir }),
            },
            30000,
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingId
                ? {
                    ...m,
                    channel: 'plan',
                    text: res.answer,
                    keyActions: res.keyActions,
                    impactDomain: res.impactDomain,
                    uncertaintyNote: res.uncertaintyNote,
                    medicalDisclaimer: res.medicalDisclaimer,
                    mode: res.mode,
                  }
                : m,
            ),
          );
          setChatModeLabel(
            res.mode === 'gemini'
              ? 'Gemini-powered structured answer (schema validated)'
              : 'Deterministic rule-based fallback guidance',
          );
        }
      } catch (err) {
        if (err instanceof ApiRequestError && (err.status === 400 || err.status === 409) && activeAir.live) {
          setAir(demoAir(city.name));
          setLiveError(`${err.message} Reverted to labeled demo data.`);
        }
        const fallback = fallbackAnswer(q, profile, activeAir);
        const errText = err instanceof Error ? err.message : 'Service unavailable.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  ...m,
                  channel: targetMode,
                  text: `${errText} Using verified deterministic guidance instead: ${fallback.answer}`,
                  keyActions: fallback.keyActions,
                  impactDomain: fallback.impactDomain,
                  uncertaintyNote: fallback.uncertaintyNote,
                  medicalDisclaimer: fallback.medicalDisclaimer,
                  mode: 'rules-fallback',
                }
              : m,
          ),
        );
        setChatModeLabel('Safe deterministic fallback guidance');
      } finally {
        setChatBusy(false);
      }
    },
    [chatBusy, city.name, copilotMode, enforceForecastFreshness, profile, showToast],
  );

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    [],
  );

  return (
    <>
      {gmpQuotaExceeded && (
        <div
          className="quota-banner bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm"
          role="alert"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <div className="app-shell">
        <Sidebar
          activeView={activeView}
          mobileOpen={mobileOpen}
          onSelectView={handleSelectView}
          onCloseMobile={handleCloseMobile}
        />

        <div className="workspace">
          <header className="topbar">
            <div className="topbar-left">
              <button
                ref={menuToggleRef}
                className="mobile-menu icon-button"
                type="button"
                id="menu-toggle"
                aria-label="Toggle navigation"
                aria-expanded={mobileOpen}
                aria-controls="sidebar"
                onClick={() => setMobileOpen((prev) => !prev)}
              >
                <Icon name={mobileOpen ? 'close' : 'menu'} />
              </button>
              <nav className="breadcrumb" aria-label="Breadcrumb">
                SMOGSAFE <span aria-hidden="true">/</span>{' '}
                <strong id="crumb">{NAV_LABELS[activeView] || NAV_ITEMS[0].label}</strong>
              </nav>
            </div>
            <div className="topbar-right">
              <span id="clock-date" className="current-date">
                {formattedDate}
              </span>
              <span className="topbar-divider" aria-hidden="true" />
              <span
                className="user-avatar"
                aria-label={user ? `Signed in as ${user.displayName || user.email || 'Member'}` : 'SmogSafe profile'}
                title={user ? `Signed in: ${user.email}` : 'Local session'}
              >
                {(user?.displayName || user?.email || 'S').charAt(0).toUpperCase()}
              </span>
            </div>
          </header>

          <main id="main" ref={mainRef} tabIndex={-1}>
            {activeView === 'overview' && (
              <OverviewView
                city={city}
                air={air}
                profile={profile}
                plan={plan}
                cityQuery={cityQuery}
                searchResults={searchResults}
                liveLoading={liveLoading}
                liveError={liveError}
                mapsApiKey={mapsApiKey}
                onCityQueryChange={setCityQuery}
                onSearchCity={handleSearchCity}
                onSelectCity={handleSelectCity}
                onUseGeo={handleUseGeo}
                onLoadLive={handleLoadLive}
                onLoadLiveCoords={(lat, lon, label) => {
                  void loadLiveForCoords(lat, lon, label);
                }}
                onProfileChange={(next) =>
                  setProfile({
                    ...next,
                    latitude: city.latitude,
                    longitude: city.longitude,
                  })
                }
                onProfileSubmit={handleProfileSubmit}
                onApplySavedProfile={(saved) => setProfile(safeProfile(saved as unknown as Record<string, unknown>))}
                onNotify={showToast}
                onDownloadPlan={handleDownloadPlan}
                onNavigate={handleSelectView}
              />
            )}

            {activeView === 'plan' && (
              <DailyPlanView
                plan={plan}
                air={air}
                brief={brief}
                briefBusy={briefBusy}
                briefError={briefError}
                onGenerateBrief={() => {
                  void handleGenerateBrief();
                }}
                onDownloadPlan={handleDownloadPlan}
              />
            )}

            {activeView === 'indoor' && <IndoorGuideView indoorTips={plan.indoor} />}

            {activeView === 'scene3d' && (
              <Suspense
                fallback={
                  <section className="view" aria-busy="true">
                    <div className="card brief-card">
                      <span className="eyebrow-mini">INTERACTIVE 3D DIGITAL TWIN</span>
                      <h2>Loading 3D Smog Simulation…</h2>
                    </div>
                  </section>
                }
              >
                <LazySmogScene3DView city={city} air={air} profile={profile} />
              </Suspense>
            )}

            {activeView === 'impact' && (
              <ImpactLabView country={city.country || 'India'} />
            )}

            {activeView === 'copilot' && (
              <CopilotView
                messages={messages}
                chatModeLabel={chatModeLabel}
                chatBusy={chatBusy}
                copilotMode={copilotMode}
                cityName={city.name}
                onModeChange={setCopilotMode}
                onSendMessage={handleSendChat}
              />
            )}
          </main>

          <footer className="footer">
            <span>SmogSafe AI · Built for thoughtful everyday choices</span>
            <div>
              <span id="footer-data">
                {air.live ? 'Open-Meteo modeled forecast' : 'Invented demo data'}
              </span>
              <span aria-hidden="true">·</span>
              <a
                href="https://open-meteo.com/en/docs/air-quality-api"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open-Meteo data source <Icon name="external" />
              </a>
              <span aria-hidden="true">·</span>
              <span>Not medical advice</span>
            </div>
          </footer>
        </div>
      </div>

      <div id="toast" className={`toast${toastVisible ? ' show' : ''}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
