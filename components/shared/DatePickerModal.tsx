// src/components/shared/DatePickerModal.tsx
import React, { useState, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig, CalendarProps } from 'react-native-calendars';
import { useTheme } from '@/context/ThemeContext';
import { format, startOfDay } from 'date-fns'; // Importar date-fns
import { ptBR } from 'date-fns/locale'; // Importar locale

// Configurar locale para react-native-calendars
LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ],
  monthNamesShort: ['Jan.', 'Fev.', 'Mar.', 'Abr.', 'Mai.', 'Jun.', 'Jul.', 'Ago.', 'Set.', 'Out.', 'Nov.', 'Dez.'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'],
  today: "Hoje"
};
LocaleConfig.defaultLocale = 'pt-br';

interface DatePickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onDateSelected: (date: Date) => void;
  initialDate?: Date; // Data inicial para mostrar no calendário
  maxDate?: Date; // Data máxima selecionável
}

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isVisible,
  onClose,
  onDateSelected,
  initialDate,
  maxDate
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const maximumDate = useMemo(() => maxDate ? format(maxDate, 'yyyy-MM-dd') : today, [maxDate, today]); // Não permite selecionar data futura por padrão

  // Define a data inicial do calendário
  const initialCalendarDate = useMemo(() =>
     initialDate ? format(initialDate, 'yyyy-MM-dd') : today,
  [initialDate, today]);

  // Estado para marcar o dia selecionado no calendário
  const [selectedDay, setSelectedDay] = useState<string>(initialCalendarDate);

  const handleDayPress: CalendarProps['onDayPress'] = (day: { timestamp: string | number | Date; dateString: React.SetStateAction<string>; }) => {
    const selectedDate = startOfDay(new Date(day.timestamp)); // Usa timestamp UTC, converte para Date local no início do dia
    setSelectedDay(day.dateString); // Marca no calendário
    onDateSelected(selectedDate); // Retorna o objeto Date
    onClose(); // Fecha o modal
  };

  // Configurações de tema para o calendário
   const calendarTheme = {
        backgroundColor: colors.backgroundSecondary,
        calendarBackground: colors.backgroundSecondary,
        textSectionTitleColor: colors.primary,
        // textSectionTitleDisabledColor: '#d9e1e8',
        selectedDayBackgroundColor: colors.primary,
        selectedDayTextColor: colors.white,
        todayTextColor: colors.warning, // Cor diferente para hoje
        dayTextColor: colors.textPrimary,
        textDisabledColor: colors.textPrimary,
        dotColor: colors.primary,
        selectedDotColor: colors.white,
        arrowColor: colors.primary,
        disabledArrowColor: colors.border,
        monthTextColor: colors.textPrimary,
        indicatorColor: colors.primary,
        // textDayFontFamily: 'monospace',
        // textMonthFontFamily: 'monospace',
        // textDayHeaderFontFamily: 'monospace',
        textDayFontWeight: '300',
        textMonthFontWeight: 'bold',
        textDayHeaderFontWeight: '500',
        textDayFontSize: 16,
        textMonthFontSize: 18,
        textDayHeaderFontSize: 14
   };


  return (
    <Modal
      transparent
      animationType="fade"
      visible={isVisible}
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.contentContainer}>
          <Calendar
            current={initialCalendarDate} // Data que o calendário abre
            onDayPress={handleDayPress}
            monthFormat={'MMMM yyyy'}
            // hideArrows={false}
            // renderArrow={(direction) => (<Arrow />)}
            hideExtraDays={true} // Não mostra dias do mês anterior/seguinte
            // disableMonthChange={false}
            // firstDay={1} // Começa na Segunda
            // hideDayNames={false}
            // showWeekNumbers={false}
            onPressArrowLeft={(subtractMonth: () => any) => subtractMonth()}
            onPressArrowRight={(addMonth: () => any) => addMonth()}
            disableArrowLeft={false}
            disableArrowRight={false}
            disableAllTouchEventsForDisabledDays={true}
            // renderHeader={(date) => {/* Custom header */} }
            enableSwipeMonths={true}
            theme={calendarTheme} // Aplica o tema
            maxDate={maximumDate} // Define data máxima selecionável
             // Marca o dia selecionado
             markedDates={{
                 [selectedDay]: {selected: true, marked: true, selectedColor: colors.primary},
                 [today]: {marked: true, dotColor: colors.warning} // Marca hoje com um ponto
             }}
          />
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
             <Text style={styles.closeButtonText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
     overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.backgroundModalScrim,
        padding: 20,
    },
    contentContainer: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 15,
        paddingVertical: 15,
        paddingHorizontal: 10, // Menor padding horizontal para calendário
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
     closeButton: {
        marginTop: 15,
        paddingVertical: 10,
        alignItems: 'center',
     },
     closeButtonText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: 'bold',
     }
});