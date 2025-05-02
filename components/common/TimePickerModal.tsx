import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
} from 'react-native';

export interface TimePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (hour: number, minute: number) => void;
  initialHour: number;
  initialMinute: number;
  colors: {
    primary: string;
    textPrimary: string;
    textSecondary: string;
    backgroundPrimary: string;
    backgroundSecondary: string;
    border: string;
    white: string;
  };
}

// Generate arrays for picker
const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = Array.from({ length: 60 }, (_, i) => i);

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isVisible,
  onClose,
  onConfirm,
  initialHour,
  initialMinute,
  colors,
}) => {
  const styles = createStyles(colors);
  const [selectedHour, setSelectedHour] = useState(initialHour);
  const [selectedMinute, setSelectedMinute] = useState(initialMinute);

  useEffect(() => {
    if (isVisible) {
      setSelectedHour(initialHour);
      setSelectedMinute(initialMinute);
    }
  }, [isVisible, initialHour, initialMinute]);

  const handleConfirm = () => {
    onConfirm(selectedHour, selectedMinute);
    onClose();
  };

  const renderPickerItem = (
    value: number,
    current: number,
    setter: (val: number) => void
  ) => (
    <TouchableOpacity
      key={value}
      style={[
        styles.pickerItem,
        value === current && styles.pickerItemSelected,
      ]}
      onPress={() => setter(value)}
    >
      <Text
        style={[
          styles.pickerItemText,
          value === current && styles.pickerItemTextSelected,
          { color: value === current ? colors.primary : colors.textSecondary },
        ]}
      >
        {value.toString().padStart(2, '0')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { backgroundColor: colors.backgroundSecondary }]}>  
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Selecionar Horário</Text>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerColumn}>
              <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Hora</Text>
              <ScrollView
                style={styles.pickerScrollView}
                showsVerticalScrollIndicator={false}
              >
                {hours.map(h => renderPickerItem(h, selectedHour, setSelectedHour))}
              </ScrollView>
            </View>

            <Text style={[styles.pickerSeparator, { color: colors.textPrimary }]}>:</Text>

            <View style={styles.pickerColumn}>
              <Text style={[styles.pickerLabel, { color: colors.textSecondary }]}>Minuto</Text>
              <ScrollView
                style={styles.pickerScrollView}
                showsVerticalScrollIndicator={false}
              >
                {minutes.map(m => renderPickerItem(m, selectedMinute, setSelectedMinute))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.confirmButton, { backgroundColor: colors.primary }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.modalButtonText, { color: colors.white }]}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => {
  const { height } = Dimensions.get('window');
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '90%',
      maxWidth: 400,
      maxHeight: height * 0.6,
      borderRadius: 15,
      padding: 20,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      marginBottom: 20,
    },
    pickerContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      width: '100%',
      marginBottom: 25,
    },
    pickerColumn: {
      flex: 1,
      alignItems: 'center',
    },
    pickerLabel: {
      fontSize: 14,
      marginBottom: 5,
    },
    pickerScrollView: {
      width: 80,
      maxHeight: 200,
    },
    pickerItem: {
      paddingVertical: 10,
      alignItems: 'center',
      width: 80,
    },
    pickerItemSelected: {},
    pickerItemText: {
      fontSize: 22,
      color: colors.textSecondary,
    },
    pickerItemTextSelected: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.primary,
    },
    pickerSeparator: {
      fontSize: 24,
      fontWeight: 'bold',
      marginHorizontal: 10,
      alignSelf: 'center',
      paddingTop: 20,
    },
    modalButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginHorizontal: 5,
    },
    cancelButton: {
      backgroundColor: colors.backgroundPrimary,
      borderWidth: 1,
    },
    confirmButton: {},
    modalButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
  });
};
