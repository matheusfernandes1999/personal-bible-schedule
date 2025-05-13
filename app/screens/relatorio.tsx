// screens/FieldServiceScreen.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    TextInput,
    Switch,
    Share,
    Keyboard, // Import Keyboard
    Modal, // Keep Modal if needed for other things, or remove if only TimerConfirmationModal is used
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase'; // Your firebase config
import {
    doc,
    updateDoc,
    getDoc,
    setDoc,
    serverTimestamp,
    Timestamp, // Import Timestamp
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    increment, // Import increment
    addDoc,    // Import addDoc for detailed entries
    orderBy,   // Import orderBy for fetching entries if needed here (though likely in HourLogScreen)
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons'; // For icons
import { format, addMonths, subMonths, startOfMonth, getYear, getMonth, endOfMonth, startOfDay } from 'date-fns'; // Date-fns for date manipulation
import { ptBR } from 'date-fns/locale'; // Portuguese locale
import { AnnualProgressModal } from '@/components/fieldservice/AnnualProgressModal';
import { RoleSelectionModal } from '@/components/fieldservice/RolesSelectionModal';
import { TimerConfirmationModal } from '@/components/fieldservice/TimerConfirmationModal'; // Import the new modal
import { router } from 'expo-router';
import { showMessage } from 'react-native-flash-message';

// --- Constants for Role Display ---
const ROLE_DISPLAY_NAMES = {
    pioneer_regular: 'Pioneiro Regular',
    pioneer_auxiliary: 'Pioneiro Auxiliar',
    publisher: 'Publicador',
    unknown: 'Não Definido',
};

// --- Types ---
type FieldServiceRole = 'pioneer_regular' | 'pioneer_auxiliary' | 'publisher' | 'unknown';

interface StudySessionData {
    id: string;
    name: string;
    date: Timestamp;
    subject: string;
}

interface MonthlyReportData {
    year: number;
    month: number; // 1-12
    hours?: number; // Total hours (still useful for summaries)
    ldcHours?: number;
    abonoHours?: number;
    participated?: boolean;
    isAuxiliaryTarget15?: boolean;
    lastUpdated?: Timestamp | any;
}

// Type for detailed hour entries (not directly stored in this component's state, but useful for saving)
interface HourEntryData {
    id?: string; // Firestore document ID (optional before saving)
    amount: number; // Hours added in this entry
    addedAt: Timestamp; // When this specific entry was saved
    method: 'manual' | 'timer'; // How the time was added
}


// --- Helper Functions ---
const getReportDocId = (date: Date): string => {
    return format(date, 'yyyy-MM');
};

const formatMonthYear = (date: Date): string => {
    return format(date, 'MMMM yyyy', { locale: ptBR });
};

// --- Component ---
export default function FieldServiceScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user, loading: authLoading } = useAuth();

    // --- State ---
    // Role & Report State
    const [currentRole, setCurrentRole] = useState<FieldServiceRole>('unknown');
    const [isLoadingRole, setIsLoadingRole] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfMonth(new Date()));
    const [monthlyReport, setMonthlyReport] = useState<Partial<MonthlyReportData>>({});
    const [isLoadingReport, setIsLoadingReport] = useState(true);
    const [isSaving, setIsSaving] = useState(false); // Generic saving state (used for LDC/Abono/Participated, and Timer confirm)
    const [isSavingRole, setIsSavingRole] = useState(false);
    const [calculatedStudies, setCalculatedStudies] = useState(0);
    const [isLoadingStudies, setIsLoadingStudies] = useState(false);

    // Input State
    const [hoursToAdd, setHoursToAdd] = useState<string>(''); // Input for manually adding hours
    const [isAddingHours, setIsAddingHours] = useState(false); // Specific loading state for manual hour add button

    // Modal State
    const [isProgressModalVisible, setIsProgressModalVisible] = useState(false);
    const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
    const [isTimerConfirmVisible, setIsTimerConfirmVisible] = useState(false); // Timer confirm modal
    const [timeToAddFromTimer, setTimeToAddFromTimer] = useState<number | null>(null); // Data for timer confirm modal

    // Timer State
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0); // Store elapsed time in seconds
    const [startTime, setStartTime] = useState<number | null>(null); // Store start timestamp (Date.now())
    const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID


    // --- useEffects ---

    // Fetch/Calculate Studies
    useEffect(() => {
        if (!user?.uid || (currentRole !== 'pioneer_regular' && currentRole !== 'pioneer_auxiliary')) {
            setCalculatedStudies(0);
            return;
        }
        setIsLoadingStudies(true);
        const start = startOfMonth(selectedDate);
        // Correct end date logic for Firestore query using '<'
        const endTimestamp = Timestamp.fromDate(startOfMonth(addMonths(start, 1))); // Start of *next* month
        const startTimestamp = Timestamp.fromDate(startOfDay(start)); // Start of the current month

        const sessionsRef = collection(db, 'users', user.uid, 'studySessions');
        const q = query(sessionsRef,
            where('date', '>=', startTimestamp),
            where('date', '<', endTimestamp) // Use '<' with the start of the next month
        );

        const fetchStudies = async () => {
            try {
                const querySnapshot = await getDocs(q);
                const sessions: StudySessionData[] = [];
                querySnapshot.forEach(doc => {
                    sessions.push({ id: doc.id, ...doc.data() } as StudySessionData);
                });
                const distinctNames = new Set(sessions.map(s => s.name.trim().toLowerCase()));
                setCalculatedStudies(distinctNames.size);
            } catch (error) {
                console.error("Erro ao buscar/calcular estudos:", error);
                setCalculatedStudies(0);
            } finally {
                setIsLoadingStudies(false);
            }
        };
        fetchStudies();
    }, [user?.uid, selectedDate, currentRole]);

    // Fetch User Role (real-time)
    useEffect(() => {
        if (!user?.uid) {
            setCurrentRole('unknown');
            setIsLoadingRole(false);
            return;
        }
        setIsLoadingRole(true);
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setCurrentRole(data?.fieldServiceRole || 'publisher'); // Default to publisher if field missing
            } else {
                setCurrentRole('publisher'); // Default if user doc doesn't exist
            }
            setIsLoadingRole(false);
        }, (error) => {
            console.error("Erro ao buscar função:", error);
            showMessage({ message: "Erro", description: "Não foi possível determinar sua função.", type: "danger"});
            setCurrentRole('unknown');
            setIsLoadingRole(false);
        });
        return () => unsubscribe();
    }, [user?.uid]);

    // Fetch Monthly Report (real-time)
    useEffect(() => {
        if (!user?.uid || currentRole === 'unknown') {
            setMonthlyReport({});
            setIsLoadingReport(false);
            return () => {}; // No subscription to clean up
        }

        setIsLoadingReport(true);
        const docId = getReportDocId(selectedDate);
        const reportDocRef = doc(db, 'users', user.uid, 'fieldServiceReports', docId);

        const unsubscribe = onSnapshot(reportDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setMonthlyReport(docSnap.data() as MonthlyReportData);
            } else {
                // Set default state if document doesn't exist for the selected month/role
                const defaultReport: Partial<MonthlyReportData> = {
                    year: getYear(selectedDate),
                    month: getMonth(selectedDate) + 1,
                    hours: 0, // Start with 0 hours if doc doesn't exist
                };
                if (currentRole === 'pioneer_regular' || currentRole === 'pioneer_auxiliary') {
                    defaultReport.ldcHours = 0;
                    defaultReport.abonoHours = 0;
                    defaultReport.isAuxiliaryTarget15 = false;
                } else { // Publisher
                    defaultReport.participated = false;
                }
                setMonthlyReport(defaultReport);
            }
            setIsLoadingReport(false);
        }, (error) => {
            console.error("Erro ao ouvir relatório mensal:", error);
            showMessage({ message: "Erro", description: "Não foi possível carregar dados do relatório.", type: "danger"});
            // Set a minimal state to avoid errors, but indicate data is missing
            setMonthlyReport({ year: getYear(selectedDate), month: getMonth(selectedDate) + 1 });
            setIsLoadingReport(false);
        });

        return () => unsubscribe(); // Cleanup listener

    }, [user?.uid, selectedDate, currentRole]); // Re-run if user, date, or role changes


    // Cleanup timer interval on component unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // --- Handlers ---

    const handleSelectRole = async (newRole: FieldServiceRole) => {
        if (!user?.uid || newRole === 'unknown' || newRole === currentRole || isSavingRole) {
            setIsRoleModalVisible(false);
            return;
        }
        setIsSavingRole(true);
        setIsRoleModalVisible(false); // Close modal immediately
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await updateDoc(userDocRef, { fieldServiceRole: newRole });
            showMessage({ message: "Sucesso", description: "Sua designação foi atualizada.", type: "success"});
            // The onSnapshot listener for the role will update the state automatically
        } catch (error) {
            console.error("Erro ao atualizar designação:", error);
            showMessage({ message: "Erro", description: "Não foi possível atualizar. Tente novamente.", type: "danger"});
        } finally {
            setIsSavingRole(false);
        }
    };

    const handlePreviousMonth = () => setSelectedDate(current => subMonths(current, 1));
    const handleNextMonth = () => setSelectedDate(current => addMonths(current, 1));

    // Handler for non-hour inputs (LDC, Abono, AuxTarget) - Updates local state only
    const handleInputChange = (field: keyof MonthlyReportData, value: any) => {
        const editableFields: (keyof MonthlyReportData)[] = [
            'ldcHours',
            'abonoHours',
            'isAuxiliaryTarget15'
            // 'participated' is handled separately with auto-save for publisher
        ];
        if (!editableFields.includes(field)) return;

        const numericFields: (keyof MonthlyReportData)[] = ['ldcHours', 'abonoHours'];
        // Ensure numeric fields are numbers, default to 0 if invalid/empty
        const processedValue = numericFields.includes(field)
             ? ( (typeof value === 'string' && value.trim() === '') ? 0 : Number(value) || 0 )
             : value;

        setMonthlyReport(prev => ({
            ...prev,
            [field]: processedValue,
        }));
    };


    // Handler for Adding Hours (Manual or Timer) - Saves detailed entry + increments total
    const handleAddHours = async (entryMethod: 'manual' | 'timer' = 'manual', hoursFromTimer?: number) => {
        if (!user?.uid) return;

        const valueToAdd = hoursFromTimer ?? (parseFloat(hoursToAdd.replace(',', '.')) || 0);

        if (valueToAdd <= 0) {
            if (entryMethod === 'manual') {
                 showMessage({ message: "Valor Inválido", description: "Insira horas válidas para adicionar.", type: "warning" });
            }
            return;
        }

        // Set appropriate loading state
        if (entryMethod === 'manual') {
            Keyboard.dismiss();
            setIsAddingHours(true);
        } else {
            setIsSaving(true); // Use generic saving for timer confirmation
        }

        const docId = getReportDocId(selectedDate);
        const reportDocRef = doc(db, 'users', user.uid, 'fieldServiceReports', docId);
        const entriesCollectionRef = collection(reportDocRef, 'hourEntries'); // Subcollection ref

        try {
            // 1. Add the detailed hour entry document
            const newEntry: Omit<HourEntryData, 'id'> = {
                amount: valueToAdd,
                addedAt: serverTimestamp() as Timestamp, // Let server set the timestamp
                method: entryMethod,
            };
            await addDoc(entriesCollectionRef, newEntry);

            // 2. Update the main report document (increment total hours)
            // Use setDoc with merge: true to handle both creation and update atomically for increment.
            const reportDataUpdate: Partial<MonthlyReportData & { hours: any }> = {
                hours: increment(valueToAdd),
                lastUpdated: serverTimestamp(),
                year: getYear(selectedDate),
                month: getMonth(selectedDate) + 1,
            };

            // Check if the document exists to add defaults ONLY on creation
             const docSnap = await getDoc(reportDocRef);
             if (!docSnap.exists()) {
                 // Set defaults for fields other than hours if creating the document
                 reportDataUpdate.ldcHours = 0;
                 reportDataUpdate.abonoHours = 0;
                 if (currentRole === 'publisher') {
                     // This case shouldn't happen often with addHours, but handle it.
                     reportDataUpdate.participated = false;
                 } else if (currentRole === 'pioneer_auxiliary') {
                     reportDataUpdate.isAuxiliaryTarget15 = false;
                 }
             }

            await setDoc(reportDocRef, reportDataUpdate, { merge: true });
            // onSnapshot will update the local monthlyReport state automatically

            if (entryMethod === 'manual') {
                setHoursToAdd(''); // Clear manual input field
            }

            showMessage({ message: "Sucesso", description: `${valueToAdd.toFixed(1)} hora(s) registrada(s).`, type: "success" });

        } catch (error: any) {
            console.error("Erro ao registrar horas:", error);
            showMessage({ message: "Erro", description: "Falha ao registrar horas.", type: "danger" });
        } finally {
            // Reset appropriate loading state
            if (entryMethod === 'manual') {
                setIsAddingHours(false);
            } else {
                setIsSaving(false);
            }
        }
    };


    // Handler to Save Other Changes (LDC, Abono, Aux Target, Publisher Participated)
    const handleSaveChanges = async () => {
        // Prevent saving if already saving, adding hours, or no user/report
        if (!user?.uid || !monthlyReport || isSaving || isAddingHours || authLoading || isLoadingReport) return;

        setIsSaving(true);
        const docId = getReportDocId(selectedDate);
        const reportDocRef = doc(db, 'users', user.uid, 'fieldServiceReports', docId);

        // Prepare data based on role
        const dataToSave: Partial<MonthlyReportData> = {
            year: getYear(selectedDate),
            month: getMonth(selectedDate) + 1,
            lastUpdated: serverTimestamp() as Timestamp,
            // Include hours (even if 0) to ensure the field exists if created here
            hours: monthlyReport.hours ?? 0,
        };

        if (currentRole === 'publisher') {
            dataToSave.participated = monthlyReport.participated ?? false;
        } else { // Pioneers
            dataToSave.ldcHours = monthlyReport.ldcHours ?? 0;
            dataToSave.abonoHours = monthlyReport.abonoHours ?? 0;
            if (currentRole === 'pioneer_auxiliary') {
                dataToSave.isAuxiliaryTarget15 = monthlyReport.isAuxiliaryTarget15 ?? false;
            }
        }

        try {
            // Use setDoc with merge: true to create or update the document
            await setDoc(reportDocRef, dataToSave, { merge: true });
            // No need to update local state manually, onSnapshot handles it.
            showMessage({ message: "Sucesso", description: "Alterações salvas!", type: "success" });
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            showMessage({ message: "Erro", description: "Não foi possível salvar as alterações.", type: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    // Handler to share the report summary
     const handleShare = async () => {
       if (!monthlyReport || isLoadingReport) return; // Don't share if no data or loading

       const monthYearStr = formatMonthYear(selectedDate);
       let message = `Relatório - ${monthYearStr}\n`;

       if (currentRole === 'pioneer_regular' || currentRole === 'pioneer_auxiliary') {
           message += `Horas: ${monthlyReport.hours?.toFixed(1) ?? '0.0'}\n`; // Format hours
           message += `Estudos: ${isLoadingStudies ? 'Calculando...' : calculatedStudies}\n`;
           if ((monthlyReport.ldcHours ?? 0) > 0) message += `Horas LDC/Outras: ${monthlyReport.ldcHours}\n`;
           if ((monthlyReport.abonoHours ?? 0) > 0) message += `Horas Abono: ${monthlyReport.abonoHours}\n`;
       } else if (currentRole === 'publisher') {
           message += `Participei: ${monthlyReport.participated ? 'Sim' : 'Não'}\n`;
       } else {
           message += "Nenhuma designação definida para compartilhar."; // Handle unknown case
       }

       try {
           await Share.share({ message, title: `Relatório - ${monthYearStr}` });
       } catch (error: any) {
           console.error("Share error:", error);
           showMessage({ message: "Erro ao Compartilhar", description: error.message || "Não foi possível compartilhar.", type: "danger"});
       }
   };

    // Handler to navigate to the detailed hour log screen
    const navigateToHourLog = () => {
        if (!user?.uid) return;
        const docId = getReportDocId(selectedDate);
        router.push({
            pathname: '/screens/relatorio/HourLogScreen', // Make sure this path matches your file structure in `app`
            params: { userId: user.uid, monthDocId: docId, currentRole: currentRole }
        });
    };

    // --- Timer Handlers ---
    const formatElapsedTime = (seconds: number): string => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStartTimer = () => {
        if (isTimerRunning || isSaving || isAddingHours) return; // Prevent starting if already running or saving
        const now = Date.now();
        setStartTime(now);
        setIsTimerRunning(true);

        // Clear any residual interval just in case
        if (intervalRef.current) clearInterval(intervalRef.current);

        // Start new interval - calculates difference from initial start time
        // Correct approach: Increment based on interval, not Date.now() difference
        intervalRef.current = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
    };

    const handlePauseTimer = () => {
        if (!isTimerRunning || !intervalRef.current || isSaving || isAddingHours) return;
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setIsTimerRunning(false);
        // Keep elapsedTime
        setStartTime(null); // Reset start time marker
    };

    const handleStopAndSaveTimer = () => {
        // Stop the timer regardless of other states
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsTimerRunning(false);

        // Check if there's time to save AFTER stopping interval
        if (elapsedTime > 0) {
            const hoursToSave = elapsedTime / 3600; // Convert seconds to hours
            setTimeToAddFromTimer(hoursToSave);
            setIsTimerConfirmVisible(true); // Show confirmation modal
        } else {
            showMessage({ message: "Tempo Zerado", description: "Nenhum tempo registrado para salvar.", type: "info"});
            // Reset timer fully if stopped at 0
            setElapsedTime(0);
            setStartTime(null);
        }
        // Don't reset elapsedTime here if > 0, modal needs it. Reset happens on confirm/cancel.
    };

    // Called from TimerConfirmationModal on Confirm
    const handleConfirmTimerAdd = () => {
         if (timeToAddFromTimer !== null && timeToAddFromTimer > 0) {
             // Call the modified handleAddHours with 'timer' method
             handleAddHours('timer', timeToAddFromTimer);
         }
         setIsTimerConfirmVisible(false);
         // Reset timer fully after confirmation
         setTimeToAddFromTimer(null);
         setElapsedTime(0);
         setStartTime(null);
     };

    // Called from TimerConfirmationModal on Cancel/Close
     const handleCancelTimerAdd = () => {
         setIsTimerConfirmVisible(false);
         setTimeToAddFromTimer(null);
         // Do NOT reset elapsedTime here - user cancelled saving, might want to resume or stop later.
         // If user wants to discard, they can manually stop at 0 or start again.
     };


    // --- Render Functions ---

    const renderInputs = () => {
        // Show main loading indicator only if report AND role haven't loaded initially
        if ((isLoadingReport && !monthlyReport.year) || isLoadingRole) {
            return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
        }

        // If role is unknown after loading, show message
        if (currentRole === 'unknown') {
           return <View style={styles.centered}><Text style={styles.infoText}>Designação não definida. Selecione sua designação para continuar.</Text></View>;
        }


        switch (currentRole) {
            case 'pioneer_regular':
            case 'pioneer_auxiliary':
                return (
                    <View style={styles.formContent}>
                        {/* Display Total Hours and Add Hours Input/Button */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.timerLabel}>Horas no ministerio:</Text>
                            {/* Display Area */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 5, gap: 10 }}>
                                {/* Use small loader specifically for report loading updates */}
                                {isLoadingReport && monthlyReport.year ? (
                                    <ActivityIndicator size="small" color={colors.primary}/>
                                ) : (
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary }}>
                                        {monthlyReport.hours?.toFixed(1) ?? '0.0'} {/* Format hours */}
                                    </Text>
                                )}
                            </View>

                             {/* Link to Hour Log - Only show if hours > 0 */}
                             {(monthlyReport.hours ?? 0) > 0 && (
                                 <TouchableOpacity onPress={navigateToHourLog} style={{ alignSelf: 'center', marginBottom: 15 }}>
                                     <Text style={{ color: colors.primary, fontSize: 13, textDecorationLine: 'underline' }}>
                                         Ver detalhes dos registros
                                     </Text>
                                 </TouchableOpacity>
                             )}


                            {/* Manual Input Area */}
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                <TextInput
                                    style={[styles.textInput, { flex: 1, textAlign: 'center' }]}
                                    value={hoursToAdd}
                                    onChangeText={setHoursToAdd}
                                    keyboardType="decimal-pad"
                                    placeholder="Adicionar Horas (ex: 1.5)"
                                    placeholderTextColor={colors.textSecondary}
                                    editable={!isAddingHours && !isSaving} // Disable while saving
                                />
                                <TouchableOpacity
                                    style={[styles.button, styles.addButton]} // Use a dedicated style
                                    onPress={() => handleAddHours('manual')} // Explicitly set method
                                    disabled={isAddingHours || isSaving || !hoursToAdd.trim()} // Disable if saving or no input
                                >
                                    {isAddingHours ? (
                                        <ActivityIndicator color={colors.primary} size="small" />
                                    ) : (
                                        <Ionicons name="add" size={24} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Estudos Calculados */}
                         <View style={styles.calculationCard}>
                             <View style={styles.calculationHeader}>
                                 <Ionicons name="book-outline" size={18} color={colors.primary} />
                                 <Text style={styles.calculationTitle}>Estudos Bíblicos</Text>
                             </View>
                             {isLoadingStudies ? (
                                 <ActivityIndicator size="small" color={colors.primary} />
                             ) : (
                                 <Text style={styles.calculationValue}>{calculatedStudies}</Text>
                             )}
                             <Text style={styles.calculationHint}>Contados automaticamente das sessões registradas neste mês</Text>
                              <TouchableOpacity
                                 onPress={() => router.push('/screens/RegisterStudySessionScreen')} // Adjust path if needed
                                 style={styles.sessionButton}
                                 disabled={isSaving || isAddingHours} // Disable if saving
                             >
                                 <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                                 <Text style={styles.sessionButtonText}>Registrar Estudo</Text>
                             </TouchableOpacity>
                         </View>


                        {/* Switch Auxiliar Target */}
                        {currentRole === 'pioneer_auxiliary' && (
                            <View style={styles.switchContainer}>
                                <Text style={styles.switchLabel}>Meta de 15 horas este mês?</Text>
                                <Switch
                                    trackColor={{ false: colors.border + '50', true: colors.primary + '80' }}
                                    thumbColor={monthlyReport.isAuxiliaryTarget15 ? colors.primary : colors.backgroundSecondary}
                                    ios_backgroundColor={colors.border + '50'}
                                    value={monthlyReport.isAuxiliaryTarget15 ?? false}
                                    onValueChange={(value) => {
                                        handleInputChange('isAuxiliaryTarget15', value);
                                        // Immediately save this change for auxiliary target
                                        // Need a slight delay or check to ensure state is updated before saving
                                         setTimeout(() => handleSaveChanges(), 100);
                                    }}
                                    disabled={isSaving || isAddingHours} // Disable while saving
                                />
                            </View>
                        )}
                    </View>
                );

            case 'publisher':
                return (
                    <View style={styles.publisherContainer}>
                        <Text style={styles.publisherTitle}>Participação Mensal</Text>
                        <View style={styles.switchContainer}>
                            <Text style={styles.switchLabel}>Participei no ministério este mês</Text>
                            <Switch
                                trackColor={{ false: colors.border + '50', true: colors.primary + '80' }}
                                thumbColor={monthlyReport.participated ? colors.primary : colors.backgroundSecondary}
                                ios_backgroundColor={colors.border + '50'}
                                value={monthlyReport.participated ?? false}
                                onValueChange={(value) => {
                                    // Update state locally first for immediate UI feedback
                                    setMonthlyReport(prev => ({ ...prev, participated: value }));
                                    // Then trigger save
                                    handleSaveChanges(); // Auto-save publisher participation
                                }}
                                disabled={isSaving || isAddingHours} // Disable while saving
                            />
                        </View>
                        <Text style={styles.publisherHint}>
                            Marque se participou em qualquer modalidade do ministério durante o mês.
                        </Text>
                    </View>
                );

            default: // Should not happen if role is loaded and not 'unknown'
                return null;
        }
    };

    // Render Timer Section
    const renderTimer = () => {
        // Only show timer for pioneers
        if (currentRole !== 'pioneer_regular' && currentRole !== 'pioneer_auxiliary') {
            return null;
        }

        const isStopDisabled = elapsedTime === 0 || isTimerRunning || isSaving || isAddingHours;

       return (
            <View style={styles.timerContainer}>
                <Text style={styles.timerLabel}>Cronômetro de Campo</Text>
                <Text style={styles.timerDisplay}>{formatElapsedTime(elapsedTime)}</Text>
                <View style={styles.timerButtons}>
                    {!isTimerRunning ? (
                        <TouchableOpacity
                            style={[styles.timerButton, styles.timerStartButton, { opacity: (isSaving || isAddingHours) ? 0.5 : 1 }]}
                            onPress={handleStartTimer}
                            disabled={isSaving || isAddingHours} // Disable if other saves are happening
                        >
                            <Ionicons name="play" size={20} color={colors.white} />
                            <Text style={styles.timerButtonText}>{(elapsedTime > 0) ? 'Continuar' : 'Iniciar'}</Text>
                        </TouchableOpacity>
                    ) : (
                         <TouchableOpacity
                            style={[styles.timerButton, styles.timerPauseButton, { opacity: (isSaving || isAddingHours) ? 0.5 : 1 }]}
                            onPress={handlePauseTimer}
                            disabled={isSaving || isAddingHours}
                        >
                            <Ionicons name="pause" size={20} color={colors.white} />
                            <Text style={styles.timerButtonText}>Pausar</Text>
                        </TouchableOpacity>
                    )}
                     <TouchableOpacity
                        style={[styles.timerButton, styles.timerStopButton, { opacity: isStopDisabled ? 0.5 : 1 } ]}
                        onPress={handleStopAndSaveTimer}
                        disabled={isStopDisabled} // Disable if 0, running, or saving
                    >
                        <Ionicons name="stop" size={20} color={colors.white} />
                        <Text style={styles.timerButtonText}>Parar e Salvar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // --- Main Return JSX ---
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside inputs
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handlePreviousMonth} style={styles.navButton} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                    <Ionicons name="chevron-back" size={24} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{formatMonthYear(selectedDate)}</Text>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                    <Ionicons name="chevron-forward" size={24} color={colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Role Card */}
            <View style={styles.roleCard}>
                <View style={styles.roleContent}>
                    <Ionicons name="person-circle-outline" size={28} color={colors.primary} />
                    <View style={styles.roleTextContainer}>
                        <Text style={styles.roleLabel}>Designação</Text>
                        <Text style={styles.roleValue}>
                            {isLoadingRole ? 'Carregando...' : ROLE_DISPLAY_NAMES[currentRole]}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setIsRoleModalVisible(true)} style={styles.editButton} disabled={isLoadingRole || isSavingRole}>
                     {isSavingRole ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="create-outline" size={20} color={colors.primary} />}
                </TouchableOpacity>
            </View>

             {/* Timer Section */}
             {renderTimer()}

            {/* Main Form Card */}
            <View style={styles.formCard}>
                {renderInputs()}
            </View>

             {/* Action Links */}
             {/* Conditionally render Annual Progress for regular pioneers */}
             {currentRole === 'pioneer_regular' && (
                  <TouchableOpacity onPress={() => setIsProgressModalVisible(true)} style={styles.actionCard} disabled={isSaving || isAddingHours}>
                      <View style={styles.actionIcon}>
                          <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.actionTextContainer}>
                          <Text style={styles.actionTitle}>Progresso Anual</Text>
                          <Text style={styles.actionSubtitle}>Acompanhe suas metas do ano</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
             )}
             {/* Revisitas link */}
             <TouchableOpacity onPress={() => router.push('/screens/ReturnVisitsList')} style={styles.actionCard} disabled={isSaving || isAddingHours}>
                 <View style={styles.actionIcon}>
                      <Ionicons name="people-outline" size={20} color={colors.primary} />
                 </View>
                 <View style={styles.actionTextContainer}>
                     <Text style={styles.actionTitle}>Revisitas</Text>
                     <Text style={styles.actionSubtitle}>Gerenciar suas revisitas e estudos</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
             </TouchableOpacity>

             <TouchableOpacity onPress={handleShare} style={styles.actionCard} disabled={isLoadingReport || isSaving || isAddingHours}>
                 <View style={styles.actionIcon}>
                      <Ionicons name="share-outline" size={20} color={colors.primary} />
                 </View>
                 <View style={styles.actionTextContainer}>
                     <Text style={styles.actionTitle}>Compartilhar</Text>
                     <Text style={styles.actionSubtitle}>Enviar seu relatório de campo</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
             </TouchableOpacity>

            {/* Modals */}
            <AnnualProgressModal
                isVisible={isProgressModalVisible}
                onClose={() => setIsProgressModalVisible(false)}
                userId={user?.uid}
                monthlyReport={monthlyReport.hours?.toFixed(1)}
                currentMonth={formatMonthYear(selectedDate)}
            />

            <RoleSelectionModal
                 isVisible={isRoleModalVisible}
                 onClose={() => setIsRoleModalVisible(false)}
                 currentRole={currentRole}
                 onSelectRole={handleSelectRole}
            />

            <TimerConfirmationModal
                isVisible={isTimerConfirmVisible}
                onClose={handleCancelTimerAdd}
                onConfirm={handleConfirmTimerAdd}
                timeToAdd={timeToAddFromTimer}
                colors={colors} // Pass colors down
            />
        </ScrollView>
    );
}

// --- Styles ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    // --- General & Layout ---
     container: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
        paddingVertical: 18 // Removed, use contentContainer padding
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40, // Ensure space at the bottom
    },
     centered: { // Used for 'unknown role' message
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
         minHeight: 150, // Give it some minimum height
        backgroundColor: colors.backgroundSecondary, // Use secondary for contrast
         borderRadius: 12,
         marginTop: 20,
    },
     infoText: { // Used for 'unknown role' message
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
    },
    loadingContainer: { // Used for main loading state
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 200,
    },

    // --- Header ---
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingHorizontal: 0, // No extra horizontal padding here
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
        textTransform: 'capitalize',
        maxWidth: '70%',
        textAlign: 'center',
    },
    navButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: colors.backgroundSecondary,
    },

    // --- Cards (Role, Action, Form) ---
     cardBase: { // Base style for cards
         backgroundColor: colors.backgroundSecondary,
         borderRadius: 12,
         marginBottom: 16,
         padding: 16,
         elevation: 1,
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
     },
     roleCard: {
         // Extends cardBase
         backgroundColor: colors.backgroundSecondary,
         borderRadius: 12,
         marginBottom: 16,
         padding: 16,
         elevation: 1,
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
         // Specific to roleCard
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'space-between',
    },
    actionCard: { // Renamed from progressCard
         // Extends cardBase
         backgroundColor: colors.backgroundSecondary,
         borderRadius: 12,
         marginBottom: 16,
         padding: 16,
         elevation: 1,
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
        // Specific to actionCard
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
     formCard: {
         // Extends cardBase
         backgroundColor: colors.backgroundSecondary,
         borderRadius: 12,
         marginBottom: 16,
         padding: 16,
         elevation: 1,
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
    },
    timerContainer: { // Timer also uses card base visually
         // Extends cardBase
         backgroundColor: colors.backgroundSecondary,
         borderRadius: 12,
         marginBottom: 16,
         padding: 16,
         elevation: 1,
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
        // Specific to timerContainer
        alignItems: 'center',
    },

    // --- Role Card Content ---
    roleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexShrink: 1,
    },
    roleTextContainer: {
        gap: 2, // Reduced gap
    },
    roleLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    roleValue: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    editButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: colors.primary + '10', // Lighter background
    },

    // --- Action Card Content --- (Previously Progress Card)
     actionIcon: {
         padding: 10, // Slightly larger padding
         borderRadius: 12,
         backgroundColor: colors.primary + '15',
     },
     actionTextContainer: {
         flex: 1,
         gap: 2,
     },
     actionTitle: {
         fontSize: 15, // Slightly larger
         fontWeight: '600',
         color: colors.textPrimary,
     },
     actionSubtitle: {
         fontSize: 12,
         color: colors.textSecondary,
     },

     // --- Form Content ---
     formContent: {
        gap: 24, // Space between form sections
    },
     inputGroup: {
        gap: 8,
        alignItems: 'center'
    },
    inputLabel: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '500',
        marginLeft: 4, // Slight indent
    },
    textInput: {
        backgroundColor: colors.backgroundPrimary, // Contrast background
        color: colors.textPrimary,
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center', // Align items vertically in the row
        gap: 10,
    },
    flexInput: {
        flex: 1, // Allow LDC/Abono inputs to grow
    },
     addButton: { // Style for the '+' button next to manual hours input
         padding: 12,
         backgroundColor: colors.primary + '15',
         borderRadius: 8,
     },
      saveButtonSmall: { // Style for the save icon button next to LDC/Abono
         padding: 12,
         backgroundColor: colors.primary,
         borderRadius: 8,
     },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border + '50',
        marginTop: 8, // Add margin top for separation
    },
    switchLabel: {
        color: colors.textPrimary,
        fontSize: 14,
        flex: 1, // Allow label to take space
        marginRight: 10, // Space before switch
    },
    // --- Calculated Studies Card ---
    calculationCard: {
        backgroundColor: colors.primary + '10',
        borderRadius: 8,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.primary + '20',
        alignItems: 'center',
    },
    calculationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    calculationTitle: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 14,
    },
    calculationValue: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.primary,
        marginVertical: 4, // Reduced margin
    },
    calculationHint: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 8, // Space before button
    },
     sessionButton: { // Button inside calculation card
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'center',
         gap: 8,
         paddingVertical: 10,
         paddingHorizontal: 16,
         borderRadius: 8,
         backgroundColor: colors.primary + '15', // Slightly different bg
         // marginTop: 8, // Removed, gap handles spacing
     },
     sessionButtonText: {
         color: colors.primary,
         fontWeight: '500',
         fontSize: 13,
     },

    // --- Publisher Specific ---
    publisherContainer: {
        gap: 16,
        paddingVertical: 8,
    },
    publisherTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        textAlign: 'center',
    },
    publisherHint: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 18, // Adjusted line height
        marginTop: -8, // Pull hint closer to switch
    },

     // --- Timer Styles ---
     timerLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    timerDisplay: {
        fontSize: 40, // Larger display
        fontWeight: 'bold',
        color: colors.primary,
        marginBottom: 20, // More space below display
        fontVariant: ['tabular-nums'],
    },
    timerButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
    },
    timerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12, // Slightly more padding
        paddingHorizontal: 10, // Adjusted horizontal
        borderRadius: 8,
        flex: 1, // Make buttons share space equally
        minHeight: 44, // Ensure good touch target size
    },
    timerButtonText: {
        color: colors.white, // Assuming white text for colored buttons
        fontWeight: '600',
        marginLeft: 8,
        fontSize: 14,
    },
    timerStartButton: {
        backgroundColor: colors.success || '#28a745', // Provide fallback color
    },
    timerPauseButton: {
        backgroundColor: colors.warning || '#ffc107', // Provide fallback color
    },
    timerStopButton: {
        backgroundColor: colors.warning || '#dc3545', // Provide fallback color
    },

    // --- General Buttons & Actions ---
    actionsContainer: {
        marginTop: 8, // Add margin above actions
        gap: 12,
    },
     button: { // Base button style
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 8,
        minHeight: 48, // Good touch target size
    },
    shareButton: {
        // Extends button
        flex: 1, // Take full width if only button
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    shareButtonText: {
        color: colors.primary,
        fontWeight: '600',
        fontSize: 15,
    },
    // Add styles for saveButtonText if a large save button is needed elsewhere
    // saveButtonText: {
    //    color: colors.white,
    //    fontWeight: '600',
    // },

});