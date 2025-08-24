import { Button } from "@react-navigation/elements";
import { View, Text, StyleSheet, Touchable, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function homeScreen(){
    const router = useRouter();
    return(
        <View style={styles.container}> 
        <TouchableOpacity style={styles.Circle} onPress={() => router.push('/menu')}>
            <Text style={styles.textStyles}>Eyra</Text>
        </TouchableOpacity>
        </View>
    );
}
const styles= StyleSheet.create({
    container:{
        backgroundColor: 'white',
        flex: 1,
        justifyContent:'center',
        alignItems: 'center',
        padding: 20,

    },
    Circle:{
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#D3ECA7', // light green
        justifyContent: 'center',
        alignItems: 'center',
    },
    textStyles:{
        fontSize: 24,
        fontWeight: 'bold',
        color: '#6f865cff', // dark green
    }
});