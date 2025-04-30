// src/components/fieldservice/RoleSelectionModal.tsx
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/context/ThemeContext';

// Reutiliza o tipo definido na tela principal ou define aqui
type FieldServiceRole = 'pioneer_regular' | 'pioneer_auxiliary' | 'publisher' | 'unknown';

interface RoleSelectionModalProps {
    isVisible: boolean;
    onClose: () => void;
    currentRole: FieldServiceRole;
    onSelectRole: (role: FieldServiceRole) => void;
}

// Mapeamento para exibição
const roleOptions: { value: FieldServiceRole; label: string }[] = [
    { value: 'pioneer_regular', label: 'Pioneiro Regular' },
    { value: 'pioneer_auxiliary', label: 'Pioneiro Auxiliar' },
    { value: 'publisher', label: 'Publicador' },
];

export const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({
    isVisible,
    onClose,
    currentRole,
    onSelectRole,
}) => {
    const { colors } = useTheme();
    const styles = createStyles(colors);

    const handleSelection = (roleValue: FieldServiceRole) => {
        onSelectRole(roleValue);
        // onClose(); // O handler onSelectRole já fecha o modal no componente pai
    };

    return (
        <Modal
            transparent
            animationType="slide"
            visible={isVisible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                {/* Usar SafeAreaView para evitar notch/barra inferior */}
                <SafeAreaView style={styles.safeAreaContainer} >
                     {/* Prevenir que o clique no conteúdo feche o modal */}
                    <TouchableOpacity activeOpacity={1} style={styles.contentContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Selecionar Designação</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={28} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {roleOptions.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={[
                                    styles.optionButton,
                                    option.value === currentRole && styles.optionButtonSelected // Estilo selecionado
                                ]}
                                onPress={() => handleSelection(option.value)}
                                disabled={option.value === currentRole} // Desabilita a opção atual
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        option.value === currentRole && styles.optionTextSelected
                                    ]}
                                >
                                    {option.label}
                                </Text>
                                {option.value === currentRole && (
                                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </TouchableOpacity>
                </SafeAreaView>
            </TouchableOpacity>
        </Modal>
    );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end', // Alinha na parte inferior
        backgroundColor: colors.backgroundModalScrim,
    },
    safeAreaContainer: {
        // Garante que o conteúdo não fique atrás das barras do sistema na parte inferior
    },
    contentContainer: {
        backgroundColor: colors.backgroundSecondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 15,
        paddingBottom: 10, // Menor padding inferior pois SafeAreaView pode adicionar mais
        paddingHorizontal: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
        marginLeft: 10, // Pequeno espaço à esquerda
    },
    closeButton: {
        padding: 5,
    },
    optionButton: {
        paddingVertical: 18,
        paddingHorizontal: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    optionButtonSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primary + '15', // Fundo leve para selecionado
    },
    optionText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    optionTextSelected: {
        fontWeight: 'bold',
        color: colors.primary,
    },
});