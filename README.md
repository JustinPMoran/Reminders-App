# Reminders App

A sophisticated Reminder App built with Expo and expo-notifications, featuring local push notifications with daily repeating and one-time reminder support.

## Features

- ✅ Create, view, and delete reminders
- ✅ Local push notifications (no FCM/APNs required)
- ✅ Daily repeating notifications using `Notifications.SchedulableTriggerInputTypes.DAILY`
- ✅ One-time notifications with expiration
- ✅ Stable notification IDs for reliable cancellation
- ✅ Smart rescheduling strategy to prevent redundant notifications
- ✅ Android notification channels support
- ✅ Cross-platform permission handling (iOS & Android)
- ✅ Persistent storage using AsyncStorage

## Technical Implementation

### Notification Engine
- **File**: `utils/notifications.ts`
- Uses `expo-notifications` for local scheduled notifications only
- Implements Android notification channels with maximum importance
- Handles permission requests for both iOS and Android

### Scheduling Logic
- **Daily Reminders**: Uses `Notifications.SchedulableTriggerInputTypes.DAILY` with hour and minute
- **One-time Reminders**: Uses date-based triggers that expire after the scheduled time
- **Stable Identifiers**: Each notification uses a unique, stable ID that can be specifically canceled

### Rescheduling Strategy
- Uses AsyncStorage to track if notifications have been initialized for the current day
- Prevents redundant scheduling on app restart
- Automatically reschedules all reminders if it's a new day

### State Management
- Uses React `useState` for managing the reminder list
- Persists reminders to AsyncStorage for app restarts
- Synchronizes notification scheduling with stored reminders

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (for Mac) or Android Emulator, or Expo Go app on your device

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm start
   ```

3. **Run on your device/simulator:**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app on your physical device

### Project Structure

```
Reminders-App/
├── App.tsx                 # Main app component with UI and state management
├── utils/
│   └── notifications.ts    # Notification utilities and scheduling logic
├── app.json                # Expo configuration
├── package.json            # Dependencies
└── tsconfig.json           # TypeScript configuration
```

## Usage

1. **Create a Reminder:**
   - Tap the "+ Add Reminder" button at the bottom
   - Enter a title for your reminder
   - Select a time using the time picker
   - Choose between "Daily" (repeating) or "One-time" reminder
   - Tap "Save"

2. **View Reminders:**
   - All active reminders are displayed in a list
   - Each reminder shows the title, time, and type (Daily/One-time)

3. **Delete a Reminder:**
   - Tap the "Delete" button on any reminder card
   - Confirm the deletion
   - The notification will be canceled immediately

## Key Implementation Details

### Android Notification Channels
The app creates a default notification channel with maximum importance:
```typescript
await Notifications.setNotificationChannelAsync('default', {
  name: 'Default',
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: '#D4AF37',
});
```

### Daily Trigger Example
```typescript
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.DAILY,
  hour: reminder.hour,
  minute: reminder.minute,
  repeats: true,
}
```

### Notification Cancellation
When a reminder is deleted, the notification is immediately canceled using its stable ID:
```typescript
await Notifications.cancelScheduledNotificationAsync(reminderId);
```

## Design Philosophy

The app follows a luxury/editorial design system with:
- Sophisticated monochrome color palette (warm alabaster background, rich charcoal text)
- Editorial typography with Playfair Display for headings
- Rectangular, architectural design (0px border-radius)
- Generous spacing and deliberate asymmetry
- Subtle shadows and layered depth

## Platform-Specific Notes

### iOS
- Requires notification permissions on first launch
- Uses native iOS time picker
- Notifications work in background and foreground

### Android
- Requires notification permissions on first launch
- Uses Android notification channels (API 26+)
- Notifications work in background and foreground
- Supports vibration patterns and custom light colors

## Troubleshooting

**Notifications not appearing:**
- Check that notification permissions are granted in device settings
- Verify that the app is not in "Do Not Disturb" mode
- Ensure the device time is set correctly

**Reminders not persisting:**
- Check AsyncStorage permissions
- Verify that the app has storage access

## License

See LICENSE file for details.
