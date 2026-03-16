let currentStep = 1;
let selectedDoctor = null;
let selectedDate = null;
let selectedTime = null;
let doctors = [];

// Initialize booking flow
document.addEventListener('DOMContentLoaded', function() {
    loadDoctors();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('nextBtn').addEventListener('click', nextStep);
    document.getElementById('prevBtn').addEventListener('click', prevStep);
    document.getElementById('confirmBtn').addEventListener('click', confirmBooking);
}

async function loadDoctors() {
    try {
        const response = await fetch('/api/doctors');
        const data = await response.json();
        doctors = data.doctors;
        displayDoctors();
    } catch (error) {
        console.error('Error loading doctors:', error);
    }
}

function displayDoctors() {
    const doctorsList = document.getElementById('doctorsList');
    doctorsList.innerHTML = '';
    
    doctors.forEach(doctor => {
        const doctorCard = document.createElement('div');
        doctorCard.className = 'doctor-card';
        doctorCard.dataset.doctorId = doctor.id;
        
        doctorCard.innerHTML = `
            <div class="doctor-name">Dr. ${doctor.name}</div>
            <div class="doctor-specialty">${doctor.specialty}</div>
            <div class="doctor-timezone">Available in ${doctor.timezone}</div>
        `;
        
        doctorCard.addEventListener('click', () => selectDoctor(doctor));
        doctorsList.appendChild(doctorCard);
    });
}

function selectDoctor(doctor) {
    // Update UI
    document.querySelectorAll('.doctor-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-doctor-id="${doctor.id}"]`).classList.add('selected');
    
    selectedDoctor = doctor;
    document.getElementById('nextBtn').disabled = false;
}

async function loadAvailability(doctorId) {
    try {
        const response = await fetch(`/api/availability/${doctorId}`);
        const data = await response.json();
        displayAvailability(data);
    } catch (error) {
        console.error('Error loading availability:', error);
    }
}

function displayAvailability(data) {
    const calendar = document.getElementById('availabilityCalendar');
    calendar.innerHTML = '';
    
    data.availability.forEach(dateData => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.textContent = formatDate(dateData.date);
        
        const slotsContainer = document.createElement('div');
        slotsContainer.className = 'time-slots';
        
        dateData.slots.forEach(time => {
            const slot = document.createElement('div');
            slot.className = 'time-slot';
            slot.dataset.date = dateData.date;
            slot.dataset.time = time;
            
            // Convert to Bangladesh time for display
            const bangladeshTime = convertToBangladeshTime(time, data.timezone);
            slot.innerHTML = `${bangladeshTime}<br><small>(${time} ${data.timezone})</small>`;
            
            slot.addEventListener('click', () => selectTimeSlot(dateData.date, time, slot));
            slotsContainer.appendChild(slot);
        });
        
        dateGroup.appendChild(dateHeader);
        dateGroup.appendChild(slotsContainer);
        calendar.appendChild(dateGroup);
    });
}

function selectTimeSlot(date, time, element) {
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    element.classList.add('selected');
    
    selectedDate = date;
    selectedTime = time;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function convertToBangladeshTime(time, fromTimezone) {
    // Simple conversion for demo - in production would use proper timezone library
    const [hours, minutes] = time.split(':').map(Number);
    
    // Rough conversion (this is simplified for demo)
    let bdHours = hours;
    if (fromTimezone.includes('EST') || fromTimezone.includes('Eastern')) {
        bdHours += 11; // EST to Bangladesh
    } else if (fromTimezone.includes('PST') || fromTimezone.includes('Pacific')) {
        bdHours += 14; // PST to Bangladesh
    } else if (fromTimezone.includes('CST') || fromTimezone.includes('Central')) {
        bdHours += 12; // CST to Bangladesh
    }
    
    if (bdHours >= 24) bdHours -= 24;
    if (bdHours < 0) bdHours += 24;
    
    return `${bdHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} BDT`;
}

function nextStep() {
    if (currentStep === 1 && !selectedDoctor) {
        alert('Please select a doctor first');
        return;
    }
    
    if (currentStep === 2 && (!selectedDate || !selectedTime)) {
        alert('Please select a date and time');
        return;
    }
    
    if (currentStep === 3 && !validatePatientForm()) {
        return;
    }
    
    currentStep++;
    updateStepDisplay();
    
    if (currentStep === 2) {
        loadAvailability(selectedDoctor.id);
        updateSelectedDoctorDisplay();
    }
    
    if (currentStep === 4) {
        displayBookingSummary();
    }
}

function prevStep() {
    currentStep--;
    updateStepDisplay();
}

function updateStepDisplay() {
    // Update progress indicator
    document.querySelectorAll('.step').forEach((step, index) => {
        if (index + 1 <= currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // Update step visibility
    document.querySelectorAll('.booking-step').forEach((step, index) => {
        if (index + 1 === currentStep) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    // Update button visibility
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    
    prevBtn.style.display = currentStep > 1 ? 'block' : 'none';
    nextBtn.style.display = currentStep < 4 ? 'block' : 'none';
    confirmBtn.style.display = currentStep === 4 ? 'block' : 'none';
}

function updateSelectedDoctorDisplay() {
    const display = document.getElementById('selectedDoctor');
    if (selectedDoctor) {
        display.innerHTML = `
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <strong>Selected: Dr. ${selectedDoctor.name}</strong> - ${selectedDoctor.specialty}
            </div>
        `;
    }
}

function validatePatientForm() {
    const name = document.getElementById('patientName').value.trim();
    const email = document.getElementById('patientEmail').value.trim();
    const phone = document.getElementById('patientPhone').value.trim();
    
    if (!name || !email || !phone) {
        alert('Please fill in all required fields');
        return false;
    }
    
    if (!email.includes('@')) {
        alert('Please enter a valid email address');
        return false;
    }
    
    return true;
}

function displayBookingSummary() {
    const summary = document.getElementById('bookingSummary');
    const name = document.getElementById('patientName').value;
    const email = document.getElementById('patientEmail').value;
    const phone = document.getElementById('patientPhone').value;
    const notes = document.getElementById('patientNotes').value;
    
    summary.innerHTML = `
        <div class="summary-row">
            <span>Doctor:</span>
            <span>Dr. ${selectedDoctor.name} - ${selectedDoctor.specialty}</span>
        </div>
        <div class="summary-row">
            <span>Date:</span>
            <span>${formatDate(selectedDate)}</span>
        </div>
        <div class="summary-row">
            <span>Time:</span>
            <span>${selectedTime} ${selectedDoctor.timezone}</span>
        </div>
        <div class="summary-row">
            <span>Patient:</span>
            <span>${name}</span>
        </div>
        <div class="summary-row">
            <span>Email:</span>
            <span>${email}</span>
        </div>
        <div class="summary-row">
            <span>Phone:</span>
            <span>${phone}</span>
        </div>
        ${notes ? `
        <div class="summary-row">
            <span>Notes:</span>
            <span>${notes}</span>
        </div>
        ` : ''}
    `;
}

async function confirmBooking() {
    const confirmBtn = document.getElementById('confirmBtn');
    const btnText = confirmBtn.querySelector('.btn-text');
    const spinner = confirmBtn.querySelector('.loading-spinner');
    
    // Show loading state
    btnText.style.display = 'none';
    spinner.style.display = 'inline';
    confirmBtn.disabled = true;
    
    try {
        const bookingData = {
            doctor_id: selectedDoctor.id,
            patient_name: document.getElementById('patientName').value,
            patient_email: document.getElementById('patientEmail').value,
            patient_phone: document.getElementById('patientPhone').value,
            appointment_date: selectedDate,
            appointment_time: selectedTime,
            notes: document.getElementById('patientNotes').value
        };
        
        const response = await fetch('/api/book-appointment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookingData)
        });
        
        if (response.ok) {
            const result = await response.json();
            window.location.href = `/confirmation/${result.booking_id}`;
        } else {
            const error = await response.json();
            alert(`Booking failed: ${error.detail}`);
        }
    } catch (error) {
        alert('Booking failed. Please try again.');
        console.error('Booking error:', error);
    } finally {
        // Hide loading state
        btnText.style.display = 'inline';
        spinner.style.display = 'none';
        confirmBtn.disabled = false;
    }
}