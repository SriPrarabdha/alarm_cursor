import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Animated } from 'react-native';
import { Stack, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';

interface TimeWheelProps {
  value: number;
  onChange: (value: number) => void;
  type: 'hour' | 'minute';
}

function TimeWheel({ value, onChange, type }: TimeWheelProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const itemHeight = 50;

  // Create base numbers array
  const baseNumbers = type === 'hour'
    ? Array.from({ length: 12 }, (_, i) => ((i + 1)).toString().padStart(2, '0'))
    : Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Create a triple-length array for infinite scroll effect
  const displayNumbers = [...baseNumbers, ...baseNumbers, ...baseNumbers];
  
  // Calculate initial scroll position to middle set
  const initialScrollPosition = type === 'hour'
    ? (baseNumbers.length + (value === 0 ? 12 : value) - 1) * itemHeight
    : (baseNumbers.length + value) * itemHeight;

  useEffect(() => {
    // Set initial scroll position to middle set
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: initialScrollPosition,
        animated: false
      });
    }
  }, []);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / itemHeight);
    const baseLength = baseNumbers.length;

    // Calculate the actual value based on scroll position
    let newValue;
    if (type === 'hour') {
      newValue = ((index % baseLength) + 1);
      if (newValue === 13) newValue = 1;
    } else {
      newValue = index % baseLength;
    }

    // If we're in the first or last set, jump to the middle set
    if (index < baseLength) {
      scrollViewRef.current?.scrollTo({
        y: y + (baseLength * itemHeight),
        animated: false
      });
    } else if (index >= baseLength * 2) {
      scrollViewRef.current?.scrollTo({
        y: y - (baseLength * itemHeight),
        animated: false
      });
    }

    onChange(newValue);
  };

  return (
    <View style={styles.wheelWrapper}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        style={styles.wheel}
        onMomentumScrollEnd={handleScroll}
        onScrollEndDrag={handleScroll}
      >
        {displayNumbers.map((num, index) => (
          <View 
            key={`${num}-${index}`} 
            style={styles.wheelItem}
          >
            <Text style={[
              styles.wheelText,
              num === value.toString().padStart(2, '0') && styles.wheelTextSelected
            ]}>
              {num}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.selectionIndicator} pointerEvents="none" />
    </View>
  );
}

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
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');

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

        setSelectedSound(destination);
        Alert.alert('Success', 'Recording saved successfully!');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }

    setRecording(null);
  }

  function toggleDay(dayId: number) {
    setSelectedDays(prev => 
      prev.includes(dayId)
        ? prev.filter(id => id !== dayId)
        : [...prev, dayId]
    );
  }

  // Convert 24h to 12h format for display
  function formatHour(hour24: number): number {
    if (hour24 === 0) return 12;
    if (hour24 > 12) return hour24 - 12;
    return hour24;
  }

  // Convert 12h to 24h format when saving
  function to24Hour(hour12: number): number {
    if (period === 'PM' && hour12 < 12) return hour12 + 12;
    if (period === 'AM' && hour12 === 12) return 0;
    return hour12;
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
            <View style={styles.timeWheelsContainer}>
              <TimeWheel 
                value={formatHour(hours)} 
                onChange={(h) => setHours(to24Hour(h))}
                type="hour"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TimeWheel 
                value={minutes} 
                onChange={setMinutes}
                type="minute" 
              />
            </View>
            <View style={styles.periodSelectorContainer}>
              <TouchableOpacity
                style={[styles.periodButton, period === 'AM' && styles.periodButtonActive]}
                onPress={() => setPeriod('AM')}
              >
                <Text style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>
                  AM
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.periodButton, period === 'PM' && styles.periodButtonActive]}
                onPress={() => setPeriod('PM')}
              >
                <Text style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>
                  PM
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingVertical: 30,
    gap: 20,
  },
  timeWheelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wheelWrapper: {
    height: 150,
    width: 60,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  wheel: {
    flex: 1,
  },
  wheelItem: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#8E8E93',
  },
  wheelTextSelected: {
    color: '#007AFF',
    fontSize: 24,
  },
  timeSeparator: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  soundSection: {
    padding: 20,
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
    height: 50,
    marginTop: -25,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  periodSelectorContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
  },
  periodButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#007AFF',
  },
  periodText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  periodTextActive: {
    color: '#FFFFFF',
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
});
