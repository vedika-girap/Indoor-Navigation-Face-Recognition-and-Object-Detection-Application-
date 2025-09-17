import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home';
import VoiceTest from '../screens/voiceTest';
import MainMenu from '../screens/menu';
import NormalModeScreen from '../screens/normal';
import SetFloorMap from '../screens/setFloorMap';
import IndoorNavigation from '../screens/indoorNavigation';
import GlobalVoiceListener from '../components/GlobalVoiceListener';

export type RootStackParamList = {
  Home: undefined;
  MainMenu: undefined;
  SetFloorMap: undefined;
  NormalMode: undefined;
  IndoorNavigation: undefined;
  VoiceTest: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <GlobalVoiceListener>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="IndoorNavigation" component={IndoorNavigation} />
        <Stack.Screen name="MainMenu" component={MainMenu} />
        <Stack.Screen name="SetFloorMap" component={SetFloorMap} />
        <Stack.Screen name="NormalMode" component={NormalModeScreen} />
        <Stack.Screen name="VoiceTest" component={VoiceTest} />
      </Stack.Navigator>
    </GlobalVoiceListener>
  );
}
