// components/leitura/ScheduleStatusCard.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { ReadingSchedule } from '@/types'; // Assuming types are shared or imported
import { getTotalChapters, chronologicalChapterOrder } from '@/utils/bibleUtils'; // Need these

interface ScheduleStatusCardProps {
    schedule: ReadingSchedule | null;
    isLoading?: boolean; // Optional loading state from parent
}

// Helper function to calculate the difference in days between two dates
// Ensures we count full days passed.
const calculateElapsedDays = (startDate: Date): number => {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()); // Start of the start day
    const today = new Date();
    const current = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // Start of today

    if (current < start) return 0; // Start date is in the future?

    // Calculate difference in milliseconds and convert to days
    const diffTime = current.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return diffDays + 1; // Add 1 because the start day itself counts as day 1 of the plan
};

export const ScheduleStatusCard: React.FC<ScheduleStatusCardProps> = ({
    schedule,
    isLoading = false,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    // --- Early exit conditions ---
    if (isLoading) {
        return (
            <View style={[styles.cardContainer, styles.centered]}>
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (!schedule || !schedule.startDate) {
        // Or show a specific message if needed
        return null;
    }

     if (schedule.status === 'completed') {
        return (
            <View style={styles.cardContainer}>
                 <Ionicons name="checkmark-done-circle-outline" size={24} color={colors.success} style={styles.icon} />
                <Text style={[styles.statusText, { color: colors.success }]}>Plano concluído!</Text>
            </View>
        );
    }

    if (schedule.status === 'paused') {
         return (
             <View style={styles.cardContainer}>
                 <Ionicons name="pause-circle-outline" size={24} color={colors.warning} style={styles.icon} />
                 <Text style={[styles.statusText, { color: colors.warning }]}>Plano pausado</Text>
                 <Text style={styles.detailText}> (Cálculo de progresso suspenso)</Text>
             </View>
         );
    }

    // --- Calculations ---
    let daysDifference = 0;
    let status: 'ahead' | 'behind' | 'on_track' | 'error' | 'starting' = 'on_track';
    let statusText = 'Calculando...';
    let detailText = '';
    let iconName: keyof typeof Ionicons.glyphMap = 'sync-circle-outline';
    let iconColor = colors.textSecondary;
    const startDate = schedule.startDate.toDate();
    const elapsedDays = calculateElapsedDays(startDate);

    try {
        if (elapsedDays <= 0) {
            status = 'starting';
        } else {
            const actualChaptersRead = schedule.chaptersReadCount || 0;
            let targetChaptersToday = 0;
            let chaptersPerDayRate = 0;
            const totalChapters = schedule.totalChaptersInBible || getTotalChapters();

            // Calculate target chapters based on plan type
            const config = schedule.styleConfig; // Use config variable for easier access

            if (schedule.styleType === 'chaptersPerDay' && 'chapters' in config) {
                chaptersPerDayRate = config.chapters;
                targetChaptersToday = Math.ceil(chaptersPerDayRate * elapsedDays);
            } else if (schedule.styleType === 'totalDuration' && 'durationMonths' in config) {
                const totalPlanDays = config.durationMonths * 30.4375;
                if (totalPlanDays > 0) {
                    chaptersPerDayRate = totalChapters / totalPlanDays;
                    targetChaptersToday = Math.ceil(chaptersPerDayRate * elapsedDays);
                }
            } else if (schedule.styleType === 'chronological' && 'durationYears' in config) {
                const totalPlanDays = config.durationYears * 365.25;
                const planLength = chronologicalChapterOrder.length > 0 ? chronologicalChapterOrder.length : totalChapters;
                if (totalPlanDays > 0) {
                    chaptersPerDayRate = planLength / totalPlanDays;
                    targetChaptersToday = Math.ceil(chaptersPerDayRate * elapsedDays);
                }
            } else if (schedule.styleType === 'custom' && 'chapters' in config) { // <--- ADICIONADO ESTE CASO
                chaptersPerDayRate = config.chapters;
                targetChaptersToday = Math.ceil(chaptersPerDayRate * elapsedDays); // Calcula a meta igual aos outros
            }


            // --- O restante da lógica (comparação, cálculo de daysDifference) permanece o mesmo ---
            if (chaptersPerDayRate > 0) {
                const chapterDifference = actualChaptersRead - targetChaptersToday;
                // Convert chapter difference to days difference
                // Use a small threshold to avoid classifying tiny rounding differences as ahead/behind
                const threshold = chaptersPerDayRate * 0.1; // Example: 10% of daily rate threshold

                if (chapterDifference > threshold) {
                     status = 'ahead';
                     daysDifference = Math.round(chapterDifference / chaptersPerDayRate);
                } else if (chapterDifference < -threshold) {
                    status = 'behind';
                    daysDifference = Math.round(chapterDifference / chaptersPerDayRate); // Will be negative
                } else {
                     status = 'on_track';
                     daysDifference = 0;
                }
                 detailText = `Lidos: ${actualChaptersRead} / Meta hoje: ${targetChaptersToday}`; // Update meta text

            } else {
                status = 'error'; // Cannot calculate rate
                detailText = 'Não foi possível calcular a meta diária.';
            }
        }

    } catch (error) {
        console.error("Error calculating schedule status:", error);
        status = 'error';
        detailText = 'Erro ao calcular progresso.';
    }

    // --- Set Text and Icon based on status ---
    switch (status) {
        case 'ahead':
            statusText = `${daysDifference} ${daysDifference === 1 ? 'dia adiantado' : 'dias adiantado'}`;
            iconName = 'rocket-outline';
            iconColor = colors.success;
            break;
        case 'behind':
            // daysDifference will be negative here
            statusText = `${Math.abs(daysDifference)} ${Math.abs(daysDifference) === 1 ? 'dia atrasado' : 'dias atrasado'}`;
            iconName = 'hourglass-outline';
            iconColor = colors.error;
            break;
        case 'on_track':
            statusText = 'Em dia com o plano';
            iconName = 'checkmark-circle-outline';
            iconColor = colors.primary; // Use primary color for on track
             // Keep detail text calculated above
            break;
        case 'starting':
             statusText = 'Plano iniciado';
             iconName = 'flag-outline';
             iconColor = colors.textSecondary;
             detailText = elapsedDays === 1 ? 'Primeiro dia!' : 'Começa em breve.';
             break;
        case 'error':
            statusText = 'Erro no Cálculo';
            iconName = 'warning-outline';
            iconColor = colors.error;
            // Detail text set in catch block
            break;
    }

    return (
        <View style={styles.cardContainer}>
             <Ionicons name={iconName} size={24} color={iconColor} style={styles.icon} />
             <View style={styles.textContainer}>
                <Text style={[styles.statusText, { color: iconColor }]}>{statusText}</Text>
                {!!detailText && <Text style={styles.detailText}>{detailText}</Text>}
             </View>
        </View>
    );
};

// --- Styles ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
    StyleSheet.create({
        cardContainer: {
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
            paddingVertical: 16, // Adjusted padding
            paddingHorizontal: 18,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: colors.shadow,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.07,
            shadowRadius: 5,
            elevation: 3,
            minHeight: 70, // Ensure consistent height
        },
        centered: {
            justifyContent: 'center', // Center ActivityIndicator
        },
        icon: {
            marginRight: 14, // Space between icon and text
        },
         textContainer: {
            flex: 1, // Take remaining space
            justifyContent: 'center',
        },
        statusText: {
            fontSize: 16,
            fontWeight: '600', // Semibold
            marginBottom: 3, // Space below main status
        },
        detailText: {
            fontSize: 13,
            color: colors.textSecondary,
            lineHeight: 16,
        },
    });