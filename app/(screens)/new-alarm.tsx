import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Animated, Platform, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';


import { TimeWheel } from '../../components/TimeWheel';

interface DayOfWeek {
  id: number;
  name: string;
  shortName: string;
}

const DAYS_OF_WEEK: DayOfWeek[] = [
  { id: 1, name: 'Monday', shortName: 'Mon' },
  { id: 2, name: 'Tuesday', shortName: 'Tue' },
  { id: 3, name: 'Wednesday', shortName: 'Wed' },
  { id: 4, name: 'Thursday', shortName: 'Thu' },
  { id: 5, name: 'Friday', shortName: 'Fri' },
  { id: 6, name: 'Saturday', shortName: 'Sat' },
  { id: 0, name: 'Sunday', shortName: 'Sun' },
];

export default function NewAlarm() {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  // Cleanup function for sound object
  const cleanup = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }
  };

  async function handleSaveAlarm() {
    if (!selectedSound) {
      Alert.alert('Error', 'Please select or record a sound first');
      return;
    }

    try {
      // Create the alarm object
      const alarm = {
        hours,
        minutes,
        soundUri: selectedSound,
        enabled: true,
        id: Date.now().toString(),
        repeatDays: selectedDays,
      };

      // Here you would save the alarm to AsyncStorage or your preferred storage
      // For example:
      // const existingAlarms = await AsyncStorage.getItem('alarms');
      // const alarms = existingAlarms ? JSON.parse(existingAlarms) : [];
      // alarms.push(alarm);
      // await AsyncStorage.setItem('alarms', JSON.stringify(alarms));
      await scheduleAlarmNotification(hours, minutes, selectedSound, selectedDays);
      Alert.alert('Success', 'Alarm saved!');
      router.back();
    } catch (error) {
      console.error('Error saving alarm:', error);
      Alert.alert('Error', 'Failed to save alarm');
    }
  }

  async function scheduleAlarmNotification(
    hours: number, 
    minutes: number, 
    soundUri: string,
    repeatDays: number[]
  ) {
    const now = new Date();
    const alarmTime = new Date();
    alarmTime.setHours(hours, minutes, 0, 0);

    if (alarmTime <= now) {
      alarmTime.setDate(alarmTime.getDate() + 1);
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Alarm',
        body: 'Your alarm is ringing!',
        sound: soundUri,
      },
      trigger: repeatDays.length > 0 ? {
        hours: hours,
        minutes: minutes,
        type: 'daily',
        repeats: true,
        weekdays: repeatDays,
      } : {
        date: alarmTime,
        type: 'date',
      },
    });
  } 

  async function handleUploadAudio() {
    try {
      await cleanup(); // Cleanup existing sound

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
        setSelectedSound(destination);
        Alert.alert('Success', 'Audio file uploaded successfully!');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      Alert.alert('Error', 'Failed to upload audio file');
    }
  }

  async function handlePlaySound() {
    try {
      if (isPlaying) {
        if (sound) {
          await sound.stopAsync();
          setIsPlaying(false);
        }
      } else if (selectedSound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: selectedSound },
          { shouldPlay: true }
        );
        setSound(newSound);
        setIsPlaying(true);

        // Handle playback finish
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Error playing sound:', error);
      Alert.alert('Error', 'Failed to play sound');
    }
  }

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
      await cleanup(); // Cleanup existing sound

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

  const [savedSounds, setSavedSounds] = useState<Array<{name: string, uri: string}>>([]);
const [isNamingModalVisible, setIsNamingModalVisible] = useState(false);
const [newSoundName, setNewSoundName] = useState('');
const [tempRecordingUri, setTempRecordingUri] = useState<string | null>(null);
const [isSavedSoundsModalVisible, setIsSavedSoundsModalVisible] = useState(false);

useEffect(() => {
  loadSavedSounds();
}, []);

async function loadSavedSounds() {
  try {
    const savedSoundsJson = await AsyncStorage.getItem('savedSounds');
    if (savedSoundsJson) {
      setSavedSounds(JSON.parse(savedSoundsJson));
    }
  } catch (error) {
    console.error('Error loading saved sounds:', error);
  }
}

async function stopRecording() {
  if (!recording) return;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    if (uri) {
      setTempRecordingUri(uri);
      setIsNamingModalVisible(true);
    }
  } catch (error) {
    console.error('Failed to stop recording:', error);
  }

  setRecording(null);
}

async function saveRecordingWithName() {
  if (!tempRecordingUri || !newSoundName.trim()) return;

  try {
    const fileName = `${newSoundName.trim()}-${Date.now()}.m4a`;
    const destination = `${FileSystem.documentDirectory}sounds/${fileName}`;

    await FileSystem.makeDirectoryAsync(
      `${FileSystem.documentDirectory}sounds/`,
      { intermediates: true }
    );

    await FileSystem.moveAsync({
      from: tempRecordingUri,
      to: destination
    });

    const newSound = { name: newSoundName.trim(), uri: destination };
    const updatedSounds = [...savedSounds, newSound];

    await AsyncStorage.setItem('savedSounds', JSON.stringify(updatedSounds));
    setSavedSounds(updatedSounds);
    setSelectedSound(destination);

    setIsNamingModalVisible(false);
    setNewSoundName('');
    setTempRecordingUri(null);

    Alert.alert('Success', 'Recording saved successfully!');
  } catch (error) {
    console.error('Failed to save recording:', error);
    Alert.alert('Error', 'Failed to save recording');
  }
}

  function toggleDay(dayId: number) {
    setSelectedDays(prev => 
      prev.includes(dayId)
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{
          title: 'Set New Alarm',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.contentContainer}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.timeContainer}>
            <TimeWheel value={hours} max={23} onChange={setHours} />
            <Text style={styles.timeSeparator}>:</Text>
            <TimeWheel value={minutes} max={59} onChange={setMinutes} />
          </View>

          <View style={styles.repeatSection}>
            <Text style={styles.sectionTitle}>Repeat</Text>
            <View style={styles.daysContainer}>
              {DAYS_OF_WEEK.map((day) => (
                <TouchableOpacity
                  key={day.id}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day.id) && styles.dayButtonSelected
                  ]}
                  onPress={() => toggleDay(day.id)}
                >
                  <Text style={[
                    styles.dayButtonText,
                    selectedDays.includes(day.id) && styles.dayButtonTextSelected
                  ]}>
                    {day.shortName}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.soundSection}>
            <Text style={styles.sectionTitle}>Alarm Sound</Text>
            {selectedSound ? (
              <View style={styles.selectedSound}>
                <Text numberOfLines={1} style={styles.soundName}>
                  {selectedSound.split('/').pop()}
                </Text>
                <View style={styles.soundControls}>
                  <TouchableOpacity onPress={handlePlaySound} style={styles.playButton}>
                    <Ionicons 
                      name={isPlaying ? "stop-circle" : "play-circle"} 
                      size={24} 
                      color="#007AFF" 
                    />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    cleanup();
                    setSelectedSound(null);
                  }}>
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.soundButtons}>
                <TouchableOpacity 
                  style={styles.soundButton}
                  onPress={handleUploadAudio}
                >
                  <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
                  <Text style={styles.buttonText}>Upload Sound</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.soundButton}
                  onPress={() => setIsSavedSoundsModalVisible(true)}
                >
                  <Ionicons name="library-outline" size={24} color="#007AFF" />
                  <Text style={styles.buttonText}>Saved Sounds</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.soundButton, isRecording && styles.recording]}
                  onPress={handleRecordSound}
                >
                  <Ionicons 
                    name={isRecording ? "stop-circle-outline" : "mic-outline"} 
                    size={24} 
                    color={isRecording ? "#FF3B30" : "#007AFF"} 
                  />
                  <Text style={styles.buttonText}>
                    {isRecording ? "Stop Recording" : "Record Sound"}
                  </Text>
                </TouchableOpacity>
            </View>
            )}
          </View>

          {/* Add padding at the bottom to ensure content isn't hidden behind the save button */}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Naming Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isNamingModalVisible}
          onRequestClose={() => setIsNamingModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Name your recording</Text>
              <TextInput
                style={styles.input}
                value={newSoundName}
                onChangeText={setNewSoundName}
                placeholder="Enter a name for your recording"
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setIsNamingModalVisible(false);
                    setNewSoundName('');
                    setTempRecordingUri(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveRecordingWithName}
                >
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Saved Sounds Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isSavedSoundsModalVisible}
          onRequestClose={() => setIsSavedSoundsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.savedSoundsModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Saved Recordings</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setIsSavedSoundsModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.savedSoundsList}>
                {savedSounds.length > 0 ? (
                  savedSounds.map((sound, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.savedSoundItem}
                      onPress={() => {
                        setSelectedSound(sound.uri);
                        setIsSavedSoundsModalVisible(false);
                      }}
                    >
                      <Text style={styles.savedSoundName}>{sound.name}</Text>
                      <Ionicons name="checkmark-circle" size={24} color={selectedSound === sound.uri ? '#007AFF' : '#E5E5EA'} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noSoundsText}>No saved recordings yet</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity 
            style={[styles.saveButton, !selectedSound && styles.saveButtonDisabled]}
            onPress={handleSaveAlarm}
            disabled={!selectedSound}
          >
            <Text style={styles.saveButtonText}>Save Alarm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  savedSoundsModal: {
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
  },
  closeButton: {
    padding: 5,
  },
  savedSoundsList: {
    flex: 1,
  },
  savedSoundItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  savedSoundName: {
    fontSize: 16,
    color: '#000',
  },
  noSoundsText: {
    textAlign: 'center',
    color: '#8E8E93',
    marginTop: 20,
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  wheelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  wheelWrapper: {
    height: 250,
    width: 70,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  wheelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    pointerEvents: 'none',
  },
  wheelHighlight: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 50,
    transform: [{ translateY: -25 }],
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#007AFF',
  },
  wheel: {
    flex: 1,
  },
  wheelItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#8E8E93',
  },
  periodSelectorContainer: {
    height: 100,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodActive: {
    backgroundColor: '#E8F0FE',
    color: '#1a73e8',
  },
  periodInactive: {
    backgroundColor: '#F0F0F0',
    color: '#9AA0A6',
  },
  periodText: {
    fontSize: 16,
    color: '#9AA0A6',
  },
  periodTextActive: {
    color: '#1a73e8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  soundButtons: {
    gap: 12,
  },
  soundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    gap: 12,
  },
  recording: {
    backgroundColor: '#FFE5E5',
  },
  buttonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  selectionIndicator: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    marginTop: -35,
    height: 70,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.08)',
  },
  indicatorLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#007AFF',
  },
  periodSelector: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 8,
    gap: 8,
  },
  selectedSound: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
  },
  soundName: {
    fontSize: 16,
    flex: 1,
    marginRight: 12,
  },
  saveButtonContainer: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: '#fff',
    // Add shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    // Add shadow for Android
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A2A2A2',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  playButton: {
    marginRight: 10,
  },
  soundControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomPadding: {
    height: 20,
  },
  repeatSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  dayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  dayButtonSelected: {
    backgroundColor: '#007AFF',
  },
  dayButtonText: {
    fontSize: 13,
    color: '#000',
  },
  dayButtonTextSelected: {
    color: '#FFF',
  },
  soundSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: 'bold',
    marginHorizontal: 10,
  }
});