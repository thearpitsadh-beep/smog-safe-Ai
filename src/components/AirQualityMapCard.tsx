import React, { useCallback, useEffect, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { DEMO_CITIES, aqiBand, demoAir } from '../shared/airQuality.ts';
import type { AirQualityData, CityLocation } from '../shared/types.ts';
import { Icon } from './Icons.tsx';

interface MapsAqiIndex {
  code?: string;
  displayName?: string;
  aqi?: number;
  aqiDisplay?: string;
  category?: string;
  dominantPollutant?: string;
}

interface AirQualityMapCardProps {
  mapsApiKey: string;
  selectedCity: CityLocation;
  air: AirQualityData;
  onSelectCity: (city: CityLocation) => void;
  onLoadLiveCoords: (lat: number, lon: number, label: string) => void;
}

function dispatchQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

interface CityPinProps {
  city: CityLocation;
  isSelected: boolean;
  aqiValue: number;
  onPickCity: (city: CityLocation) => void;
}

const CityPinMarker: React.FC<CityPinProps> = ({
  city,
  isSelected,
  aqiValue,
  onPickCity,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);
  const band = aqiBand(aqiValue);

  const pinColors = isSelected
    ? { background: '#145a4f', borderColor: '#0a292f', glyphColor: '#ffffff' }
    : aqiValue > 150
      ? { background: '#b94435', borderColor: '#7a251b', glyphColor: '#ffffff' }
      : aqiValue > 100
        ? { background: '#b36b18', borderColor: '#6d3e08', glyphColor: '#ffffff' }
        : { background: '#1b6d52', borderColor: '#0e4030', glyphColor: '#ffffff' };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: city.latitude, lng: city.longitude }}
        title={`${city.name} (US AQI ${Math.round(aqiValue)})`}
        onClick={() => {
          setInfoOpen(true);
          onPickCity(city);
        }}
      >
        <Pin
          background={pinColors.background}
          borderColor={pinColors.borderColor}
          glyphColor={pinColors.glyphColor}
          scale={isSelected ? 1.18 : 0.95}
          glyphText={String(Math.round(aqiValue))}
        />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="map-infowindow">
            <strong>{[city.name, city.admin1].filter(Boolean).join(', ')}</strong>
            <p>
              US AQI {Math.round(aqiValue)} · {band.label}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface InnerMapCanvasProps {
  selectedCity: CityLocation;
  air: AirQualityData;
  onSelectCity: (city: CityLocation) => void;
  onLoadLiveCoords: (lat: number, lon: number, label: string) => void;
}

const InnerMapCanvas: React.FC<InnerMapCanvasProps> = ({
  selectedCity,
  air,
  onSelectCity,
  onLoadLiveCoords,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const loadingStatus = useApiLoadingStatus();

  const [placeQuery, setPlaceQuery] = useState('');
  const [placeStatus, setPlaceStatus] = useState<string | null>(null);
  const [searchingPlace, setSearchingPlace] = useState(false);

  useEffect(() => {
    if (
      loadingStatus === APILoadingStatus.AUTH_FAILURE ||
      loadingStatus === APILoadingStatus.FAILED
    ) {
      dispatchQuotaExceeded();
    }
  }, [loadingStatus]);

  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: selectedCity.latitude, lng: selectedCity.longitude });
  }, [map, selectedCity.latitude, selectedCity.longitude]);

  const handlePlaceSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = placeQuery.trim();
      if (q.length < 2) return;
      if (!placesLib || !placesLib.Place?.searchByText) {
        setPlaceStatus('Places search is still initializing.');
        return;
      }
      setSearchingPlace(true);
      setPlaceStatus(null);
      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: q,
          fields: ['displayName', 'formattedAddress', 'location'],
          maxResultCount: 1,
          language: 'en',
        });
        const top = places?.[0];
        if (!top || !top.location) {
          setPlaceStatus('No matching place found on Google Maps.');
          return;
        }
        const lat = top.location.lat();
        const lng = top.location.lng();
        const label = top.displayName || q;
        const nextCity: CityLocation = {
          name: label,
          admin1: top.formattedAddress || 'Google Maps Place',
          country: 'India',
          latitude: lat,
          longitude: lng,
        };
        onSelectCity(nextCity);
        onLoadLiveCoords(lat, lng, label);
        setPlaceQuery('');
        setPlaceStatus(`Centered on ${label}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('429')
        ) {
          dispatchQuotaExceeded();
        }
        setPlaceStatus('Unable to search this place right now.');
      } finally {
        setSearchingPlace(false);
      }
    },
    [onLoadLiveCoords, onSelectCity, placeQuery, placesLib],
  );

  if (loadingStatus === APILoadingStatus.AUTH_FAILURE || loadingStatus === APILoadingStatus.FAILED) {
    return (
      <div className="map-fallback" role="status">
        <Icon name="pin" />
        <div>
          <strong>Interactive Google Map temporarily unavailable</strong>
          <p>
            City coordinates ({selectedCity.latitude.toFixed(3)}, {selectedCity.longitude.toFixed(3)}) and modeled forecasts continue working normally.
          </p>
        </div>
      </div>
    );
  }

  const isPresetSelected = DEMO_CITIES.some(
    (c) =>
      Math.abs(c.latitude - selectedCity.latitude) < 0.02 &&
      Math.abs(c.longitude - selectedCity.longitude) < 0.02,
  );

  return (
    <>
      <form className="map-place-search" onSubmit={handlePlaceSearch}>
        <label htmlFor="map-place-input" className="sr-only">
          Jump to a neighborhood or landmark on Google Maps
        </label>
        <input
          id="map-place-input"
          type="text"
          placeholder="Search neighborhood or landmark on map (e.g., Connaught Place, Delhi)"
          value={placeQuery}
          maxLength={100}
          onChange={(e) => setPlaceQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-line" disabled={searchingPlace}>
          <Icon name="pin" /> {searchingPlace ? 'Searching…' : 'Find on map'}
        </button>
      </form>
      {placeStatus && (
        <p className="map-place-status" role="status">
          {placeStatus}
        </p>
      )}
      <div className="map-canvas-wrap">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: selectedCity.latitude, lng: selectedCity.longitude }}
          defaultZoom={10}
          gestureHandling="cooperative"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          style={{ width: '100%', height: '100%' }}
        >
          {DEMO_CITIES.map((city) => {
            const matchSelected =
              Math.abs(city.latitude - selectedCity.latitude) < 0.02 &&
              Math.abs(city.longitude - selectedCity.longitude) < 0.02;
            const cityAqi = matchSelected ? air.current.usAqi : demoAir(city.name).current.usAqi;
            return (
              <CityPinMarker
                key={city.name}
                city={city}
                isSelected={matchSelected}
                aqiValue={cityAqi}
                onPickCity={(picked) => {
                  onSelectCity(picked);
                  onLoadLiveCoords(picked.latitude, picked.longitude, picked.name);
                }}
              />
            );
          })}
          {!isPresetSelected && (
            <CityPinMarker
              city={selectedCity}
              isSelected
              aqiValue={air.current.usAqi}
              onPickCity={(picked) =>
                onLoadLiveCoords(picked.latitude, picked.longitude, picked.name)
              }
            />
          )}
        </GoogleMap>
      </div>
    </>
  );
};

export const AirQualityMapCard: React.FC<AirQualityMapCardProps> = ({
  mapsApiKey,
  selectedCity,
  air,
  onSelectCity,
  onLoadLiveCoords,
}) => {
  const [mapsAqi, setMapsAqi] = useState<MapsAqiIndex | null>(null);

  useEffect(() => {
    if (!mapsApiKey) return;
    let cancelled = false;
    fetch(
      `/api/maps-aqi?lat=${encodeURIComponent(selectedCity.latitude)}&lon=${encodeURIComponent(selectedCity.longitude)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          available?: boolean;
          quotaExceeded?: boolean;
          indexes?: MapsAqiIndex[];
        };
        if (res.status === 429 || body.quotaExceeded) {
          dispatchQuotaExceeded();
          return;
        }
        if (!cancelled && body.available && Array.isArray(body.indexes) && body.indexes.length > 0) {
          const usa = body.indexes.find((idx) => idx.code === 'usa_epa') ?? body.indexes[0];
          setMapsAqi(usa);
        } else if (!cancelled) {
          setMapsAqi(null);
        }
      })
      .catch(() => {
        if (!cancelled) setMapsAqi(null);
      });
    return () => {
      cancelled = true;
    };
  }, [mapsApiKey, selectedCity.latitude, selectedCity.longitude]);

  return (
    <article className="card map-card" aria-label="Interactive location map">
      <div className="section-card-head">
        <div>
          <div className="eyebrow-mini">GOOGLE MAPS LOCATION EXPLORER</div>
          <h2>Regional air &amp; city map</h2>
        </div>
        <div className="map-meta-badges">
          {mapsAqi && typeof mapsAqi.aqi === 'number' && (
            <span className="source-pill">
              Google Air Quality: {mapsAqi.aqiDisplay ?? mapsAqi.aqi} ({mapsAqi.displayName ?? 'UAQI'})
            </span>
          )}
          <span className="chart-key">
            {selectedCity.latitude.toFixed(2)}°N, {selectedCity.longitude.toFixed(2)}°E
          </span>
        </div>
      </div>

      {mapsApiKey ? (
        <APIProvider
          apiKey={mapsApiKey}
          libraries={['marker', 'places']}
          language="en"
          region="IN"
        >
          <InnerMapCanvas
            selectedCity={selectedCity}
            air={air}
            onSelectCity={onSelectCity}
            onLoadLiveCoords={onLoadLiveCoords}
          />
        </APIProvider>
      ) : (
        <div className="map-fallback" role="status">
          <Icon name="pin" />
          <div>
            <strong>Map coordinates locked on {selectedCity.name}</strong>
            <p>
              Quick-select another city below or use Search above to load its modeled US AQI outlook.
            </p>
            <div className="map-quick-cities">
              {DEMO_CITIES.map((city) => (
                <button
                  key={city.name}
                  type="button"
                  className={`btn ${city.name === selectedCity.name ? 'btn-primary' : 'btn-line'}`}
                  onClick={() => {
                    onSelectCity(city);
                    onLoadLiveCoords(city.latitude, city.longitude, city.name);
                  }}
                >
                  {city.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
