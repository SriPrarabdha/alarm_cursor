
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const ITEM_HEIGHT = 50;
const VISIBLE_ITEMS = 5;

interface TimeWheelProps {
  value: number;
  onChange: (value: number) => void;
  max: number;
}

export function TimeWheel({ value, onChange, max }: TimeWheelProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  
  const numbers = Array.from({ length: max + 1 }, (_, i) => i.toString().padStart(2, '0'));
  const items = [...numbers, ...numbers, ...numbers];
  
  useEffect(() => {
    if (scrollViewRef.current) {
      const targetY = (numbers.length + value) * ITEM_HEIGHT;
      scrollViewRef.current.scrollTo({ y: targetY, animated: false });
    }
  }, []);

  const handleScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const index = Math.round(y / ITEM_HEIGHT);
    const normalizedIndex = index % numbers.length;
    
    if (normalizedIndex !== value) {
      onChange(normalizedIndex);
    }

    // Reset to middle section if we're at the edges
    if (index < numbers.length || index >= numbers.length * 2) {
      const newOffset = numbers.length * ITEM_HEIGHT + (normalizedIndex * ITEM_HEIGHT);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: newOffset, animated: false });
      }, 10);
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
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
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
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
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
    pointerEvents: 'none',
  },
});
