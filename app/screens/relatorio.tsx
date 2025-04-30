// screens/FieldServiceScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase'; // Seu firebase config
import {
    doc,
    updateDoc,
    getDoc,
    setDoc,
    serverTimestamp,
    Timestamp, // Importe Timestamp
    onSnapshot,
    collection,
    query,
    where,
    getDocs,
    increment, // <--- Import increment
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons'; // Para ícones
import { format, addMonths, subMonths, startOfMonth, getYear, getMonth, endOfMonth, startOfDay } from 'date-fns'; // Date-fns para manipulação de datas
import { ptBR } from 'date-fns/locale'; // Locale Português
import { AnnualProgressModal } from '@/components/fieldservice/AnnualProgressModal'; // Modal a ser criado
import { RoleSelectionModal } from '@/components/fieldservice/RolesSelectionModal'; // <--- Modal a ser criado
import { router } from 'expo-router';
import { showMessage } from 'react-native-flash-message';

// --- Constants for Role Display ---
// Use the definition provided at the end of the style prompt
const ROLE_DISPLAY_NAMES = {
    pioneer_regular: 'Pioneiro Regular',
    pioneer_auxiliary: 'Pioneiro Auxiliar',
    publisher: 'Publicador',
    unknown: 'Não Definido',
};


// Tipos específicos para este relatório
type FieldServiceRole = 'pioneer_regular' | 'pioneer_auxiliary' | 'publisher' | 'unknown';
interface StudySessionData { // Tipo para sessões de estudo lidas
    id: string;
    name: string;
    date: Timestamp;
    subject: string;
}
interface MonthlyReportData {
    year: number;
    month: number; // 1-12
    hours?: number;
    // bibleStudies?: number; // Calculated, not stored directly in report
    ldcHours?: number;
    abonoHours?: number;
    participated?: boolean;
    isAuxiliaryTarget15?: boolean;
    lastUpdated?: Timestamp;
}

// Função auxiliar para obter o ID do documento yyyy-MM
const getReportDocId = (date: Date): string => {
    return format(date, 'yyyy-MM');
};

// Função auxiliar para obter o nome do mês e ano formatado
const formatMonthYear = (date: Date): string => {
    return format(date, 'MMMM yyyy', { locale: ptBR });
};

export default function FieldServiceScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors); // Use the passed styles function
    const { user, loading: authLoading } = useAuth();

    // Estados existentes
    const [currentRole, setCurrentRole] = useState<FieldServiceRole>('unknown');
    const [isLoadingRole, setIsLoadingRole] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfMonth(new Date()));
    const [monthlyReport, setMonthlyReport] = useState<Partial<MonthlyReportData>>({});
    const [isLoadingReport, setIsLoadingReport] = useState(true); // Start loading initially
    const [isSaving, setIsSaving] = useState(false); // For saving LDC/Abono/Participated etc
    const [isProgressModalVisible, setIsProgressModalVisible] = useState(false);
    const [isSavingRole, setIsSavingRole] = useState(false);
    const [isRoleModalVisible, setIsRoleModalVisible] = useState(false);
    const [calculatedStudies, setCalculatedStudies] = useState(0);
    const [isLoadingStudies, setIsLoadingStudies] = useState(false);

    // --- NOVOS ESTADOS ---
    const [hoursToAdd, setHoursToAdd] = useState<string>(''); // Input para adicionar horas
    const [isAddingHours, setIsAddingHours] = useState(false); // Loading state para botão de adicionar horas

    // --- useEffects ---

    // useEffect para buscar estudos
    useEffect(() => {
        if (!user?.uid || (currentRole !== 'pioneer_regular' && currentRole !== 'pioneer_auxiliary')) {
            setCalculatedStudies(0); // Zera se não for pioneiro
            return;
        }

        setIsLoadingStudies(true);
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        const startTimestamp = Timestamp.fromDate(startOfDay(start));
        const endTimestamp = Timestamp.fromDate(startOfDay(addMonths(start, 1)));

        const sessionsRef = collection(db, 'users', user.uid, 'studySessions');
        const q = query(sessionsRef,
                        where('date', '>=', startTimestamp),
                        where('date', '<', endTimestamp)
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

    // useEffect para buscar role
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
                setCurrentRole(data?.fieldServiceRole || 'publisher');
            } else {
                setCurrentRole('publisher'); // Default if doc doesn't exist
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

    // useEffect para buscar/ouvir relatório (onSnapshot)
    useEffect(() => {
        if (!user?.uid || currentRole === 'unknown') {
            setMonthlyReport({});
            setIsLoadingReport(false);
            return () => {};
        }

        setIsLoadingReport(true);
        const docId = getReportDocId(selectedDate);
        const reportDocRef = doc(db, 'users', user.uid, 'fieldServiceReports', docId);

        const unsubscribe = onSnapshot(reportDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setMonthlyReport(docSnap.data() as MonthlyReportData);
            } else {
                // Set default state if document doesn't exist
                const defaultReport: Partial<MonthlyReportData> = {
                    year: getYear(selectedDate),
                    month: getMonth(selectedDate) + 1,
                };
                if (currentRole === 'pioneer_regular' || currentRole === 'pioneer_auxiliary') {
                    defaultReport.hours = 0;
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
            showMessage({ message: "Erro", description: "Não foi possível carregar/ouvir dados.", type: "danger"});
            setMonthlyReport({ year: getYear(selectedDate), month: getMonth(selectedDate) + 1 });
            setIsLoadingReport(false);
        });

        return () => unsubscribe();

    }, [user?.uid, selectedDate, currentRole]);

    // --- Handlers ---

    const handleSelectRole = async (newRole: FieldServiceRole) => {
        if (!user?.uid || newRole === 'unknown' || newRole === currentRole) {
            setIsRoleModalVisible(false);
            return;
        }
        setIsSavingRole(true);
        setIsRoleModalVisible(false);
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await updateDoc(userDocRef, { fieldServiceRole: newRole });
            showMessage({ message: "Sucesso", description: "Sua designação foi atualizada.", type: "success"});
        } catch (error) {
            console.error("Erro ao atualizar designação:", error);
            showMessage({ message: "Erro", description: "Não foi possível atualizar. Tente novamente.", type: "danger"});
        } finally {
            setIsSavingRole(false);
        }
    };

    const handlePreviousMonth = () => setSelectedDate(current => subMonths(current, 1));
    const handleNextMonth = () => setSelectedDate(current => addMonths(current, 1));

    // Handler para inputs (LDC, Abono, AuxTarget) - NÃO horas diretas
    const handleInputChange = (field: keyof MonthlyReportData, value: any) => {
        const editableFields: (keyof MonthlyReportData)[] = [
            'ldcHours',
            'abonoHours',
            'isAuxiliaryTarget15'
            // 'participated' is handled separately with auto-save for publisher
        ];
        if (!editableFields.includes(field)) return;

        const numericFields: (keyof MonthlyReportData)[] = ['ldcHours', 'abonoHours'];
        const processedValue = numericFields.includes(field) ? Number(value) || 0 : value;

        // Update state locally, save happens via handleSaveChanges button
        setMonthlyReport(prev => ({
            ...prev,
            [field]: processedValue,
        }));
    };

    // Handler para Adicionar Horas
    const handleAddHours = async () => {
        if (!user?.uid) return;
        const valueToAdd = parseFloat(hoursToAdd.replace(',', '.')) || 0;

        if (valueToAdd <= 0) {
            showMessage({ message: "Valor Inválido", description: "Insira horas válidas.", type: "warning" });
            return;
        }

        Keyboard.dismiss();
        setIsAddingHours(true);
        const docId = getReportDocId(selectedDate);
        const reportDocRef = doc(db, 'users', user.uid, 'fieldServiceReports', docId);

        try {
            // Try updating first (most common case)
            await updateDoc(reportDocRef, {
                hours: increment(valueToAdd),
                lastUpdated: serverTimestamp(),
                // Ensure these exist if doc is created via increment
                year: getYear(selectedDate),
                month: getMonth(selectedDate) + 1,
            });
             // No need for optimistic update if onSnapshot is active
            // setMonthlyReport(prev => ({...prev, hours: (prev?.hours ?? 0) + valueToAdd }));
            setHoursToAdd('');
            showMessage({ message: "Sucesso", description: `${valueToAdd} hora(s) adicionada(s).`, type: "success" });

        } catch (error: any) {
            if (error.code === 'not-found') {
                // Doc doesn't exist, create it
                try {
                    await setDoc(reportDocRef, {
                        hours: valueToAdd,
                        year: getYear(selectedDate),
                        month: getMonth(selectedDate) + 1,
                        lastUpdated: serverTimestamp(),
                        // Defaults based on role
                        ...(currentRole !== 'publisher' ? { ldcHours: 0, abonoHours: 0 } : { participated: false }),
                        ...(currentRole === 'pioneer_auxiliary' ? { isAuxiliaryTarget15: false } : {}),
                    }, { merge: true }); // Merge in case other fields somehow exist? Safer.
                     // No need for optimistic update if onSnapshot is active
                    setHoursToAdd('');
                    showMessage({ message: "Sucesso", description: `Relatório iniciado com ${valueToAdd} hora(s).`, type: "success" });
                } catch (setError) {
                    console.error("Erro ao criar relatório com setDoc:", setError);
                    showMessage({ message: "Erro", description: "Falha ao criar relatório inicial.", type: "danger" });
                }
            } else {
                console.error("Erro ao adicionar horas:", error);
                showMessage({ message: "Erro", description: "Falha ao adicionar horas.", type: "danger" });
            }
        } finally {
            setIsAddingHours(false);
        }
    };

    // Handler para Salvar Outras Alterações (LDC, Abono, Aux Target, Publisher Participated)
    const handleSaveChanges = async () => {
        if (!user?.uid || !monthlyReport || isSaving || isAddingHours) return;

        setIsSaving(true);
        const docId = getReportDocId(selectedDate);
        const reportDocRef = doc(db, 'users', user.uid, 'fieldServiceReports', docId);

        const dataToSave: Partial<MonthlyReportData> = {
            year: getYear(selectedDate),
            month: getMonth(selectedDate) + 1,
            lastUpdated: serverTimestamp() as unknown as Timestamp,
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
            await setDoc(reportDocRef, dataToSave, { merge: true });
            showMessage({ message: "Sucesso", description: "Alterações salvas!", type: "success" });
        } catch (error) {
            console.error("Erro ao salvar alterações:", error);
            showMessage({ message: "Erro", description: "Não foi possível salvar.", type: "danger" });
        } finally {
            setIsSaving(false);
        }
    };

    // handleShare (Mantido como antes)
     const handleShare = async () => {
       if (!monthlyReport) return;
       let message = `Relatório - ${formatMonthYear(selectedDate)}\n`;
       message += `----------------------------------\n`;
       if (currentRole === 'pioneer_regular' || currentRole === 'pioneer_auxiliary') {
           const target = currentRole === 'pioneer_regular' ? 50 : (monthlyReport.isAuxiliaryTarget15 ? 15 : 30);
           message += `Horas (Meta ${target}): ${monthlyReport.hours ?? 0}\n`;
           message += `Estudos (Contados): ${calculatedStudies}\n`;
           if ((monthlyReport.ldcHours ?? 0) > 0) message += `Horas LDC/Outras: ${monthlyReport.ldcHours}\n`;
           if ((monthlyReport.abonoHours ?? 0) > 0) message += `Horas Abono: ${monthlyReport.abonoHours}\n`;
       } else if (currentRole === 'publisher') {
           message += `Participei: ${monthlyReport.participated ? 'Sim' : 'Não'}\n`;
       } else {
           message += "Nenhum dado para compartilhar.";
       }
       try {
           await Share.share({ message, title: `Relatório - ${formatMonthYear(selectedDate)}` });
       } catch (error: any) {
           showMessage({ message: "Erro Compartilhar", description: error.message, type: "danger"});
       }
   };

    // --- Renderização ---

    const renderInputs = () => {
        // Main loader if nothing is loaded yet
        if (isLoadingReport && !monthlyReport.year) {
            return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
        }
         // Small loader if role is still loading
        if (isLoadingRole || currentRole === 'unknown') {
             return <View style={styles.loadingContainer}><ActivityIndicator size="small" color={colors.primary} /></View>;
        }

        switch (currentRole) {
            case 'pioneer_regular':
            case 'pioneer_auxiliary':
                return (
                    <View style={styles.formContent}>
                        {/* Display Total Hours and Add Hours Input/Button */}
                        <View style={styles.inputGroup}>
                             <Text style={styles.inputLabel}>Horas no Ministério</Text>
                             {/* Display Area */}
                             <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 10, gap: 10 }}>
                                <Text style={{ fontSize: 14, color: colors.textSecondary }}>Total Mês:</Text>
                                {isLoadingReport ? (
                                    <ActivityIndicator size="small" color={colors.primary}/>
                                ) : (
                                    <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.textPrimary }}>{monthlyReport.hours ?? 0}</Text>
                                )}
                             </View>
                             {/* Input Area */}
                            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                                <TextInput
                                    style={[styles.textInput, { flex: 1, textAlign: 'center' }]} // Make input take space
                                    value={hoursToAdd}
                                    onChangeText={setHoursToAdd}
                                    keyboardType="decimal-pad"
                                    placeholder="Adicionar Horas"
                                    placeholderTextColor={colors.textSecondary}
                                />
                                <TouchableOpacity
                                    style={[styles.button, { padding: 12, backgroundColor: colors.primary + '15' } ]} // Style the add button
                                    onPress={handleAddHours}
                                    disabled={isAddingHours || !hoursToAdd}
                                >
                                    {isAddingHours ? (
                                        <ActivityIndicator color={colors.primary} size="small" />
                                    ) : (
                                        <Ionicons name="add" size={24} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Horas LDC/Abono */}
                        <View style={styles.inputRow}>
                            <View style={[styles.inputGroup, styles.flexInput]}>
                            <TextInput
                                    style={styles.textInput}
                                    // Show placeholder if value is 0/null/undefined, otherwise show number
                                    value={monthlyReport.ldcHours ? String(monthlyReport.ldcHours) : ''}
                                    onChangeText={(text) => {
                                        // Update state; treat empty string as 0
                                        handleInputChange('ldcHours', text === '' ? 0 : text);
                                    }}
                                    keyboardType="numeric" // Use numeric for better decimal handling on some devices
                                    placeholder="LDC"
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>
                            <View style={[styles.inputGroup, styles.flexInput]}>
                            <TextInput
                                    style={styles.textInput}
                                    // Show placeholder if value is 0/null/undefined, otherwise show number
                                    value={monthlyReport.abonoHours ? String(monthlyReport.abonoHours) : ''}
                                     onChangeText={(text) => {
                                        // Update state; treat empty string as 0
                                        handleInputChange('abonoHours', text === '' ? 0 : text);
                                    }}
                                    keyboardType="numeric" // Use numeric
                                    placeholder="Abono"
                                    placeholderTextColor={colors.textSecondary}
                                />
                            </View>
                            {/* Botão Salvar para LDC/Abono/AuxTarget */}
                            <TouchableOpacity
                                    style={[styles.button, { padding: 12, backgroundColor: colors.primary + '15' } ]} // Style the add button
                                    onPress={handleSaveChanges}
                                disabled={isSaving || isAddingHours}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color={colors.backgroundPrimary} />
                                ) : (
                                    <>
                                      <Ionicons name="add" size={24} color={colors.white} />
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                         

                        {/* Estudos Calculados */}
                        <View style={styles.calculationCard}>
                            <View style={styles.calculationHeader}>
                                <Ionicons name="calculator-outline" size={18} color={colors.primary} />
                                <Text style={styles.calculationTitle}>Estudos Bíblicos</Text>
                            </View>
                            {isLoadingStudies ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <Text style={styles.calculationValue}>{calculatedStudies}</Text>
                            )}
                            <Text style={styles.calculationHint}>Contados automaticamente das sessões registradas</Text>
                            <TouchableOpacity
                                onPress={() => router.push('/screens/RegisterStudySessionScreen')}
                                style={styles.sessionButton}
                            >
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                                <Text style={styles.sessionButtonText}>Registrar Estudo</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Switch Auxiliar */}
                        {currentRole === 'pioneer_auxiliary' && (
                            <View style={styles.switchContainer}>
                                <Text style={styles.switchLabel}>Meta de 15 horas este mês?</Text>
                                <Switch
                                    trackColor={{ false: colors.border + '50', true: colors.primary }}
                                    thumbColor={monthlyReport.isAuxiliaryTarget15 ? colors.primary : colors.backgroundSecondary} // Adapt thumb color
                                    ios_backgroundColor={colors.border + '50'}
                                    value={monthlyReport.isAuxiliaryTarget15 ?? false}
                                    onValueChange={(value) => {
                                        handleInputChange('isAuxiliaryTarget15', value);
                                        // Consider if save button should be enabled after this change
                                    }}
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
                            <Text style={styles.switchLabel}>Participei este mês</Text>
                            <Switch
                                trackColor={{ false: colors.border + '50', true: colors.primary }}
                                thumbColor={monthlyReport.participated ? colors.primary : colors.backgroundSecondary}
                                ios_backgroundColor={colors.border + '50'}
                                value={monthlyReport.participated ?? false}
                                onValueChange={(value) => {
                                    // Update state and immediately save for publisher
                                    setMonthlyReport(prev => ({ ...prev, participated: value }));
                                    handleSaveChanges(); // Auto-save publisher participation
                                }}
                            />
                        </View>
                        <Text style={styles.publisherHint}>
                            Marque se participou em qualquer modalidade no mês.
                        </Text>
                    </View>
                );

            default:
                return null;
        }
    };

    // --- Main Return JSX ---
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
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

             {/* Action Links */}
             {currentRole === 'pioneer_regular' && (
                 <TouchableOpacity onPress={() => setIsProgressModalVisible(true)} style={styles.progressCard}>
                    <View style={styles.progressIcon}>
                        <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.progressTextContainer}>
                        <Text style={styles.progressTitle}>Progresso Anual</Text>
                        <Text style={styles.progressSubtitle}>Acompanhe suas metas</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                 </TouchableOpacity>
             )}
             <TouchableOpacity onPress={() => router.push('/screens/ReturnVisitsList')} style={styles.progressCard}>
                <View style={styles.progressIcon}>
                     <Ionicons name="list-outline" size={20} color={colors.primary} />
                </View>
                 <View style={styles.progressTextContainer}>
                    <Text style={styles.progressTitle}>Revisitas & Estudos</Text>
                    <Text style={styles.progressSubtitle}>Gerenciar e registrar</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
             </TouchableOpacity>

            {/* Formulário Principal */}
            <View style={styles.formCard}>
                {renderInputs()}
            </View>

            {/* Ações */}
             <View style={styles.actionsContainer}>
                 {/* Share button takes full width if it's the only one */}
                 <TouchableOpacity
                    style={[styles.button, styles.shareButton]}
                    onPress={handleShare}
                    disabled={isLoadingReport}
                 >
                    <Ionicons name="share-outline" size={18} color={colors.primary} />
                    <Text style={styles.shareButtonText}>Compartilhar Relatório</Text>
                 </TouchableOpacity>
             </View>


            {/* Modals */}
            <AnnualProgressModal
              isVisible={isProgressModalVisible}
              onClose={() => setIsProgressModalVisible(false)} 
              userId={user?.uid}            
            />

            <RoleSelectionModal
                isVisible={isRoleModalVisible}
                onClose={() => setIsRoleModalVisible(false)}
                currentRole={currentRole}
                onSelectRole={handleSelectRole}
            />
        </ScrollView>
    );
}

// Estilos completos (using the function provided by the user)
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colors.backgroundPrimary, // Added background color
    },
    infoText: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
    },
    container: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
        paddingVertical: 18 // Let contentContainer handle padding
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingHorizontal: 8, // Use padding from container now? No, keep for spacing around title
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
        textTransform: 'capitalize',
        maxWidth: '70%', // Adjusted slightly
        textAlign: 'center',
    },
    navButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: colors.backgroundSecondary, // Keep background for contrast
    },
    roleCard: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        elevation: 1, // Keep subtle elevation
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    roleContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexShrink: 1, // Allow content to shrink if needed
    },
    roleTextContainer: {
        gap: 4,
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
        backgroundColor: colors.primary + '10', // Use hex alpha notation
    },
    // Renamed progressCard to actionCard for consistency
    progressCard: { // Keep name for compatibility if needed elsewhere, but apply actionCard styles
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        padding: 16,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        marginBottom: 16,
        elevation: 1, // Keep subtle elevation
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    progressIcon: { // Keep name for compatibility
        padding: 8,
        borderRadius: 12,
        backgroundColor: colors.primary + '15', // Use hex alpha notation
    },
    progressTextContainer: { // Keep name for compatibility
        flex: 1,
        gap: 2,
    },
    progressTitle: { // Keep name for compatibility
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    progressSubtitle: { // Keep name for compatibility
        fontSize: 12,
        color: colors.textSecondary,
    },
    formCard: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
         elevation: 1, // Keep subtle elevation
         shadowColor: colors.shadow,
         shadowOffset: { width: 0, height: 1 },
         shadowOpacity: 0.05,
         shadowRadius: 2,
    },
    formContent: {
        gap: 20, // Keep gap between sections
    },
    inputGroup: {
        gap: 8, // Keep gap between label and input
    },
    inputLabel: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '500',
    },
    textInput: {
        backgroundColor: colors.backgroundPrimary,
        color: colors.textPrimary,
        borderRadius: 8,
        padding: 14,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    inputRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8
    },
    flexInput: {
        flex: 1, // Keep flex grow
    },
    calculationCard: {
        backgroundColor: colors.primary + '10', // Use hex alpha
        borderRadius: 8,
        padding: 16,
        gap: 8,
        borderWidth: 1,
        borderColor: colors.primary + '20', // Use hex alpha
        alignItems: 'center', // Center content as added previously
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
        textAlign: 'center',
        marginVertical: 8, // Keep vertical margin
    },
    calculationHint: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    switchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12, // Keep padding
        borderTopWidth: 1,
        borderTopColor: colors.border + '50', // Use hex alpha
    },
    switchLabel: {
        color: colors.textPrimary,
        fontSize: 14,
        flex: 1, // Keep flex
    },
    sessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: colors.primary + '10', // Use hex alpha
        marginTop: 8, // Keep margin
    },
    sessionButtonText: {
        color: colors.primary,
        fontWeight: '500',
    },
    publisherContainer: {
        gap: 16, // Keep gap
        paddingVertical: 8, // Keep padding
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
        lineHeight: 16, // Keep line height
    },
    actionsContainer: {
        gap: 12, // Keep gap
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8, // Keep gap
        padding: 14, // Keep padding
        borderRadius: 8, // Keep border radius
    },
    // secondaryButton definition seems unused now, keeping for reference
    secondaryButton: {
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // mainActions definition seems unused now, keeping for reference
    mainActions: {
        flexDirection: 'row',
        gap: 12,
    },
    saveButton: {
       // flex: 1, // Removed flex: 1 for save button
        backgroundColor: colors.primary,
    },
    saveButtonText: {
        color: colors.backgroundPrimary, // Use backgroundPrimary for text on primary button
        fontWeight: '600',
    },
    shareButton: {
        flex: 1, // Keep flex: 1 for share button
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    shareButtonText: {
        color: colors.primary,
        fontWeight: '600',
    },
     // secondaryButtonText definition seems unused now, keeping for reference
    secondaryButtonText: {
        color: colors.primary,
        fontWeight: '600',
    },
    loadingContainer: {
        padding: 24, // Keep padding
        alignItems: 'center', // Keep alignment
    },
});