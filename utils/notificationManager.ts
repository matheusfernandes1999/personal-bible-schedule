import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for saved reminders
const REMINDERS_STORAGE_KEY = 'study_reminders_settings';

export class NotificationManager {

    // --- Core Scheduling ---

    /**
     * Sends a notification immediately.
     * @param title - The title of the notification.
     * @param body - The main text content of the notification.
     * @param data - Optional data payload to attach to the notification.
     */
    static async sendImmediateNotification(title: string, body: string, data: Record<string, any> = {}) {
        const serializableData = this.ensureSerializable(data);
        try {
            return await Notifications.scheduleNotificationAsync({
                content: { title, body, data: serializableData, sound: true },
                trigger: null, // null trigger means immediate
            });
        } catch (error) {
            console.error("Error sending immediate notification:", error);
            throw error;
        }
    }

    /**
     * Schedules a single, non-repeating notification for a specific future date and time.
     * @param title - The title of the notification.
     * @param body - The main text content of the notification.
     * @param triggerDate - The Date object representing when the notification should trigger.
     * @param data - Optional data payload.
     */
    static async scheduleNotification(title: string, body: string, triggerDate: Date, data: Record<string, any> = {}) {
        const serializableData = this.ensureSerializable(data);
        try {
            return await Notifications.scheduleNotificationAsync({
                content: { title, body, data: serializableData, sound: true },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                },
            });
        } catch (error) {
            console.error("Error scheduling notification:", error);
            throw error;
        }
    }    

    /**
     * Schedules a notification that repeats weekly on a specific day of the week at a specific time.
     * This is the primary method used for setting reminders for specific days.
     *
     * @param title - The title of the notification.
     * @param body - The main text content of the notification.
     * @param weekday - The day of the week (1-7, where 1=Monday, 7=Sunday).
     * @param hour - The hour of the day (0-23) for the trigger.
     * @param minute - The minute of the hour (0-59) for the trigger.
     * @param data - Optional data payload (e.g., { type: 'study_reminder', dayOfWeek: 1 }).
     */
    static async scheduleWeeklyNotification(
        title: string,
        body: string,
        weekday: number,
        hour: number,
        minute: number,
        data: Record<string, any> = {}
    ) {
        if (weekday < 1 || weekday > 7 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            console.error(`Invalid trigger parameters: weekday=${weekday}, hour=${hour}, minute=${minute}`);
            throw new Error("Invalid parameters for weekly notification trigger.");
        }
        
        const serializableData = this.ensureSerializable({
            ...data,
            notificationId: `study_reminder_day_${weekday}`, // Add unique ID for this specific day
            scheduledTime: `${hour}:${minute}`,
        });
        
        console.log(`Scheduling weekly: Weekday=${weekday}, Time=${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);

        try {
            // Map weekday from our format (1=Monday) to Expo format (1=Sunday)
            // Expo uses: 1=Sunday, 2=Monday, ..., 7=Saturday
            // Our app uses: 1=Monday, 2=Tuesday, ..., 7=Sunday
            const expoWeekday = weekday === 7 ? 1 : weekday + 1;
            
            return await Notifications.scheduleNotificationAsync({
                content: {
                    title,
                    body,
                    data: serializableData,
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                    weekday: expoWeekday,
                    hour: hour,
                    minute: minute,
                },
            });
            
        } catch (error) {
            console.error(`Error scheduling weekly notification for weekday ${weekday}:`, error);
            throw error;
        }
    }

    /**
     * Bulk schedules notifications for multiple days with different times.
     * @param notificationConfig - Array of day configurations with specific times.
     * @returns Object with success counts and any errors.
     */
    static async bulkScheduleWeeklyNotifications(
        notificationConfig: Array<{
            dayId: number, 
            time: string, 
            enabled: boolean,
            title?: string,
            body?: string
        }>
    ) {
        const results = {
            scheduled: 0,
            errors: 0,
            details: [] as string[],
        };

        // Cancel existing notifications first
        await this.cancelNotificationsByType('study_reminder');

        // Schedule new notifications for each enabled day
        for (const config of notificationConfig) {
            if (!config.enabled) continue;

            try {
                const timeObj = this.parseTimeString(config.time);
                if (!timeObj) {
                    results.errors++;
                    results.details.push(`Invalid time format for day ${config.dayId}: ${config.time}`);
                    continue;
                }

                const { hour, minute } = timeObj;
                const title = config.title || 'Study Reminder';
                const body = config.body || `Time to study! (Day ${config.dayId})`;

                await this.scheduleWeeklyNotification(
                    title,
                    body,
                    config.dayId,
                    hour,
                    minute,
                    { 
                        type: 'study_reminder', 
                        dayOfWeek: config.dayId,
                        customMessage: body 
                    }
                );
                results.scheduled++;
                results.details.push(`Successfully scheduled for day ${config.dayId} at ${config.time}`);
            } catch (error) {
                results.errors++;
                results.details.push(`Error scheduling day ${config.dayId}: ${error}`);
            }
        }

        return results;
    }

    // --- Cancellation & Management ---

    /**
     * Cancels all scheduled notifications for this application. Use with caution.
     */
    static async cancelAllNotifications() {
        console.log("Cancelling ALL scheduled notifications.");
        try {
            await Notifications.cancelAllScheduledNotificationsAsync();
            return true;
        } catch (error) {
            console.error("Error cancelling all notifications:", error);
            throw error;
        }
    }

    /**
     * Cancels specific scheduled notifications based on their data payload.
     * Example: await NotificationManager.cancelNotificationsByType('study_reminder');
     *
     * @param notificationType - The value associated with the 'type' key in the notification's data payload.
     * @returns Number of cancelled notifications.
     */
    static async cancelNotificationsByType(notificationType: string) {
        console.log(`Attempting to cancel notifications of type: ${notificationType}`);
        let cancelledCount = 0;
        
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            for (const notification of scheduled) {
                // Check if data exists and has the specified type
                if (notification.content.data && notification.content.data.type === notificationType) {
                    try {
                        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                        cancelledCount++;
                    } catch (cancelError) {
                        console.error(`Failed to cancel notification ${notification.identifier}:`, cancelError);
                        // Continue trying to cancel others
                    }
                }
            }
        } catch (error) {
            console.error(`Error retrieving or cancelling notifications by type "${notificationType}":`, error);
        }
        
        console.log(`Cancelled ${cancelledCount} notifications of type: ${notificationType}.`);
        return cancelledCount;
    }

    /**
     * Cancels a notification for a specific day of the week.
     * @param dayId - The day ID (1-7 where 1=Monday)
     * @returns Boolean indicating if notification was found and cancelled.
     */
    static async cancelDayNotification(dayId: number) {
        try {
            const scheduled = await Notifications.getAllScheduledNotificationsAsync();
            for (const notification of scheduled) {
                const data = notification.content.data;
                if (data?.type === 'study_reminder' && data?.dayOfWeek === dayId) {
                    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
                    console.log(`Cancelled notification for day ${dayId}`);
                    return true;
                }
            }
            console.log(`No notification found for day ${dayId}`);
            return false;
        } catch (error) {
            console.error(`Error cancelling notification for day ${dayId}:`, error);
            return false;
        }
    }

    /**
     * Retrieves a list of all currently scheduled notifications for the app.
     */
    static async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
        try {
            return await Notifications.getAllScheduledNotificationsAsync();
        } catch (error) {
            console.error("Error getting all scheduled notifications:", error);
            return []; // Return empty array on error
        }
    }
    

    /**
     * Gets all scheduled study reminders.
     * @returns Array of study reminder notifications.
     */
    static async getStudyReminders() {
        try {
            const all = await this.getAllScheduledNotifications();
            return all.filter(notification => 
                notification.content.data?.type === 'study_reminder'
            );
        } catch (error) {
            console.error("Error getting study reminders:", error);
            return [];
        }
    }

    // --- Storage Methods for Reminder Settings ---

    /**
     * Saves reminder settings to device storage.
     * @param reminderSettings - The reminder settings object to save.
     */
    static async saveReminderSettings(reminderSettings: any) {
        try {
            const jsonValue = JSON.stringify(reminderSettings);
            await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, jsonValue);
            return true;
        } catch (error) {
            console.error('Error saving reminder settings:', error);
            return false;
        }
    }

    /**
     * Loads reminder settings from device storage.
     * @returns The saved reminder settings object or null if not found.
     */
    static async loadReminderSettings() {
        try {
            const jsonValue = await AsyncStorage.getItem(REMINDERS_STORAGE_KEY);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (error) {
            console.error('Error loading reminder settings:', error);
            return null;
        }
    }

    // --- Utilities ---

    /**
     * Parses a time string in "HH:MM" format into hour and minute numbers.
     * Returns null if the format is invalid.
     * @param timeString - The time string to parse (e.g., "09:30").
     */
    static parseTimeString(timeString: string): { hour: number; minute: number } | null {
        if (!timeString || !/^\d{1,2}:\d{1,2}$/.test(timeString)) {
            console.warn(`Invalid time string format provided: "${timeString}". Expected HH:MM.`);
            return null;
        }
        
        const [hourStr, minuteStr] = timeString.split(':');
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);

        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            console.warn(`Invalid time values parsed from string: "${timeString}".`);
            return null;
        }
        
        return { hour, minute };
    }

    /**
     * Formats hours and minutes into "HH:MM" format.
     * @param hour - Hour (0-23)
     * @param minute - Minute (0-59)
     * @returns Formatted time string
     */
    static formatTimeString(hour: number, minute: number): string {
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    /**
     * Converts a notification trigger to a user-friendly time string.
     * @param trigger - The notification trigger object
     * @returns Formatted time string or null if trigger is invalid
     */
    static getTimeFromTrigger(trigger: any): string | null {
        if (!trigger || typeof trigger.hour !== 'number' || typeof trigger.minute !== 'number') {
            return null;
        }
        
        return this.formatTimeString(trigger.hour, trigger.minute);
    }

    /**
     * Helper to ensure the data object is serializable.
     * @param data - The data object to check/clean.
     */
    private static ensureSerializable(data: Record<string, any>): Record<string, any> {
        try {
            return JSON.parse(JSON.stringify(data || {}));
        } catch (e) {
            console.error("Failed to ensure data serializability, returning empty object:", e);
            return {};
        }
    }
}