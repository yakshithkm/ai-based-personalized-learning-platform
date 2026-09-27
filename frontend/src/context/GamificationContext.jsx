import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';
import { onGamificationEvent } from '../utils/appEvents';

const noop = () => {};
const defaultGamificationContext = {
  gamification: null,
  loaded: false,
  refreshGamification: async () => {},
  applyGamificationResult: noop,
  showXpGain: noop,
  showAchievementUnlock: noop,
  showLevelUp: noop,
};

// Default value (rather than null) means any component that calls
// useGamification() without being wrapped in a <GamificationProvider> -
// e.g. an existing smoke test that renders <Layout /> in isolation -
// degrades gracefully to "no gamification data yet" instead of throwing.
const GamificationContext = createContext(defaultGamificationContext);

let toastIdCounter = 0;

// Central, app-wide gamification state. Fetches the aggregated summary once
// (section 33/48 - one endpoint for header/dashboard instead of N widgets
// each hitting the API), then applies further updates locally from the
// `gamification` result object any endpoint returns alongside its normal
// response - no refetch needed for every small interaction.
export const GamificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [gamification, setGamification] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [xpToasts, setXpToasts] = useState([]);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [levelUp, setLevelUp] = useState(null);
  const timersRef = useRef(new Map());

  const refreshGamification = useCallback(async () => {
    try {
      const res = await api.get('/gamification/summary');
      setGamification(res?.data || null);
    } catch (error) {
      // Gamification is additive UI chrome - a failed fetch should never
      // block the rest of the app from working.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setGamification(null);
      setLoaded(false);
      return undefined;
    }
    refreshGamification();
    return undefined;
  }, [user, refreshGamification]);

  const dismissXpToast = useCallback((id) => {
    setXpToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showXpGain = useCallback(
    (xpAwarded, label) => {
      if (!xpAwarded) return;
      const id = toastIdCounter++;
      setXpToasts((prev) => [...prev.slice(-2), { id, xpAwarded, label }]);
      const timer = setTimeout(() => dismissXpToast(id), 2600);
      timersRef.current.set(id, timer);
    },
    [dismissXpToast]
  );

  const showAchievementUnlock = useCallback((achievement) => {
    setAchievementQueue((prev) => [...prev, achievement]);
  }, []);

  const dismissAchievement = useCallback(() => {
    setAchievementQueue((prev) => prev.slice(1));
  }, []);

  const showLevelUp = useCallback((payload) => {
    setLevelUp(payload);
  }, []);

  const dismissLevelUp = useCallback(() => setLevelUp(null), []);

  // Applies one `gamification` result (as returned by processEvent on the
  // backend) into local state, and surfaces any toast/modal it implies.
  const applyGamificationResult = useCallback(
    (result, { label } = {}) => {
      if (!result || result.duplicate) return;

      setGamification((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          profile: {
            ...prev.profile,
            totalXp: result.totalXp,
            level: result.level,
            currentLevelXp: result.currentLevelXp,
            xpForNextLevel: result.xpForNextLevel,
            progressPercent: result.xpForNextLevel
              ? Math.min(100, Math.round((result.currentLevelXp / result.xpForNextLevel) * 100))
              : 100,
            currentStreak: result.streak?.currentStreak ?? prev.profile.currentStreak,
            longestStreak: result.streak?.longestStreak ?? prev.profile.longestStreak,
          },
        };
      });

      if (result.xpAwarded) showXpGain(result.xpAwarded, label);
      if (result.leveledUp) {
        showLevelUp({ previousLevel: result.previousLevel, newLevel: result.level, xpAwarded: result.xpAwarded });
      }
      (result.newAchievements || []).forEach((achievement) => showAchievementUnlock(achievement));
    },
    [showXpGain, showLevelUp, showAchievementUnlock]
  );

  useEffect(() => {
    const unsubscribe = onGamificationEvent((event) => {
      applyGamificationResult(event.detail);
    });
    return unsubscribe;
  }, [applyGamificationResult]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <GamificationContext.Provider
      value={{
        gamification,
        loaded,
        refreshGamification,
        applyGamificationResult,
        showXpGain,
        showAchievementUnlock,
        showLevelUp,
      }}
    >
      {children}

      <div className="xp-toast-stack" role="status" aria-live="polite">
        {xpToasts.map((toast) => (
          <div key={toast.id} className="xp-toast">
            <span className="xp-toast-amount">+{toast.xpAwarded} XP</span>
            {toast.label && <span className="xp-toast-label">{toast.label}</span>}
          </div>
        ))}
      </div>

      {achievementQueue[0] && (
        <div className="gam-modal-backdrop" role="dialog" aria-modal="true" aria-label="Achievement unlocked">
          <div className="gam-modal achievement-modal">
            <span className="gam-modal-icon" aria-hidden="true">🏆</span>
            <p className="gam-modal-eyebrow">Achievement Unlocked</p>
            <h3>{achievementQueue[0].label}</h3>
            <p className="gam-modal-desc">{achievementQueue[0].description}</p>
            {Boolean(achievementQueue[0].xp) && <p className="gam-modal-xp">+{achievementQueue[0].xp} XP</p>}
            <button type="button" className="solid-btn" onClick={dismissAchievement} autoFocus>
              Nice!
            </button>
          </div>
        </div>
      )}

      {levelUp && (
        <div className="gam-modal-backdrop" role="dialog" aria-modal="true" aria-label="Level up">
          <div className="gam-modal levelup-modal">
            <span className="gam-modal-icon" aria-hidden="true">⭐</span>
            <p className="gam-modal-eyebrow">Level Up</p>
            <h3>Level {levelUp.previousLevel} → Level {levelUp.newLevel}</h3>
            <p className="gam-modal-desc">You earned {levelUp.xpAwarded} XP to get here.</p>
            <button type="button" className="solid-btn" onClick={dismissLevelUp} autoFocus>
              Keep Going
            </button>
          </div>
        </div>
      )}
    </GamificationContext.Provider>
  );
};

// Returns { gamification, loaded, refreshGamification, applyGamificationResult,
//   showXpGain, showAchievementUnlock, showLevelUp }.
// `gamification` matches GET /api/gamification/summary's shape (or null
// before the first load / when logged out).
export const useGamification = () => useContext(GamificationContext);