// components/fieldservice/TimerConfirmationModal.tsx
import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Optional: for icons
import { useTheme } from '@/context/ThemeContext'; // Import useTheme if needed directly, or receive colors as prop

interface TimerConfirmationModalProps {
    isVisible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    timeToAdd: number | null;
    colors: ReturnType<typeof useTheme>['colors']; // Receive colors as prop
}

// Function to format hours for display in the modal
const formatHoursForDisplay = (hours: number | null): string => {
    if (hours === null || hours <= 0) return "0.0";
    return hours.toFixed(2); // Show two decimal places for better precision
}

export const TimerConfirmationModal: React.FC<TimerConfirmationModalProps> = ({
    isVisible,
    onClose,
    onConfirm,
    timeToAdd,
    colors // Use colors from props
}) => {
    // You could create styles dynamically based on colors prop if needed,
    // but passing colors to basic style definitions is also fine.
    const styles = createStyles(colors);

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={isVisible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                         <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <Ionicons name="timer-outline" size={40} color={colors.primary} style={styles.modalIcon} />

                    <Text style={styles.modalTitle}>Confirmar Tempo</Text>
                    <Text style={styles.modalText}>
                        Deseja adicionar{' '}
                        <Text style={styles.timeHighlight}>
                            {formatHoursForDisplay(timeToAdd)} hora(s)
                        </Text>
                         {' '}ao seu relatório deste mês?
                    </Text>

                    <View style={styles.buttonContainer}>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonCancel]}
                            onPress={onClose}
                        >
                            <Text style={[styles.buttonText, styles.buttonTextCancel]}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.button, styles.buttonConfirm]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.buttonText, styles.buttonTextConfirm]}>Confirmar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// Define styles within the component or import from a separate file
const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
     centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dim background
    },
    modalView: {
        margin: 20,
        backgroundColor: colors.backgroundSecondary, // Use theme color
        borderRadius: 15,
        padding: 25, // Increased padding
        paddingTop: 40, // More padding top for close button space
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '85%', // Control modal width
        position: 'relative', // Needed for absolute positioning of close button
    },
    closeButton: {
         position: 'absolute',
         top: 10,
         right: 10,
         padding: 5, // Hit area
    },
    modalIcon: {
        marginBottom: 15,
    },
     modalTitle: {
         marginBottom: 8,
         textAlign: 'center',
         fontSize: 18,
         fontWeight: 'bold',
         color: colors.textPrimary, // Use theme color
     },
     modalText: {
         marginBottom: 25,
         textAlign: 'center',
         fontSize: 16,
         lineHeight: 22, // Improve readability
         color: colors.textSecondary, // Use theme color
     },
     timeHighlight: {
         fontWeight: 'bold',
         color: colors.primary, // Use theme color
         fontSize: 17, // Slightly larger
     },
     buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between', // Space out buttons
         width: '100%', // Make container take full width
         marginTop: 10,
    },
    button: {
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        elevation: 2,
         flex: 1, // Make buttons share space
         marginHorizontal: 5, // Add space between buttons
         alignItems: 'center', // Center text
    },
    buttonCancel: {
         backgroundColor: colors.backgroundPrimary, // Use theme color
         borderWidth: 1,
         borderColor: colors.border,
    },
    buttonConfirm: {
         backgroundColor: colors.primary, // Use theme color
    },
     buttonText: {
         fontWeight: 'bold',
         fontSize: 15,
     },
     buttonTextCancel: {
         color: colors.textSecondary, // Use theme color
     },
     buttonTextConfirm: {
        color: colors.white, // Or appropriate contrast color from theme
     },
});