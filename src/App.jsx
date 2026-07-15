import { useState, useEffect, useMemo } from 'react';

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (totalMinutes) => {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  return isNegative ? `-${timeStr}` : timeStr;
};

const formatDuration = (totalMinutes) => {
  const absMins = Math.abs(totalMinutes);
  if (absMins === 0) return '0 min';
  if (absMins < 60) return `${absMins} min`;
  const hours = Math.floor(absMins / 60);
  const mins = absMins % 60;
  return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`;
};

const getCurrentTimeStr = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
};

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('timeGetterHistory')) || []);
  const [showHistory, setShowHistory] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentTimeStr());
  const [hasNotified, setHasNotified] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTimeStr());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const [times, setTimes] = useState(() => {
    const saved = localStorage.getItem('timeGetterData');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...parsed, 
        hasLunch: parsed.hasLunch ?? true, 
        quota: parsed.quota === '07:30' ? '07:08' : (parsed.quota || '07:08'),
        previousCounterTime: parsed.previousCounterTime || '00:00',
        isPreviousCounterPositive: parsed.isPreviousCounterPositive !== undefined ? parsed.isPreviousCounterPositive : true
      };
    }
    return {
      arrival: '',
      lunchStart: '',
      lunchEnd: '',
      departure: '',
      quota: '07:08',
      hasLunch: true,
      previousCounterTime: '00:00',
      isPreviousCounterPositive: true,
    };
  });

  useEffect(() => {
    localStorage.setItem('timeGetterData', JSON.stringify(times));
  }, [times]);

  useEffect(() => {
    localStorage.setItem('timeGetterHistory', JSON.stringify(history));
  }, [history]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTimes(prev => ({ ...prev, [name]: value }));
  };

  const setNow = (name) => {
    setTimes(prev => ({ ...prev, [name]: getCurrentTimeStr() }));
  };

  const results = useMemo(() => {
    const arrivalMins = timeToMinutes(times.arrival);
    const lunchStartMins = timeToMinutes(times.lunchStart);
    const lunchEndMins = timeToMinutes(times.lunchEnd);
    const departureMins = times.departure ? timeToMinutes(times.departure) : timeToMinutes(currentTime);
    const quotaMins = timeToMinutes(times.quota);

    let workedMins = 0;

    if (times.arrival) {
      if (times.hasLunch) {
        if (times.lunchStart && !times.lunchEnd) {
          workedMins = lunchStartMins - arrivalMins;
        } else if (times.lunchStart && times.lunchEnd) {
          workedMins = departureMins - arrivalMins - (lunchEndMins - lunchStartMins);
        } else {
          workedMins = departureMins - arrivalMins;
        }
      } else {
        workedMins = departureMins - arrivalMins;
      }
    }

    if (workedMins < 0) workedMins = 0;
    
    const overtimeMins = workedMins > 0 ? workedMins - quotaMins : 0;
    
    const previousMins = timeToMinutes(times.previousCounterTime) * (times.isPreviousCounterPositive ? 1 : -1);
    const newTotalCounterMins = previousMins + overtimeMins;

    return {
      workedMins,
      overtimeMins,
      newTotalCounterMins,
    };
  }, [times, currentTime]);

  const progressMins = useMemo(() => {
    if (!times.arrival) return 0;
    const arrivalMins = timeToMinutes(times.arrival);
    const lunchStartMins = timeToMinutes(times.lunchStart);
    const lunchEndMins = timeToMinutes(times.lunchEnd);
    
    let currentMins = timeToMinutes(currentTime);
    if (times.departure) {
      const depMins = timeToMinutes(times.departure);
      if (depMins < currentMins) currentMins = depMins;
    }

    let pMins = 0;
    if (times.hasLunch) {
      if (times.lunchStart && !times.lunchEnd) {
        pMins = lunchStartMins - arrivalMins;
      } else if (times.lunchStart && times.lunchEnd) {
        if (currentMins > lunchStartMins && currentMins < lunchEndMins) {
          pMins = lunchStartMins - arrivalMins;
        } else if (currentMins >= lunchEndMins) {
          pMins = currentMins - arrivalMins - (lunchEndMins - lunchStartMins);
        } else {
          pMins = currentMins - arrivalMins;
        }
      } else {
        pMins = currentMins - arrivalMins;
      }
    } else {
      pMins = currentMins - arrivalMins;
    }
    
    return pMins > 0 ? pMins : 0;
  }, [times, currentTime]);

  useEffect(() => {
    if (results.workedMins > 0 && results.overtimeMins >= 0 && !hasNotified && times.arrival && !times.departure) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification("TimeGetter", {
          body: "Objectif atteint ! Il est temps de rentrer 🎉",
          icon: "/vite.svg"
        });
      }
      setShowToast(true);
      setHasNotified(true);
    }
    if (results.overtimeMins < 0) {
      setHasNotified(false);
      setShowToast(false);
    }
  }, [results.overtimeMins, results.workedMins, hasNotified, times.arrival, times.departure]);

  const endDay = () => {
    if (confirm('Voulez-vous sauvegarder cette journée dans l\'historique et la réinitialiser ?')) {
      const today = new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      
      const newHistoryItem = {
        id: Date.now(),
        date: today,
        workedMins: results.workedMins,
        overtimeMins: results.overtimeMins,
        newTotalCounterMins: results.newTotalCounterMins,
        quota: times.quota
      };

      setHistory(prev => [newHistoryItem, ...prev]);

      setTimes({
        arrival: '',
        lunchStart: '',
        lunchEnd: '',
        departure: '',
        quota: times.quota,
        hasLunch: times.hasLunch,
        previousCounterTime: minutesToTime(Math.abs(results.newTotalCounterMins)),
        isPreviousCounterPositive: results.newTotalCounterMins >= 0,
      });
      setHasNotified(false);
    }
  };

  const deleteHistoryItem = (id) => {
    if (confirm('Supprimer cette entrée ?')) {
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  };

  const quotaMins = timeToMinutes(times.quota) || 1;
  const progressPercent = Math.min((progressMins / quotaMins) * 100, 100);
  const isOverQuota = progressMins >= quotaMins;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative overflow-hidden transition-colors duration-300">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-[200] bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-bounce">
          <span className="text-2xl"><i className="las la-glass-cheers"></i></span>
          <div>
            <div className="font-bold">Objectif atteint !</div>
            <div className="text-sm opacity-90">Il est temps de rentrer.</div>
          </div>
          <button onClick={() => setShowToast(false)} className="ml-4 p-1 hover:bg-emerald-600 rounded-lg">✕</button>
        </div>
      )}

      <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex gap-3 z-50">
        <button 
          onClick={() => setShowHistory(true)}
          className="p-3 rounded-full bg-white/20 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 hover:scale-110 transition-transform shadow-lg flex items-center justify-center w-12 h-12 text-xl"
          title="Historique"
        >
          <i className="las la-history"></i>
        </button>
        <button 
          onClick={toggleTheme}
          className="p-3 rounded-full bg-white/20 dark:bg-slate-800/50 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 text-slate-800 dark:text-slate-200 hover:scale-110 transition-transform shadow-lg flex items-center justify-center w-12 h-12 text-xl"
          title="Changer de thème"
        >
          {theme === 'dark' ? <i className="las la-sun"></i> : <i className="las la-moon"></i>}
        </button>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 dark:opacity-20 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 dark:opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 dark:opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-4xl relative z-10 backdrop-blur-xl bg-white/80 dark:bg-slate-900/60 p-6 sm:p-10 rounded-3xl border border-slate-200 dark:border-slate-700/50 shadow-2xl transition-colors duration-300">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 tracking-tight">
            TimeGetter
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 transition-colors">Gérez votre temps de travail</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Colonne de Gauche : Saisie */}
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/30 transition-colors">
              <div className="flex flex-col">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5 transition-colors">
                  <i className="las la-hourglass-half text-base"></i> Compteur J-1
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimes(prev => ({ ...prev, isPreviousCounterPositive: !prev.isPreviousCounterPositive }))}
                    className={`flex-shrink-0 w-12 h-[50px] rounded-xl flex items-center justify-center text-lg font-bold transition-colors ${times.isPreviousCounterPositive ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:hover:bg-emerald-500/30' : 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30'}`}
                  >
                    {times.isPreviousCounterPositive ? '+' : '-'}
                  </button>
                  <input
                    type="time"
                    name="previousCounterTime"
                    value={times.previousCounterTime}
                    onChange={handleChange}
                    className="flex-1 bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 time-input-modern"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TimeInput label="Arrivée" name="arrival" value={times.arrival} onChange={handleChange} onNowClick={setNow} icon={<i className="las la-sign-in-alt text-base"></i>} />
              <TimeInput label="Départ" name="departure" value={times.departure} onChange={handleChange} onNowClick={setNow} icon={<i className="las la-sign-out-alt text-base"></i>} />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 space-y-4 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">Pause Déjeuner</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors">{times.hasLunch ? 'Activée' : 'Désactivée'}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={times.hasLunch}
                    onClick={() => setTimes(prev => ({ ...prev, hasLunch: !prev.hasLunch }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${times.hasLunch ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${times.hasLunch ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TimeInput label="Début" name="lunchStart" value={times.lunchStart} onChange={handleChange} onNowClick={setNow} icon={<i className="las la-utensils text-base"></i>} disabled={!times.hasLunch} />
                <TimeInput label="Fin" name="lunchEnd" value={times.lunchEnd} onChange={handleChange} onNowClick={setNow} icon={<i className="las la-coffee text-base"></i>} disabled={!times.hasLunch} />
              </div>
            </div>

            <div className="pt-2">
              <TimeInput label="Objectif Journalier" name="quota" value={times.quota} onChange={handleChange} icon={<i className="las la-bullseye text-base"></i>} fullWidth />
            </div>
          </div>

          {/* Colonne de Droite : Bilan & Action */}
          <div className="flex flex-col h-full">
            <div className="flex-1 p-8 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-inner transition-colors flex flex-col justify-center">
              <div className="mb-8">
                <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 transition-colors">
                  <span>Progression du jour</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-950 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-1000 ease-out ${isOverQuota ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center justify-center space-y-2">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors">Temps Travaillé</span>
                <span className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter transition-colors">
                  {results.workedMins > 0 ? minutesToTime(results.workedMins) : '00:00'}
                </span>
                
                {results.workedMins > 0 && times.quota && (
                  <div className={`mt-3 px-4 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${results.overtimeMins >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                    {results.overtimeMins === 0 ? (
                      <span>Pile à l'heure ! <i className="las la-check-circle ml-1"></i></span>
                    ) : (
                      <>
                        <i className={results.overtimeMins > 0 ? 'las la-arrow-up' : 'las la-arrow-down'}></i>
                        {formatDuration(Math.abs(results.overtimeMins))} {results.overtimeMins > 0 ? 'supplémentaires' : 'manquantes'} 
                      </>
                    )}
                  </div>
                )}

                <div className="mt-8 pt-6 w-full border-t border-slate-200 dark:border-slate-700/50 flex flex-col items-center transition-colors">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 transition-colors">Nouveau Compteur Global</span>
                  <div className={`px-6 py-3 rounded-xl text-2xl font-bold flex items-center gap-2 ${results.newTotalCounterMins >= 0 ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'} transition-colors`}>
                    {results.newTotalCounterMins >= 0 ? '+' : '-'} {formatDuration(Math.abs(results.newTotalCounterMins))}
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={endDay}
              className="mt-6 w-full py-4 rounded-xl text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <i className="las la-save text-xl"></i> Sauvegarder et terminer la journée
            </button>
          </div>
        </div>
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Historique</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 pr-2">
              {history.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 py-8">Aucun historique pour le moment.</p>
              ) : (
                history.map(item => (
                  <div key={item.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white capitalize">{item.date}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Travaillé: {minutesToTime(item.workedMins)} (Obj: {item.quota})
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`font-bold ${item.overtimeMins >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                        {item.overtimeMins > 0 ? '+' : ''}{formatDuration(item.overtimeMins)}
                      </div>
                      <button onClick={() => deleteHistoryItem(item.id)} className="text-rose-400 hover:text-rose-600 p-2 text-xl" title="Supprimer">
                        <i className="las la-trash-alt"></i>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeInput({ label, name, value, onChange, icon, fullWidth = false, disabled = false, onNowClick }) {
  return (
    <div className={`flex flex-col ${fullWidth ? 'w-full' : ''} ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={name} className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 transition-colors">
          <span>{icon}</span> {label}
        </label>
        {onNowClick && !disabled && (
          <button 
            type="button" 
            onClick={() => onNowClick(name)}
            className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-600 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 px-2 py-0.5 rounded-md transition-colors"
          >
            Maintenant
          </button>
        )}
      </div>
      <input
        type="time"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors duration-200 time-input-modern ${disabled ? 'cursor-not-allowed bg-slate-50 dark:bg-slate-900' : ''}`}
      />
    </div>
  );
}

export default App;
