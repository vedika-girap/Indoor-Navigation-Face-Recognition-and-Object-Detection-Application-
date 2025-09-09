import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home';
import VoiceTest from '../screens/voiceTest';
import MainMenu from '../screens/menu';
import NormalModeScreen from '../screens/normal';
import SetFloorMap from '../screens/setFloorMap';

export type RootStackParamList = {
  Home: undefined;
  VoiceTest: undefined;
  MainMenu: undefined;
  SetFloorMap: undefined;
  NormalMode: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="VoiceTest" component={VoiceTest} />
      <Stack.Screen name="MainMenu" component={MainMenu} />
      <Stack.Screen name="SetFloorMap" component={SetFloorMap} />
      <Stack.Screen name="NormalMode" component={NormalModeScreen} />
    </Stack.Navigator>
  );
}
