// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Platform, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { TopBar } from '@/components/Components/TopBar';
import PregacaoIcon from '@/assets/icons/pregacao';
import InicioIcon from '@/assets/icons/inicio';
import PublicacoesIcon from '@/assets/icons/publicacoes';
import VidaIcon from '@/assets/icons/vida';
import BibleIcon from '@/assets/icons/bible';
import { useAuth } from '@/context/AuthContext';

const screenNames = {
  pregacao: 'pregacao',
  vidaCrista: 'vida-crista',
  congregacao: 'congregacao',
  publicacoes: 'publicacoes',
  leitura: 'leitura',
};

export default function TabLayout() {
  const { colors } = useTheme();
  const { userData } = useAuth();
  const hasCongregation = userData?.congregationId
  //Implement: if no congregation, show only leitura e congregação

  return (
  <View style={[styles.tabContainer, { backgroundColor: colors.backgroundPrimary }]}>
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: true,
        header: (props) => {
          const title = props.options.title ?? props.route.name;
          return <TopBar title={title} showBackButton={false} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.backgroundSecondary,
          borderTopColor: 'transparent',
          height: Platform.OS === 'ios' ? 86 : 66,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          ...styles.tabBarShadow,
          borderTopRightRadius: 12,
          borderTopLeftRadius: 12
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
          height: 30,
        },
        tabBarLabelStyle: {
          fontSize: 8,
          fontWeight: '600',
          marginTop: -4,
          marginRight: 10
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'ios' ? 6 : 13,
        },
      })}
    >

      {/* Aba Pregação */}
      <Tabs.Screen
        name={screenNames.leitura}
        options={{
          title: 'Leitura',
          tabBarIcon: ({ color, focused }) => (
            <BibleIcon
              size={focused ? 35 : 33}
              color={color}
              style={focused ? styles.activeIcon : {}}
          />

          ),
        }}
      />
      
      {/* Aba Pregação */}
      <Tabs.Screen
        name={screenNames.pregacao}
        options={{
          title: 'Pregação',
          tabBarIcon: ({ color, focused }) => (
            <PregacaoIcon
            size={focused ? 35 : 33}
            color={color}
              style={focused ? styles.activeIcon : {}}
          />

          ),
        }}
      />

      {/* Aba Vida Cristã */}
      <Tabs.Screen
        name={screenNames.vidaCrista}
        options={{
          title: 'Vida Cristã',
          tabBarIcon: ({ color, focused }) => (
            <VidaIcon
            size={focused ? 35 : 33}
            color={color}
              style={focused ? styles.activeIcon : {}}
          />
          ),
        }}
      />

      {/* Aba Vida Cristã */}
      <Tabs.Screen
        name={screenNames.publicacoes}
        options={{
          title: 'Publicações',
          tabBarIcon: ({ color, focused }) => (
            <PublicacoesIcon
            size={focused ? 35 : 33}
            color={color}
              style={focused ? styles.activeIcon : {}}
          />
          ),
        }}
      />

      {/* Aba Congregação */}
      <Tabs.Screen
        name={screenNames.congregacao}
        options={{
          title: 'Congregação',
          tabBarIcon: ({ color, focused }) => (
            <InicioIcon
            size={focused ? 35 : 33}
            color={color}
              style={focused ? styles.activeIcon : {}}
          />
          ),
        }}
      />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarShadow: {
    borderTopWidth: 0,
  },
  activeIcon: {
  },
  tabContainer: {
    flex: 1,
  },
});