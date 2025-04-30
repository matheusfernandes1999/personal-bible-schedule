// components/publicacoes/ImportPublicationsModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal,
    TouchableWithoutFeedback, KeyboardAvoidingView, Platform, Dimensions, ScrollView, Linking
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { showMessage } from 'react-native-flash-message';
// Firestore imports
import { collection, doc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// Types and Constants
import { PublicationItem, PUBLICATION_CATEGORY_TRANSLATIONS } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Papa from 'papaparse'; // CSV parsing library

// --- Interfaces ---
interface ImportPublicationsModalProps {
    isVisible: boolean;
    onClose: () => void;
    onImportSuccess: (importedMonthId: string) => void; // Callback returns "YYYY-MM" ID
    congregationId: string;
}

// Interface for expected CSV row structure (case-insensitive after normalization)
interface CSVRow {
    categoria?: string;
    codigo_item?: string;
    descricao_item?: string;
    quantidade_atual?: string;
    movimento_medio_mensal?: string;
    observacao_movimento?: string;
    month?: string; // Expected format: "Month Year" (e.g., "Abril 2025")
    // Allow other potential keys from PapaParse
    [key: string]: string | undefined;
}
// components/publicacoes/ImportPublicationsModal.tsx

// --- Imports e outras partes do arquivo ... ---

// --- Helper Function APRIMORADA ---

// Mapeamento de nomes de meses (minúsculos) para índice numérico (0-11)
const monthNameToIndex: { [key: string]: number } = {
    // Inglês
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
    // Português (adicionar variações se necessário)
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'marco': 2, /* comum sem cedilha */ 'abril': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11
};

// Converte "Month Year" string (e.g., "Abril 2025", "March 2025") para "YYYY-MM" format
const getMonthIdFromString = (monthYearString: string | null): string | null => {
    if (!monthYearString || typeof monthYearString !== 'string') {
        console.log("[getMonthIdFromString] Input is null or not a string.");
        return null;
    }
    const trimmedInput = monthYearString.trim();
    if (!trimmedInput) {
        console.log("[getMonthIdFromString] Input is empty after trimming.");
        return null;
    }

    // Separa o mês e o ano (permitindo múltiplos espaços como separador)
    const parts = trimmedInput.toLowerCase().split(/[\s]+/);
    if (parts.length !== 2) {
        console.warn(`[getMonthIdFromString] Unexpected format (expected 'Month Year'):`, trimmedInput);
        return null; // Formato não esperado
    }

    const monthPart = parts[0];
    const yearPart = parts[1];
    const year = parseInt(yearPart, 10);

    // Busca o índice do mês no mapeamento (case-insensitive devido ao .toLowerCase() acima)
    let monthIndex = -1;
    if (monthNameToIndex.hasOwnProperty(monthPart)) {
        monthIndex = monthNameToIndex[monthPart];
    }

    // Valida se o ano e o mês foram parseados corretamente
    if (!isNaN(year) && year > 1900 && year < 2100 && monthIndex !== -1) {
        // Constrói a data usando números (mais confiável) - Dia é sempre 1
        try {
            // Nota: monthIndex é 0-11, que é o esperado pelo construtor Date
            const date = new Date(year, monthIndex, 1);

            // Verificação extra (não deveria falhar com números válidos)
            if (isNaN(date.getTime())) {
                console.error(`[getMonthIdFromString] Failed to create date even with numbers: Year=${year}, MonthIndex=${monthIndex}`);
                return null;
            }

            // Formata para YYYY-MM
            // Usamos getMonth() do objeto Date criado para garantir consistência
            const formattedMonth = (date.getMonth() + 1).toString().padStart(2, '0');
            const formattedYear = date.getFullYear(); // Usar o ano do objeto Date
            return `${formattedYear}-${formattedMonth}`;

        } catch (e) {
            console.error(`[getMonthIdFromString] Error creating/formatting date: Year=${year}, MonthIndex=${monthIndex}`, e);
            return null;
        }
    } else {
        // Falha ao parsear ano ou encontrar índice do mês
        console.warn(`[getMonthIdFromString] Could not parse month or year from input '${trimmedInput}'. Details: MonthPart='${monthPart}', YearPart='${yearPart}' (Parsed: Year=${year}, MonthIndex=${monthIndex})`);
        return null;
    }
};

// --- Restante do componente ImportPublicationsModal ... ---

// export default ImportPublicationsModal; // <- Fim do arquivo

// --- Modal Component ---
const ImportPublicationsModal: React.FC<ImportPublicationsModalProps> = ({
    isVisible,
    onClose,
    onImportSuccess,
    congregationId,
}) => {
    const { colors } = useTheme();
    const { user } = useAuth(); // Get current user for logging import
    const styles = createStyles(colors);

    // --- State Variables ---
    const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [parsedItems, setParsedItems] = useState<PublicationItem[]>([]); // Valid items parsed from CSV
    const [importedMonthDisplay, setImportedMonthDisplay] = useState<string | null>(null); // "Abril 2025" (for display)
    const [importedMonthId, setImportedMonthId] = useState<string | null>(null); // "2025-04" (for Firestore path/ID)

    // Reset state when modal visibility changes (especially when closing)
    useEffect(() => {
        if (!isVisible) {
            setSelectedFile(null);
            setIsParsing(false);
            setIsUploading(false);
            setParsedItems([]);
            setImportedMonthDisplay(null);
            setImportedMonthId(null);
        }
    }, [isVisible]);

    // --- File Selection Logic ---
    const handlePickDocument = useCallback(async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['text/csv', 'text/comma-separated-values', 'application/csv'], // Specific MIME types for CSV
                copyToCacheDirectory: true, // Required on some platforms to read the file
            });

            console.log("[ImportModal] Document Picker result:", JSON.stringify(result, null, 2));

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];

                // Basic validation: Check file extension (optional but helpful)
                if (asset.name && !asset.name.toLowerCase().endsWith('.csv')) {
                     showMessage({ message: "Tipo de Arquivo Inválido", description: "Por favor, selecione um arquivo .csv.", type: "warning", duration: 4000 });
                     return;
                }

                // Check MIME type (more reliable)
                 const validMimeTypes = ['text/csv', 'text/comma-separated-values', 'application/csv', 'application/vnd.ms-excel']; // Include common variants
                 if (asset.mimeType && !validMimeTypes.includes(asset.mimeType)) {
                     console.warn(`[ImportModal] Unexpected MIME type: ${asset.mimeType}. Allowing for now.`);
                     // Optionally show warning: showMessage({...})
                 }

                setSelectedFile(asset);
                setParsedItems([]); // Clear previous results
                setImportedMonthDisplay(null);
                setImportedMonthId(null);
                console.log("[ImportModal] File selected:", asset.name);
            } else {
                console.log("[ImportModal] File selection cancelled or no assets found.");
                setSelectedFile(null);
            }
        } catch (error: any) {
            console.error("[ImportModal] Error picking document:", error);
            showMessage({ message: "Erro ao Selecionar", description: `Não foi possível selecionar o arquivo: ${error.message}`, type: "danger" });
            setSelectedFile(null);
        }
    }, []);

    // --- CSV Parsing Logic ---
    const handleParseCSV = useCallback(async () => {
        if (!selectedFile || !selectedFile.uri) {
            showMessage({ message: "Nenhum Arquivo", description: "Selecione um arquivo CSV primeiro.", type: "warning" });
            return;
        }
        setIsParsing(true);
        setParsedItems([]);
        setImportedMonthDisplay(null);
        setImportedMonthId(null);

        try {
            // Fetch the CSV content from the selected file URI
            const response = await fetch(selectedFile.uri);
            const csvString = await response.text();
            console.log("[ImportModal] CSV content fetched (first 300 chars):", csvString.substring(0, 300));

            // Use PapaParse to parse the CSV string
            Papa.parse<CSVRow>(csvString, {
                header: true,           // Treat the first row as headers
                skipEmptyLines: true,   // Ignore empty lines
                encoding: "UTF-8",      // Assume UTF-8 encoding (common)
                transformHeader: header => header.trim().toLowerCase().replace(/\s+/g, '_'), // Normalize headers (lowercase, underscore spaces)
                complete: (results) => { // Callback on successful parsing
                    console.log(`[ImportModal] PapaParse complete. ${results.data.length} rows found.`);
                    console.log("[ImportModal] Detected headers (normalized):", results.meta.fields);

                    // Check for parsing errors reported by PapaParse
                    if (results.errors.length > 0) {
                        console.error("[ImportModal] PapaParse errors:", results.errors);
                        const firstError = results.errors[0];
                       
                        setIsParsing(false);
                        return;
                    }

                    // Validate required headers after normalization
                    const expectedHeaders = ['codigo_item', 'descricao_item', 'month']; // Minimum required headers
                    const actualHeaders = results.meta.fields ?? [];
                    const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));

                    if (missingHeaders.length > 0) {
                        showMessage({
                           message: "Cabeçalho Inválido",
                           description: `Coluna(s) faltando no CSV: ${missingHeaders.join(', ')}. Verifique o arquivo.`,
                           type: "danger",
                           duration: 7000
                        });
                        setIsParsing(false);
                        return;
                    }
                     // Optional: Check for other headers like 'categoria', 'quantidade_atual' etc. and warn if missing

                    // Process the parsed data rows
                    processParsedData(results.data as CSVRow[]); // Cast to CSVRow[]
                },
                error: (error: Error) => { // Callback on critical parsing error
                    console.error("[ImportModal] PapaParse critical error:", error);
                    showMessage({ message: "Erro ao Ler Arquivo", description: `Falha ao processar CSV: ${error.message}`, type: "danger" });
                    setIsParsing(false);
                }
            });

        } catch (error: any) {
            console.error("[ImportModal] Error fetching or parsing CSV:", error);
            showMessage({ message: "Erro de Processamento", description: `Falha ao ler arquivo: ${error.message}`, type: "danger" });
            setIsParsing(false);
        }
    }, [selectedFile]); // Dependency: selectedFile

    // --- Data Processing Logic (after parsing) ---
    const processParsedData = useCallback((data: CSVRow[]) => {
        const items: PublicationItem[] = [];
        let processingErrors = 0;
        let currentCategory = 'Sem Categoria'; // Default category
        let detectedMonthStr: string | null = null; // e.g., "Abril 2025"
        let determinedMonthId: string | null = null; // e.g., "2025-04"

        console.log("[ImportModal] Starting processing of parsed data...");

        data.forEach((row, index) => {
             // Row already has normalized keys from PapaParse transformHeader
            const {
                categoria, codigo_item, descricao_item, quantidade_atual,
                movimento_medio_mensal, observacao_movimento, month
            } = row;

            // 1. Detect Month (use the first valid one found)
            if (month && !determinedMonthId) {
                const potentialMonthId = getMonthIdFromString(month);
                if (potentialMonthId) {
                    determinedMonthId = potentialMonthId;
                    detectedMonthStr = month.trim(); // Store original display month
                    console.log(`[ImportModal] Month ID ${determinedMonthId} ('${detectedMonthStr}') detected at row ${index + 1}`);
                } else {
                     console.warn(`[ImportModal] Row ${index + 1}: Invalid month format '${month}'. Ignoring for month detection.`);
                }
            }

            // 2. Detect Category Row (specific format: category in first col, maybe repeated in description, no code)
            // Adjust this logic based on the exact format of category rows in the CSV
            if (categoria && (!codigo_item || codigo_item.length === 0) && descricao_item === categoria) {
                 currentCategory = categoria.trim() || 'Sem Categoria';
                 console.log(`[ImportModal] Category set to '${currentCategory}' at row ${index + 1}`);
                 return; // Skip to next row, this is just a category header
            }

            // 3. Process Item Row (must have code, description, and month must be determined)
            if (codigo_item && descricao_item && determinedMonthId) {
                // Clean and parse numeric values
                const cleanedQuantity = quantidade_atual?.replace(',', '.');
                const cleanedMovement = movimento_medio_mensal?.replace(',', '.');

                const quantity = cleanedQuantity ? parseInt(cleanedQuantity, 10) : null;
                const movement = cleanedMovement ? parseFloat(cleanedMovement) : null;

                // Translate category using imported mapping
                const categoryPT = PUBLICATION_CATEGORY_TRANSLATIONS[currentCategory] || currentCategory;

                const item: PublicationItem = {
                    itemCode: codigo_item.trim(),
                    description: descricao_item.trim(),
                    category: currentCategory, // Store original category name
                    categoryPT: categoryPT, // Store translated category name
                    // 'month' (display format) is no longer stored in the item document itself
                    currentQuantity: !isNaN(quantity!) ? quantity : 0, // Default to 0 if parsing fails or empty
                    monthlyMovement: !isNaN(movement!) ? movement : null, // Keep null if parsing fails or empty
                    movementObservation: observacao_movimento?.trim() || null,
                };
                items.push(item);
            } else if (codigo_item && descricao_item && !determinedMonthId) {
                // Item found before month was determined (might happen if month column is later)
                // These items will be processed once month is found. No error here yet.
                // console.log(`[ImportModal] Row ${index + 1}: Item ${codigo_item} found, waiting for month definition.`);
            } else {
                // Row is not a category header or a valid item (or month not yet found)
                 // Log as warning only if the row contains *some* potentially relevant data
                 if (codigo_item || descricao_item || categoria || quantidade_atual || movimento_medio_mensal || month) {
                     console.warn(`[ImportModal] Row ${index + 1}: Skipped. Unexpected format or required field missing (Code: ${codigo_item}, Desc: ${descricao_item}, Month Found: ${!!determinedMonthId}). Data:`, row);
                     processingErrors++;
                 }
            }
        });

        console.log(`[ImportModal] Data processing finished. ${items.length} valid items found.`);

        // --- Final Validation and State Update ---
        if (!determinedMonthId) {
            showMessage({ message: "Mês Não Encontrado", description: "Não foi possível encontrar uma coluna 'month' válida no formato 'Mês Ano' (ex: Abril 2025).", type: "danger", duration: 7000 });
            setIsParsing(false);
            return;
        }
        if (items.length === 0) {
            showMessage({ message: "Nenhum Item Válido", description: `Nenhum item de publicação válido encontrado para ${detectedMonthStr}. Verifique o formato do CSV.`, type: "warning", duration: 6000 });
            setIsParsing(false);
            return;
        }

        // Success: Update state with processed data
        setParsedItems(items);
        setImportedMonthDisplay(detectedMonthStr); // For display in UI
        setImportedMonthId(determinedMonthId);   // For Firestore path & callback
        showMessage({
           message: "Arquivo Processado",
           description: `${items.length} itens encontrados para ${detectedMonthStr}. Pronto para importar.`,
           type: "info"
        });
        if (processingErrors > 0) {
            showMessage({ message: "Atenção", description: `${processingErrors} linha(s) foram ignoradas (formato inválido). Veja console.`, type: "warning", duration: 5000 });
        }
        setIsParsing(false); // Finished parsing
    }, []); // No external dependencies

    // --- Firestore Upload Logic ---
    const handleUploadToFirestore = useCallback(async () => {
        // Ensure we have data and context
        if (parsedItems.length === 0 || !importedMonthId) {
            showMessage({ message: "Dados Inválidos", description: "Processe um arquivo CSV válido primeiro.", type: "warning" });
            return;
        }
        if (!user || !congregationId) {
            showMessage({ message: "Erro de Contexto", description: "Usuário ou congregação não identificados.", type: "danger" });
            return;
        }

        setIsUploading(true); // Start upload indicator
        console.log(`[ImportModal] Starting Firestore upload for month ${importedMonthId}...`);

        try {
            const batch = writeBatch(db); // Create a Firestore batch write operation

            // --- Define Firestore Paths ---
            // 1. Path to the document representing the month itself (for metadata)
            const monthDocRef = doc(db, "congregations", congregationId, "publications", importedMonthId);
            // 2. Path to the subcollection holding the inventory items for this month
            const monthItemsColRef = collection(monthDocRef, "items");

            // --- Add operations to the batch ---
            // A. Set/Update metadata for the month document
            batch.set(monthDocRef, {
                monthDisplay: importedMonthDisplay, // Store "Abril 2025"
                lastImportTimestamp: serverTimestamp(), // Timestamp of this import
                importedByUid: user.uid,             // Record who imported
                itemCount: parsedItems.length       // Number of items in this import
            }, { merge: true }); // Use merge:true to create or update without overwriting unrelated fields

            // B. Add each parsed item to the 'items' subcollection
            let itemsAddedToBatch = 0;
            parsedItems.forEach(item => {
                // Ensure itemCode is a valid string to be used as document ID
                if (item.itemCode && typeof item.itemCode === 'string' && item.itemCode.length > 0) {
                    // Create a reference to the specific item document using itemCode as ID
                    const itemDocRef = doc(monthItemsColRef, item.itemCode);
                    const dataToSave = {
                        ...item, // Spread all fields from the processed item
                        lastUpdated: serverTimestamp(), // Add/Update timestamp for this specific item
                        // 'monthId' (YYYY-MM) is implicitly defined by the collection path
                    };
                    // Add a set operation to the batch (creates if new, overwrites if exists)
                    batch.set(itemDocRef, dataToSave, { merge: true }); // Merge is good practice here too
                    itemsAddedToBatch++;
                } else {
                    console.warn("[ImportModal] Item skipped during upload due to invalid itemCode:", item);
                }
            });

            console.log(`[ImportModal] Added ${itemsAddedToBatch} items to batch for month ${importedMonthId}.`);

            // --- Commit the batch ---
            await batch.commit(); // Atomically execute all operations in the batch
            console.log(`[ImportModal] Firestore batch commit successful for ${importedMonthId}.`);

            showMessage({
               message: "Importação Concluída!",
               description: `Inventário de ${importedMonthDisplay} importado/atualizado com ${itemsAddedToBatch} itens.`,
               type: "success"
            });
            onImportSuccess(importedMonthId); // Trigger callback with "YYYY-MM" ID
            onClose(); // Close the modal automatically on success

        } catch (error: any) {
            console.error("[ImportModal] Error uploading to Firestore:", error);
            showMessage({ message: "Erro no Upload", description: `Falha ao salvar dados no servidor: ${error.message}`, type: "danger" });
        } finally {
            setIsUploading(false); // Stop upload indicator regardless of success/failure
        }
    }, [parsedItems, importedMonthId, importedMonthDisplay, user, congregationId, onImportSuccess, onClose]);

    // --- Render Logic ---
    const isLoading = isParsing || isUploading; // Combined loading state

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose} // For Android back button
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"} // Adjust keyboard behavior
                style={styles.modalContainer}
            >
                {/* Overlay to dismiss modal on tap */}
                <TouchableWithoutFeedback onPress={onClose} disabled={isLoading}>
                    <View style={styles.modalOverlay} />
                </TouchableWithoutFeedback>

                {/* Modal Content */}
                <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    {/* Handle and Title */}
                    <View style={styles.modalHeader}>
                        <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
                    </View>
                    <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Importar Inventário (CSV)</Text>

                    {/* Scrollable Form Area */}
                    <ScrollView style={styles.formScrollView} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
                        {/* Instructions */}
                        <Text style={[styles.instructions, { color: colors.textSecondary }]}>
                            1. Selecione o arquivo <Text style={styles.bold}>CSV</Text> exportado do sistema.
                        </Text>
                         <Text style={[styles.instructions, { color: colors.textSecondary, marginTop: -10, marginBottom: 20 }]}>
                             2. Verifique se ele contém as colunas: <Text style={styles.bold}>Categoria, Codigo_Item, Descricao_Item, Quantidade_Atual, Movimento_Medio_Mensal, Observacao_Movimento, Month</Text> (com o mês no formato "Mês Ano", ex: <Text style={styles.bold}>Abril 2025</Text>).
                         </Text>

                        {/* File Selection Button */}
                        <TouchableOpacity
                            style={[
                                styles.selectButton,
                                { borderColor: colors.border, backgroundColor: colors.backgroundPrimary }
                            ]}
                            onPress={handlePickDocument}
                            disabled={isLoading}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="document-attach-outline" size={22} color={colors.primary} style={{ marginRight: 10 }} />
                            <Text style={[styles.selectButtonText, { color: selectedFile ? colors.textPrimary : colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">
                                {selectedFile ? selectedFile.name : 'Selecionar Arquivo CSV'}
                            </Text>
                            {/* Clear selection button */}
                            {selectedFile && !isLoading && (
                                <TouchableOpacity
                                   onPress={() => { setSelectedFile(null); setParsedItems([]); setImportedMonthId(null); setImportedMonthDisplay(null); }}
                                   style={styles.clearSelectionButton}
                                   hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} // Increase tap area
                                >
                                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                                </TouchableOpacity>
                            )}
                            {/* Loading indicator during selection (rarely needed, but possible) */}
                            {isLoading && !isUploading && <ActivityIndicator size="small" color={colors.textMuted} style={{ marginLeft: 10 }} />}
                        </TouchableOpacity>

                        {/* Process File Button (Visible only if file selected and not yet processed) */}
                        {selectedFile && !parsedItems.length && !importedMonthId && (
                            <TouchableOpacity
                                style={[styles.actionButton, { backgroundColor: isLoading ? colors.backgroundSecondary : colors.secondary }]}
                                onPress={handleParseCSV}
                                disabled={isLoading || isParsing}
                                activeOpacity={0.7}
                            >
                                {isParsing ? <ActivityIndicator color={colors.white} />
                                    : <Text style={[styles.actionButtonText, { color: colors.white }]}>Verificar Arquivo</Text>}
                            </TouchableOpacity>
                        )}

                        {/* Processing Feedback (Visible after successful parsing) */}
                        {parsedItems.length > 0 && importedMonthDisplay && (
                            <View style={[styles.summaryContainer, { borderColor: colors.success, backgroundColor: colors.backgroundPrimary }]}>
                                <Ionicons name="checkmark-circle-outline" size={24} color={colors.success} style={{ marginRight: 10 }} />
                                <Text style={[styles.summaryText, { color: colors.success }]}>
                                    {`${parsedItems.length} itens para ${importedMonthDisplay} prontos.`}
                                </Text>
                            </View>
                        )}

                        {/* Upload Button (Visible only after successful parsing) */}
                        {parsedItems.length > 0 && importedMonthId && (
                            <TouchableOpacity
                                style={[styles.modalButton, { backgroundColor: isLoading ? colors.backgroundSecondary : colors.primary }]}
                                onPress={handleUploadToFirestore}
                                disabled={isLoading || isUploading}
                                activeOpacity={0.7}
                            >
                                {isUploading ? (<ActivityIndicator size="small" color={colors.white} />)
                                    : (<Text style={[styles.modalButtonText, { color: colors.white }]}>Importar para o Inventário</Text>)}
                            </TouchableOpacity>
                        )}

                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// --- Styles --- (Using Dimensions for responsive height)
const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end', // Aligns modal to bottom
    },
    modalOverlay: {
        ...StyleSheet.absoluteFillObject, // Covers entire screen
        backgroundColor: 'rgba(0, 0, 0, 0.5)', // Semi-transparent background
    },
    modalContentContainer: {
        width: '100%',
        maxHeight: screenHeight * 0.8, // Limit modal height to 80% of screen
        borderTopRightRadius: 20,
        borderTopLeftRadius: 20,
        overflow: 'hidden', // Ensures content stays within rounded corners
    },
    modalHeader: {
        width: '100%',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 5,
        backgroundColor: colors.backgroundSecondary, // Match content background
        borderTopRightRadius: 20, // Keep rounding consistent
        borderTopLeftRadius: 20,
    },
    modalHandle: { // Small draggable handle indicator
        width: 40,
        height: 5,
        borderRadius: 4,
        backgroundColor: colors.textMuted, // Use theme color
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
        paddingHorizontal: 24,
        paddingTop: 5,
        backgroundColor: colors.backgroundSecondary, // Match content background
    },
    formScrollView: {
        width: '100%',
        backgroundColor: colors.backgroundSecondary, // Match content background
    },
    formContent: {
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 30, // Extra padding at bottom
    },
    instructions: {
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 10, // Space between instruction lines
        textAlign: 'left',
        color: colors.textSecondary,
    },
    bold: {
        fontWeight: 'bold',
        color: colors.textPrimary, // Slightly emphasize bold text
    },
    selectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 15,
        marginBottom: 15,
    },
    selectButtonText: {
        flex: 1, // Allow text to take available space
        fontSize: 16,
        marginRight: 5,
        color: colors.textSecondary, // Default color
    },
    clearSelectionButton: {
        paddingLeft: 10, // Space before the 'x' icon
    },
    actionButton: { // Process/Verify button
        paddingVertical: 14, // Make button slightly larger
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 15,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.white, // Use theme color for text on secondary button
    },
    summaryContainer: { // Feedback after parsing
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
        borderWidth: 1,
    },
    summaryText: {
        marginLeft: 0, // Icon has margin now
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center', // Center text
        flexShrink: 1, // Allow text to wrap if needed
    },
    modalButton: { // Final Import button
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginTop: 5,
    },
    modalButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: colors.white, // Use theme color for text on primary button
    },
});

export default ImportPublicationsModal;