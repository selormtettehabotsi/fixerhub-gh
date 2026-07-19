import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  FlatList,
  Dimensions,
  Linking,
  AppState,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../../src/constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;

/** Returns true if the URL is a video file (Cloudinary /video/ or common extensions). */
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0];
  return lower.includes('/video/upload/') ||
    lower.endsWith('.mp4') || lower.endsWith('.mov') ||
    lower.endsWith('.webm') || lower.endsWith('.avi') || lower.endsWith('.3gp');
}
import { getBooking, getBookingsByCustomer, cancelBooking, Booking } from '../../src/api/bookings';
import { getPaymentUrl, verifyPayment, getPaymentByBooking, Payment } from '../../src/api/payments';
import RatingPromptModal from '../../src/components/RatingPromptModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatUserId, formatWorkerId, formatBookingId, conversationId as mkConversationId } from '../../src/utils/formatId';
import { cloudinaryThumb } from '../../src/utils/imageUrl';
import LiveTrackingMap from '../../src/components/LiveTrackingMap';
import { useLocation } from '../../src/hooks/useLocation';

const HIDDEN_KEY = 'hiddenBookingIds';

const STATUSES = ['PENDING', 'ACCEPTED', 'WORKER_ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'];
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  WORKER_ON_THE_WAY: 'On the Way',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: Colors.warning,
  ACCEPTED: Colors.secondary,
  WORKER_ON_THE_WAY: Colors.tertiary,
  IN_PROGRESS: Colors.primary,
  COMPLETED: Colors.available,
  CANCELLED: Colors.unavailable,
};

export default function BookingDetailScreen() {
  const { id, bookingNumber } = useLocalSearchParams<{ id: string; bookingNumber?: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [myName, setMyName] = useState('');
  const [myProfilePicture, setMyProfilePicture] = useState('');
  const [showPhoto, setShowPhoto] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [paymentOpened, setPaymentOpened] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<Payment | null>(null);
  const [resolvedBookingNumber, setResolvedBookingNumber] = useState<number | null>(
    bookingNumber ? Number(bookingNumber) : null
  );
  // Must be declared here (not after early returns) to satisfy Rules of Hooks
  const [photoIndex, setPhotoIndex] = useState(0);
  const appStateRef = useRef(AppState.currentState);
  // LIVE TRACKING: customer's own position for the route line + ETA
  const { latitude: myLat, longitude: myLng } = useLocation();

  const loadBooking = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getBooking(id);
      setBooking(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    AsyncStorage.multiGet(['role', 'userId', 'name', 'profilePicture']).then(([[, r], [, uid], [, n], [, pic]]) => {
      setUserRole(r ?? '');
      if (uid) setMyUserId(Number(uid));
      if (n) setMyName(n);
      if (pic) setMyProfilePicture(pic);
    });
    loadBooking();
    const interval = setInterval(loadBooking, 10000);
    return () => clearInterval(interval);
  }, [loadBooking]);

  // Compute booking number for customers when not passed as URL param
  useEffect(() => {
    if (resolvedBookingNumber != null || !booking) return;
    AsyncStorage.multiGet(['role', 'userId']).then(async ([[, role], [, userId]]) => {
      if (role !== 'CUSTOMER' || !userId) return;
      try {
        const all = await getBookingsByCustomer(userId);
        const sorted = [...all].sort((a, b) => a.id - b.id);
        const idx = sorted.findIndex((b) => b.id === booking.id);
        if (idx >= 0) setResolvedBookingNumber(idx + 1);
      } catch {
        // non-critical
      }
    });
  }, [booking, resolvedBookingNumber]);

  // ── Cancel booking ────────────────────────────────────────────────────────
  function handleCancel() {
    if (!booking) return;
    const isLate = booking.status === 'WORKER_ON_THE_WAY' || booking.status === 'IN_PROGRESS';
    const title = isLate ? 'Cancel Active Job?' : 'Cancel Booking?';
    const message = isLate
      ? 'The worker is already on the way or working. Cancelling now may affect your account. Are you sure?'
      : `Are you sure you want to cancel this ${booking.serviceType} booking?`;

    Alert.alert(title, message, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel Booking',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            const updated = await cancelBooking(booking.id);
            setBooking(updated);
          } catch (err: any) {
            Alert.alert('Error', err?.message ?? 'Could not cancel booking.');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  // ── Hide booking from lists (soft delete — stays in DB) ──────────────────
  async function handleHide() {
    if (!booking) return;
    Alert.alert(
      'Hide this booking?',
      'It will be removed from your list but stays on the server. You cannot undo this.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            try {
              const raw = await AsyncStorage.getItem(HIDDEN_KEY);
              const existing: number[] = raw ? JSON.parse(raw) : [];
              if (!existing.includes(booking.id)) {
                await AsyncStorage.setItem(HIDDEN_KEY, JSON.stringify([...existing, booking.id]));
              }
              router.back();
            } catch {
              Alert.alert('Error', 'Could not hide booking.');
            }
          },
        },
      ],
    );
  }

  // ── Load existing payment data for completed bookings (customer + worker) ──
  useEffect(() => {
    if (!booking || booking.status !== 'COMPLETED') return;
    if (userRole !== 'CUSTOMER' && userRole !== 'WORKER') return;
    getPaymentByBooking(booking.id)
      .then((p) => {
        setPaymentStatus(p.paystackStatus ?? p.status ?? null);
        // Store full payment data when payment is confirmed
        if (p.paystackStatus === 'success' || p.status === 'SUCCESS') {
          setPaymentData(p);
        }
      })
      .catch(() => { /* payment record may not exist yet */ });
  }, [booking, userRole]);

  // ── AppState listener: show confirm button when user returns from Paystack browser ──
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === 'active' &&
        paymentOpened
      ) {
        // User came back to the app after opening Paystack — prompt them to confirm
        setPaymentOpened(true);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [paymentOpened]);

  // ── Pay Now ──────────────────────────────────────────────────────────────
  async function handlePayNow() {
    if (!booking) return;
    setPaying(true);
    try {
      const { authorizationUrl } = await getPaymentUrl(booking.id);
      if (!authorizationUrl) {
        Alert.alert('Payment not ready', 'The payment link is not available yet. Please try again shortly.');
        return;
      }

      // Mark as opened BEFORE launching browser so AppState listener works
      setPaymentOpened(true);

      // Try in-app browser first (Chrome Custom Tabs / SFSafariViewController)
      // Falls back to system browser if unavailable
      try {
        await WebBrowser.openBrowserAsync(authorizationUrl, {
          showTitle: true,
          toolbarColor: '#0052CC',
        });
      } catch {
        // In-app browser not available — open in system browser
        const canOpen = await Linking.canOpenURL(authorizationUrl);
        if (canOpen) {
          await Linking.openURL(authorizationUrl);
        } else {
          Alert.alert('Cannot open browser', 'Please open this URL manually:\n' + authorizationUrl);
        }
      }
    } catch (err: any) {
      setPaymentOpened(false);
      const msg = err?.response?.data?.error ?? err?.message ?? 'Could not start payment.';
      Alert.alert('Payment Error', msg);
    } finally {
      setPaying(false);
    }
  }

  // ── Confirm Payment ────────────────────────────────────────────────────────
  async function handleConfirmPayment() {
    if (!booking) return;
    setVerifying(true);
    try {
      const { status } = await verifyPayment(booking.id);
      setPaymentStatus(status);
      if (status === 'success') {
        // Fetch the full payment record so receipt details are available inline
        const payment = await getPaymentByBooking(booking.id).catch(() => null);
        if (payment) setPaymentData(payment);
      } else {
        Alert.alert(
          'Not confirmed yet',
          'Payment not confirmed by Paystack. If you already paid, wait a moment and try again.',
          [
            { text: 'Try Again', onPress: handleConfirmPayment },
            { text: 'Back to Pay Now', style: 'cancel', onPress: () => setPaymentOpened(false) },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Could not verify payment.');
    } finally {
      setVerifying(false);
    }
  }

  // ── Share receipt ─────────────────────────────────────────────────────────
  function handleShareReceipt() {
    if (!paymentData || !booking) return;
    const commPct = Math.round((paymentData.commissionRate ?? 0.05) * 100);
    const lines = [
      '===========================',
      '   FixerHub Payment Receipt',
      '===========================',
      '',
      `Service:       ${paymentData.serviceType ?? booking.serviceType ?? '—'}`,
      `Booking:       ${formatBookingId(booking.id)}`,
      `Worker:        ${paymentData.workerName ?? booking.workerName ?? '—'}`,
      '',
      `Total Paid:    GH₵ ${(paymentData.amount ?? 0).toFixed(2)}`,
      `FixerHub (${commPct}%): GH₵ ${(paymentData.commissionAmount ?? 0).toFixed(2)}`,
      `Worker Payout: GH₵ ${(paymentData.workerAmount ?? 0).toFixed(2)}`,
      '',
      `Reference:     ${paymentData.paystackReference ?? '—'}`,
      `Date:          ${paymentData.createdAt ? new Date(paymentData.createdAt).toLocaleString() : new Date().toLocaleString()}`,
      '',
      'Powered by FixerHub',
    ];
    Share.share({ message: lines.join('\n'), title: 'FixerHub Payment Receipt' });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (error || !booking) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.error} />
        <Text style={styles.errorText}>{error ?? 'Booking not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const currentIndex = STATUSES.indexOf(booking.status);
  const isCancelled = booking.status === 'CANCELLED';
  const isCompleted = booking.status === 'COMPLETED';
  const isTerminal = isCancelled || isCompleted;
  const isPaid = paymentStatus === 'success' || paymentStatus === 'SUCCESS';

  // Collect all media for the modal viewer
  const allBookingMedia: string[] = booking.bookingImages && booking.bookingImages.length > 0
    ? booking.bookingImages
    : booking.bookingImage ? [booking.bookingImage] : [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.serviceType}>{booking.serviceType}</Text>
            {resolvedBookingNumber != null && (
              <Text style={styles.bookingNumLabel}>Your Booking #{resolvedBookingNumber}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[booking.status] ?? Colors.outline }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[booking.status] ?? booking.status}</Text>
          </View>
        </View>

        {!isCancelled && (
          <View style={styles.stepperCard}>
            <Text style={styles.stepperTitle}>Job Progress</Text>
            <View style={styles.stepper}>
              {STATUSES.map((status, index) => {
                const isActive = index <= currentIndex;
                const isLast = index === STATUSES.length - 1;
                return (
                  <React.Fragment key={status}>
                    <View style={styles.stepItem}>
                      <View style={[styles.stepCircle, isActive ? styles.stepCircleActive : styles.stepCircleInactive]}>
                        {isActive ? (
                          <Ionicons name="checkmark" size={14} color={Colors.onPrimary} />
                        ) : (
                          <Text style={styles.stepNumber}>{index + 1}</Text>
                        )}
                      </View>
                      <Text style={[styles.stepLabel, isActive ? styles.stepLabelActive : styles.stepLabelInactive]} numberOfLines={2}>
                        {STATUS_LABELS[status]}
                      </Text>
                    </View>
                    {!isLast && (
                      <View style={[styles.stepLine, index < currentIndex ? styles.stepLineActive : styles.stepLineInactive]} />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          </View>
        )}

        {/* LIVE TRACKING: Uber-style map while the worker is en route.
            Customer view: worker marker + own home marker + route/ETA.
            Worker view (via View Details): their own broadcast position. */}
        {booking.status === 'WORKER_ON_THE_WAY' && (
          <LiveTrackingMap
            bookingId={booking.id}
            workerName={userRole === 'WORKER' ? 'You' : (booking.workerName ?? undefined)}
            // Customer view: their live position. Worker view: the job location
            // captured when the booking was created — destination + route + ETA.
            customerLat={userRole === 'CUSTOMER' ? (myLat ?? booking.customerLat) : booking.customerLat}
            customerLng={userRole === 'CUSTOMER' ? (myLng ?? booking.customerLng) : booking.customerLng}
          />
        )}

        <View style={styles.detailCard}>
          <Text style={styles.sectionTitle}>Booking Details</Text>
          <DetailRow icon="receipt-outline" label="Booking ID" value={formatBookingId(booking.id)} />
          <DetailRow icon="person-outline" label="Worker" value={booking.workerName ?? `Worker ${formatWorkerId(booking.workerId)}`} />
          <DetailRow icon="call-outline" label="Contact" value={booking.customerPhone ?? '—'} />
          <DetailRow
            icon="cash-outline"
            label="Amount"
            value={booking.minAmount != null && booking.maxAmount != null
              ? `GH₵ ${booking.minAmount} – GH₵ ${booking.maxAmount}`
              : `GH₵ ${booking.amount ?? 0}`}
          />
          {/* SCHEDULING: when the customer asked the worker to come */}
          {booking.scheduledAt && (
            <DetailRow
              icon="time-outline"
              label="Scheduled for"
              value={new Date(booking.scheduledAt).toLocaleString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            />
          )}
          {booking.createdAt && (
            <DetailRow icon="calendar-outline" label="Booked" value={new Date(booking.createdAt).toLocaleDateString()} />
          )}
          {booking.notes ? (
            <View style={styles.notesRow}>
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.notesText}>{booking.notes}</Text>
              </View>
            </View>
          ) : null}

          {/* ── Booking Media (images + video) ─────────────────────── */}
          {((booking.bookingImages && booking.bookingImages.length > 0) || booking.bookingImage) ? (() => {
            // Build unified media list: bookingImages takes priority, fallback to bookingImage
            const allMedia: string[] = booking.bookingImages && booking.bookingImages.length > 0
              ? booking.bookingImages
              : [booking.bookingImage!];
            return (
              <View style={styles.photoSection}>
                <Text style={styles.detailLabel}>
                  {allMedia.length > 1 ? `Media (${allMedia.length})` : 'Booking Media'}
                </Text>
                {allMedia.length === 1 ? (
                  isVideoUrl(allMedia[0]) ? (
                    <TouchableOpacity
                      style={styles.videoThumbWrap}
                      onPress={() => WebBrowser.openBrowserAsync(allMedia[0])}
                      activeOpacity={0.85}
                    >
                      <View style={styles.videoPlayOverlay}>
                        <Ionicons name="play-circle" size={52} color="#fff" />
                      </View>
                      <View style={styles.photoHint}>
                        <Ionicons name="videocam-outline" size={14} color={Colors.primary} />
                        <Text style={styles.photoHintText}>Tap to play video</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setShowPhoto(true)} activeOpacity={0.85}>
                      <Image source={{ uri: cloudinaryThumb(allMedia[0], 340) }} style={styles.bookingThumb} resizeMode="cover" />
                      <View style={styles.photoHint}>
                        <Ionicons name="expand-outline" size={14} color={Colors.primary} />
                        <Text style={styles.photoHintText}>Tap to enlarge</Text>
                      </View>
                    </TouchableOpacity>
                  )
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaGallery}>
                    {allMedia.map((url, idx) => (
                      <View key={idx} style={styles.mediaThumbnailWrap}>
                        {isVideoUrl(url) ? (
                          <TouchableOpacity
                            style={styles.mediaThumbnail}
                            onPress={() => WebBrowser.openBrowserAsync(url)}
                            activeOpacity={0.85}
                          >
                            <View style={[styles.mediaThumbnail, styles.videoPlaceholder]}>
                              <Ionicons name="play-circle" size={36} color="#fff" />
                              <Text style={styles.mediaVideoLabel}>Video</Text>
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity onPress={() => { setShowPhoto(true); }} activeOpacity={0.85}>
                            <Image source={{ uri: cloudinaryThumb(url, 140) }} style={styles.mediaThumbnail} resizeMode="cover" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            );
          })() : null}
        </View>

        {/* ── Chat button ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => router.push(`/chat/${mkConversationId(booking.customerId, booking.workerId)}`)}
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-outline" size={18} color={Colors.secondary} />
          <Text style={styles.chatBtnText}>Open Chat</Text>
        </TouchableOpacity>

        {/* ── Pay Now / Confirm Payment (customer, completed) ───────── */}
        {isCompleted && userRole === 'CUSTOMER' && !isPaid && (
          <>
            {!paymentOpened ? (
              <TouchableOpacity
                style={[styles.payBtn, paying && styles.cancelBtnDisabled]}
                onPress={handlePayNow}
                disabled={paying}
                activeOpacity={0.85}
              >
                {paying ? (
                  <>
                    <ActivityIndicator color={Colors.onPrimary} size="small" />
                    <Text style={styles.payBtnText}>Opening Paystack…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color={Colors.onPrimary} />
                    <Text style={styles.payBtnText}>Pay with Paystack</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.payBtn, verifying && styles.cancelBtnDisabled]}
                  onPress={handleConfirmPayment}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <>
                      <ActivityIndicator color={Colors.onPrimary} size="small" />
                      <Text style={styles.payBtnText}>Verifying…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-outline" size={18} color={Colors.onPrimary} />
                      <Text style={styles.payBtnText}>I've Paid — Confirm</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.retryPayBtn}
                  onPress={() => setPaymentOpened(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
                  <Text style={styles.retryPayText}>Didn't pay? Go back to Pay</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        {/* ── Paid badge ────────────────────────────────────────────── */}
        {isCompleted && userRole === 'CUSTOMER' && isPaid && (
          <View style={styles.paidBadge}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.available} />
            <Text style={styles.paidBadgeText}>Payment Completed</Text>
          </View>
        )}

        {/* ── Customer Payment Receipt (inline, shown after payment succeeds) ── */}
        {isCompleted && userRole === 'CUSTOMER' && isPaid && paymentData && (() => {
          const commPct = Math.round((paymentData.commissionRate ?? 0.05) * 100);
          return (
            <View style={styles.receiptCard}>
              <View style={styles.receiptHeader}>
                <Ionicons name="receipt-outline" size={22} color={Colors.available} />
                <Text style={styles.receiptTitle}>Payment Receipt</Text>
              </View>

              <ReceiptRow label="Service" value={paymentData.serviceType ?? booking.serviceType ?? '—'} />
              <ReceiptRow label="Booking ID" value={formatBookingId(booking.id)} />
              <ReceiptRow label="Worker" value={paymentData.workerName ?? booking.workerName ?? '—'} />

              <View style={styles.receiptDivider} />

              <ReceiptRow
                label="Total Paid"
                value={`GH₵ ${(paymentData.amount ?? 0).toFixed(2)}`}
                bold
              />
              <ReceiptRow
                label={`FixerHub Fee (${commPct}%)`}
                value={`GH₵ ${(paymentData.commissionAmount ?? 0).toFixed(2)}`}
              />
              <ReceiptRow
                label="Worker Payout"
                value={`GH₵ ${(paymentData.workerAmount ?? 0).toFixed(2)}`}
              />

              <View style={styles.receiptDivider} />

              <ReceiptRow label="Reference" value={paymentData.paystackReference ?? '—'} mono />
              <ReceiptRow
                label="Date"
                value={paymentData.createdAt
                  ? new Date(paymentData.createdAt).toLocaleString()
                  : new Date().toLocaleString()}
              />

              <TouchableOpacity style={styles.shareReceiptBtn} onPress={handleShareReceipt} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={18} color={Colors.primary} />
                <Text style={styles.shareReceiptText}>Share Receipt</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* ── Worker: Payment Received card ─────────────────────────── */}
        {isCompleted && userRole === 'WORKER' && isPaid && paymentData && (() => {
          const commPct = Math.round((paymentData.commissionRate ?? 0.05) * 100);
          const payoutSuccess = paymentData.payoutStatus === 'success';
          return (
            <View style={styles.workerPaymentCard}>
              <View style={styles.receiptHeader}>
                <Ionicons
                  name={payoutSuccess ? 'cash' : 'time-outline'}
                  size={22}
                  color={payoutSuccess ? Colors.available : Colors.warning}
                />
                <Text style={[styles.receiptTitle, { color: payoutSuccess ? Colors.available : Colors.warning }]}>
                  {payoutSuccess ? 'Payment Received' : 'Payment Pending Payout'}
                </Text>
              </View>

              {!payoutSuccess && (
                <Text style={styles.workerPaymentSub}>
                  The customer has paid. Your earnings are being processed and will arrive on your MoMo shortly.
                </Text>
              )}

              <ReceiptRow label="Total Collected" value={`GH₵ ${(paymentData.amount ?? 0).toFixed(2)}`} />
              <ReceiptRow label={`FixerHub Fee (${commPct}%)`} value={`GH₵ ${(paymentData.commissionAmount ?? 0).toFixed(2)}`} />

              <View style={styles.receiptDivider} />

              <ReceiptRow
                label="Your Earnings"
                value={`GH₵ ${(paymentData.workerAmount ?? 0).toFixed(2)}`}
                bold
              />
              {payoutSuccess && paymentData.payoutReference && (
                <ReceiptRow label="Payout Ref" value={paymentData.payoutReference} mono />
              )}
              <ReceiptRow
                label="Date Paid"
                value={paymentData.createdAt
                  ? new Date(paymentData.createdAt).toLocaleString()
                  : new Date().toLocaleString()}
              />
            </View>
          );
        })()}

        {/* ── Worker: payment not yet made ─────────────────────────── */}
        {isCompleted && userRole === 'WORKER' && !isPaid && (
          <View style={styles.workerPendingPay}>
            <Ionicons name="time-outline" size={18} color={Colors.outline} />
            <Text style={styles.workerPendingPayText}>Waiting for customer payment</Text>
          </View>
        )}

        {/* ── Rate worker (customer, completed) ─────────────────────── */}
        {isCompleted && userRole === 'CUSTOMER' && (
          <TouchableOpacity
            style={styles.rateBtn}
            onPress={() => setShowRating(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="star-outline" size={18} color={Colors.onPrimary} />
            <Text style={styles.rateBtnText}>Rate Worker</Text>
          </TouchableOpacity>
        )}

        {/* ── Cancel booking (any non-terminal status) ──────────────── */}
        {!isTerminal && (
          <TouchableOpacity
            style={[styles.cancelBtn, cancelling && styles.cancelBtnDisabled]}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.85}
          >
            {cancelling ? (
              <ActivityIndicator color={Colors.error} size="small" />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={Colors.error} />
                <Text style={styles.cancelBtnText}>Cancel Booking</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* ── Hide from list (terminal bookings only) ───────────────── */}
        {isTerminal && (
          <TouchableOpacity
            style={styles.hideBtn}
            onPress={handleHide}
            activeOpacity={0.85}
          >
            <Ionicons name="eye-off-outline" size={18} color={Colors.outline} />
            <Text style={styles.hideBtnText}>Remove from My List</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <RatingPromptModal
        visible={showRating}
        workerName={booking.workerName ?? `Worker ${formatWorkerId(booking.workerId)}`}
        bookingId={booking.id}
        workerId={booking.workerId}
        customerId={myUserId ?? undefined}
        customerName={myName || undefined}
        customerProfilePicture={myProfilePicture || undefined}
        onClose={() => setShowRating(false)}
        onSubmit={() => setShowRating(false)}
      />

      {allBookingMedia.length > 0 ? (
        <Modal visible={showPhoto} transparent animationType="fade" onRequestClose={() => setShowPhoto(false)}>
          <View style={styles.photoModal}>
            <TouchableOpacity style={styles.photoCloseBtn} onPress={() => setShowPhoto(false)}>
              <Ionicons name="close-circle" size={36} color="#fff" />
            </TouchableOpacity>
            {allBookingMedia.length === 1 ? (
              <Image source={{ uri: allBookingMedia[0] }} style={styles.photoFull} resizeMode="contain" />
            ) : (
              <>
                <FlatList
                  data={allBookingMedia}
                  keyExtractor={(_, i) => String(i)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setPhotoIndex(idx);
                  }}
                  renderItem={({ item }) => (
                    <Image source={{ uri: item }} style={[styles.photoFull, { width: SCREEN_WIDTH }]} resizeMode="contain" />
                  )}
                />
                <View style={styles.photoDots}>
                  {allBookingMedia.map((_, i) => (
                    <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
                  ))}
                </View>
              </>
            )}
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={Colors.primary} style={styles.detailIcon} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function ReceiptRow({ label, value, bold, mono }: {
  label: string; value: string; bold?: boolean; mono?: boolean;
}) {
  return (
    <View style={styles.receiptRow}>
      <Text style={styles.receiptLabel}>{label}</Text>
      <Text style={[
        styles.receiptValue,
        bold && styles.receiptValueBold,
        mono && styles.receiptValueMono,
      ]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: Colors.surface },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface },
  errorText:       { color: Colors.error, fontFamily: 'Inter_400Regular', fontSize: 15 },
  scroll:          { paddingBottom: 40 },

  // Header
  titleRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backBtnText:     { fontSize: 15, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  bookingNumLabel: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  hideBtn:         { padding: 4 },
  hideBtnText:     { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },

  // Status badge
  statusBadge:     { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginVertical: 8 },
  statusText:      { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_600SemiBold' },
  paidBadge:       { alignSelf: 'center', backgroundColor: Colors.available + '22', paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 4 },
  paidBadgeText:   { fontSize: 13, color: Colors.available, fontFamily: 'Inter_600SemiBold' },

  // Stepper
  stepperCard:     { marginHorizontal: 20, marginVertical: 10, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16 },
  stepperTitle:    { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_600SemiBold', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepper:         { flexDirection: 'row', alignItems: 'flex-start' },
  stepItem:        { flex: 1, alignItems: 'center' },
  stepCircle:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepCircleActive: { backgroundColor: Colors.primary },
  stepCircleInactive: { borderWidth: 2, borderColor: Colors.outline },
  stepNumber:      { fontSize: 12, color: Colors.outline, fontFamily: 'Inter_600SemiBold' },
  stepLabel:       { fontSize: 10, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 4 },
  stepLabelActive: { color: Colors.primary, fontWeight: '600' },
  stepLabelInactive: { color: Colors.outline },
  stepLine:        { flex: 1, height: 2, marginTop: 14 },
  stepLineActive:  { backgroundColor: Colors.primary },
  stepLineInactive: { backgroundColor: Colors.outline },

  // Detail card
  detailCard:      { marginHorizontal: 20, marginVertical: 10, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle:    { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  detailRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailIcon:      { marginTop: 2 },
  detailContent:   { flex: 1 },
  detailLabel:     { fontSize: 12, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  detailValue:     { fontSize: 15, color: Colors.onSurface, fontFamily: 'Inter_500Medium', marginTop: 1 },
  serviceType:     { fontSize: 18, fontWeight: '700', color: Colors.onSurface, fontFamily: 'PlusJakartaSans_700Bold' },

  // Notes
  notesRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  notesText:       { flex: 1, fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_400Regular', lineHeight: 20 },

  // Photo / Media
  photoSection:     { marginHorizontal: 20, marginVertical: 10, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 14, padding: 16 },
  photoHint:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  photoHintText:    { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  bookingThumb:     { width: '100%', height: 200, borderRadius: 10, marginTop: 10 },
  videoThumbWrap:   { marginTop: 10 },
  videoPlayOverlay: { width: '100%', height: 180, borderRadius: 10, backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center' },
  mediaGallery:     { marginTop: 10 },
  mediaThumbnailWrap: { marginRight: 8 },
  mediaThumbnail:   { width: 130, height: 130, borderRadius: 10 },
  videoPlaceholder: { backgroundColor: Colors.surfaceContainerHigh, alignItems: 'center', justifyContent: 'center', gap: 4 },
  mediaVideoLabel:  { fontSize: 11, color: '#fff', fontFamily: 'Inter_400Regular' },

  // Actions
  payBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 6, padding: 14, borderRadius: 12, backgroundColor: Colors.primary },
  retryPayBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 20, marginBottom: 10, paddingVertical: 6 },
  retryPayText:    { fontSize: 13, color: Colors.primary, fontFamily: 'Inter_400Regular', textDecorationLine: 'underline' },
  cancelBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.error },
  cancelBtnText:   { fontSize: 15, color: Colors.error, fontFamily: 'Inter_600SemiBold' },
  cancelBtnDisabled: { opacity: 0.4 },
  chatBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 20, marginTop: 4, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.primary },
  chatBtnText:     { fontSize: 15, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },
  rateBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 12, backgroundColor: Colors.primary },
  rateBtnText:     { fontSize: 15, color: Colors.onPrimary, fontFamily: 'Inter_600SemiBold' },
  payBtnText:      { fontSize: 15, color: Colors.onPrimary, fontFamily: 'Inter_600SemiBold' },

  // Photo modal
  photoModal:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  photoFull:       { width: SCREEN_WIDTH, height: '70%' },
  photoCloseBtn:   { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  photoDots:       { flexDirection: 'row', gap: 6, marginTop: 16 },
  photoDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  photoDotActive:  { backgroundColor: '#fff', width: 18 },

  // Payment Receipt card (customer)
  receiptCard: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: Colors.available + '44',
  },
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  receiptTitle:  { fontSize: 16, fontWeight: '700', color: Colors.available, fontFamily: 'PlusJakartaSans_700Bold' },
  receiptRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  receiptLabel:  { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular' },
  receiptValue:  { fontSize: 14, color: Colors.onSurface, fontFamily: 'Inter_500Medium', textAlign: 'right', flex: 1, marginLeft: 8 },
  receiptValueBold: { fontWeight: '700', fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: Colors.primary },
  receiptValueMono: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.onSurfaceVariant },
  receiptDivider:   { height: 1, backgroundColor: Colors.surfaceContainerHigh, marginVertical: 8 },
  shareReceiptBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary },
  shareReceiptText: { fontSize: 14, color: Colors.primary, fontFamily: 'Inter_600SemiBold' },

  // Worker Payment Received card
  workerPaymentCard: {
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: Colors.available + '44',
  },
  workerPaymentSub: { fontSize: 13, color: Colors.onSurfaceVariant, fontFamily: 'Inter_400Regular', lineHeight: 18, marginBottom: 12 },

  // Worker: waiting for customer payment
  workerPendingPay: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10, paddingVertical: 10 },
  workerPendingPayText: { fontSize: 13, color: Colors.outline, fontFamily: 'Inter_400Regular' },
});