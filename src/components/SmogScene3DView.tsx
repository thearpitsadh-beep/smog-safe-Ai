import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  estimateIndoorPm25,
  mountSmogSimulationScene,
  type CameraPresetId,
  type SmogSceneController,
} from '../three/smogSimulationScene.ts';
import type { AirQualityData, CityLocation, HouseholdProfile } from '../shared/types.ts';
import { Icon } from './Icons.tsx';

interface SmogScene3DViewProps {
  city: CityLocation;
  air: AirQualityData;
  profile: HouseholdProfile;
}

export const SmogScene3DView: React.FC<SmogScene3DViewProps> = ({ city, air, profile }) => {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SmogSceneController | null>(null);

  const [preset, setPreset] = useState<CameraPresetId>('overview');
  const [hepaCadr, setHepaCadr] = useState<number>(profile.purifier ? 320 : 140);
  const [windSpeed, setWindSpeed] = useState<number>(2.4);
  const [windowsSealed, setWindowsSealed] = useState<boolean>(true);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  const outdoorPm25 = air.current.pm25 ?? Math.max(12, Math.round(air.current.usAqi * 0.45));
  const indoorPm25Estimate = useMemo(
    () => estimateIndoorPm25(outdoorPm25, hepaCadr, windowsSealed),
    [outdoorPm25, hepaCadr, windowsSealed],
  );

  // Mount Three.js WebGL scene once outside React HUD state updates
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;
    const controller = mountSmogSimulationScene(host, {
      usAqi: air.current.usAqi,
      pm25: outdoorPm25,
      hepaCadr,
      windSpeed,
      windowsSealed,
      commute: profile.commute,
      preset,
    });
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
    // Intentionally mounted once per view activation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push reactive props/controls to the Three.js scene without tearing down canvas
  useEffect(() => {
    controllerRef.current?.updateParams({
      usAqi: air.current.usAqi,
      pm25: outdoorPm25,
      hepaCadr,
      windSpeed,
      windowsSealed,
      commute: profile.commute,
    });
  }, [air.current.usAqi, outdoorPm25, hepaCadr, windSpeed, windowsSealed, profile.commute]);

  // Keyboard shortcut 'H' to toggle bottom dock visibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectPreset = (next: CameraPresetId) => {
    setPreset(next);
    controllerRef.current?.setPreset(next);
  };

  return (
    <section
      id="view-scene3d"
      className="view scene3d-view"
      aria-labelledby="scene3d-title"
      data-scene-state={`${preset}-${windowsSealed ? 'sealed' : 'open'}`}
    >
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" />
            <span>INTERACTIVE 3D AIR &amp; HEPA SIMULATION</span>
          </div>
          <h1 id="scene3d-title">
            See how air moves, <em>inside &amp; out.</em>
          </h1>
          <p className="lead">
            Explore an interactive 3D urban block synced to {city.name}&apos;s active{' '}
            {air.live ? 'modeled forecast' : 'illustrative demo'} (US AQI {Math.round(air.current.usAqi)}). Drag to orbit, scroll to zoom, or toggle controls with H.
          </p>
        </div>
      </div>

      <div className="scene3d-stage card">
        {/* Isolated WebGL canvas container outside sibling HUD overlays */}
        <div
          ref={canvasHostRef}
          className="scene3d-canvas-host"
          data-testid="smog-3d-canvas"
          aria-label={`Interactive 3D smog and HEPA filtration simulation for ${city.name}`}
        />

        {/* Minimal top-left HUD telemetry summary (solid/rgba surface, zero backdrop-filter, zero pulse dots) */}
        <div className="scene3d-hud-badge" aria-live="polite">
          <div className="scene3d-badge-row">
            <span className="scene3d-swatch" aria-hidden="true" />
            <strong>
              {city.name} · US AQI {Math.round(air.current.usAqi)}
            </strong>
            <span className="scene3d-prov-tag">
              {air.live ? 'Modeled forecast' : 'Illustrative demo'}
            </span>
          </div>
          <div className="scene3d-badge-metrics">
            <span>Outdoor PM₂.₅: {outdoorPm25.toFixed(1)} µg/m³</span>
            <span>Est. indoor PM₂.₅: {indoorPm25Estimate.toFixed(1)} µg/m³</span>
          </div>
        </div>

        {/* Unified collapsible bottom control dock */}
        <div className={`scene3d-dock-wrap${dockCollapsed ? ' collapsed' : ''}`}>
          <button
            type="button"
            className="scene3d-dock-toggle"
            aria-expanded={!dockCollapsed}
            onClick={() => setDockCollapsed((prev) => !prev)}
          >
            {dockCollapsed ? '▴ Show Controls (H)' : '▾ Hide Controls (H)'}
          </button>

          {!dockCollapsed && (
            <div className="scene3d-dock" role="region" aria-label="3D simulation controls">
              <div className="scene3d-dock-group" role="group" aria-label="Camera views">
                <button
                  type="button"
                  className={`scene3d-pill${preset === 'overview' ? ' active' : ''}`}
                  onClick={() => handleSelectPreset('overview')}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`scene3d-pill${preset === 'indoor' ? ' active' : ''}`}
                  onClick={() => handleSelectPreset('indoor')}
                >
                  Indoor HEPA
                </button>
                <button
                  type="button"
                  className={`scene3d-pill${preset === 'street' ? ' active' : ''}`}
                  onClick={() => handleSelectPreset('street')}
                >
                  Street Exhaust
                </button>
              </div>

              <label className="scene3d-slider">
                <span>HEPA CADR: {hepaCadr} m³/h</span>
                <input
                  type="range"
                  min={0}
                  max={450}
                  step={30}
                  value={hepaCadr}
                  onChange={(e) => setHepaCadr(Number(e.target.value))}
                />
              </label>

              <label className="scene3d-slider">
                <span>Wind: {windSpeed.toFixed(1)} m/s</span>
                <input
                  type="range"
                  min={0.5}
                  max={6}
                  step={0.5}
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(Number(e.target.value))}
                />
              </label>

              <button
                type="button"
                className={`scene3d-pill${windowsSealed ? ' active' : ''}`}
                aria-pressed={windowsSealed}
                onClick={() => setWindowsSealed((prev) => !prev)}
              >
                <Icon name="home" /> {windowsSealed ? 'Windows sealed' : 'Windows open'}
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="fine-print">
        <Icon name="info" />
        <span>
          Illustrative physics visualization: indoor PM₂.₅ estimate uses a simplified steady-state mass-balance ratio and is not a calibrated room sensor measurement.
        </span>
      </p>
    </section>
  );
};
