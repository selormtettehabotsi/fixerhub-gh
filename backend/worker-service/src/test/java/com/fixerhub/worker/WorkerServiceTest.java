package com.fixerhub.worker;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.exception.NotFoundException;
import com.fixerhub.worker.model.VerificationStatus;
import com.fixerhub.worker.model.Worker;
import com.fixerhub.worker.repository.WorkerRepository;
import com.fixerhub.worker.service.GeocodingService;
import com.fixerhub.worker.service.WorkerService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class WorkerServiceTest {

    @Mock
    private WorkerRepository workerRepository;

    @Mock
    private GeocodingService geocodingService;

    /** WorkerService now calls notification-service on KYC decisions. Mocked so
     *  constructor injection stays complete and no HTTP happens in tests. */
    @Mock
    private org.springframework.web.client.RestTemplate restTemplate;

    @InjectMocks
    private WorkerService workerService;

    @Test
    void createProfile_savesAndReturnsWorker() {
        WorkerProfileRequest request = new WorkerProfileRequest();
        request.setUserId(1L);
        request.setName("Kofi");
        request.setPhone("0241234567");
        request.setSkill("plumber");
        request.setLocation("Accra");

        Worker saved = Worker.builder()
                .id(1L).userId(1L).name("Kofi")
                .phone("0241234567").skill("plumber")
                .location("Accra").rating(0.0).available(true)
                .build();

        when(workerRepository.save(any(Worker.class))).thenReturn(saved);

        WorkerProfileResponse response = workerService.createProfile(request);

        assertNotNull(response);
        assertEquals("Kofi", response.getName());
        assertEquals("plumber", response.getSkill());
        verify(workerRepository, times(1)).save(any(Worker.class));
    }

    @Test
    void updateAvailability_updatesAndReturnsWorker() {
        Worker worker = Worker.builder()
                .id(1L).name("Kofi").available(true).rating(0.0)
                .build();

        when(workerRepository.findById(1L)).thenReturn(Optional.of(worker));
        when(workerRepository.save(any(Worker.class))).thenReturn(worker);

        WorkerProfileResponse response = workerService.updateAvailability(1L, false);

        assertNotNull(response);
        assertFalse(response.getAvailable());
        verify(workerRepository, times(1)).save(any(Worker.class));
    }

    /** VISIBILITY GATE: an unapproved worker must not be readable on the public
     *  route, and must fail the same way a non-existent one does so IDs can't
     *  be walked to enumerate pending workers. */
    @Test
    void getWorkerById_hidesWorkersWhoAreNotApproved() {
        Worker pending = Worker.builder()
                .id(5L).userId(50L).name("Kojo").rating(0.0).available(true)
                .verificationStatus(VerificationStatus.PENDING)
                .build();

        when(workerRepository.findById(5L)).thenReturn(Optional.of(pending));

        assertThrows(NotFoundException.class, () -> workerService.getWorkerById(5L));

        // ...but service-to-service callers still need to read them: payouts,
        // chat peer lookup and ownership checks all go through this path.
        WorkerProfileResponse internal = workerService.getWorkerByIdInternal(5L);
        assertEquals("Kojo", internal.getName());
    }

    @Test
    void getWorkerById_returnsApprovedWorkers() {
        Worker approved = Worker.builder()
                .id(6L).userId(60L).name("Adjoa").rating(4.5).available(true)
                .verificationStatus(VerificationStatus.APPROVED)
                .build();

        when(workerRepository.findById(6L)).thenReturn(Optional.of(approved));

        assertEquals("Adjoa", workerService.getWorkerById(6L).getName());
    }

    /** KYC: a decline used to update the row and tell the worker nothing, so
     *  they had no way to learn they'd been declined or why. */
    @Test
    void declineVerification_notifiesTheWorkerWithTheReason() {
        Worker worker = Worker.builder()
                .id(7L).userId(42L).name("Ama").phone("0241234567")
                .rating(0.0).available(true)
                .build();

        when(workerRepository.findById(7L)).thenReturn(Optional.of(worker));
        when(workerRepository.save(any(Worker.class))).thenAnswer(inv -> inv.getArgument(0));

        WorkerProfileResponse response = workerService.declineVerification(7L, "ID photo was blurry");

        assertEquals("DECLINED", response.getVerificationStatus().name());
        assertFalse(response.getVerified());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<java.util.Map<String, String>> body = ArgumentCaptor.forClass(java.util.Map.class);
        verify(restTemplate).postForEntity(
                eq("http://notification-service/notifications/push"), body.capture(), eq(Void.class));
        assertEquals("42", body.getValue().get("userId"));
        assertTrue(body.getValue().get("body").contains("ID photo was blurry"));
        // SMS too — verification matters enough to reach a worker who isn't in the app
        assertEquals("0241234567", body.getValue().get("phone"));
    }

    /** A notification outage must not fail the admin's review action. */
    @Test
    void approveVerification_survivesNotificationFailure() {
        Worker worker = Worker.builder()
                .id(8L).userId(43L).name("Yaw").rating(0.0).available(true)
                .build();

        when(workerRepository.findById(8L)).thenReturn(Optional.of(worker));
        when(workerRepository.save(any(Worker.class))).thenAnswer(inv -> inv.getArgument(0));
        when(restTemplate.postForEntity(anyString(), any(), eq(Void.class)))
                .thenThrow(new RuntimeException("notification-service down"));

        WorkerProfileResponse response = workerService.approveVerification(8L);

        assertEquals("APPROVED", response.getVerificationStatus().name());
        assertTrue(response.getVerified());
    }
}
