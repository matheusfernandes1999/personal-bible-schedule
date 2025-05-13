// components/leitura/ReadingStreakCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';

interface ReadingStreakCardProps {
    /** Array of Timestamps representing days when reading was completed. */
    readCompletionTimestamps: Timestamp[] | undefined | null;
}

/** Helper function to format a Date object into YYYY-MM-DD string */
const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Calculates the number of consecutive days ending today (or yesterday)
 * that the user has marked reading as completed.
 */
const calculateStreak = (timestamps: Timestamp[] | undefined | null): number => {
    if (!timestamps || timestamps.length === 0) {
        return 0;
    }

    // 1. Convert Timestamps to unique YYYY-MM-DD date strings in user's local timezone
    // Use a Set for efficient lookup and uniqueness
    const uniqueReadDatesSet = new Set<string>();
    timestamps.forEach((ts) => {
        const date = ts.toDate(); // Convert Firestore Timestamp to JS Date
        uniqueReadDatesSet.add(formatDate(date));
    });

    if (uniqueReadDatesSet.size === 0) {
        return 0;
    }

    // 2. Determine the starting date for the streak check
    const today = new Date();
    const todayStr = formatDate(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = formatDate(yesterday);

    let currentDate: Date | null = null;

    if (uniqueReadDatesSet.has(todayStr)) {
        // If read today, start checking from today
        currentDate = today;
    } else if (uniqueReadDatesSet.has(yesterdayStr)) {
        // If didn't read today BUT read yesterday, start checking from yesterday
        currentDate = yesterday;
    } else {
        // If didn't read today OR yesterday, the streak is broken
        return 0;
    }

    // 3. Iterate backwards day by day from the starting date
    let streak = 0;
    while (currentDate) { // Loop while we have a valid date to check
        const currentDateStr = formatDate(currentDate);

        if (uniqueReadDatesSet.has(currentDateStr)) {
            // This day is part of the streak
            streak++;
            // Move to the previous day
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            // Found a gap, the consecutive streak ends here
            break;
        }
    }

    return streak;
};

export const ReadingStreakCard: React.FC<ReadingStreakCardProps> = ({
    readCompletionTimestamps,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // Calculate the streak using the updated logic
    const streak = calculateStreak(readCompletionTimestamps);
    const hasStreak = streak > 0;

    return (
        <View style={styles.cardContainer}>
            <View style={styles.iconContainer}>
                <Ionicons
                    name={hasStreak ? "flame" : "flame-outline"}
                    size={32}
                    color={hasStreak ? colors.warning : colors.textSecondary} // Use warning color for active streak
                />
            </View>
            <View style={styles.textContainer}>
                <Text style={styles.streakNumber}>{streak}</Text>
                <Text style={styles.streakLabel}>
                    {streak === 1 ? 'Dia Consecutivo' : 'Dias Consecutivos'}
                </Text>
                {!hasStreak && (
                     <Text style={styles.subText}>Leia hoje para iniciar sua sequência!</Text>
                 )}
                  {hasStreak && (
                       <Text style={styles.subText}>Continue assim!</Text>
                   )}
            </View>
        </View>
    );
};

// Styles remain the same
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        cardContainer: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            paddingVertical: 18,
            paddingHorizontal: 20, // Consistent padding
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 3 }, // Adjusted shadow
            shadowOpacity: 0.07,
            shadowRadius: 5,
            elevation: 3,
            // Add margin if needed, e.g., marginBottom: 8
        },
        iconContainer: {
            marginRight: 18, // Space between icon and text
            alignItems: 'center',
            justifyContent: 'center',
        },
        textContainer: {
            flex: 1, // Take remaining space
            justifyContent: 'center',
        },
        streakNumber: {
            fontSize: 28, // Larger number
            fontWeight: 'bold',
            color: colors.textPrimary,
            lineHeight: 34, // Adjust line height
        },
        streakLabel: {
            fontSize: 15, // Slightly smaller label
            fontWeight: '600', // Semibold
            color: colors.textPrimary,
            marginTop: 2, // Space between number and label
            lineHeight: 18,
        },
         subText: {
             fontSize: 13,
             color: colors.textSecondary,
             marginTop: 4, // Space above subtext
         },
    });
