import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
} from '../lib/firebase.ts';
import {
  buildAirLogData,
  buildPrivateProfileData,
  buildSavedPlanData,
  isValidFirestoreId,
} from '../lib/firestoreValidation.ts';
import type { AirQualityData, DailyPlan, HouseholdProfile } from '../shared/types.ts';

export interface CloudSavedPlan {
  id: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  dataStatus: 'modeled-live-forecast' | 'illustrative-demo';
  scale: 'US AQI';
  usAqi: number;
  pm25: number;
  forecastTimestamp: string;
  sourceLabel: string;
  intensity: string;
  actionTitles: string[];
  schedule: HouseholdProfile['schedule'];
  commute: HouseholdProfile['commute'];
  budget: HouseholdProfile['budget'];
}

export interface CloudAirLog {
  id: string;
  city: string;
  usAqi: number;
  dataStatus: 'modeled-live-forecast' | 'illustrative-demo';
  actionTaken: string;
  note: string;
}

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  syncBusy: boolean;
  authError: string | null;
  cloudProfile: HouseholdProfile | null;
  savedPlans: CloudSavedPlan[];
  airLogs: CloudAirLog[];
  signInWithGoogle: () => Promise<void>;
  signOutAccount: () => Promise<void>;
  saveCloudProfile: (profile: HouseholdProfile) => Promise<void>;
  savePlanSnapshot: (profile: HouseholdProfile, air: AirQualityData, plan: DailyPlan) => Promise<void>;
  deleteSavedPlan: (planId: string) => Promise<void>;
  logExposureAction: (city: string, air: AirQualityData, actionTaken: string, note: string) => Promise<void>;
  deleteAirLog: (logId: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

async function ensureUserAnchor(uid: string): Promise<void> {
  if (!isValidFirestoreId(uid)) {
    throw new Error('Invalid authenticated user identifier.');
  }
  const userDocRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      await setDoc(userDocRef, {
        uid,
        schemaVersion: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cloudProfile, setCloudProfile] = useState<HouseholdProfile | null>(null);
  const [savedPlans, setSavedPlans] = useState<CloudSavedPlan[]>([]);
  const [airLogs, setAirLogs] = useState<CloudAirLog[]>([]);
  const [fatalFirestoreError, setFatalFirestoreError] = useState<Error | null>(null);

  if (fatalFirestoreError) {
    throw fatalFirestoreError;
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setCloudProfile(null);
        setSavedPlans([]);
        setAirLogs([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !isValidFirestoreId(user.uid)) {
      return;
    }

    let cancelled = false;
    let unsubProfile: (() => void) | null = null;
    let unsubPlans: (() => void) | null = null;
    let unsubLogs: (() => void) | null = null;

    const setupListeners = async () => {
      try {
        await ensureUserAnchor(user.uid);
      } catch (err) {
        if (!cancelled && err instanceof Error) {
          setAuthError('Cloud sync paused until permissions settle.');
        }
        return;
      }
      if (cancelled) return;

      const profilePath = `users/${user.uid}/private/profile`;
      unsubProfile = onSnapshot(
        doc(db, 'users', user.uid, 'private', 'profile'),
        (snap) => {
          if (!snap.exists()) {
            setCloudProfile(null);
            return;
          }
          const d = snap.data();
          setCloudProfile({
            city: String(d.city || 'New Delhi'),
            country: String(d.country || 'India'),
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
            schedule: d.schedule,
            commute: d.commute,
            budget: d.budget,
            children: Boolean(d.children),
            seniors: Boolean(d.seniors),
            sensitive: Boolean(d.sensitive),
            purifier: Boolean(d.purifier),
          });
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.GET, profilePath);
          } catch (wrapped) {
            if (!cancelled && wrapped instanceof Error) {
              setFatalFirestoreError(wrapped);
            }
          }
        },
      );

      const plansPath = `users/${user.uid}/plans`;
      const plansQuery = query(
        collection(db, 'users', user.uid, 'plans'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(8),
      );
      unsubPlans = onSnapshot(
        plansQuery,
        (snap) => {
          const items: CloudSavedPlan[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              city: String(d.city || ''),
              country: String(d.country || 'India'),
              latitude: Number(d.latitude),
              longitude: Number(d.longitude),
              dataStatus:
                d.dataStatus === 'modeled-live-forecast'
                  ? 'modeled-live-forecast'
                  : 'illustrative-demo',
              scale: 'US AQI',
              usAqi: Number(d.usAqi || 0),
              pm25: Number(d.pm25 || 0),
              forecastTimestamp: String(d.forecastTimestamp || ''),
              sourceLabel: String(d.sourceLabel || ''),
              intensity: String(d.intensity || ''),
              actionTitles: Array.isArray(d.actionTitles) ? d.actionTitles.map(String) : [],
              schedule: d.schedule,
              commute: d.commute,
              budget: d.budget,
            };
          });
          setSavedPlans(items);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, plansPath);
          } catch (wrapped) {
            if (!cancelled && wrapped instanceof Error) {
              setFatalFirestoreError(wrapped);
            }
          }
        },
      );

      const logsPath = `users/${user.uid}/airLogs`;
      const logsQuery = query(
        collection(db, 'users', user.uid, 'airLogs'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(6),
      );
      unsubLogs = onSnapshot(
        logsQuery,
        (snap) => {
          const items: CloudAirLog[] = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              city: String(d.city || ''),
              usAqi: Number(d.usAqi || 0),
              dataStatus:
                d.dataStatus === 'modeled-live-forecast'
                  ? 'modeled-live-forecast'
                  : 'illustrative-demo',
              actionTaken: String(d.actionTaken || ''),
              note: String(d.note || ''),
            };
          });
          setAirLogs(items);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, logsPath);
          } catch (wrapped) {
            if (!cancelled && wrapped instanceof Error) {
              setFatalFirestoreError(wrapped);
            }
          }
        },
      );
    };

    void setupListeners();

    return () => {
      cancelled = true;
      unsubProfile?.();
      unsubPlans?.();
      unsubLogs?.();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError(null);
      } else {
        setAuthError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutAccount = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out right now.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const saveCloudProfile = useCallback(
    async (profile: HouseholdProfile) => {
      if (!user || !user.emailVerified) {
        throw new Error('Sign in with a verified Google account to sync your household profile.');
      }
      setSyncBusy(true);
      const profilePath = `users/${user.uid}/private/profile`;
      try {
        await ensureUserAnchor(user.uid);
        const profileRef = doc(db, 'users', user.uid, 'private', 'profile');
        const payload = buildPrivateProfileData(
          user.uid,
          user.email ?? '',
          user.displayName ?? '',
          profile,
        );
        const existingSnap = await getDoc(profileRef);
        if (existingSnap.exists()) {
          await updateDoc(profileRef, {
            ...payload,
            createdAt: existingSnap.data().createdAt,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(profileRef, {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, profilePath);
      } finally {
        setSyncBusy(false);
      }
    },
    [user],
  );

  const savePlanSnapshot = useCallback(
    async (profile: HouseholdProfile, air: AirQualityData, plan: DailyPlan) => {
      if (!user || !user.emailVerified) {
        throw new Error('Sign in with a verified Google account to save plan snapshots.');
      }
      setSyncBusy(true);
      const planId = `plan_${Date.now()}`;
      const planPath = `users/${user.uid}/plans/${planId}`;
      try {
        await ensureUserAnchor(user.uid);
        const payload = buildSavedPlanData(user.uid, profile, air, plan);
        await setDoc(doc(db, 'users', user.uid, 'plans', planId), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, planPath);
      } finally {
        setSyncBusy(false);
      }
    },
    [user],
  );

  const deleteSavedPlan = useCallback(
    async (planId: string) => {
      if (!user || !isValidFirestoreId(planId)) return;
      const planPath = `users/${user.uid}/plans/${planId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'plans', planId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, planPath);
      }
    },
    [user],
  );

  const logExposureAction = useCallback(
    async (city: string, air: AirQualityData, actionTaken: string, note: string) => {
      if (!user || !user.emailVerified) {
        throw new Error('Sign in with Google to save exposure notes.');
      }
      setSyncBusy(true);
      const logId = `log_${Date.now()}`;
      const logPath = `users/${user.uid}/airLogs/${logId}`;
      try {
        await ensureUserAnchor(user.uid);
        const payload = buildAirLogData(user.uid, city, air, actionTaken, note);
        await setDoc(doc(db, 'users', user.uid, 'airLogs', logId), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, logPath);
      } finally {
        setSyncBusy(false);
      }
    },
    [user],
  );

  const deleteAirLog = useCallback(
    async (logId: string) => {
      if (!user || !isValidFirestoreId(logId)) return;
      const logPath = `users/${user.uid}/airLogs/${logId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'airLogs', logId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, logPath);
      }
    },
    [user],
  );

  return (
    <FirebaseContext.Provider
      value={{
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
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebaseSync(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebaseSync must be used inside FirebaseProvider.');
  }
  return ctx;
}
