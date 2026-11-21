import React, { useState } from 'react';
import { useFirebaseSync } from '../context/FirebaseContext.tsx';
import type { AirQualityData, CityLocation, DailyPlan, HouseholdProfile } from '../shared/types.ts';
import { Icon } from './Icons.tsx';

interface CloudSyncCardProps {
  profile: HouseholdProfile;
  air: AirQualityData;
  plan: DailyPlan;
  onApplySavedProfile: (profile: HouseholdProfile) => void;
  onSelectSavedCity: (city: CityLocation) => void;
  onNotify: (msg: string) => void;
}

export const CloudSyncCard: React.FC<CloudSyncCardProps> = ({
  profile,
  air,
  plan,
  onApplySavedProfile,
  onSelectSavedCity,
  onNotify,
}) => {
  const {
    user,
    authReady,
    authBusy,
    syncBusy,
    authError,
    cloudProfile,
    savedPlans,
    airLogs,
    signInWithGoogle,
    signOutAccount,
    saveCloudProfile,
    savePlanSnapshot,
    deleteSavedPlan,
    logExposureAction,
    deleteAirLog,
  } = useFirebaseSync();

  const [actionTaken, setActionTaken] = useState('Switched to metro or stayed indoors during peak hours');
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    setLocalError(null);
    try {
      await saveCloudProfile(profile);
      onNotify('Household settings synced to your encrypted Cloud Firestore profile.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not sync household profile.');
    }
  };

  const handleSaveSnapshot = async () => {
    setLocalError(null);
    try {
      await savePlanSnapshot(profile, air, plan);
      onNotify('Saved daily routine snapshot to Cloud Firestore.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not save snapshot.');
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) return;
    setLocalError(null);
    try {
      await logExposureAction(profile.city, air, actionTaken, note);
      setNote('');
      onNotify('Saved routine check-in note.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Could not save routine check-in.');
    }
  };

  return (
    <article className="card cloud-sync-card" aria-label="Cloud account sync">
      <div className="section-card-head">
        <div>
          <div className="eyebrow-mini">FAMILY CLOUD SYNC</div>
          <h2>Saved profiles &amp; routine history</h2>
        </div>
        {user ? (
          <span className="source-pill">Signed in</span>
        ) : (
          <span className="chart-key">Optional Google Sign-In</span>
        )}
      </div>

      {!authReady ? (
        <p className="cloud-sync-copy">Checking account session…</p>
      ) : !user ? (
        <div className="cloud-signed-out">
          <p className="cloud-sync-copy">
            Everything works locally without an account. Sign in with Google if you want to store your household profile, saved city snapshots, and daily check-ins privately in Cloud Firestore.
          </p>
          <button
            type="button"
            id="google-signin-btn"
            className="btn btn-primary"
            disabled={authBusy}
            onClick={() => void signInWithGoogle()}
          >
            <Icon name="shield" /> {authBusy ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>
      ) : (
        <div className="cloud-signed-in">
          <div className="cloud-account-row">
            <div className="cloud-account-meta">
              <strong>{user.displayName || 'SmogSafe Family Member'}</strong>
              <span>{user.email}</span>
            </div>
            <div className="cloud-account-actions">
              <button
                type="button"
                className="btn btn-line btn-sm"
                disabled={syncBusy}
                onClick={() => void handleSaveProfile()}
              >
                Sync household
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={syncBusy}
                onClick={() => void handleSaveSnapshot()}
              >
                Save plan snapshot
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                disabled={authBusy}
                onClick={() => void signOutAccount()}
              >
                Sign out
              </button>
            </div>
          </div>

          {cloudProfile && (
            <div className="cloud-restore-bar">
              <span>
                Cloud profile saved for <strong>{cloudProfile.city}</strong> ({cloudProfile.commute},{' '}
                {cloudProfile.schedule})
              </span>
              <button
                type="button"
                className="btn btn-line btn-sm"
                onClick={() => {
                  onSelectSavedCity({
                    name: cloudProfile.city,
                    admin1: '',
                    country: cloudProfile.country || 'India',
                    latitude: Number(cloudProfile.latitude ?? 28.6139),
                    longitude: Number(cloudProfile.longitude ?? 77.209),
                  });
                  onApplySavedProfile(cloudProfile);
                  onNotify(`Loaded saved cloud settings for ${cloudProfile.city}.`);
                }}
              >
                Apply saved settings
              </button>
            </div>
          )}

          {savedPlans.length > 0 && (
            <div className="cloud-list-section">
              <div className="tiny-label">SAVED SNAPSHOTS ({savedPlans.length})</div>
              <ul className="cloud-list">
                {savedPlans.map((item) => (
                  <li key={item.id} className="cloud-list-item">
                    <div>
                      <strong>
                        {item.city} · US AQI {item.usAqi}
                      </strong>
                      <span className="cloud-item-meta">
                        {item.dataStatus === 'modeled-live-forecast' ? 'Modeled forecast' : 'Demo example'} ·{' '}
                        {item.intensity}
                      </span>
                    </div>
                    <div className="cloud-item-btns">
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        aria-label={`Delete snapshot for ${item.city}`}
                        onClick={() => void deleteSavedPlan(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form className="cloud-log-form" onSubmit={(e) => void handleAddLog(e)}>
            <label htmlFor="cloud-log-action" className="tiny-label">
              LOG A CLEANER-AIR CHECK-IN
            </label>
            <div className="cloud-log-inputs">
              <select
                id="cloud-log-action"
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
              >
                <option value="Switched to metro or stayed indoors during peak hours">
                  Switched to metro / avoided peak outdoor rush
                </option>
                <option value="Ran HEPA purifier and kept doors sealed">
                  Ran HEPA purifier &amp; sealed room
                </option>
                <option value="Used damp mopping and kitchen exhaust">
                  Damp-mopped &amp; ran kitchen exhaust
                </option>
              </select>
              <input
                id="cloud-log-note"
                type="text"
                placeholder="Short note (e.g., Indoor PM felt noticeably calmer)"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-line btn-sm" disabled={syncBusy}>
                Log note
              </button>
            </div>
          </form>

          {airLogs.length > 0 && (
            <ul className="cloud-list">
              {airLogs.map((entry) => (
                <li key={entry.id} className="cloud-list-item">
                  <div>
                    <strong>
                      {entry.city} (US AQI {entry.usAqi}) — {entry.actionTaken}
                    </strong>
                    <span className="cloud-item-meta">{entry.note}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-quiet btn-sm"
                    aria-label={`Delete check-in log for ${entry.city}`}
                    onClick={() => void deleteAirLog(entry.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(authError || localError) && (
        <div className="error-banner" role="alert">
          {authError || localError}
        </div>
      )}
    </article>
  );
};
