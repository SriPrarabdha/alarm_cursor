
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

interface TimeWheelProps {
  value: number;
  onChange: (value: number) => void;
  type: 'hour' | 'minute';
}

export function TimeWheel({ value, onChange, type }: TimeWheelProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  
  const numbers = type === 'hour'
    ? Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'))
    : Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Create a larger array for infinite scroll effect
  const items = [...numbers, ...numbers, ...numbers];
  
  useEffect(() => {
    if (scrollViewRef.current) {
      const initialOffset = numbers.length * ITEM_HEIGHT;
      scrollViewRef.current.scrollTo({ y: initialOffset, animated: false });
    }
  }, []);

  const handleMomentumScrollEnd = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const normalizedIndex = index % numbers.length;
    
    let newValue = type === 'hour' 
      ? (normalizedIndex + 1 === 13 ? 1 : normalizedIndex + 1)
      : normalizedIndex;

    onChange(newValue);

    // Reset to middle section if we're at the edges
    if (index < numbers.length || index >= numbers.length * 2) {
      const newOffset = numbers.length * ITEM_HEIGHT + (normalizedIndex * ITEM_HEIGHT);
      scrollViewRef.current?.scrollTo({ y: newOffset, animated: false });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.wheelContainer}>
        <View style={styles.selection} />
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          onMomentumScrollEnd={handleMomentumScrollEnd}
          onScrollEndDrag={handleMomentumScrollEnd}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {items.map((num, index) => (
            <View key={`${num}-${index}`} style={styles.item}>
              <Text style={[
                styles.number,
                num === value.toString().padStart(2, '0') && styles.selectedNumber
              ]}>
                {num}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 70,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelContainer: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    position: 'relative',
  },
  scrollView: {
    height: '100%',
  },
  scrollContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  number: {
    fontSize: 20,
    color: '#8E8E93',
    fontWeight: '500',
  },
  selectedNumber: {
    color: '#007AFF',
    fontSize: 24,
    fontWeight: '600',
  },
  selection: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    top: '50%',
    marginTop: -ITEM_HEIGHT / 2,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#007AFF',
    zIndex: 1,
  },
});
