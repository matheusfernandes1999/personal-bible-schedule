// utils/dateUtils.ts (or similar file)
import { Timestamp } from 'firebase/firestore';

/**
 * Formats a Date object into YYYY-MM-DD string in local time.
 */
export const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Checks if any Firestore Timestamp in the array falls on the current local date.
 */
export const didReadToday = (timestamps: Timestamp[] | undefined | null): boolean => {
    if (!timestamps || timestamps.length === 0) {
        return false;
    }
    const todayStr = formatDateLocal(new Date());
    return timestamps.some(ts => formatDateLocal(ts.toDate()) === todayStr);
};