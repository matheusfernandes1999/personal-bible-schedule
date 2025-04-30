// app/(tabs)/publicacoes.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
    SectionList, TextInput, Platform // Added Platform
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
// Firestore imports
import { collection, query, onSnapshot, Unsubscribe, orderBy, doc, getDoc } from "firebase/firestore";
import { db } from '@/lib/firebase';
// Types and Constants
import {
    PublicationItem, PUBLICATIONS_SERVANT_CATEGORY, ADMIN_CATEGORY,
    PUBLICATION_CATEGORY_TRANSLATIONS // Import translations if using categoryPT
} from '@/types';
import { Ionicons } from '@expo/vector-icons';
import ImportPublicationsModal from '@/components/publicacoes/ImportPublicationsModal';
import { router } from 'expo-router';
import IconeIcon from '@/assets/icons/icone';

// Interface for SectionList data
interface PublicationSection {
    title: string; // Section header title (e.g., translated category)
    data: PublicationItem[];
}

// --- Helper Function ---
// Formats a Date object into display ("Month Year") or ID ("YYYY-MM") format
const formatMonthYear = (date: Date | null, format: 'display' | 'id'): string => {
  if (!date) return ''; // Return empty string if date is null

  const year = date.getFullYear();
  const monthIndex = date.getMonth(); // 0-11

  if (format === 'id') {
      // Format for Firestore document ID (YYYY-MM)
      return `${year}-${(monthIndex + 1).toString().padStart(2, '0')}`;
  } else { // 'display'
      // Return "Month Year" localized (e.g., "Abril 2025")
      try {
           // <<< --- ESTA LINHA DEVE GERAR O MÊS EM PORTUGUÊS --- >>>
           return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
           // <<< --- --- --- --- --- --- --- --- --- --- --- --- >>>
      } catch (e) {
           // Fallback for potential environment issues
           console.warn("toLocaleString pt-BR failed, using default.", e);
           // Se 'pt-BR' falhar, tenta o padrão do dispositivo ou inglês como último recurso
           try {
              return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
           } catch (e2) {
               // Fallback muito básico se tudo falhar
               const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
               return `${monthNames[monthIndex]} ${year}`;
           }
      }
  }
};

// --- Main Screen Component ---
export default function PublicacoesScreen() {
    const { colors } = useTheme();
    const { user, userData, isAdmin, userCategories, loading: authLoading } = useAuth();
    const [inventory, setInventory] = useState<PublicationItem[]>([]);
    const [loading, setLoading] = useState(true); // Loading state for fetching publications
    const [isImportModalVisible, setIsImportModalVisible] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonthDate, setSelectedMonthDate] = useState<Date | null>(null); // Start as null until auth loads
    const [monthExists, setMonthExists] = useState<boolean | null>(null); // Tracks if data exists for the selected month
    const styles = createStyles(colors);

    // Set initial date (current month) only after authentication is loaded and if not already set
    useEffect(() => {
        if (!authLoading && userData?.congregationId && !selectedMonthDate) {
            setSelectedMonthDate(new Date()); // Set to the current month
        }
        // Clear date and inventory if user loses congregation association
        if (!userData?.congregationId) {
            setSelectedMonthDate(null);
            setInventory([]);
            setMonthExists(null);
        }
    }, [authLoading, userData?.congregationId, selectedMonthDate]); // Re-run if auth or congregation changes

    // Determine if the user has permission to manage publications
    const canManagePublications = isAdmin || (userCategories?.includes(PUBLICATIONS_SERVANT_CATEGORY) ?? false);

    // Effect to fetch publication inventory for the selected month
    useEffect(() => {
        // Exit if auth is loading, user has no congregation, or no date is selected
        if (authLoading || !userData?.congregationId || !selectedMonthDate) {
            setLoading(false);
            setInventory([]);
            setMonthExists(null);
            return;
        }

        setLoading(true); // Start loading indicator for this fetch
        setInventory([]); // Clear previous inventory
        setMonthExists(null); // Reset month existence state

        const congregationId = userData.congregationId;
        let unsubscribeListener: Unsubscribe | null = null; // To clean up the listener

        // --- NEW FIRESTORE PATH AND QUERY ---
        const monthId = formatMonthYear(selectedMonthDate, 'id'); // Get "YYYY-MM" format
        console.log(`[PublicacoesScreen] Fetching publications for month ID: ${monthId}`);

        // Path to the 'items' subcollection within the specific month's document
        const monthItemsCollectionRef = collection(db, "congregations", congregationId, "publications", monthId, "items");

        // Path to the month document itself (to check existence)
        const monthDocumentRef = doc(db, "congregations", congregationId, "publications", monthId);

        // 1. Check if the month document exists (meaning data has been imported for this month)
        getDoc(monthDocumentRef).then(docSnapshot => {
            if (docSnapshot.exists()) {
                console.log(`[PublicacoesScreen] Document for month ${monthId} exists. Setting up listener...`);
                setMonthExists(true); // Mark month as existing

                // 2. If it exists, set up the real-time listener on the 'items' subcollection
                const publicationsQuery = query(
                    monthItemsCollectionRef,
                    orderBy("categoryPT"), // Order by translated category (ensure 'categoryPT' field exists in items)
                    orderBy("description")  // Then by description
                );

                unsubscribeListener = onSnapshot(publicationsQuery, (snapshot) => {
                    const publicationsData: PublicationItem[] = [];
                    snapshot.forEach((itemDoc) => {
                        // Add document ID (itemCode) and data, ensuring correct type
                        publicationsData.push({ id: itemDoc.id, ...itemDoc.data() } as PublicationItem);
                    });
                    setInventory(publicationsData); // Update state with fetched data
                    setLoading(false); // Stop loading indicator *after* data is received
                    console.log(`[PublicacoesScreen] ${publicationsData.length} publication items loaded for ${monthId}.`);
                }, (error) => {
                    console.error(`[PublicacoesScreen] Error fetching publications for ${monthId}:`, error);
                    showMessage({ message: "Erro ao Carregar", description: "Não foi possível carregar as publicações.", type: "danger" });
                    setInventory([]);
                    setLoading(false);
                    setMonthExists(null); // Error state, could be permission issue or other problem
                });

            } else {
                // Month document does not exist
                console.log(`[PublicacoesScreen] Document for month ${monthId} not found. No data to load.`);
                setInventory([]); // Ensure inventory is empty
                setMonthExists(false); // Mark month as not existing
                setLoading(false); // Stop loading
            }
        }).catch(error => {
            console.error(`[PublicacoesScreen] Error checking month existence for ${monthId}:`, error);
            showMessage({ message: "Erro de Verificação", description: "Não foi possível verificar os dados do mês.", type: "danger" });
            setInventory([]);
            setMonthExists(null); // Uncertain state due to error
            setLoading(false);
        });

        // Cleanup function: Unsubscribe from the listener when the component unmounts or dependencies change
        return () => {
            if (unsubscribeListener) {
                console.log(`[PublicacoesScreen] Cleaning up publications listener for ${monthId}.`);
                unsubscribeListener();
            }
        };
        // Dependencies: Re-run this effect if congregation, auth state, or selected month changes
    }, [userData?.congregationId, authLoading, selectedMonthDate]);

    // Memoized calculation for filtering and grouping the inventory
    const filteredAndGroupedInventory = useMemo<PublicationSection[]>(() => {
        if (inventory.length === 0) return [];

        const lowerCaseSearchTerm = searchTerm.toLowerCase();

        // Filter items based on search term (description, itemCode, category, or translated category)
        const filteredItems = inventory.filter(item =>
            item.description.toLowerCase().includes(lowerCaseSearchTerm) ||
            item.itemCode.toLowerCase().includes(lowerCaseSearchTerm) ||
            (item.category && item.category.toLowerCase().includes(lowerCaseSearchTerm)) ||
            (item.categoryPT && item.categoryPT.toLowerCase().includes(lowerCaseSearchTerm))
        );

        // Group filtered items by category (using categoryPT as primary, fallback to category)
        const groupedByCategory: { [categoryTitle: string]: PublicationItem[] } = {};
        filteredItems.forEach(item => {
            const groupTitle = item.categoryPT || item.category || 'Sem Categoria'; // Determine group title
            if (!groupedByCategory[groupTitle]) {
                groupedByCategory[groupTitle] = []; // Initialize array if group doesn't exist
            }
            groupedByCategory[groupTitle].push(item); // Add item to its group
        });

        // Format the grouped data for the SectionList component
        return Object.entries(groupedByCategory)
            .map(([title, data]) => ({ title, data })) // Create { title, data } objects
            .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' })); // Sort sections alphabetically by title

    }, [inventory, searchTerm]); // Recalculate only when inventory or search term changes

    // --- Modal Callbacks ---
    const handlePresentImportModal = useCallback(() => {
        if (!canManagePublications) {
            showMessage({ message: "Permissão Negada", description: "Você não tem permissão para importar.", type: "warning" });
            return;
        }
        setIsImportModalVisible(true);
    }, [canManagePublications]);

    const handleDismissImportModal = useCallback(() => setIsImportModalVisible(false), []);

    // Callback triggered after successful import in the modal
    const handleImportSuccess = useCallback((importedMonthId: string) => { // Receives "YYYY-MM"
        console.log("[PublicacoesScreen] Import successful for month ID:", importedMonthId);
        setIsImportModalVisible(false); // Ensure modal is closed

        // Parse the "YYYY-MM" string to navigate to the imported month
        const [yearStr, monthStr] = importedMonthId.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10); // 1-12

        if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
            // Create a Date object for the first day of the imported month
            // Note: month - 1 because Date constructor month index is 0-11
            const newSelectedDate = new Date(year, month - 1, 1);
            console.log("[PublicacoesScreen] Navigating display to date:", newSelectedDate);
            setSelectedMonthDate(newSelectedDate); // Update state to trigger refetch
            showMessage({
                message: "Importação Concluída",
                description: `Exibindo inventário para ${formatMonthYear(newSelectedDate, 'display')}.`,
                type: "success", // Changed from info to success
                duration: 3000
            });
        } else {
            console.error("[PublicacoesScreen] Invalid imported month ID received:", importedMonthId);
            showMessage({ message: "Erro Pós-Importação", description: "Não foi possível navegar para o mês importado.", type: "warning" });
        }
    }, []); // No external dependencies that change

    // --- Month Navigation ---
    const goToPreviousMonth = () => {
        setSelectedMonthDate(prevDate =>
            prevDate ? new Date(prevDate.getFullYear(), prevDate.getMonth() - 1, 1) : new Date() // Go to prev month, or current if null
        );
    };
    const goToNextMonth = () => {
        setSelectedMonthDate(prevDate =>
            prevDate ? new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1) : new Date() // Go to next month, or current if null
        );
    };

    // --- List Item Rendering ---
    const renderInventoryItem = ({ item }: { item: PublicationItem }) => (
        <View style={[styles.itemContainer, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            {/* Item Details */}
            <View style={styles.itemInfo}>
                <Text style={[styles.itemDescription, { color: colors.textPrimary }]}>{item.description}</Text>
                <Text style={[styles.itemCode, { color: colors.textSecondary }]}>({item.itemCode})</Text>
                {item.movementObservation && (
                    <Text style={[styles.itemObservation, { color: colors.textMuted }]}>Obs: {item.movementObservation}</Text>
                )}
            </View>
            {/* Item Quantity */}
            <View style={styles.itemQuantityContainer}>
                {/* Display 0 if quantity is null/undefined, but also display actual 0 */}
                <Text style={[styles.itemQuantity, { color: colors.primary }]}>{item.currentQuantity ?? 0}</Text>
                <Text style={styles.itemQuantityLabel}>Atual</Text>
            </View>
            {/* TODO: Add edit button/functionality here if needed */}
        </View>
    );

    // --- Section Header Rendering ---
    const renderSectionHeader = ({ section: { title } }: { section: PublicationSection }) => (
        <View style={[styles.sectionHeaderContainer, { backgroundColor: colors.black || colors.backgroundPrimary }]}>
             <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
                 {title}
             </Text>
        </View>
    );

    // --- Main Render ---

    // Loading state while authentication is resolving or initial date is not set
    if (authLoading || selectedMonthDate === null && userData?.congregationId) { // Show loading if auth pending or date null (but user HAS congregation)
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Message if user is not associated with a congregation
    if (!userData?.congregationId) {
        return (
            <View style={[styles.container, styles.centered, { backgroundColor: colors.backgroundPrimary }]}>
                <IconeIcon
                    size={80}
                    color={colors.textSecondary}
                  />                
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                    Associe-se a uma congregação.
                </Text>
                <Text style={[styles.infoTextSmall, { color: colors.textMuted, marginTop: 5 }]}>
                    Use a aba 'Congregação' para encontrar ou criar uma.
                </Text>
            </View>
        );
    }

    // --- Main Screen Layout ---
    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundPrimary }]}>

            {/* Floating Action Button - Insights */}
            {canManagePublications && (
                <TouchableOpacity
                    style={[styles.goButton, { backgroundColor: colors.secondary }]}
                    onPress={() => router.push('/screens/insightsPublicacoesScreen')} // Adjust route if needed
                    activeOpacity={0.7}
                 >
                    <Ionicons name="flash" size={24} color={colors.white} />
                </TouchableOpacity>
            )}

            {/* Floating Action Button - Import */}
            {canManagePublications && (
                <TouchableOpacity
                   style={[styles.addButton, { backgroundColor: colors.primary }]}
                   onPress={handlePresentImportModal}
                   activeOpacity={0.7}
                >
                    <Ionicons name="cloud-upload" size={24} color={colors.white} />
                </TouchableOpacity>
            )}

            {/* Month Navigation Header */}
            <View style={[styles.monthNavigator, { borderBottomColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton} disabled={loading}>
                    <Ionicons name="chevron-back-outline" size={28} color={loading ? colors.textMuted : colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.monthText, { color: colors.textPrimary }]}>
                    {formatMonthYear(selectedMonthDate, 'display')}
                </Text>
                <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} disabled={loading}>
                    <Ionicons name="chevron-forward-outline" size={28} color={loading ? colors.textMuted : colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
                <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    placeholder="Buscar por item, código ou categoria..."
                    placeholderTextColor={colors.textMuted}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    clearButtonMode="while-editing" // iOS 'x' button
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                {/* Manual clear button for Android */}
                {searchTerm.length > 0 && Platform.OS !== 'ios' && (
                    <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
                        <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content Area: Loading Indicator, Empty State, or SectionList */}
            {loading ? (
                // Loading state specific to fetching publications
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 10 }]}>
                        Carregando inventário...
                    </Text>
                </View>
            ) : monthExists === false ? (
                // State when the month document doesn't exist (no import yet)
                <View style={styles.centered}>
                    <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} style={{ marginBottom: 15 }} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        Nenhum inventário importado para {formatMonthYear(selectedMonthDate, 'display')}.
                    </Text>
                    {canManagePublications && (
                        <Text style={[styles.emptyText, { fontSize: 14, color: colors.textMuted, marginTop: 5 }]}>
                            Use o botão para importar o arquivo CSV deste mês.
                        </Text>
                    )}
                </View>
            ) : (
                // Display the SectionList if month exists (even if empty after filtering)
                <SectionList
                    sections={filteredAndGroupedInventory}
                    keyExtractor={(item) => item.id ?? item.itemCode} // Use itemCode as the key
                    renderItem={renderInventoryItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={styles.listContent}
                    stickySectionHeadersEnabled={true} // Keep headers visible while scrolling
                    keyboardShouldPersistTaps="handled" // Dismiss keyboard on tap outside input
                    ListEmptyComponent={ // Displayed when monthExists is true but list is empty (due to search or empty inventory)
                        <View style={styles.centered}>
                            <Ionicons
                                name={searchTerm ? "search-outline" : "file-tray-outline"}
                                size={40}
                                color={colors.textSecondary}
                                style={{ marginBottom: 15 }}
                            />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                {searchTerm
                                    ? 'Nenhum item encontrado.'
                                    : 'Inventário vazio para este mês.'}
                            </Text>
                            {searchTerm ? (
                                // Provide button to clear search if results are empty
                                <TouchableOpacity onPress={() => setSearchTerm('')}>
                                    <Text style={[styles.emptyText, { fontSize: 14, color: colors.primary, marginTop: 10 }]}>
                                        Limpar busca
                                    </Text>
                                </TouchableOpacity>
                            ) : (
                                // Message if inventory is empty and user can't import
                                !canManagePublications &&
                                <Text style={[styles.emptyText, { fontSize: 14, color: colors.textMuted, marginTop: 5 }]}>
                                    Contate o responsável pelas publicações.
                                </Text>
                            )}
                        </View>
                    }
                />
            )}

            {/* Import Modal */}
            {userData?.congregationId && ( // Only render modal if congregation ID exists
                <ImportPublicationsModal
                    isVisible={isImportModalVisible}
                    onClose={handleDismissImportModal}
                    onImportSuccess={handleImportSuccess} // Pass the success handler
                    congregationId={userData.congregationId}
                />
            )}
        </View>
    );
}

// --- Styles --- (Memoized in component for theme changes)
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      },
      infoText: {
        fontSize: 17,
        textAlign: "center",
        fontWeight: "500",
      },
      infoTextSmall: {
        fontSize: 14,
        textAlign: "center",
      },
    // Floating Action Buttons
    goButton: { // Insights/Analytics button
        position: 'absolute',
        bottom: 24, // Position higher than import button
        right: 12,
        width: 56,
        height: 56,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 10, // Ensure it's above list
    },
    addButton: { // Import button
        position: 'absolute',
        bottom: 92,
        right: 12,
        width: 56,
        height: 56,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        zIndex: 10,
    },
    // Month Navigator
    monthNavigator: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
    },
    navButton: {
        padding: 5, // Clickable area
    },
    monthText: {
        fontSize: 17,
        fontWeight: '600', // Slightly bolder
    },
    // Search Bar
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        height: 40, // Explicit height
    },
    clearButton: { // For Android clear search
        paddingLeft: 10,
    },
    // SectionList Styles
    listContent: {
        paddingBottom: 160, // More padding at bottom to avoid FAB overlap
        flexGrow: 1 // Allows ListEmptyComponent to fill space if list is short/empty
    },
    sectionHeaderContainer: { // Container for section header text
       paddingVertical: 8,
       paddingHorizontal: 15,
       // Background color set inline based on theme
    },
    sectionHeaderText: { // Text style for section header
        fontSize: 14,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    // Item Styles
    itemContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        // Background color set inline
    },
    itemInfo: {
        flex: 1, // Takes available space
        marginRight: 10,
    },
    itemDescription: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 2,
    },
    itemCode: {
        fontSize: 13,
        fontStyle: 'italic',
    },
    itemObservation: {
        fontSize: 12,
        fontStyle: 'italic',
        marginTop: 4,
    },
    itemQuantityContainer: {
        alignItems: 'flex-end', // Align quantity to the right
        minWidth: 50, // Minimum width for alignment
    },
    itemQuantity: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    itemQuantityLabel: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
    // Empty state text
    emptyText: {
        textAlign: 'center',
        fontSize: 16,
        paddingHorizontal: 20,
        color: colors.textSecondary, // Use theme color
    },
});