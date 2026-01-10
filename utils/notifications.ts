import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Notification channel ID for Android
const NOTIFICATION_CHANNEL_ID = 'default';
const NOTIFICATIONS_INITIALIZED_KEY = 'notifications_initialized';
const NOTIFICATIONS_INITIALIZED_DATE_KEY = 'notifications_initialized_date';

export interface Reminder {
  id: string;
  title: string;
  body?: string; // Optional body text for the notification
  hour: number;
  minute: number;
  isDaily: boolean;
  expiresAt?: Date; // For one-time reminders
}

/**
 * Register for push notifications and set up Android channel
 */
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  try {
    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D4AF37',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error registering for notifications:', error);
    return false;
  }
}

/**
 * Schedule a reminder notification
 */
export async function scheduleReminder(reminder: Reminder): Promise<string | null> {
  try {
    let trigger: Notifications.NotificationTriggerInput;

    if (reminder.isDaily) {
      // Daily repeating notification
      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: reminder.hour,
        minute: reminder.minute,
      };
    } else {
      // One-time notification with expiration
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(reminder.hour, reminder.minute, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      trigger = {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: scheduledTime,
      };
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title || 'Reminder',
        body: reminder.body || '', // Use custom body or empty string
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
      identifier: reminder.id, // Use stable identifier
    });

    return notificationId;
  } catch (error) {
    console.error('Error scheduling reminder:', error);
    return null;
  }
}

/**
 * Cancel a scheduled reminder notification
 */
export async function cancelReminder(notificationId: string): Promise<boolean> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    return true;
  } catch (error) {
    console.error('Error canceling reminder:', error);
    return false;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error canceling all reminders:', error);
  }
}

/**
 * Check if notifications have been initialized today
 * This prevents redundant scheduling on app restart
 */
export async function shouldInitializeNotifications(): Promise<boolean> {
  try {
    const initialized = await AsyncStorage.getItem(NOTIFICATIONS_INITIALIZED_KEY);
    const initializedDate = await AsyncStorage.getItem(NOTIFICATIONS_INITIALIZED_DATE_KEY);

    if (!initialized || initialized !== 'true') {
      return true;
    }

    // Check if it's a new day
    const today = new Date().toDateString();
    if (initializedDate !== today) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking notification initialization:', error);
    return true; // Default to initializing if there's an error
  }
}

/**
 * Mark notifications as initialized for today
 */
export async function markNotificationsInitialized(): Promise<void> {
  try {
    await AsyncStorage.setItem(NOTIFICATIONS_INITIALIZED_KEY, 'true');
    await AsyncStorage.setItem(NOTIFICATIONS_INITIALIZED_DATE_KEY, new Date().toDateString());
  } catch (error) {
    console.error('Error marking notifications as initialized:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
}

