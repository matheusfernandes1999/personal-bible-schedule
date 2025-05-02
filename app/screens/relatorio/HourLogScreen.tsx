// screens/HourLogScreen.tsx
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    Keyboard,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router'; // Removed Stack as TopBar is used
import { db } from '@/lib/firebase';
import {
    collection,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
    doc,
    deleteDoc,
    updateDoc,
    writeBatch,
    increment,
    serverTimestamp, // Import serverTimestamp
} from 'firebase/firestore';
import { useTheme } from '@/context/ThemeContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { showMessage } from 'react-native-flash-message';
import TopBar from '@/components/Components/TopBar'; // Assuming TopBar exists and works

// --- Interfaces ---
interface HourEntryData {
    id: string; // Firestore document ID
    amount: number;
    addedAt: Timestamp;
    method: 'manual' | 'timer';
}

// Interface for the relevant fields from the parent report document
interface MonthlyReportSubset {
    hours?: number;
    ldcHours?: number;
    abonoHours?: number;
}

// --- Helper Functions ---
const formatEntryTimestamp = (timestamp: Timestamp | null | undefined): string => {
    if (!timestamp) return 'Data indisponível';
    try {
        // Format example: 01/Mai/2025 14:30
        return format(timestamp.toDate(), "dd/MMM/yyyy HH:mm", { locale: ptBR });
    } catch (e) {
        console.error("Timestamp format error:", e);
        return 'Data inválida';
    }
};

const formatMonthYearFromId = (docId: string): string => {
    try {
        const [year, month] = docId.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return format(date, 'MMMM yyyy', { locale: ptBR });
    } catch (e) {
        console.error("Error formatting month/year from ID:", e)
        return "Mês Inválido";
    }
};

// --- Component ---
export default function HourLogScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    // Get params passed via navigation (ensure userId, monthDocId, currentRole are passed)
    const { userId, monthDocId, currentRole } = useLocalSearchParams<{ userId: string; monthDocId: string; currentRole: string }>();

    // --- State ---
    // Data State
    const [entries, setEntries] = useState<HourEntryData[]>([]);
    const [monthlyReportData, setMonthlyReportData] = useState<MonthlyReportSubset>({}); // Holds hours, ldc, abono

    // Loading State
    const [isLoading, setIsLoading] = useState(true); // Initial data load
    const [isUpdatingEntry, setIsUpdatingEntry] = useState(false); // For edit/delete/ldc/abono saves

    // Edit Entry Modal State
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingEntry, setEditingEntry] = useState<HourEntryData | null>(null);
    const [newAmountString, setNewAmountString] = useState('');

    // LDC/Abono Modal State
    const [isLdcModalVisible, setIsLdcModalVisible] = useState(false);
    const [ldcValueString, setLdcValueString] = useState('');
    const [isAbonoModalVisible, setIsAbonoModalVisible] = useState(false);
    const [abonoValueString, setAbonoValueString] = useState('');

    // --- useEffect for Data Fetching ---
    useEffect(() => {
        // Validate params
        if (!userId || !monthDocId) {
            console.error("HourLogScreen: userId or monthDocId missing!");
            showMessage({ message: "Erro", description: "Dados necessários não encontrados para carregar o log.", type: "danger" });
            setIsLoading(false);
            return;
        };

        setIsLoading(true); // Start loading
        const reportDocRef = doc(db, 'users', userId, 'fieldServiceReports', monthDocId);

        // Listener 1: Parent Report Document (for totals, LDC, Abono)
        const unsubscribeReport = onSnapshot(reportDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMonthlyReportData({
                    hours: data?.hours ?? 0,
                    ldcHours: data?.ldcHours ?? 0,
                    abonoHours: data?.abonoHours ?? 0,
                });
            } else {
                // If report doc doesn't exist for the month, set defaults
                setMonthlyReportData({ hours: 0, ldcHours: 0, abonoHours: 0 });
            }
        }, (error) => {
            console.error("Error fetching monthly report data:", error);
            setMonthlyReportData({}); // Indicate error
            showMessage({ message: "Erro", description: "Não foi possível carregar totais LDC/Abono.", type: "danger" });
            // Consider setting isLoading false here if this is critical and fails
        });

        // Listener 2: Hour Entries Subcollection
        const entriesCollectionRef = collection(reportDocRef, 'hourEntries');
        const q = query(entriesCollectionRef, orderBy('addedAt', 'desc')); // Order by most recent first

        const unsubscribeEntries = onSnapshot(q, (querySnapshot) => {
            const fetchedEntries: HourEntryData[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                // Basic validation
                if (data.addedAt && data.addedAt instanceof Timestamp && typeof data.amount === 'number') {
                   fetchedEntries.push({ id: doc.id, ...data } as HourEntryData);
                } else {
                    console.warn(`Entry ${doc.id} has invalid data. Skipping.`);
                }
            });
            setEntries(fetchedEntries);
            setIsLoading(false); // Stop loading indicator *after* entries are processed
        }, (error) => {
            console.error("Error fetching hour entries:", error);
            setIsLoading(false); // Stop loading on error too
            showMessage({ message: "Erro", description: "Não foi possível carregar os registros de hora.", type: "danger" });
        });

        // Cleanup function: Unsubscribe from both listeners on component unmount
        return () => {
            unsubscribeReport();
            unsubscribeEntries();
        };

    }, [userId, monthDocId]); // Re-run if userId or monthDocId changes

    // --- Edit/Delete Entry Handlers ---

    const handleEditPress = (item: HourEntryData) => {
        if (isUpdatingEntry) return;
        setEditingEntry(item);
        setNewAmountString(item.amount.toString());
        setIsEditModalVisible(true);
    };

    const handleDeletePress = (item: HourEntryData) => {
        if (isUpdatingEntry) return;
        Alert.alert(
            "Confirmar Exclusão",
            `Tem certeza que deseja excluir o registro de ${item.amount.toFixed(1)} hora(s) (${item.method}) adicionado em ${formatEntryTimestamp(item.addedAt)}?\n\nIsso ajustará o total de horas do mês.`,
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Excluir", style: "destructive", onPress: () => deleteEntry(item) },
            ]
        );
    };

    const deleteEntry = async (itemToDelete: HourEntryData) => {
        if (!userId || !monthDocId || !itemToDelete || isUpdatingEntry) return;

        setIsUpdatingEntry(true);
        const reportDocRef = doc(db, 'users', userId, 'fieldServiceReports', monthDocId);
        const entryDocRef = doc(reportDocRef, 'hourEntries', itemToDelete.id);
        const batch = writeBatch(db);

        batch.delete(entryDocRef); // Delete entry
        batch.update(reportDocRef, { hours: increment(-itemToDelete.amount) }); // Decrement total

        try {
            await batch.commit();
            showMessage({ message: "Sucesso", description: "Registro excluído.", type: "success" });
        } catch (error) {
            console.error("Error deleting entry:", error);
            showMessage({ message: "Erro", description: "Falha ao excluir registro.", type: "danger" });
        } finally {
            setIsUpdatingEntry(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!userId || !monthDocId || !editingEntry || isUpdatingEntry) return;

        const newAmount = parseFloat(newAmountString.replace(',', '.')) || 0;
        const originalAmount = editingEntry.amount;

        if (newAmount <= 0) {
            showMessage({ message: "Valor Inválido", description: "Insira um valor de horas positivo.", type: "warning" });
            return;
        }
        if (newAmount === originalAmount) {
            handleCancelEdit(); // Just close if no change
            return;
        }

        setIsUpdatingEntry(true);
        const difference = newAmount - originalAmount;
        const reportDocRef = doc(db, 'users', userId, 'fieldServiceReports', monthDocId);
        const entryDocRef = doc(reportDocRef, 'hourEntries', editingEntry.id);
        const batch = writeBatch(db);

        batch.update(entryDocRef, { amount: newAmount }); // Update entry amount
        batch.update(reportDocRef, { hours: increment(difference) }); // Adjust total

        try {
            await batch.commit();
            showMessage({ message: "Sucesso", description: "Registro atualizado.", type: "success" });
            handleCancelEdit(); // Close modal on success
        } catch (error) {
            console.error("Error updating entry:", error);
            showMessage({ message: "Erro", description: "Falha ao atualizar registro.", type: "danger" });
        } finally {
            setIsUpdatingEntry(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditModalVisible(false);
        setEditingEntry(null);
        setNewAmountString('');
    };

    // --- LDC/Abono Handlers ---

    const openLdcModal = () => {
        if (isUpdatingEntry) return;
        setLdcValueString(monthlyReportData.ldcHours?.toString() ?? '');
        setIsLdcModalVisible(true);
    };

    const openAbonoModal = () => {
        if (isUpdatingEntry) return;
        setAbonoValueString(monthlyReportData.abonoHours?.toString() ?? '');
        setIsAbonoModalVisible(true);
    };

    const closeLdcModal = () => {
        setIsLdcModalVisible(false);
        setLdcValueString('');
    };

    const closeAbonoModal = () => {
        setIsAbonoModalVisible(false);
        setAbonoValueString('');
    };

    // Generic function to save LDC or Abono hours
    const saveLdcOrAbonoHours = async (type: 'ldc' | 'abono') => {
        if (!userId || !monthDocId || isUpdatingEntry) return;

        const valueString = type === 'ldc' ? ldcValueString : abonoValueString;
        const fieldToUpdate = type === 'ldc' ? 'ldcHours' : 'abonoHours';
        const newValue = parseFloat(valueString.replace(',', '.')) || 0; // Default to 0
        const currentValue = type === 'ldc' ? monthlyReportData.ldcHours ?? 0 : monthlyReportData.abonoHours ?? 0;

        if (newValue === currentValue) {
            showMessage({ message: "Sem Alterações", description: `O valor ${type.toUpperCase()} não foi alterado.`, type: "info" });
            if (type === 'ldc') closeLdcModal(); else closeAbonoModal();
            return;
        }

        setIsUpdatingEntry(true);
        Keyboard.dismiss();
        const reportDocRef = doc(db, 'users', userId, 'fieldServiceReports', monthDocId);

        try {
            await updateDoc(reportDocRef, {
                [fieldToUpdate]: newValue,
                lastUpdated: serverTimestamp(),
            });
            showMessage({ message: "Sucesso", description: `Horas ${type.toUpperCase()} atualizadas.`, type: "success" });
            if (type === 'ldc') closeLdcModal(); else closeAbonoModal();
        } catch (error) {
             console.error(`Error updating ${type} hours:`, error);
             showMessage({ message: "Erro", description: `Falha ao atualizar horas ${type.toUpperCase()}.`, type: "danger" });
        } finally {
             setIsUpdatingEntry(false);
        }
    };

    // --- Render Item Function for FlatList ---
    const renderItem = ({ item }: { item: HourEntryData }) => (
        <View style={styles.entryItem}>
            {/* Details */}
            <View style={styles.entryDetailsContainer}>
                <View style={styles.entryDetails}>
                    <Text style={styles.entryAmount}>{item.amount.toFixed(1)} hr{item.amount !== 1 ? 's' : ''}</Text>
                    <Text style={styles.entryMethod}>({item.method === 'timer' ? 'Timer' : 'Manual'})</Text>
                </View>
                <Text style={styles.entryTimestamp}>{formatEntryTimestamp(item.addedAt)}</Text>
            </View>
            {/* Actions */}
            <View style={styles.actionButtonsContainer}>
                 <TouchableOpacity onPress={() => handleEditPress(item)} style={styles.actionButton} disabled={isUpdatingEntry}>
                     <Ionicons name="pencil" size={20} color={colors.primary} style={{ opacity: isUpdatingEntry ? 0.3 : 1 }}/>
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => handleDeletePress(item)} style={styles.actionButton} disabled={isUpdatingEntry}>
                      <Ionicons name="trash-outline" size={20} color={colors.warning || '#dc3545'} style={{ opacity: isUpdatingEntry ? 0.3 : 1 }}/>
                 </TouchableOpacity>
            </View>
        </View>
    );

    // --- Title ---
    const monthYearTitle = monthDocId ? formatMonthYearFromId(monthDocId) : "Detalhes Horas";

    // --- Main JSX Return ---
    return (
        <>
            <TopBar title={monthYearTitle} showBackButton/>
            <View style={styles.container}>
                {/* Loading Overlay */}
                {(isLoading || isUpdatingEntry) && (
                     <View style={styles.loadingOverlay}>
                         <ActivityIndicator size="large" color={isUpdatingEntry ? colors.warning : colors.primary} />
                     </View>
                 )}

                {/* Content Area - Hide while initial loading */}
                {!isLoading && (
                    <>
                        {/* Totals and Quick Add Buttons (Only for Pioneers) */}
                        {currentRole !== 'publisher' && (
                            <>
                                <View style={styles.totalContainer}>
                                    <Text style={styles.totalLabel}>Total Horas (Mês):</Text>
                                    <Text style={styles.totalValue}>
                                        {monthlyReportData.hours?.toFixed(1) ?? '0.0'} hrs
                                    </Text>
                                </View>
                                <View style={styles.quickAddContainer}>
                                    <TouchableOpacity style={styles.quickAddButton} onPress={openLdcModal} disabled={isUpdatingEntry}>
                                        <Ionicons name="construct-outline" size={18} color={colors.primary} />
                                        <Text style={styles.quickAddButtonText}>
                                            LDC: {monthlyReportData.ldcHours ?? '0'}h
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.quickAddButton} onPress={openAbonoModal} disabled={isUpdatingEntry}>
                                        <Ionicons name="gift-outline" size={18} color={colors.primary} />
                                        <Text style={styles.quickAddButtonText}>
                                            Abono: {monthlyReportData.abonoHours ?? '0'}h
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {/* Empty List Text */}
                        {entries.length === 0 && (
                            <Text style={styles.emptyText}>Nenhum registro detalhado de hora encontrado para este mês.</Text>
                        )}

                        {/* Entries List */}
                        {entries.length > 0 && (
                            <FlatList
                                data={entries}
                                renderItem={renderItem}
                                keyExtractor={(item) => item.id}
                                contentContainerStyle={styles.listContent}
                                showsVerticalScrollIndicator={false}
                                scrollEnabled={!isEditModalVisible && !isLdcModalVisible && !isAbonoModalVisible && !isUpdatingEntry}
                                extraData={isUpdatingEntry} // Helps ensure re-render on loading state change
                            />
                        )}
                    </>
                )}
            </View>

            {/* --- Modals --- */}

            {/* Edit Entry Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isEditModalVisible}
                onRequestClose={handleCancelEdit}
            >
                <View style={styles.modalCenteredView}>
                    <View style={styles.modalView}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={handleCancelEdit}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Editar Registro</Text>
                        {editingEntry && (
                            <Text style={styles.modalSubText}>
                                Original: {editingEntry.amount.toFixed(1)} hrs ({editingEntry.method}) {formatEntryTimestamp(editingEntry.addedAt)}
                            </Text>
                        )}
                        <TextInput
                            style={styles.modalInput}
                            value={newAmountString}
                            onChangeText={setNewAmountString}
                            placeholder="Novo valor (ex: 2.5)"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="decimal-pad"
                            autoFocus={true}
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={handleCancelEdit}>
                                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={handleSaveEdit} disabled={isUpdatingEntry || !newAmountString}>
                                {isUpdatingEntry ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Salvar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* LDC Input Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isLdcModalVisible}
                onRequestClose={closeLdcModal}
            >
                <View style={styles.modalCenteredView}>
                    <View style={styles.modalView}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={closeLdcModal}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Horas LDC</Text>
                        <Text style={styles.modalSubText}>Insira o total de horas LDC para este mês.</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={ldcValueString}
                            onChangeText={setLdcValueString}
                            placeholder="Total Horas LDC"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="decimal-pad"
                            autoFocus={true}
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={closeLdcModal}>
                                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={() => saveLdcOrAbonoHours('ldc')} disabled={isUpdatingEntry}>
                                {isUpdatingEntry ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Salvar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Abono Input Modal */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isAbonoModalVisible}
                onRequestClose={closeAbonoModal}
            >
                <View style={styles.modalCenteredView}>
                    <View style={styles.modalView}>
                        <TouchableOpacity style={styles.modalCloseButton} onPress={closeAbonoModal}>
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>Horas Abono</Text>
                        <Text style={styles.modalSubText}>Insira o total de horas Abono para este mês.</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={abonoValueString}
                            onChangeText={setAbonoValueString}
                            placeholder="Total Horas Abono"
                            placeholderTextColor={colors.textSecondary}
                            keyboardType="decimal-pad"
                            autoFocus={true}
                        />
                        <View style={styles.modalButtonContainer}>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonCancel]} onPress={closeAbonoModal}>
                                <Text style={[styles.modalButtonText, styles.modalButtonTextCancel]}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalButton, styles.modalButtonConfirm]} onPress={() => saveLdcOrAbonoHours('abono')} disabled={isUpdatingEntry}>
                                {isUpdatingEntry ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>Salvar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}

// --- Styles ---
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
        paddingHorizontal: 16, // Apply horizontal padding here
        paddingTop: 8,
        paddingBottom: 16,
    },
    loadingOverlay: { // Style for loading indicator overlay
         ...StyleSheet.absoluteFillObject, // Take up whole screen
         backgroundColor: 'rgba(0,0,0,0.1)', // Slight dimming
         justifyContent: 'center',
         alignItems: 'center',
         zIndex: 10, // Ensure loader is on top
    },
    totalContainer: {
        backgroundColor: colors.backgroundSecondary,
        padding: 15,
        borderRadius: 8,
        marginBottom: 8,
        alignItems: 'center',
        elevation: 1,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    totalLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: colors.primary,
    },
    quickAddContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 4, // Add small top margin
        gap: 10,
    },
    quickAddButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.backgroundSecondary,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        elevation: 1,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
        minHeight: 44,
    },
    quickAddButtonText: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '500',
    },
    listContent: {
        paddingBottom: 20,
    },
    entryItem: {
        backgroundColor: colors.backgroundSecondary,
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 8,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 1,
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    entryDetailsContainer: {
        flex: 1,
        marginRight: 10,
    },
    entryDetails: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        marginBottom: 2,
    },
    entryAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    entryMethod: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    entryTimestamp: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    actionButtonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    actionButton: {
        padding: 5,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 50, // More margin if list is empty
        fontSize: 16,
        color: colors.textSecondary,
        paddingHorizontal: 20, // Add padding for centering
    },
    // --- Modal Styles (Shared) ---
    modalCenteredView: {
       flex: 1,
       justifyContent: 'center',
       alignItems: 'center',
       backgroundColor: 'rgba(0, 0, 0, 0.6)',
   },
   modalView: {
       margin: 20,
       backgroundColor: colors.backgroundSecondary,
       borderRadius: 15,
       padding: 25,
       paddingTop: 45,
       alignItems: 'stretch',
       shadowColor: '#000',
       shadowOffset: { width: 0, height: 2 },
       shadowOpacity: 0.25,
       shadowRadius: 4,
       elevation: 5,
       width: '90%',
       maxWidth: 400, // Max width for larger screens
       position: 'relative',
   },
   modalCloseButton: {
        position: 'absolute',
        top: 12,
        right: 12,
        padding: 8, // Slightly larger hit area
        zIndex: 1,
   },
   modalTitle: {
       marginBottom: 8,
       textAlign: 'center',
       fontSize: 18,
       fontWeight: 'bold',
       color: colors.textPrimary,
   },
    modalSubText: {
        marginBottom: 20,
        textAlign: 'center',
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
   modalInput: {
       backgroundColor: colors.backgroundPrimary,
       color: colors.textPrimary,
       borderRadius: 8,
       padding: 14,
       fontSize: 16,
       borderWidth: 1,
       borderColor: colors.border,
       marginBottom: 25,
       textAlign: 'center',
   },
   modalButtonContainer: {
       flexDirection: 'row',
       justifyContent: 'space-between',
       gap: 10,
   },
   modalButton: {
       borderRadius: 8,
       paddingVertical: 12,
       paddingHorizontal: 20,
       elevation: 2,
       flex: 1,
       alignItems: 'center',
       minHeight: 44,
   },
   modalButtonCancel: {
       backgroundColor: colors.backgroundPrimary,
       borderWidth: 1,
       borderColor: colors.border,
   },
   modalButtonConfirm: {
       backgroundColor: colors.primary,
   },
   modalButtonText: {
       fontWeight: 'bold',
       fontSize: 15,
   },
   modalButtonTextCancel: {
       color: colors.textSecondary,
   },
   modalButtonTextConfirm: {
       color: colors.white, // Use theme contrast color if available
   },
});