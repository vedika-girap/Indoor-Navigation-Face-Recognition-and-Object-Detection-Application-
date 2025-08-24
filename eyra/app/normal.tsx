import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';


export default function NormalModeScreen() {
  // const [facing, setFacing]=useState<CameraType>('back');
  const [permission, requestPermission]=useCameraPermissions();

  if(!permission){
    //Camera permissions are loading..
    return(
      <View style={styles.defaultView}>
        <Text style={styles.defaultText}>Camera Permissions are still loading..</Text>
      </View>
    )
  }
  if(!permission.granted){
    return(
      <View style={styles.defaultView}>
        <Text style={styles.defaultText}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={{marginTop:20, padding:10, backgroundColor:'#8DC63F', borderRadius:5}}>
          <Text style={{color:'#6e9c35ff'}}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }


  return (
    <View style={styles.container}>
        <CameraView style={styles.cameraContainer} facing='back'>
        </CameraView>




      {/* Card overlay */}
      <View style={styles.card}>
        <Image
        source={{ uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=60&q=80' }}
        style={styles.cardImage}
        />
        <View style={styles.cardInfo}>
        <Text style={styles.turnText}>Turn right</Text>
        <Text style={styles.addressText}>3 Birrel Avenue</Text>
        <Text style={styles.metaText}>10 Mtr Left</Text>
        </View>
        </View>

      {/* Bottom buttons */}
      <View style={styles.bottomButtons}>
        <TouchableOpacity style={styles.iconButton}>
        <Text style={styles.icon}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
        <Text style={styles.icon}>🗺️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton}>
        <Text style={styles.cancelIcon}>✕</Text>
        </TouchableOpacity>
        </View>
      </View>
  );
}

// Styles
const styles = StyleSheet.create({
  defaultView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultText: {
    fontSize: 16,
    color: '#161616ff',
  },




  container: {
    flex: 1,
    // backgroundColor: '#D3ECA7', // light green
    alignItems: 'center',
  },
  headerText: {
    position: 'absolute',
    top: 16,
    left: 22,
    color: '#A9C88D',
    fontSize: 18,
    fontWeight: 'bold',
    opacity: 0.7,
    letterSpacing: 1,
    zIndex: 2,
  },
  cameraContainer: {
    // marginTop: 42,
    // width: '91%',
    // height: 380,
    // borderRadius: 16,
    // overflow: 'hidden',
    // alignItems: 'center',
    // justifyContent: 'center',
    flex:1,
    width:'100%',
    height:'100%',
  },
  overlayTextContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  overlayText: {
    color: '#222',
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 36,
  },
  card: {
    position: 'absolute',
    bottom: 120,
    left: '7.5%',
    width: '85%',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 14,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  cardImage: {
    width: 55,
    height: 55,
    borderRadius: 7,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  cardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  turnText: {
    color: '#8DC63F',
    fontWeight: 'bold',
    fontSize: 15,
  },
  addressText: {
    color: '#222',
    fontWeight: '500',
    fontSize: 18,
    marginVertical: 3,
  },
  metaText: {
    color: '#A9A9A9',
    fontSize: 14,
  },
  bottomButtons: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    left: '15%',
    width: '70%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 21,
    borderRadius: 10,
    elevation: 1,
  },
  icon: {
    fontSize: 22,
  },
  cancelButton: {
    backgroundColor: '#222',
    paddingVertical: 10,
    paddingHorizontal: 21,
    borderRadius: 11,
    elevation: 2,
    marginLeft: 9,
  },
  cancelIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
