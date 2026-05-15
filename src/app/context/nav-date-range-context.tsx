import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { NavDateFilter } from '../lib/nav-date-range';
import { clampFilterToToday, parseStoredNavFilter } from '../lib/nav-date-range';

const STORAGE_KEY = 'saralash_nav_date_range_v1';

function readStored(): NavDateFilter {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: 'all' };
    return clampFilterToToday(parseStoredNavFilter(JSON.parse(raw)));
  } catch {
    return { mode: 'all' };
  }
}

function writeStored(f: NavDateFilter) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {
    /* ignore */
  }
}

interface NavDateRangeContextValue {
  filter: NavDateFilter;
  setFilter: (f: NavDateFilter) => void;
}

const NavDateRangeContext = createContext<NavDateRangeContextValue | null>(null);

export function NavDateRangeProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilterState] = useState<NavDateFilter>(() =>
    typeof sessionStorage !== 'undefined' ? readStored() : { mode: 'all' },
  );

  useEffect(() => {
    setFilterState(readStored());
  }, []);

  const setFilter = useCallback((f: NavDateFilter) => {
    const next = clampFilterToToday(f);
    setFilterState(next);
    writeStored(next);
  }, []);

  const value = useMemo(() => ({ filter, setFilter }), [filter, setFilter]);

  return (
    <NavDateRangeContext.Provider value={value}>{children}</NavDateRangeContext.Provider>
  );
}

export function useNavDateFilter() {
  const ctx = useContext(NavDateRangeContext);
  if (!ctx) throw new Error('useNavDateFilter must be used within NavDateRangeProvider');
  return ctx;
}
