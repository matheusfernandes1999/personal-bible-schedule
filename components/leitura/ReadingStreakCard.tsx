// components/leitura/ReadingStreakCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';

interface ReadingStreakCardProps {
    /** Array of Timestamps representing days when reading was completed. Assumed to be reasonably sorted or filterable. */
    readCompletionTimestamps: Timestamp[] | undefined | null;
}

/**
 * Calculates the number of consecutive days ending today (or yesterday)
 * that the user has marked reading as completed.
 */
const calculateStreak = (timestamps: Timestamp[] | undefined | null): number => {
    if (!timestamps || timestamps.length === 0) {
        return 0;
    }

    // 1. Convert Timestamps to unique YYYY-MM-DD date strings in user's local timezone
    const uniqueReadDates = [
        ...new Set(
            timestamps.map((ts) => {
                // Convert Firestore Timestamp to JS Date
                const date = ts.toDate();
                // Format to YYYY-MM-DD in local time. Be mindful of timezones.
                // A more robust solution might use a date library if timezone issues arise.
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}-${month}-${day}`;
            })
        ),
    ].sort((a, b) => b.localeCompare(a)); // Sort dates descending (most recent first)

    if (uniqueReadDates.length === 0) {
        return 0;
    }

    // 2. Calculate streak starting from today or yesterday
    let streak = 0;
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    let currentDate = new Date();
    let currentDateStr = formatDate(currentDate);

    // Check if the most recent read date is today or yesterday
    if (uniqueReadDates[0] !== todayStr && uniqueReadDates[0] !== yesterdayStr) {
        return 0; // Streak is broken if the latest reading wasn't today or yesterday
    }

    // 3. Iterate backwards day by day
    for (let i = 0; i < uniqueReadDates.length; i++) {
        currentDateStr = formatDate(currentDate);

        if (uniqueReadDates.includes(currentDateStr)) {
            streak++;
            // Move to the previous day
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            // Found a gap, streak ends
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