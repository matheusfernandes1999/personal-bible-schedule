// screens/ReturnVisitDetailScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    onSnapshot,
    Timestamp,
    DocumentData,
    QuerySnapshot,
    deleteDoc,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import TopBar from '@/components/Components/TopBar';
import ConfirmationModal from '@/components/common/ConfirmationModal'; // Import the modal
import { showMessage } from 'react-native-flash-message';

// Define param type for the route (if using react-navigation without expo-router)
// type ReturnVisitDetailRouteParams = {
//  ReturnVisitDetail: {
//  visitId: string;
//  };
// };

// Type for the main return visit document data
interface ReturnVisitData {
    id: string;
    name: string;
    initialNotes?: string;
    lastVisitDate: Date | null; // Converted JS Date
    createdAt: Date | null; // Converted JS Date
}

// Type for individual notes in the subcollection
interface VisitNote {
    id: string;
    text: string;
    timestamp: Date | null; // Converted JS Date
}

export default function ReturnVisitDetailScreen() {
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { user } = useAuth();
    const navigation = useNavigation();
    const { visitId } = useLocalSearchParams<{ visitId: string }>();

    const [visitData, setVisitData] = useState<ReturnVisitData | null>(null);
    const [isLoading, setIsLoading] = useState(true); // For initial data loading
    const [error, setError] = useState<string | null>(null);

    const [visitNotesList, setVisitNotesList] = useState<VisitNote[]>([]);
    const [isLoadingNotes, setIsLoadingNotes] = useState(true);
    const [newNote, setNewNote] = useState('');
    const [isSavingNote, setIsSavingNote] = useState(false);

    // --- State for Delete Confirmation Modal ---
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false); // For modal confirmation loading state


    // --- Fetch Main Visit Data ---
    useEffect(() => {
        if (!user?.uid || !visitId) {
            setError("Dados da visita inválidos ou usuário não logado.");
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        const docRef = doc(db, 'users', user.uid, 'returnVisits', visitId);

        const fetchVisit = async () => {
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const createdAtTs = data.createdAt as Timestamp | undefined;
                    const lastVisitTs = data.lastVisitDate as Timestamp | undefined;
                    setVisitData({
                        id: docSnap.id,
                        name: data.name || 'Nome não encontrado',
                        initialNotes: data.initialNotes,
                        createdAt: createdAtTs ? createdAtTs.toDate() : null,
                        lastVisitDate: lastVisitTs ? lastVisitTs.toDate() : null,
                    });
                } else {
                    setError("Revisita não encontrada.");
                }
            } catch (err) {
                console.error("Erro ao buscar detalhes da revisita:", err);
                setError("Não foi possível carregar os detalhes.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchVisit();

    }, [user?.uid, visitId]);

    // --- Fetch Visit Notes (Subcollection Listener) ---
    useEffect(() => {
        if (!user?.uid || !visitId) {
            setVisitNotesList([]);
            setIsLoadingNotes(false);
            return () => {}; // No cleanup needed if no listener attached
        }

        setIsLoadingNotes(true);
        const notesCollectionRef = collection(db, 'users', user.uid, 'returnVisits', visitId, 'visitNotes');
        const q = query(notesCollectionRef, orderBy('timestamp', 'desc')); // Most recent first

        console.log("Setting up notes listener for visit:", visitId);
        const unsubscribe = onSnapshot(q,
            (querySnapshot: QuerySnapshot<DocumentData>) => {
                console.log(`Received ${querySnapshot.size} note documents.`);
                const fetchedNotes: VisitNote[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    const noteTs = data.timestamp as Timestamp | undefined;
                    fetchedNotes.push({
                        id: doc.id,
                        text: data.text || '',
                        timestamp: noteTs ? noteTs.toDate() : null,
                    });
                });
                setVisitNotesList(fetchedNotes);
                setIsLoadingNotes(false);
            },
            (err) => {
                console.error("Erro ao buscar notas da visita:", err);
                setError(prev => prev ? `${prev}\nErro ao carregar notas.` : "Erro ao carregar notas.");
                setIsLoadingNotes(false);
            }
        );

        // Cleanup listener on unmount or when dependencies change
        return () => {
             console.log("Cleaning up notes listener for visit:", visitId);
             unsubscribe();
        }
    }, [user?.uid, visitId]);


    // --- Handle Adding a New Note ---
    const handleAddNote = async () => {
        if (!user?.uid || !visitId || !newNote.trim()) {
            showMessage({ message: "Nota Vazia", description: "Por favor, escreva a nota antes de adicionar.", type: "danger"});
            return;
        }

        setIsSavingNote(true);
        const notesCollectionRef = collection(db, 'users', user.uid, 'returnVisits', visitId, 'visitNotes');
        const parentDocRef = doc(db, 'users', user.uid, 'returnVisits', visitId);
        const currentTimestamp = serverTimestamp(); // Use the same timestamp for note and parent update

        try {
            // 1. Add the new note to the subcollection
            await addDoc(notesCollectionRef, {
                text: newNote.trim(),
                timestamp: currentTimestamp,
            });

            // 2. Update the lastVisitDate on the parent document
            await updateDoc(parentDocRef, {
                lastVisitDate: currentTimestamp,
            });

            setNewNote(''); // Clear input field
             // Update local state immediately - Firestore listener will eventually update,
             // but this provides faster UI feedback. Using new Date() is an approximation.
            setVisitData(prev => prev ? {...prev, lastVisitDate: new Date()} : null);

        } catch (error) {
            console.error("Erro ao adicionar nota:", error);
            showMessage({ message: "Erro", description: "Não foi possível adicionar a nota. Tente novamente.", type: "danger"});

        } finally {
            setIsSavingNote(false);
        }
    };

   // --- Open Delete Confirmation Modal ---
   const handleDeleteVisitPress = () => {
       if (!visitData) return; // Should not happen if button is visible, but good check
       setIsDeleteModalVisible(true);
   };

   // --- Confirm Deletion Action (Called by Modal) ---
   const handleConfirmDelete = async () => {
       if (!user?.uid || !visitId) return;

       setIsDeleting(true); // Show loading indicator on modal button
       const docRef = doc(db, 'users', user.uid, 'returnVisits', visitId);

       try {
           await deleteDoc(docRef);
           // Don't show Alert here, just close modal and navigate
           setIsDeleteModalVisible(false);
           navigation.goBack();
           // Optionally: Show a toast message for success if you have a toast library
       } catch (error) {
           console.error("Erro ao excluir revisita:", error);
           // Keep modal open on error, show alert
           showMessage({ message: "Erro", description: "Não foi possível excluir a revisita. Tente novamente.", type: "danger"});
           setIsDeleting(false); // Stop loading indicator on modal button
       }
       // No finally block needed here for setIsDeleting(false) because
       // we only want to stop loading on error, or implicitly on success by navigating away/closing modal.
   };

   // --- Close Delete Confirmation Modal ---
   const handleCloseDeleteModal = () => {
       if (isDeleting) return; // Prevent closing while delete is in progress
       setIsDeleteModalVisible(false);
   };


    // --- Render Note Item ---
    const renderNoteItem = ({ item }: { item: VisitNote }) => (
        <View style={styles.noteItem}>
            <Text style={styles.noteText}>{item.text}</Text>
            {item.timestamp && (
                <Text style={styles.noteTimestamp}>
                    {format(item.timestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </Text>
            )}
        </View>
    );

    // --- Loading and Error States ---
    if (isLoading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>;
    }

    if (error) {
        return <View style={styles.centered}><Text style={[styles.errorText, {color: colors.error}]}>{error}</Text></View>;
    }

    if (!visitData) {
         return <View style={styles.centered}><Text style={styles.infoText}>Revisita não encontrada.</Text></View>;
    }


    // --- Main Render ---
    return (
        <SafeAreaView style={styles.safeArea}>
            <TopBar title='Detalhes' showBackButton={true} />

            <KeyboardAvoidingView
                 behavior={Platform.OS === "ios" ? "padding" : "height"}
                 style={styles.keyboardAvoiding}
                 keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Adjust offset if needed
            >

                <ScrollView style={styles.contentScrollView}>
                    {/* Initial Info Section */}
                    <View style={styles.infoSection}>
                        <Text style={styles.sectionTitle}>Informações</Text>
                        <Text style={styles.infoText}>Nome: {visitData.name}</Text>
                        {visitData.initialNotes ? (
                            <Text style={styles.infoText}>Nota: {visitData.initialNotes}</Text>
                        ) : (
                            <Text style={styles.infoTextMuted}>Nenhuma nota inicial registrada.</Text>
                        )}
                        {visitData.createdAt && (
                            <Text style={styles.infoTextMuted}>
                                Registrado em: {format(visitData.createdAt, 'dd/MM/yyyy', { locale: ptBR })}
                            </Text>
                        )}
                        {visitData.lastVisitDate && (
                            <Text style={styles.infoTextMuted}>
                                Última interação: {format(visitData.lastVisitDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </Text>
                        )}

                        {/* Updated Delete Button */}
                        <TouchableOpacity
                            onPress={handleDeleteVisitPress} // Opens the modal
                            style={styles.sessionButton}
                        >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                            <Text style={styles.sessionButtonText}>Apagar Revisita</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Notes List Section */}
                    <View style={styles.notesSection}>
                        <Text style={styles.sectionTitle}>Histórico de Visitas/Notas</Text>
                        {isLoadingNotes ? (
                            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
                        ) : visitNotesList.length > 0 ? (
                            <FlatList
                                data={visitNotesList}
                                renderItem={renderNoteItem}
                                keyExtractor={(item) => item.id}
                                // Prevent FlatList from interfering with ScrollView's scroll
                                // nestedScrollEnabled={true} // Alternative, might be needed
                                scrollEnabled={false} // Usually better if list isn't huge
                            />
                        ) : (
                            <Text style={styles.infoTextMuted}>Nenhuma nota registrada ainda.</Text>
                        )}
                    </View>
                </ScrollView>

                {/* Add Note Input Section */}
                <View style={styles.addNoteContainer}>
                    <TextInput
                        style={styles.input}
                        value={newNote}
                        onChangeText={setNewNote}
                        placeholder="Adicionar nova nota sobre a visita..."
                        placeholderTextColor={colors.textSecondary}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.button, styles.addButton, isSavingNote && styles.buttonDisabled]}
                        onPress={handleAddNote}
                        disabled={isSavingNote || !newNote.trim()}
                    >
                        {isSavingNote ? (
                            <ActivityIndicator color={colors.primary} size="small" />
                        ) : (
                            <Ionicons name="send-outline" size={22} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                </View>

            </KeyboardAvoidingView>

            {/* --- Confirmation Modal --- */}
            <ConfirmationModal
                isVisible={isDeleteModalVisible}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
                title="Confirmar Exclusão"
                message={`Tem certeza que deseja excluir a revisita de "${visitData?.name}" e todas as suas notas? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                isConfirming={isDeleting}
                confirmButtonStyle="destructive" // Use destructive style for delete
            />
        </SafeAreaView>
    );
}


// Styles (assuming createStyles is defined correctly as before)
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    sessionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: colors.error + '1A', // Slightly adjusted transparency
        marginTop: 16, // Increased margin a bit
        borderWidth: 1,
        borderColor: colors.error + '40', // Subtle border
    },
     sessionButtonText: {
        color: colors.error,
        fontWeight: '600', // Bolder text
        fontSize: 15,
     },
    safeArea: {
        flex: 1,
        backgroundColor: colors.backgroundPrimary,
    },
    keyboardAvoiding: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colors.backgroundPrimary, // Ensure background color
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 10,
        // Color set inline
    },
    infoText: {
        color: colors.textPrimary,
        fontSize: 15,
        lineHeight: 22,
    },
     infoTextMuted: {
        color: colors.textSecondary,
        fontSize: 13,
        marginTop: 5,
        lineHeight: 18, // Added line height
    },
    // Removed header styles as TopBar is used
    contentScrollView: {
        flex: 1, // Takes up available space above input
    },
    infoSection: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10, // Reduced bottom padding
        backgroundColor: colors.backgroundSecondary,
        // marginBottom: 10, // Space removed, handled by notesSection padding
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    notesSection: {
        paddingHorizontal: 20,
        paddingTop: 20, // Increased top padding
        paddingBottom: 10, // Space before input
        flex: 1, // Allow this section to grow if needed
    },
    sectionTitle: {
        fontSize: 17, // Slightly larger
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 15,
    },
    noteItem: {
        backgroundColor: colors.backgroundPrimary, // Match main background
        padding: 15,
        borderRadius: 8,
        marginBottom: 12, // Increased spacing
        borderWidth: 1,
        borderColor: colors.border,
    },
    noteText: {
        fontSize: 15,
        color: colors.textPrimary,
        lineHeight: 21,
        marginBottom: 8, // Increased spacing
    },
    noteTimestamp: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'right',
    },
    addNoteContainer: {
        flexDirection: 'row',
        padding: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.backgroundSecondary, // Match header/info background
        alignItems: 'flex-end', // Align items to bottom when multiline grows
        paddingBottom: Platform.OS === 'ios' ? 15 : 10, // Extra padding for iOS home indicator area
    },
    input: {
        flex: 1, // Take available width
        backgroundColor: colors.backgroundPrimary,
        color: colors.textPrimary,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 20, // Rounded input
        paddingHorizontal: 15,
        paddingVertical: Platform.OS === 'ios' ? 12 : 8, // Adjust padding per platform
        fontSize: 15,
        marginRight: 10,
        maxHeight: 100, // Limit input height
        textAlignVertical: 'top', // Align text top on Android
        paddingTop: Platform.OS === 'ios' ? 12 : 8, // Ensure consistent padding top
    },
    button: {
        padding: 10,
        borderRadius: 25, // Circular button
        justifyContent: 'center',
        alignItems: 'center',
        height: 45, // Fixed height
        width: 45, // Fixed width
        alignSelf: 'flex-end', // Keep button at bottom right
    },
    addButton: {
        // width/height defined in button
        // backgroundColor: colors.primary + '20', // Light background for button - commented out, looks cleaner without?
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: { // Not used for icon button, but keep for potential future use
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.primary,
    },
});