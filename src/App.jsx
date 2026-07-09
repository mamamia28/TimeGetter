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

function App() {
  const [times, setTimes] = useState(() => {
    const saved = localStorage.getItem('timeGetterData');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      arrival: '',
      lunchStart: '',
      lunchEnd: '',
      departure: '',
      quota: '07:30',
    };
  });

  useEffect(() => {
    localStorage.setItem('timeGetterData', JSON.stringify(times));
  }, [times]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTimes(prev => ({ ...prev, [name]: value }));
  };

  const clearData = () => {
    if (confirm('Voulez-vous vraiment effacer toutes les données ?')) {
      setTimes({
        arrival: '',
        lunchStart: '',
        lunchEnd: '',
        departure: '',
        quota: times.quota, // Keep quota
      });
    }
  };

  const results = useMemo(() => {
    const arrivalMins = timeToMinutes(times.arrival);
    const lunchStartMins = timeToMinutes(times.lunchStart);
    const lunchEndMins = timeToMinutes(times.lunchEnd);
    const departureMins = timeToMinutes(times.departure);
    const quotaMins = timeToMinutes(times.quota);

    let workedMins = 0;

    if (times.arrival && times.departure) {
      workedMins = departureMins - arrivalMins;
      
      // Subtract lunch break if both are provided and valid
      if (times.lunchStart && times.lunchEnd && lunchEndMins >= lunchStartMins) {
        workedMins -= (lunchEndMins - lunchStartMins);
      }
    }

    const overtimeMins = workedMins > 0 ? workedMins - quotaMins : 0;
    
    return {
      workedMins,
      overtimeMins,
    };
  }, [times]);

  const isOvertimePositive = results.overtimeMins >= 0;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-slate-900/60 p-8 rounded-3xl border border-slate-700/50 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight">
            TimeGetter
          </h1>
          <p className="text-slate-400 text-sm mt-2">Gérez votre temps de travail</p>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <TimeInput label="Arrivée" name="arrival" value={times.arrival} onChange={handleChange} icon="👋" />
            <TimeInput label="Départ" name="departure" value={times.departure} onChange={handleChange} icon="🏃" />
          </div>

          <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/50 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pause Déjeuner</h3>
            <div className="grid grid-cols-2 gap-4">
              <TimeInput label="Début" name="lunchStart" value={times.lunchStart} onChange={handleChange} icon="🥪" />
              <TimeInput label="Fin" name="lunchEnd" value={times.lunchEnd} onChange={handleChange} icon="☕" />
            </div>
          </div>

          <div className="pt-2">
            <TimeInput label="Objectif Journalier" name="quota" value={times.quota} onChange={handleChange} icon="🎯" fullWidth />
          </div>
        </div>

        <div className="mt-10 p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-inner">
          <div className="flex flex-col items-center justify-center space-y-2">
            <span className="text-sm font-medium text-slate-400">Temps Travaillé</span>
            <span className="text-5xl font-black text-white tracking-tighter">
              {results.workedMins > 0 ? minutesToTime(results.workedMins) : '00:00'}
            </span>
            
            {results.workedMins > 0 && times.quota && (
              <div className={`mt-2 px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2 ${isOvertimePositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {isOvertimePositive ? '↑' : '↓'}
                {Math.abs(results.overtimeMins)} min {isOvertimePositive ? 'supplémentaires' : 'manquantes'} 
                ({minutesToTime(results.overtimeMins)})
              </div>
            )}
          </div>
        </div>

        <button 
          onClick={clearData}
          className="mt-8 w-full py-3 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-200"
        >
          Réinitialiser la journée
        </button>
      </div>
    </div>
  );
}

function TimeInput({ label, name, value, onChange, icon, fullWidth = false }) {
  return (
    <div className={`flex flex-col ${fullWidth ? 'w-full' : ''}`}>
      <label htmlFor={name} className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
        <span>{icon}</span> {label}
      </label>
      <input
        type="time"
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full bg-slate-950/50 border border-slate-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 time-input-modern"
      />
    </div>
  );
}

export default App;
