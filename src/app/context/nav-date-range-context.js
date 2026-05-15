import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, } from 'react';
import { clampFilterToToday, parseStoredNavFilter } from '../lib/nav-date-range';
const STORAGE_KEY = 'saralash_nav_date_range_v1';
function readStored() {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { mode: 'all' };
        return clampFilterToToday(parseStoredNavFilter(JSON.parse(raw)));
    }
    catch {
        return { mode: 'all' };
    }
}
function writeStored(f) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    }
    catch {
        /* ignore */
    }
}
const NavDateRangeContext = createContext(null);
export function NavDateRangeProvider({ children }) {
    const [filter, setFilterState] = useState(() => typeof sessionStorage !== 'undefined' ? readStored() : { mode: 'all' });
    useEffect(() => {
        setFilterState(readStored());
    }, []);
    const setFilter = useCallback((f) => {
        const next = clampFilterToToday(f);
        setFilterState(next);
        writeStored(next);
    }, []);
    const value = useMemo(() => ({ filter, setFilter }), [filter, setFilter]);
    return (_jsx(NavDateRangeContext.Provider, { value: value, children: children }));
}
export function useNavDateFilter() {
    const ctx = useContext(NavDateRangeContext);
    if (!ctx)
        throw new Error('useNavDateFilter must be used within NavDateRangeProvider');
    return ctx;
}
