import '@testing-library/jest-native/extend-expect';
import { Animated } from 'react-native';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
  },
  NotificationFeedbackType: {
    Success: 'Success',
  },
}));

const createAnimationMock = () => ({
  start: jest.fn(callback => callback?.()),
  stop: jest.fn(),
  reset: jest.fn(),
});

jest.spyOn(Animated, 'timing').mockImplementation(() => createAnimationMock());
jest.spyOn(Animated, 'spring').mockImplementation(() => createAnimationMock());
jest.spyOn(Animated, 'parallel').mockImplementation(() => createAnimationMock());
jest.spyOn(Animated, 'sequence').mockImplementation(() => createAnimationMock());
jest.spyOn(Animated, 'loop').mockImplementation(() => createAnimationMock());
jest.spyOn(Animated, 'delay').mockImplementation(() => createAnimationMock());
