import { Stack } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useState, useCallback } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

interface AudioCardProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  backgroundColor: string;
}

function AudioCard({ title, icon, onPress, backgroundColor }: AudioCardProps) {
  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor }]} 
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color="#000" />
      <Text style={styles.cardTitle}>{title}</Text>
      <Ionicons name="arrow-forward" size={20} color="#000" style={styles.arrow} />
    </TouchableOpacity>
  );
}

interface Alarm {
  id: string;
  time: string;
  soundPath: string;
  isEnabled: boolean;
}

export default function Home() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [alarms, setAlarms] = useState<Alarm[]>([]);

  // Fetch alarms when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAlarms();
    }, [])
  );

  // Handle audio file upload
  async function handleUploadAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const fileName = asset.name;
      const destination = `${FileSystem.documentDirectory}sounds/${fileName}`;

      // Create sounds directory if it doesn't exist
      await FileSystem.makeDirectoryAsync(
        `${FileSystem.documentDirectory}sounds/`,
        { intermediates: true }
      );

      // Copy file to app's document directory
      if (asset.uri) {
        await FileSystem.copyAsync({
          from: asset.uri,
          to: destination
        });
        Alert.alert('Success', 'Audio file uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload audio file');
    }
  }

  // Handle audio recording
  async function handleRecordSound() {
    try {
      if (isRecording) {
        // Stop recording
        setIsRecording(false);
        await stopRecording();
      } else {
        // Start recording
        await startRecording();
        setIsRecording(true);
      }
    } catch (error) {
      console.error('Error with recording:', error);
      Alert.alert('Error', 'Failed to record audio');
    }
  }

  async function startRecording() {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Please grant microphone permission');
        return;
      }

      // Prepare recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }

  async function stopRecording() {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        const fileName = `recording-${Date.now()}.m4a`;
        const destination = `${FileSystem.documentDirectory}sounds/${fileName}`;

        // Create sounds directory if it doesn't exist
        await FileSystem.makeDirectoryAsync(
          `${FileSystem.documentDirectory}sounds/`,
          { intermediates: true }
        );

        // Move recording to permanent location
        await FileSystem.moveAsync({
          from: uri,
          to: destination
        });

        Alert.alert('Success', 'Recording saved successfully!');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }

    setRecording(null);
  }

  async function loadAlarms() {
    try {
      const alarmsJson = await AsyncStorage.getItem('alarms');
      if (alarmsJson) {
        setAlarms(JSON.parse(alarmsJson));
      }
    } catch (error) {
      console.error('Error loading alarms:', error);
    }
  }

  async function toggleAlarm(id: string) {
    try {
      const updatedAlarms = alarms.map(alarm => 
        alarm.id === id ? { ...alarm, isEnabled: !alarm.isEnabled } : alarm
      );
      await AsyncStorage.setItem('alarms', JSON.stringify(updatedAlarms));
      setAlarms(updatedAlarms);
    } catch (error) {
      console.error('Error toggling alarm:', error);
    }
  }

  async function deleteAlarm(id: string) {
    try {
      const updatedAlarms = alarms.filter(alarm => alarm.id !== id);
      await AsyncStorage.setItem('alarms', JSON.stringify(updatedAlarms));
      setAlarms(updatedAlarms);
    } catch (error) {
      console.error('Error deleting alarm:', error);
    }
  }

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: false 
        }} 
      />
      
      <View style={styles.header}>
        <Text style={styles.greeting}>My Alarms</Text>
        <Text style={styles.subtitle}>Manage your alarm sounds and times</Text>
      </View>

      <ScrollView style={styles.alarmList}>
        {alarms.map(alarm => (
          <View key={alarm.id} style={styles.alarmItem}>
            <Text style={styles.alarmTime}>{alarm.time}</Text>
            <View style={styles.alarmControls}>
              <Switch
                value={alarm.isEnabled}
                onValueChange={() => toggleAlarm(alarm.id)}
              />
              <TouchableOpacity 
                onPress={() => deleteAlarm(alarm.id)}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {alarms.length === 0 && (
          <Text style={styles.noAlarms}>No alarms set</Text>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.fabButton}
        onPress={() => router.push('/(screens)/new-alarm')}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    marginTop: 20,
    marginBottom: 40,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  arrow: {
    opacity: 0.5,
  },
  statsCard: {
    marginTop: 40,
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  fabButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  alarmList: {
    flex: 1,
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  alarmTime: {
    fontSize: 24,
    fontWeight: '600',
  },
  alarmControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteButton: {
    padding: 8,
  },
  noAlarms: {
    textAlign: 'center',
    color: '#666',
    marginTop: 24,
    fontSize: 16,
  },
});
