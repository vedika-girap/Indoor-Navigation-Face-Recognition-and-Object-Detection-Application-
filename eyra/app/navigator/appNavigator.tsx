import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/home';
import MainMenu from '../screens/menu';
import NormalModeScreen from '../screens/normal';
import SetFloorMap from '../screens/setFloorMap';
import IndoorNavigation from '../screens/indoorNavigation';
import FloorMapManagement from '../screens/floorMapManagement';
import ProcessFloorMapScreen from '../screens/processFloorMap';
import ProcessedMapViewer from '../screens/processedMapViewer';
import type { FloorMap } from '../services/floorMapService';

export type RootStackParamList = {
  Home: undefined;
  MainMenu: undefined;
  SetFloorMap: undefined;
  NormalMode: undefined;
  IndoorNavigation: { floorMap?: FloorMap };
  FloorMapManagement: undefined;
  ProcessFloorMap: undefined;
  ProcessedMapViewer: { processed?: any; original?: FloorMap } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="IndoorNavigation" component={IndoorNavigation} />
      <Stack.Screen name="MainMenu" component={MainMenu} />
      <Stack.Screen name="SetFloorMap" component={SetFloorMap} />
      <Stack.Screen name="FloorMapManagement" component={FloorMapManagement} />
      <Stack.Screen name="ProcessFloorMap" component={ProcessFloorMapScreen} />
      <Stack.Screen name="ProcessedMapViewer" component={ProcessedMapViewer} />
      <Stack.Screen name="NormalMode" component={NormalModeScreen} />
    </Stack.Navigator>
  );
}
