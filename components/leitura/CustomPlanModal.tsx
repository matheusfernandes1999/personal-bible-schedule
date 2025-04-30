// components/leitura/CustomPlanModal.tsx
import React, { useState, useEffect, useMemo } from 'react'; // Import useMemo
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getBookList, BookInfo, getTotalChapters } from '@/utils/bibleUtils'; // Import getTotalChapters
import { Ionicons } from '@expo/vector-icons';
import { CustomPlanModalProps } from '@/types'; // Adjust path if needed
import { showMessage } from 'react-native-flash-message';

export const CustomPlanModal: React.FC<CustomPlanModalProps> = ({
  visible,
  onClose,
  onCreatePlan,
  isLoading,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [chaptersPerDay, setChaptersPerDay] = useState<string>('1');
  const [selectedBookAbbrev, setSelectedBookAbbrev] = useState<string | null>(null);
  const [bookList, setBookList] = useState<BookInfo[]>([]);
  const [bookPickerVisible, setBookPickerVisible] = useState(false);
  const [totalBibleChapters, setTotalBibleChapters] = useState<number>(0); // Store total chapters

  useEffect(() => {
    const books = getBookList();
    setBookList(books);
    setTotalBibleChapters(getTotalChapters()); // Get total chapters on mount
    const genesis = books.find(b => b.abbrev === 'gn');
    if (genesis) {
      setSelectedBookAbbrev(genesis.abbrev);
    } else if (books.length > 0) {
      setSelectedBookAbbrev(books[0].abbrev);
    }
  }, []);

  // --- Calculation Logic with useMemo ---
  const estimatedTime = useMemo(() => {
    const chapters = parseInt(chaptersPerDay, 10);
    if (isNaN(chapters) || chapters <= 0 || totalBibleChapters <= 0) {
      return ''; // No estimate if input is invalid or total chapters not loaded
    }

    const totalDays = Math.ceil(totalBibleChapters / chapters);

    if (totalDays <= 45) { // Less than ~1.5 months, show days
        return `Estimativa: ~${totalDays} dia${totalDays > 1 ? 's' : ''}`;
    } else if (totalDays <= 365 * 1.5) { // Less than 1.5 years, show months
        const totalMonths = Math.round(totalDays / 30.4); // Approx months
        return `Estimativa: ~${totalMonths} ${totalMonths > 1 ? 'meses' : 'mês'}`;
    } else { // Show years
        const totalYears = (totalDays / 365.25);
        // Show one decimal place for years if not a whole number
        const yearsFormatted = totalYears % 1 === 0 ? totalYears.toFixed(0) : totalYears.toFixed(1);
        return `Estimativa: ~${yearsFormatted} ano${totalYears > 1 ? 's' : ''}`;
    }
  }, [chaptersPerDay, totalBibleChapters]); // Recalculate when these change

  // --- Handlers ---
  const handleCreate = () => {
    const chapters = parseInt(chaptersPerDay, 10);
     if (isNaN(chapters) || chapters <= 0) {
       showMessage({
         message: "Por favor, insira um número válido de capítulos por dia (maior que 0).",
         type: "warning",
         icon: "warning"
       });
       return;
     }
     if (!selectedBookAbbrev) {
       showMessage({
         message: "Por favor, selecione o livro inicial.",
         type: "warning",
         icon: "warning"
       });
       return;
     }
    onCreatePlan(chapters, selectedBookAbbrev);
  };

  const handleChaptersChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setChaptersPerDay(numericValue);
  };

  const selectedBookName = bookList.find(book => book.abbrev === selectedBookAbbrev)?.name || '';

  // --- Render ---
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPressOut={onClose} // Fecha ao clicar fora
      >
        {/* Previne fechar ao clicar dentro */}
        <TouchableOpacity activeOpacity={1} style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <ScrollView>
            <View style={styles.modalHeader}>
                 <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
             </View>
            {/* Título opcional */}
            <Text style={styles.modalTitle}>Personalizar Plano</Text>

            {/* Chapters per Day Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Capítulos por dia:</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                value={chaptersPerDay}
                onChangeText={handleChaptersChange}
                keyboardType="numeric"
                placeholder="Ex: 2"
                placeholderTextColor={colors.textSecondary}
                maxLength={3}
              />
               {/* --- Display Estimated Time --- */}
               {estimatedTime && (
                   <Text style={styles.estimateText}>{estimatedTime}</Text>
               )}
            </View>

            {/* Starting Book Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Começar a ler em:</Text>
              <TouchableOpacity
                style={[styles.selectButton, { borderColor: colors.border, backgroundColor: colors.backgroundPrimary }]}
                onPress={() => setBookPickerVisible(true)}
              >
                <Text style={[styles.selectButtonText, { color: selectedBookName ? colors.textPrimary : colors.textSecondary }]}>
                  {selectedBookName || 'Selecione um livro'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: isLoading ? colors.buttonDisabledBackground : colors.primary }]}
              onPress={handleCreate}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.createButtonText}>Criar Plano</Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Book Picker Modal (Nested) */}
          <Modal
            visible={bookPickerVisible}
            transparent
            animationType="fade" // 'fade' or 'slide' might look better
            onRequestClose={() => setBookPickerVisible(false)}
          >
            <TouchableOpacity style={styles.bookPickerOverlay} onPressOut={() => setBookPickerVisible(false)}>
              <TouchableOpacity activeOpacity={1} style={[styles.bookPickerContainer, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={styles.title}>Livros</Text>
                <FlatList
                  data={bookList}
                  keyExtractor={(item) => item.abbrev}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.bookItem}
                      onPress={() => {
                        setSelectedBookAbbrev(item.abbrev);
                        setBookPickerVisible(false);
                      }}
                    >
                      <Text style={{ color: colors.textPrimary }}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          </Modal>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  title: {
    fontSize: 18, // Slightly larger title
    fontWeight: '600', // Semibold
    color: colors.textPrimary,
    marginBottom: 14,
    textAlign: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.backgroundModalScrim,
  },
  modalContentContainer: {
    maxHeight: '60%',
    width: '100%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
  },
  modalHeader: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8 // Adjust vertical padding if needed
  },
   modalHandle: {
     width: 40,
     height: 5,
     borderRadius: 4,
   },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 44,
  },
  // --- Style for Estimate Text ---
  estimateText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6, // Space above the estimate text
    textAlign: 'right', // Align to the right below input
  },
  // --- Styles for Book Selector ---
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10, // Adjusted padding
    minHeight: 44,
  },
  selectButtonText: {
      fontSize: 16, // Match input font size
  },
  // --- Create Button ---
  createButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10, // Space above button
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.white,
  },
  // --- Styles for Book Picker Modal ---
  bookPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', // Darker overlay for picker
    justifyContent: 'center',
    alignItems: 'center', // Center the picker container
    paddingHorizontal: 30, // Add horizontal padding
  },
  bookPickerContainer: {
    borderRadius: 12,
    width: '100%', // Take full width within padding
    maxHeight: '70%', // Increase max height
    paddingVertical: 10, // Vertical padding inside container
    paddingHorizontal: 8, // Horizontal padding inside container
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  bookItem: {
    paddingVertical: 15, // Increase touch area
    paddingHorizontal: 15, // Add horizontal padding to item
    borderBottomWidth: StyleSheet.hairlineWidth, // Subtle separator
    borderBottomColor: colors.border,
  },
  pickerCloseButton: { // Optional close button style
      marginTop: 10,
      padding: 10,
      alignItems: 'center',
  }
});