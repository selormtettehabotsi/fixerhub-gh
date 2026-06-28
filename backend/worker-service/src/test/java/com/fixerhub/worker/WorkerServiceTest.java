package com.fixerhub.worker;

import com.fixerhub.worker.dto.WorkerProfileRequest;
import com.fixerhub.worker.dto.WorkerProfileResponse;
import com.fixerhub.worker.model.Worker;
import com.fixerhub.worker.repository.WorkerRepository;
import com.fixerhub.worker.service.GeocodingService;
import com.fixerhub.worker.service.WorkerService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
}
