import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import MainMenu from './menu';
import SetFloorMap from './setFloorMap';
import homeScreen from './home';
import NormalModeScreen from './normal';
// import or define Navigate and CheckSurrounding screens too!

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Home" component={homeScreen} />
        <Stack.Screen name="MainMenu" component={MainMenu} />
        <Stack.Screen name="SetFloorMap" component={SetFloorMap} />
        <Stack.Screen name="NormalMode" component={NormalModeScreen} />
        {/* Add other screens here */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
