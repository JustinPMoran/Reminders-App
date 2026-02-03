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

export type RecurrenceFrequency = 'day' | 'week' | 'month' | 'year';

export interface RecurrenceOptions {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[]; // 0 for Sunday, 1 for Monday, etc.
  until?: Date;
}

export interface Reminder {
  id: string;
  title: string;
  body?: string; // Optional body text for the notification
  startDate: Date;
  startTime: Date;
  isAllDay: boolean;
  isRecurring: boolean;
  recurrence?: RecurrenceOptions;
  // Keep legacy fields for a bit or migrate them? 
  // Let's just use the new ones.
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
    const scheduledTime = new Date(reminder.startDate);
    if (reminder.isAllDay) {
      scheduledTime.setHours(9, 0, 0, 0);
    } else {
      scheduledTime.setHours(reminder.startTime.getHours(), reminder.startTime.getMinutes(), 0, 0);
    }

    if (!reminder.isRecurring) {
      const now = new Date();
      if (scheduledTime <= now) {
        if (scheduledTime.toLocaleDateString() === now.toLocaleDateString()) {
          scheduledTime.setDate(scheduledTime.getDate() + 1);
        }
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title || 'Reminder',
          body: reminder.body || '',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: scheduledTime,
        },
        identifier: reminder.id,
      });
      return notificationId;
    }

    // Handle Recurring
    const recurrence = reminder.recurrence || { frequency: 'day', interval: 1 };

    if (recurrence.frequency === 'day') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title || 'Reminder',
          body: reminder.body || '',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: scheduledTime.getHours(),
          minute: scheduledTime.getMinutes(),
        },
        identifier: reminder.id,
      });
    } else if (recurrence.frequency === 'week') {
      const days = recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0
        ? recurrence.daysOfWeek
        : [scheduledTime.getDay()];

      for (const day of days) {
        // JS Day: 0(Sun) - 6(Sat)
        // Expo Weekday: 1(Sun) - 7(Sat)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title || 'Reminder',
            body: reminder.body || '',
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1,
            hour: scheduledTime.getHours(),
            minute: scheduledTime.getMinutes(),
          },
          identifier: `${reminder.id}_${day}`,
        });
      }
    } else if (recurrence.frequency === 'month') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title || 'Reminder',
          body: reminder.body || '',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
          day: scheduledTime.getDate(),
          hour: scheduledTime.getHours(),
          minute: scheduledTime.getMinutes(),
        },
        identifier: reminder.id,
      });
    } else if (recurrence.frequency === 'year') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title || 'Reminder',
          body: reminder.body || '',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          month: scheduledTime.getMonth() + 1,
          day: scheduledTime.getDate(),
          hour: scheduledTime.getHours(),
          minute: scheduledTime.getMinutes(),
        },
        identifier: reminder.id,
      });
    }

    return reminder.id;
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
    // Try to cancel the main ID
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    // Try to cancel all possible day-specific variants
    for (let i = 0; i <= 6; i++) {
      await Notifications.cancelScheduledNotificationAsync(`${notificationId}_${i}`);
    }
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

