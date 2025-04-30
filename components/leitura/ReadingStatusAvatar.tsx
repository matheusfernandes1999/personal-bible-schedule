// components/leitura/ReadingStatusAvatar.tsx
import React from 'react';
import { View, Image, StyleSheet, ImageSourcePropType, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

export type ScheduleStatus =
    | 'ahead'
    | 'behind'
    | 'on_track'
    | 'completed'
    | 'paused'
    | 'starting'
    | 'error'
    | 'loading'
    | 'none';

interface ReadingStatusAvatarProps {
    scheduleStatus: ScheduleStatus;
    readToday: boolean;
    size?: number;
}

const avatarImages: { [key: string]: ImageSourcePropType } = {
    happy: require('@/assets/images/avatars/happy.png'),
    sad: require('@/assets/images/avatars/sad.png'),
    neutral: require('@/assets/images/avatars/neutral.png'),
    sleeping: require('@/assets/images/avatars/sleeping.png'),
    celebrating: require('@/assets/images/avatars/celebrating.png'),
    default: require('@/assets/images/avatars/default.png'),
};

// getAvatarSource function remains the same...
const getAvatarSource = (
    status: ScheduleStatus,
    readToday: boolean
): ImageSourcePropType => {
    switch (status) {
        case 'loading':
        case 'none':
        case 'error':
            return avatarImages.default;
        case 'completed':
            return avatarImages.celebrating;
        case 'paused':
            return avatarImages.sleeping;
        case 'starting':
            return avatarImages.neutral;
        case 'ahead':
            return avatarImages.happy;
        case 'on_track':
            return readToday ? avatarImages.happy : avatarImages.neutral;
        case 'behind':
            return readToday ? avatarImages.happy : avatarImages.sad;
        default:
            return avatarImages.default;
    }
};


export const ReadingStatusAvatar: React.FC<ReadingStatusAvatarProps> = ({
    scheduleStatus,
    readToday,
    size = 60, // Default size
}) => {
    const { colors } = useTheme();
    // Pass size to createStyles AND use it for positioning logic if needed
    const styles = createStyles(colors, size);

    // No need for a wrapping View here anymore if the component itself is positioned
    if (scheduleStatus === 'loading') {
        // Apply positioning styles directly to the loading container
        return (
            <View style={styles.avatarContainer}>
                <ActivityIndicator color={colors.primary} size="small" />
            </View>
        );
    }

    const avatarSource = getAvatarSource(scheduleStatus, readToday);

    // Apply positioning styles directly to the image container
    return (
        <View style={styles.avatarContainer}>
            <Image source={avatarSource} style={styles.avatarImage} />
        </View>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], size: number) =>
    StyleSheet.create({
        avatarContainer: {
            // --- Absolute Positioning ---
            position: 'absolute',
            bottom: -20, // Distance from the bottom edge (adjust as needed)
            left: 0, // Distance from the right edge (adjust as needed)
            zIndex: 10, // Ensure it's above the ScrollView content
            // --- Sizing & Appearance ---
            width: size,
            height: size,
            overflow: 'hidden',
        },
        avatarImage: {
            width: '100%',
            height: '100%',
            resizeMode: 'cover',
        },
    });