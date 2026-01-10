import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerForPushNotificationsAsync,
  scheduleReminder,
  cancelReminder,
  shouldInitializeNotifications,
  markNotificationsInitialized,
  getAllScheduledNotifications,
  Reminder,
} from './utils/notifications';

const REMINDERS_STORAGE_KEY = 'reminders';
const NOTES_STORAGE_KEY = 'notes';

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

type Tab = 'reminders' | 'notes';

export default function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('reminders');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderBody, setReminderBody] = useState('');
  const [isDaily, setIsDaily] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  // Initialize notifications on mount
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Register for notifications
      const hasPermission = await registerForPushNotificationsAsync();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings to use reminders.'
        );
        return;
      }

      // Check if we need to reschedule notifications
      const shouldInit = await shouldInitializeNotifications();
      
      // Load reminders from storage
      const storedReminders = await loadReminders();
      setReminders(storedReminders);

      // Load notes from storage
      const storedNotes = await loadNotes();
      setNotes(storedNotes);

      if (shouldInit && storedReminders.length > 0) {
        // Reschedule all reminders
        for (const reminder of storedReminders) {
          await scheduleReminder(reminder);
        }
        await markNotificationsInitialized();
      }
    } catch (error) {
      console.error('Error initializing app:', error);
      Alert.alert('Error', 'Failed to initialize the app. Please try again.');
    }
  };

  const loadReminders = async (): Promise<Reminder[]> => {
    try {
      const stored = await AsyncStorage.getItem(REMINDERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert expiresAt strings back to Date objects
        return parsed.map((r: any) => ({
          ...r,
          expiresAt: r.expiresAt ? new Date(r.expiresAt) : undefined,
        }));
      }
      return [];
    } catch (error) {
      console.error('Error loading reminders:', error);
      return [];
    }
  };

  const saveReminders = async (newReminders: Reminder[]) => {
    try {
      await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(newReminders));
    } catch (error) {
      console.error('Error saving reminders:', error);
    }
  };

  const loadNotes = async (): Promise<Note[]> => {
    try {
      const stored = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        return parsed.map((n: any) => ({
          ...n,
          createdAt: new Date(n.createdAt),
          updatedAt: new Date(n.updatedAt),
        }));
      }
      return [];
    } catch (error) {
      console.error('Error loading notes:', error);
      return [];
    }
  };

  const saveNotes = async (newNotes: Note[]) => {
    try {
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(newNotes));
    } catch (error) {
      console.error('Error saving notes:', error);
    }
  };

  const handleEditReminder = (reminder: Reminder) => {
    setEditingReminderId(reminder.id);
    setReminderTitle(reminder.title);
    setReminderBody(reminder.body || '');
    const time = new Date();
    time.setHours(reminder.hour, reminder.minute, 0, 0);
    setSelectedTime(time);
    setIsDaily(reminder.isDaily);
    setShowTimePicker(false);
    setModalVisible(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderTitle.trim()) {
      Alert.alert('Error', 'Please enter a reminder title.');
      return;
    }

    if (editingReminderId) {
      // Edit existing reminder
      const existingReminder = reminders.find((r) => r.id === editingReminderId);
      if (!existingReminder) return;

      // Cancel old notification
      await cancelReminder(editingReminderId);

      // Create updated reminder
      const updatedReminder: Reminder = {
        ...existingReminder,
        title: reminderTitle.trim(),
        body: reminderBody.trim() || undefined,
        hour: selectedTime.getHours(),
        minute: selectedTime.getMinutes(),
        isDaily,
        expiresAt: isDaily ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Schedule new notification
      const notificationId = await scheduleReminder(updatedReminder);
      if (!notificationId) {
        Alert.alert('Error', 'Failed to schedule notification. Please try again.');
        return;
      }

      // Update state and storage
      const updatedReminders = reminders.map((r) =>
        r.id === editingReminderId ? updatedReminder : r
      );
      setReminders(updatedReminders);
      await saveReminders(updatedReminders);
    } else {
      // Add new reminder
      const newReminder: Reminder = {
        id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: reminderTitle.trim(),
        body: reminderBody.trim() || undefined,
        hour: selectedTime.getHours(),
        minute: selectedTime.getMinutes(),
        isDaily,
        expiresAt: isDaily ? undefined : new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      // Schedule notification
      const notificationId = await scheduleReminder(newReminder);
      if (!notificationId) {
        Alert.alert('Error', 'Failed to schedule notification. Please try again.');
        return;
      }

      // Update state and storage
      const updatedReminders = [...reminders, newReminder];
      setReminders(updatedReminders);
      await saveReminders(updatedReminders);
    }

    // Reset form
    setReminderTitle('');
    setReminderBody('');
    setSelectedTime(new Date());
    setIsDaily(true);
    setEditingReminderId(null);
    setShowTimePicker(false);
    setModalVisible(false);
  };

  const handleCloseModal = () => {
    Keyboard.dismiss();
    setShowTimePicker(false);
    setReminderTitle('');
    setReminderBody('');
    setSelectedTime(new Date());
    setIsDaily(true);
    setEditingReminderId(null);
    setModalVisible(false);
  };

  const handleDeleteReminder = async (reminderId: string) => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Cancel notification
            await cancelReminder(reminderId);

            // Remove from state and storage
            const updatedReminders = reminders.filter((r) => r.id !== reminderId);
            setReminders(updatedReminders);
            await saveReminders(updatedReminders);
          },
        },
      ]
    );
  };

  const formatTime = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    let h12 = hour;
    if (hour === 0) {
      h12 = 12; // Midnight (0:00) -> 12 AM
    } else if (hour > 12) {
      h12 = hour - 12; // Afternoon/evening (13-23) -> 1-11 PM
    }
    // hour 1-11 stays as is (AM), hour 12 stays as 12 (PM)
    const h = h12.toString();
    const m = minute.toString().padStart(2, '0');
    return `${h}:${m} ${period}`;
  };

  const handleEditNote = (note: Note) => {
    setEditingNoteId(note.id);
    setNoteTitle(note.title);
    setNoteBody(note.body);
    setNoteModalVisible(true);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert('Error', 'Please enter a note title.');
      return;
    }

    if (editingNoteId) {
      // Edit existing note
      const updatedNote: Note = {
        id: editingNoteId,
        title: noteTitle.trim(),
        body: noteBody.trim(),
        createdAt: notes.find((n) => n.id === editingNoteId)!.createdAt,
        updatedAt: new Date(),
      };

      const updatedNotes = notes.map((n) =>
        n.id === editingNoteId ? updatedNote : n
      );
      setNotes(updatedNotes);
      await saveNotes(updatedNotes);
    } else {
      // Add new note
      const newNote: Note = {
        id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: noteTitle.trim(),
        body: noteBody.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      await saveNotes(updatedNotes);
    }

    // Reset form
    setNoteTitle('');
    setNoteBody('');
    setEditingNoteId(null);
    setNoteModalVisible(false);
  };

  const handleCloseNoteModal = () => {
    Keyboard.dismiss();
    setNoteTitle('');
    setNoteBody('');
    setEditingNoteId(null);
    setNoteModalVisible(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedNotes = notes.filter((n) => n.id !== noteId);
            setNotes(updatedNotes);
            await saveNotes(updatedNotes);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>
            {currentTab === 'reminders' ? 'Reminders' : 'Notes'}
          </Text>
          <TouchableOpacity
            style={styles.tabButton}
            onPress={() => setCurrentTab(currentTab === 'reminders' ? 'notes' : 'reminders')}
          >
            <Text style={styles.tabButtonText}>
              {currentTab === 'reminders' ? 'Notes' : 'Reminders'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>
          {currentTab === 'reminders' ? 'Your daily notifications' : 'Your personal notes'}
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {currentTab === 'reminders' ? (
          reminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No reminders yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the button below to create your first reminder
              </Text>
            </View>
          ) : (
            reminders.map((reminder) => (
              <View key={reminder.id} style={styles.reminderCard}>
                <View style={styles.reminderContent}>
                  <Text style={styles.reminderTitle}>{reminder.title}</Text>
                  <Text style={styles.reminderTime}>
                    {formatTime(reminder.hour, reminder.minute)}
                  </Text>
                  <Text style={styles.reminderType}>
                    {reminder.isDaily ? 'Daily' : 'One-time'}
                  </Text>
                </View>
                <View style={styles.reminderActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditReminder(reminder)}
                  >
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteReminder(reminder.id)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : (
          notes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No notes yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Tap the button below to create your first note
              </Text>
            </View>
          ) : (
            notes.map((note) => (
              <TouchableOpacity
                key={note.id}
                style={styles.noteCard}
                onPress={() => handleEditNote(note)}
              >
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle}>{note.title}</Text>
                  {note.body ? (
                    <ScrollView 
                      style={styles.noteBodyScroll}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      <Text style={styles.noteBody}>
                        {note.body}
                      </Text>
                    </ScrollView>
                  ) : null}
                  <Text style={styles.noteDate}>
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteNote(note.id);
                  }}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          if (currentTab === 'reminders') {
            setEditingReminderId(null);
            setReminderTitle('');
            setReminderBody('');
            setSelectedTime(new Date());
            setIsDaily(true);
            setShowTimePicker(false);
            setModalVisible(true);
          } else {
            setEditingNoteId(null);
            setNoteTitle('');
            setNoteBody('');
            setNoteModalVisible(true);
          }
        }}
      >
        <Text style={styles.addButtonText}>
          {currentTab === 'reminders' ? '+ Add Reminder' : '+ Add Note'}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setShowTimePicker(false);
        }}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    {editingReminderId ? 'Edit Reminder' : 'New Reminder'}
                  </Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Title</Text>
                    <View style={styles.textInputWrapper}>
                      <TextInput
                        style={styles.textInput}
                        value={reminderTitle}
                        onChangeText={setReminderTitle}
                        placeholder="Enter reminder title"
                        placeholderTextColor="#6C6863"
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Notification Body (Optional)</Text>
                    <View style={[styles.textInputWrapper, styles.reminderBodyWrapper]}>
                      <TextInput
                        style={[styles.textInput, styles.reminderBodyText]}
                        value={reminderBody}
                        onChangeText={setReminderBody}
                        placeholder="Enter notification body text"
                        placeholderTextColor="#6C6863"
                        multiline
                        textAlignVertical="top"
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => {
                        Keyboard.dismiss();
                        setShowTimePicker(true);
                      }}
                    >
                      <Text style={styles.timeButtonText}>
                        {formatTime(selectedTime.getHours(), selectedTime.getMinutes())}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {showTimePicker && (
                    <View style={styles.datePickerContainer}>
                      <DateTimePicker
                        value={selectedTime}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, date) => {
                          setShowTimePicker(Platform.OS === 'ios');
                          if (date) {
                            setSelectedTime(date);
                          }
                        }}
                      />
                    </View>
                  )}

                  <View style={styles.toggleContainer}>
                    <TouchableOpacity
                      style={[styles.toggleOption, isDaily && styles.toggleOptionActive]}
                      onPress={() => setIsDaily(true)}
                    >
                      <Text style={[styles.toggleText, isDaily && styles.toggleTextActive]}>
                        Daily
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleOption, !isDaily && styles.toggleOptionActive]}
                      onPress={() => setIsDaily(false)}
                    >
                      <Text style={[styles.toggleText, !isDaily && styles.toggleTextActive]}>
                        One-time
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={handleCloseModal}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleSaveReminder}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={noteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseNoteModal}
      >
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
        }}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <TouchableWithoutFeedback onPress={() => {}}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    {editingNoteId ? 'Edit Note' : 'New Note'}
                  </Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Title</Text>
                    <View style={styles.textInputWrapper}>
                      <TextInput
                        style={styles.textInput}
                        value={noteTitle}
                        onChangeText={setNoteTitle}
                        placeholder="Enter note title"
                        placeholderTextColor="#6C6863"
                      />
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Body</Text>
                    <View style={styles.textAreaWrapper}>
                      <TextInput
                        style={[styles.textInput, styles.textArea]}
                        value={noteBody}
                        onChangeText={setNoteBody}
                        placeholder="Enter your notes here..."
                        placeholderTextColor="#6C6863"
                        multiline
                        textAlignVertical="top"
                      />
                    </View>
                    <View style={styles.textAreaDivider} />
                  </View>
                  
                  

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.cancelButton]}
                      onPress={handleCloseNoteModal}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={handleSaveNote}
                    >
                      <Text style={styles.saveButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F8F6',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '400',
    color: '#1A1A1A',
    fontFamily: Platform.OS === 'ios' ? 'Playfair Display' : 'serif',
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  tabButtonText: {
    fontSize: 12,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6C6863',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 20,
    color: '#1A1A1A',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'Playfair Display' : 'serif',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6C6863',
    textAlign: 'center',
  },
  reminderCard: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  reminderTime: {
    fontSize: 24,
    fontWeight: '400',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Playfair Display' : 'serif',
  },
  reminderType: {
    fontSize: 12,
    color: '#6C6863',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reminderActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  editButtonText: {
    fontSize: 12,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  deleteButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#F9F8F6',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    padding: 24,
    paddingBottom: 40,
  },
  datePickerContainer: {
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: '400',
    color: '#1A1A1A',
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'Playfair Display' : 'serif',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 12,
    color: '#6C6863',
    textTransform: 'uppercase',
    letterSpacing: 0.25,
    marginBottom: 8,
  },
  textInputWrapper: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 8,
  },
  textInput: {
    fontSize: 16,
    color: '#1A1A1A',
    minHeight: 24,
  },
  timeButton: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    paddingBottom: 8,
    alignSelf: 'flex-start',
  },
  timeButtonText: {
    fontSize: 24,
    color: '#1A1A1A',
    fontFamily: Platform.OS === 'ios' ? 'Playfair Display' : 'serif',
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 12,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#1A1A1A',
  },
  toggleText: {
    fontSize: 14,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#1A1A1A',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#1A1A1A',
  },
  saveButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  noteContent: {
    flex: 1,
    marginRight: 12,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  noteBodyScroll: {
    maxHeight: 100,
    marginBottom: 8,
  },
  noteBody: {
    fontSize: 14,
    color: '#6C6863',
    lineHeight: 20,
  },
  noteDate: {
    fontSize: 12,
    color: '#6C6863',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textAreaWrapper: {
    height: 100,
    paddingTop: 8,
    marginBottom: 8,
  },
  textArea: {
    height: 100,
    fontSize: 16,
    color: '#1A1A1A',
  },
  textAreaDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
    marginTop: 8,
  },
  reminderBodyWrapper: {
    minHeight: 40,
    paddingTop: 8,
  },
  reminderBodyText: {
    minHeight: 40,
    fontSize: 16,
    color: '#1A1A1A',
  },
});

