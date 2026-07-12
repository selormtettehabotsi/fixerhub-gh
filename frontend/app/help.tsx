import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface QA {
  q: string;
  a: string;
}

interface Section {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  items: QA[];
}

const SECTIONS: Section[] = [
  {
    title: 'Getting Started',
    icon: 'rocket-outline',
    items: [
      {
        q: 'How do I create an account?',
        a: 'Tap "Get Started" on the welcome screen, choose whether you are a Customer or a Worker, then fill in your name, email, phone and password. Workers also provide a skill and location.',
      },
      {
        q: "What's the difference between Customer and Worker?",
        a: 'Customers book services from local professionals. Workers create a profile, set their availability and pricing, and receive booking requests from customers nearby.',
      },
      {
        q: 'How do I update my profile picture?',
        a: 'Open your Profile tab, tap your avatar, and choose a photo from your library. Your picture syncs across the app automatically.',
      },
    ],
  },
  {
    title: 'Booking a Worker',
    icon: 'search-outline',
    items: [
      {
        q: 'How do I find a worker near me?',
        a: 'From the Home tab, browse categories or use nearby search. FixerHub uses your location to show available workers closest to you, sorted by distance.',
      },
      {
        q: 'What happens after I book?',
        a: 'The worker is notified of your request. Once they accept, you can chat to agree on details. The status of your booking updates as the job progresses.',
      },
      {
        q: 'Can I cancel a booking?',
        a: 'Yes. Open the booking from the Bookings tab and tap Cancel. Please cancel as early as possible out of courtesy to the worker.',
      },
      {
        q: 'How do I track my booking status?',
        a: 'Every booking shows a live status — Pending, Accepted, In Progress, Completed or Cancelled — in the Bookings tab and on the booking detail screen.',
      },
    ],
  },
  {
    title: 'Payments & Billing',
    icon: 'card-outline',
    items: [
      {
        q: 'How does payment work?',
        a: 'When a job is marked complete, you pay securely through Paystack. Tap "Pay Now" on the booking, complete checkout, then confirm the payment in the app.',
      },
      {
        q: 'When do I pay?',
        a: 'Payment happens after the worker marks the job as completed. You will see a "Pay Now" button on the booking once it is ready for payment.',
      },
      {
        q: 'Is my payment secure?',
        a: 'Yes. All payments are processed by Paystack, a PCI-DSS compliant payment provider. FixerHub never stores your card details.',
      },
      {
        q: 'What is the FixerHub commission?',
        a: 'FixerHub deducts a small commission from each completed job to keep the platform running. The breakdown is shown on your payment receipt.',
      },
    ],
  },
  {
    title: 'Chat',
    icon: 'chatbubble-ellipses-outline',
    items: [
      {
        q: 'How do I chat with a worker?',
        a: 'Open a worker profile or a booking and tap Chat. You can message back and forth to discuss the job before and after booking.',
      },
      {
        q: 'Are my messages saved?',
        a: 'Yes. Conversations are saved per booking so you can always return to them from the Chats tab.',
      },
      {
        q: 'Can I share photos in chat?',
        a: 'Photo sharing in chat is being rolled out. For now you can attach photos when confirming a booking so the worker sees the job upfront.',
      },
    ],
  },
  {
    title: 'Account & Profile',
    icon: 'person-circle-outline',
    items: [
      {
        q: 'How do I reset my password?',
        a: 'On the login screen tap "Forgot Password", enter your phone number, and we will send a 6-digit OTP via SMS. Enter it with your new password to reset.',
      },
      {
        q: 'How do I change my phone number?',
        a: 'Phone number changes are handled by support for security reasons. Submit a request through Report an Issue and our team will assist you.',
      },
      {
        q: 'How do I delete my account?',
        a: 'To delete your account, submit a request through Report an Issue selecting "Other". Our team will process the deletion of your data.',
      },
    ],
  },
  {
    title: 'Reporting Issues',
    icon: 'flag-outline',
    items: [
      {
        q: 'How do I report a problem?',
        a: 'Go to your Profile and tap "Report an Issue". Choose a category, describe what happened, and submit. Our team reviews every report.',
      },
      {
        q: 'How long does it take to resolve a report?',
        a: 'Most reports are reviewed within 24–48 hours. Complex cases involving payments may take a little longer.',
      },
      {
        q: 'What counts as a valid report?',
        a: 'Payment problems, app issues, and concerns about a worker or customer are all valid. Please include as much detail as possible so we can help quickly.',
      },
    ],
  },
];

export default function HelpCentreScreen() {
  const [open, setOpen] = useState<number | null>(0);

  function toggle(index: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(open === index ? null : index);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Help Centre</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.intro}>
          Find answers to common questions. Tap a section to expand it.
        </Text>

        {SECTIONS.map((section, index) => {
          const isOpen = open === index;
          return (
            <View key={section.title} style={styles.card}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggle(index)}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Ionicons name={section.icon} size={20} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Ionicons
                  name={isOpen ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.onSurfaceVariant}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.sectionBody}>
                  {section.items.map((item, i) => (
                    <View key={i} style={[styles.qaItem, i > 0 && styles.qaItemBorder]}>
                      <Text style={styles.question}>{item.q}</Text>
                      <Text style={styles.answer}>{item.a}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surfaceContainerHigh,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onSurface,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  intro: {
    fontSize: 14,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
    lineHeight: 20,
  },

  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  qaItem: { paddingVertical: 14 },
  qaItemBorder: { borderTopWidth: 1, borderTopColor: Colors.surfaceContainerHigh },
  question: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.onSurface,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 6,
  },
  answer: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
});
