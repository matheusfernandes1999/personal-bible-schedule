// components/common/ConfirmationModal.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons'; // Opcional: para ícones

interface ConfirmationModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isConfirming?: boolean;
  confirmButtonStyle?: 'default' | 'destructive';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isVisible,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isConfirming = false,
  confirmButtonStyle = 'default',
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors, confirmButtonStyle);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContentContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHandle, { backgroundColor: colors.textMuted }]} />
          </View>

          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            {title}
          </Text>

          <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
            {message}
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={isConfirming}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText, { color: colors.textSecondary }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                confirmButtonStyle === 'destructive' ? styles.destructiveButton : styles.defaultConfirmButton,
                { opacity: isConfirming ? 0.7 : 1 }
              ]}
              onPress={onConfirm}
              disabled={isConfirming}
            >
              {isConfirming ? (
                <ActivityIndicator size="small" color={confirmButtonStyle === 'destructive' ? colors.white : colors.textOnPrimary} />
              ) : (
                <Text style={[
                    styles.buttonText,
                    styles.confirmButtonText,
                    confirmButtonStyle === 'destructive' ? styles.destructiveButtonText : styles.defaultConfirmButtonText 
                ]}>
                  {confirmText}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const screenHeight = Dimensions.get('window').height;
const createStyles = (colors: ReturnType<typeof useTheme>['colors'], confirmButtonStyle: 'default' | 'destructive') => StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: { 
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContentContainer: { // Conteúdo visível do modal
    width: '100%',
    minHeight: screenHeight * 0.25, // Altura mínima
    maxHeight: screenHeight * 0.4, // Altura máxima
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 30, // Espaço seguro na parte inferior
    paddingTop: 10,
    alignItems: 'center', // Centraliza conteúdo horizontalmente
    elevation: 5, // Sombra Android
    shadowColor: '#000', // Sombra iOS
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modalHeader: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 15,
  },
  modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 25, // Espaço antes dos botões
    lineHeight: 22, // Melhora legibilidade
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between', // Espaça os botões
    width: '100%',
  },
  button: {
    flex: 1, // Faz os botões dividirem o espaço
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 5, // Espaço entre os botões
  },
  cancelButton: {
    backgroundColor: colors.backgroundPrimary, // Fundo claro/cinza
    borderWidth: 1,
  },
  confirmButton: {
    // Estilos base do botão confirmar (cor de fundo definida abaixo)
  },
  defaultConfirmButton: {
      backgroundColor: colors.primary, // Cor primária padrão
  },
  destructiveButton: {
      backgroundColor: colors.error, // Cor de erro para destrutivo
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    // Cor definida inline
  },
  confirmButtonText: {
     // Cor definida abaixo
  },
  defaultConfirmButtonText: {
      color: colors.textOnPrimary, // Branco no fundo primário
  },
  destructiveButtonText: {
      color: colors.white, // Branco no fundo de erro
  },
});

export default ConfirmationModal;
