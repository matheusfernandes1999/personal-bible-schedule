import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NotificationManager } from '@/utils/notificationManager'; // Adjust path as needed
import { TimePickerModal } from '@/components/common/TimePickerModal'; // Adjust path as needed
import { checkNotificationPermissions } from '@/utils/notificationUtils'; // Adjust path as needed
import TopBar from '@/components/Components/TopBar';
import { useTheme } from "@/context/ThemeContext";
import { showMessage } from 'react-native-flash-message';

// Define the structure for a single day's reminder setting
interface DayReminderSetting {
  dayId: number; // 1=Monday, 2=Tuesday, ..., 7=Sunday (matches NotificationManager logic)
  dayName: string; // User-friendly name
  enabled: boolean;
  time: string; // Format "HH:MM"
}


const BibleReadingReminderScreen: React.FC = () => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const initialSettings: DayReminderSetting[] = [
    { dayId: 1, dayName: 'Segunda', enabled: false, time: '08:00' },
    { dayId: 2, dayName: 'Terça', enabled: false, time: '08:00' },
    { dayId: 3, dayName: 'Quarta', enabled: false, time: '08:00' },
    { dayId: 4, dayName: 'Quinta', enabled: false, time: '08:00' },
    { dayId: 5, dayName: 'Sexta', enabled: false, time: '08:00' },
    { dayId: 6, dayName: 'Sábado', enabled: false, time: '08:00' },
    { dayId: 7, dayName: 'Domingo', enabled: false, time: '08:00' },
  ];

  const [reminderSettings, setReminderSettings] = useState<DayReminderSetting[]>(initialSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTimePickerVisible, setIsTimePickerVisible] = useState(false);
  const [currentlyEditingDayId, setCurrentlyEditingDayId] = useState<number | null>(null);
  const [initialPickerTime, setInitialPickerTime] = useState<{ hour: number; minute: number }>({ hour: 8, minute: 0 });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // --- Permission Handling ---
  const checkAndRequestPermissions = useCallback(async () => {
      let status = await checkNotificationPermissions();
      if (status !== 'granted') {
          Alert.alert(
              "Permissão Necessária",
              "Precisamos da sua permissão para enviar notificações de lembrete. Por favor, habilite as notificações nas configurações do seu dispositivo.",
              [
                  { text: "Cancelar", style: "cancel", onPress: () => setHasPermission(false) },
                  { text: "Pedir Permissão", onPress: async () => {
                      status = await checkNotificationPermissions();
                      setHasPermission(status === 'granted');
                      if (status !== 'granted') {
                         showMessage({
                            message: "Permissão Necessária",
                            description: "Não será possível agendar lembretes sem a permissão de notificação.",
                            type: "warning",
                        });
                      }
                  }},
              ]
          );
      } else {
          setHasPermission(true);
      }
  }, []);


  // --- Load Settings ---
  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      await checkAndRequestPermissions(); // Check permissions first
      const savedSettings = await NotificationManager.loadReminderSettings();
      if (savedSettings && Array.isArray(savedSettings) && savedSettings.length === 7) {
        // Basic validation: ensure it's an array of 7 items
        setReminderSettings(savedSettings);
      } else {
        // Initialize with defaults if nothing is saved or format is wrong
        setReminderSettings(initialSettings);
         // Optionally save the defaults if nothing was loaded
        await NotificationManager.saveReminderSettings(initialSettings);
      }
      setIsLoading(false);
    };

    loadSettings();
  }, [checkAndRequestPermissions]); // Add checkAndRequestPermissions dependency

  // --- Update State ---
  const handleToggleSwitch = (dayId: number, value: boolean) => {
    setReminderSettings(prevSettings =>
      prevSettings.map(day =>
        day.dayId === dayId ? { ...day, enabled: value } : day
      )
    );
  };

  const handleTimePress = (dayId: number) => {
    if (!hasPermission) {
        showMessage({
            message: "Permissão Necessária",
            description: "Por favor, habilite as permissões de notificação para definir horários.",
            type: "warning",
        });
        return;
    }
    const daySetting = reminderSettings.find(d => d.dayId === dayId);
    if (daySetting) {
      const timeParts = NotificationManager.parseTimeString(daySetting.time);
      if (timeParts) {
        setInitialPickerTime(timeParts);
        setCurrentlyEditingDayId(dayId);
        setIsTimePickerVisible(true);
      } else {
        // Handle case where time format is somehow invalid (shouldn't happen with defaults)
        setInitialPickerTime({ hour: 8, minute: 0 }); // Fallback
        setCurrentlyEditingDayId(dayId);
        setIsTimePickerVisible(true);
      }
    }
  };

  const handleTimeConfirm = (hour: number, minute: number) => {
    if (currentlyEditingDayId !== null) {
      const formattedTime = NotificationManager.formatTimeString(hour, minute);
      setReminderSettings(prevSettings =>
        prevSettings.map(day =>
          day.dayId === currentlyEditingDayId ? { ...day, time: formattedTime } : day
        )
      );
    }
    setIsTimePickerVisible(false);
    setCurrentlyEditingDayId(null);
  };

  const handleTimePickerClose = () => {
    setIsTimePickerVisible(false);
    setCurrentlyEditingDayId(null);
  };

  // --- Save Settings & Schedule Notifications ---
  const handleSave = async () => {
     if (!hasPermission) {
        showMessage({
            message: "Permissão Necessária",
            description: "Não é possível salvar lembretes sem a permissão de notificação.",
            type: "warning",
        });
        checkAndRequestPermissions(); // Prompt again
        return;
     }
    if (isSaving) return; // Prevent double saving

    setIsSaving(true);

    try {
        // Prepare config for bulk scheduling
        const notificationConfig = reminderSettings.map(setting => ({
            dayId: setting.dayId,
            time: setting.time,
            enabled: setting.enabled,
            // Customize title and body here
            title: 'Lembrete de Leitura Bíblica 📖',
            body: `É hora da sua leitura diária! (${setting.dayName})`,
        }));

        console.log("Saving settings and scheduling notifications:", notificationConfig);

        // 1. Schedule/Cancel Notifications based on current settings
        const scheduleResult = await NotificationManager.bulkScheduleWeeklyNotifications(notificationConfig);
        console.log('Scheduling Result:', scheduleResult);

        // 2. Save the UI state to AsyncStorage
        const saveResult = await NotificationManager.saveReminderSettings(reminderSettings);

        if (saveResult && scheduleResult.errors === 0) {
            showMessage({
                message: "Sucesso",
                description: "Lembretes atualizados com sucesso!",
                type: "success",
            });
        } else {
             // Provide more specific feedback if possible
            let errorMessage = 'Ocorreu um erro ao salvar.';
            if (!saveResult) {
                errorMessage += ' Falha ao salvar configurações.';
            }
            if (scheduleResult.errors > 0) {
                errorMessage += ` Falha ao agendar ${scheduleResult.errors} notificações.`;
                console.error("Scheduling Errors:", scheduleResult.details);
            }
            showMessage({
                message: "Erro",
                description: errorMessage,
                type: "warning",
            });
        }

        // Optional: Log scheduled notifications for debugging
        const scheduled = await NotificationManager.getStudyReminders();
        console.log("Currently scheduled study reminders:", scheduled.map((n: { identifier: any; trigger: any; content: { data: any; }; }) => ({ id: n.identifier, trigger: n.trigger, data: n.content.data })));


    } catch (error: any) {
        console.error('Error saving settings:', error);
        showMessage({
            message: "Erro",
            description: "Não foi possível salvar os lembretes",
            type: "warning",
        });
    } finally {
        setIsSaving(false);
    }
  };


  // --- Render Logic ---
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>Carregando configurações...</Text>
      </View>
    );
  }

  return (
    <>
    <TopBar title='Lembretes de Leitura Bíblica' showBackButton/>
    <View style={styles.container}>
       <ScrollView style={styles.scrollView}>
           <Text style={styles.subtitle}>
               Defina horários para receber notificações diárias e te ajudar a manter o hábito da leitura.
           </Text>

          {hasPermission === false && (
             <View style={styles.permissionWarning}>
                 <Text style={styles.permissionText}>
                     As notificações estão desabilitadas. Habilite a permissão para usar os lembretes.
                 </Text>
                 <TouchableOpacity style={styles.permissionButton} onPress={checkAndRequestPermissions}>
                     <Text style={styles.permissionButtonText}>Verificar Permissão</Text>
                 </TouchableOpacity>
             </View>
          )}

           {reminderSettings.map(day => (
                <View key={day.dayId} style={styles.dayRow}>
                    <Text style={styles.dayName}>{day.dayName}</Text>
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={[
                                styles.timeButton,
                                !day.enabled && styles.timeButtonDisabled // Style disabled state
                            ]}
                            onPress={() => handleTimePress(day.dayId)}
                            disabled={!day.enabled || hasPermission !== true} // Disable if switch is off or no permission
                        >
                            <Text style={[
                                styles.timeText,
                                !day.enabled && styles.timeTextDisabled // Style disabled state
                            ]}>
                                {day.time}
                            </Text>
                        </TouchableOpacity>
                        <Switch
                            trackColor={{ false: colors.primary, true: colors.primary }}
                            thumbColor={day.enabled ? colors.white : colors.backgroundSecondary}
                            ios_backgroundColor={colors.primary}
                            onValueChange={(value) => handleToggleSwitch(day.dayId, value)}
                            value={day.enabled}
                            disabled={hasPermission !== true} // Disable switch if no permission
                        />
                    </View>
                </View>
           ))}
       </ScrollView>

       <TouchableOpacity
           style={[styles.saveButton, (isSaving || hasPermission !== true) && styles.saveButtonDisabled]}
           onPress={handleSave}
           disabled={isSaving || hasPermission !== true}
        >
            {isSaving ? (
                <ActivityIndicator size="small" color={colors.white} />
            ) : (
                <Text style={styles.saveButtonText}>Salvar Lembretes</Text>
            )}
       </TouchableOpacity>

       {currentlyEditingDayId !== null && (
           <TimePickerModal
               isVisible={isTimePickerVisible}
               onClose={handleTimePickerClose}
               onConfirm={handleTimeConfirm}
               initialHour={initialPickerTime.hour}
               initialMinute={initialPickerTime.minute}
               colors={colors} // Pass colors to the modal
           />
       )}
    </View>
    </>
  );
};

// --- Styles ---
const createStyles = (colors: ReturnType<typeof useTheme>["colors"]) => StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundPrimary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.textPrimary,
    textAlign: 'center',
  },
   subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  permissionWarning: {
      backgroundColor: '#FFF3CD', // Light yellow
      padding: 15,
      borderRadius: 8,
      marginBottom: 20,
      marginHorizontal: 5,
      borderWidth: 1,
      borderColor: '#FFEEBA', // Darker yellow border
  },
  permissionText: {
      color: '#856404', // Dark yellow/brown text
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 10,
  },
  permissionButton: {
      backgroundColor: colors.primary,
      paddingVertical: 8,
      paddingHorizontal: 15,
      borderRadius: 6,
      alignSelf: 'center',
  },
  permissionButtonText: {
      color: colors.white,
      fontWeight: 'bold',
      fontSize: 14,
  },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayName: {
    fontSize: 17,
    color: colors.textPrimary,
    flex: 1, // Allow day name to take available space
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeButton: {
    marginRight: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary, // Border color when enabled
  },
  timeButtonDisabled: {
    borderColor: colors.textMuted, // Border color when disabled
    // Optionally add a background color for disabled state
    // backgroundColor: colors.backgroundSecondary,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary, // Text color when enabled
  },
  timeTextDisabled: {
    color: colors.textMuted, // Text color when disabled
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    margin: 20,
    alignItems: 'center',
    justifyContent: 'center', // Center activity indicator
    minHeight: 50, // Ensure consistent height
  },
  saveButtonDisabled: {
    backgroundColor: colors.backgroundSecondary,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default BibleReadingReminderScreen;