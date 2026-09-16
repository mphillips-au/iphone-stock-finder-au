import { useEffect, useState } from 'react';
import type { Location } from '../shared/types';
import { api } from '../client/api';
export default function LocationInput({ value, onChange, onValid, disabled }: { value: Location; onChange: (value: Location) => void; onValid: (valid: boolean) => void; disabled: boolean }) {
  const [text, setText] = useState(value.label), [options, setOptions] = useState<Location[]>([]), [message, setMessage] = useState(''), [active, setActive] = useState(-1);
  useEffect(() => { setText(value.label); }, [value]);
  useEffect(() => {
    if (text === value.label || text.trim().length < 2) { setOptions([]); return; }
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setMessage('Finding locations…');
      api<Location[]>(`/api/location?q=${encodeURIComponent(text.trim())}`, abort.signal).then(results => { setOptions(results); setActive(-1); setMessage(results.length ? '' : 'No matching locations. Try another suburb or postcode.'); }).catch(() => { if (!abort.signal.aborted) setMessage('Location search is unavailable. Try again or use your location.'); });
    }, 350);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [text, value.label]);
  function select(location: Location) { onChange(location); onValid(true); setText(location.label); setOptions([]); setMessage(''); }
  function locate() {
    if (!navigator.geolocation) { setMessage('Your browser does not support location. Search by suburb instead.'); return; }
    setMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(p => {
      const { latitude: lat, longitude: lon } = p.coords;
      if (lat < -44 || lat > -9 || lon < 112 || lon > 154) { setMessage('Please choose an Australian location.'); return; }
      select({ label: 'My current location', lat, lon });
    }, () => setMessage('Location access is unavailable. Search by suburb or postcode instead.'), { timeout: 10000, maximumAge: 60000 });
  }
  return <div className="location-field"><label htmlFor="location">Suburb or postcode</label><div className="location-row"><span aria-hidden="true" className="location-icon">⌖</span><input id="location" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={options.length > 0} aria-controls="locations" aria-activedescendant={active >= 0 ? `location-${active}` : undefined} value={text} disabled={disabled} onChange={e => { setText(e.target.value); onValid(e.target.value === value.label); }} onKeyDown={e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, options.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    if (e.key === 'Enter' && active >= 0 && options[active]) { e.preventDefault(); select(options[active]); }
    if (e.key === 'Escape') setOptions([]);
  }}/><button type="button" className="text-button locate" onClick={locate} disabled={disabled}>Use my location</button></div>
    {options.length > 0 && <ul id="locations" role="listbox" className="suggestions">{options.map((option, i) => <li key={`${option.label}:${option.lat}`} role="option" id={`location-${i}`} aria-selected={active === i}><button type="button" onClick={() => select(option)}>{option.label}</button></li>)}</ul>}
    {message && <small role="status">{message}</small>}
  </div>;
}
