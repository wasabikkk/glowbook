let currentUser = null;
let services = [];
let aestheticians = [];
let selectedService = null;

$(function() {
    fbRequireAuth();
    
    fbFetchProfile()
        .done(function(res) {
            currentUser = res.user;
            if (currentUser.role !== 'client') {
                window.location.href = 'login.html';
                return;
            }
            displayUserName(currentUser);
            loadServices();
            loadAestheticians();
            loadMyBookings();
            
            // Set minimum date to tomorrow (no same-day booking)
            // Calculate tomorrow in local timezone to ensure correct date
            function setMinDate() {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);
                
                // Format as yyyy-mm-dd in local timezone (not UTC)
                const year = tomorrow.getFullYear();
                const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
                const day = String(tomorrow.getDate()).padStart(2, '0');
                const minDateStr = `${year}-${month}-${day}`;
                
                // Set min attribute - this should make today and previous dates unclickable in the calendar
                $('#booking-date').attr('min', minDateStr);
                
                // Store for validation
                window.bookingMinDate = minDateStr;
                window.bookingToday = today;
                
                return { minDateStr, today };
            }
            
            // Set min date initially
            const { minDateStr, today } = setMinDate();
            
            // Format date display to mm/dd/yyyy when date is selected
            $('#booking-date').on('change', function() {
                const dateValue = $(this).val(); // yyyy-mm-dd format
                if (dateValue) {
                    // Parse the selected date
                    const selectedDate = new Date(dateValue + 'T00:00:00');
                    const todayCheck = new Date();
                    todayCheck.setHours(0, 0, 0, 0);
                    selectedDate.setHours(0, 0, 0, 0);
                    
                    // Silently prevent same-day booking (clear field if today is selected)
                    // The min attribute should prevent this, but we'll double-check
                    if (selectedDate <= todayCheck) {
                        $(this).val('');
                        $('#booking-date-display').val('');
                        return;
                    }
                    
                    // Check if date is before minimum (shouldn't happen with min attribute, but safety check)
                    const minDate = new Date(window.bookingMinDate + 'T00:00:00');
                    if (selectedDate < minDate) {
                        $(this).val('');
                        $('#booking-date-display').val('');
                        return;
                    }
                    
                    if (!isNaN(selectedDate.getTime())) {
                        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                        const day = String(selectedDate.getDate()).padStart(2, '0');
                        const year = selectedDate.getFullYear();
                        const formattedDate = `${month}/${day}/${year}`;
                        $('#booking-date-display').val(formattedDate);
                        
                        // Reload time slots when date changes to filter out booked times
                        loadTimeSlots();
                    }
                } else {
                    $('#booking-date-display').val('');
                }
            });
            
            // Prevent manual typing of invalid dates
            $('#booking-date').on('input', function() {
                const dateValue = $(this).val();
                if (dateValue) {
                    const selectedDate = new Date(dateValue + 'T00:00:00');
                    const todayCheck = new Date();
                    todayCheck.setHours(0, 0, 0, 0);
                    selectedDate.setHours(0, 0, 0, 0);
                    
                    if (selectedDate <= todayCheck) {
                        $(this).val('');
                        $('#booking-date-display').val('');
                    }
                }
            });
            
            // Ensure min attribute is always set when calendar opens or input is clicked
            $('#booking-date').on('focus click', function() {
                // Recalculate and re-apply min attribute to ensure it's always current
                setMinDate();
            });
            
            // Also set on page load and periodically to ensure it stays current
            setInterval(function() {
                setMinDate();
            }, 60000); // Update every minute to handle date changes
            
            // Event listener for date changes to reload time slots (filter by user's bookings)
            $('#booking-date').on('change', loadTimeSlots);
            
            // Initial load of time slots
            loadTimeSlots();
        })
        .fail(function() {
            window.location.href = 'login.html';
        });
});

function showTab(tab) {
    $('.tab-content').removeClass('active');
    $('.tab-btn').removeClass('active');
    $('#' + tab + '-tab').addClass('active');
    $('.tab-btn[data-tab="' + tab + '"]').addClass('active');
}

function handleLogout() {
    fbLogout().always(function() {
        window.location.href = 'login.html';
    });
}

function displayUserName(user) {
    if (!user) return;
    
    let displayName = '';
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    
    if (user.role === 'aesthetician') {
        // Aesthetician: Add "Dr." prefix
        displayName = `Dr. ${firstName} ${lastName}`;
    } else if (user.role === 'admin') {
        // Admin: Add "(admin)" suffix
        displayName = `${firstName} ${lastName} (admin)`;
    } else {
        // Client: Just first name and last name
        displayName = `${firstName} ${lastName}`;
    }
    
    $('#user-name-display').text(displayName);
}

function loadServices() {
    fbGetServices()
        .done(function(res) {
            services = res.items || [];
            displayServiceList();
        });
}

function displayServiceList() {
    let html = '';
    const activeServices = services.filter(service => service.is_active);
    
    if (activeServices.length === 0) {
        html = '<p style="text-align: center; color: #666; padding: 40px;">No services available at the moment.</p>';
    } else {
        activeServices.forEach(service => {
            const storageBase = typeof STORAGE_BASE !== 'undefined' ? STORAGE_BASE : 'http://127.0.0.1:8000';
            const imageUrl = service.image_url || storageBase + '/storage/services/default_service.png';
            html += `
                <div class="service-card">
                    <div class="service-card-image">
                        <img src="${imageUrl}" alt="${service.name}" onerror="this.src='${storageBase}/storage/services/default_service.png'">
                    </div>
                    <div class="service-card-content">
                        <h4>${service.name}</h4>
                        <button class="select-service-btn" onclick="selectService(${service.id})">Select Service</button>
                    </div>
                </div>
            `;
        });
    }
    
    $('#services-grid').html(html);
}

function selectService(serviceId) {
    selectedService = services.find(s => s.id === serviceId);
    if (!selectedService) {
        alert('Service not found');
        return;
    }
    
    showServiceDetails();
}

function showServiceDetails() {
    if (!selectedService) return;
    
    const storageBase = typeof STORAGE_BASE !== 'undefined' ? STORAGE_BASE : 'http://127.0.0.1:8000';
    const imageUrl = selectedService.image_url || storageBase + '/storage/services/default_service.png';
    const html = `
        <div class="service-details">
            <div class="service-details-image">
                <img src="${imageUrl}" alt="${selectedService.name}" onerror="this.src='${storageBase}/storage/services/default_service.png'">
            </div>
            <div class="service-details-content">
                <h2>${selectedService.name}</h2>
                ${selectedService.description ? `<p class="service-description">${selectedService.description}</p>` : ''}
                <div class="service-info">
                    <div class="service-info-item">
                        <strong>Price:</strong> ₱${parseFloat(selectedService.price).toFixed(2)}
                    </div>
                    <div class="service-info-item">
                        <strong>Duration:</strong> ${selectedService.duration_minutes} minutes
                    </div>
                </div>
                <button class="book-appointment-btn" onclick="goToBookingForm()">Book Appointment</button>
            </div>
        </div>
    `;
    
    $('#service-details-container').html(html);
    showStep('step-service-details');
}

function goToBookingForm() {
    if (!selectedService) return;
    
    $('#booking-service-id').val(selectedService.id);
    showStep('step-booking-form');
    // Reload time slots when entering booking form (in case date was already selected)
    loadTimeSlots();
}

function goBackToServiceList() {
    selectedService = null;
    showStep('step-service-list');
}

function goBackToServiceDetails() {
    if (selectedService) {
        showStep('step-service-details');
    } else {
        goBackToServiceList();
    }
}

function showStep(stepId) {
    $('.booking-step').removeClass('active');
    $('#' + stepId).addClass('active');
}

function loadAestheticians() {
    fbGetAestheticians()
        .done(function(res) {
            aestheticians = res.items || [];
            let html = '<option value="">Select an aesthetician...</option>';
            aestheticians.forEach(aesthetician => {
                html += `<option value="${aesthetician.id}">${aesthetician.first_name} ${aesthetician.last_name}</option>`;
            });
            $('#booking-aesthetician').html(html);
            
            // Add event listener for aesthetician change to reload time slots
            $('#booking-aesthetician').off('change.timeSlots').on('change.timeSlots', function() {
                // Reload time slots when aesthetician changes
                if ($('#booking-date').val()) {
                    loadTimeSlots();
                }
            });
        });
}

function loadTimeSlots() {
    // Generate time slots from 9 AM to 5 PM (hourly intervals)
    // Excluding 12:00pm - 1:00pm for lunch break
    // Also exclude time slots already booked by:
    // 1. The current user on the selected date (prevent double booking)
    // 2. The selected aesthetician if they have approved/completed bookings (prevent aesthetician double booking)
    const selectedDate = $('#booking-date').val();
    const selectedAestheticianId = $('#booking-aesthetician').val();
    
    // Helper function to format time for display
    function formatTimeDisplay(hour) {
        if (hour === 0) return '12:00am';
        if (hour < 12) return hour + ':00am';
        if (hour === 12) return '12:00pm';
        return (hour - 12) + ':00pm';
    }
    
    // Helper function to format time for backend (HH:MM)
    function formatTimeValue(hour) {
        return (hour < 10 ? '0' : '') + hour + ':00';
    }
    
    // Helper function to normalize date to yyyy-mm-dd format
    function normalizeDate(dateString) {
        if (!dateString) return null;
        // Handle both ISO string and date string formats
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Get current user's bookings and aesthetician's bookings to filter out booked time slots
    if (selectedDate && currentUser) {
        // Get all bookings for the current user (API automatically filters by user_id for clients)
        const userBookingsPromise = fbGetBookings();
        
        // Get aesthetician's approved/completed bookings for availability checking
        let aestheticianBookingsPromise = null;
        if (selectedAestheticianId) {
            aestheticianBookingsPromise = fbGetBookings({
                aesthetician_id: selectedAestheticianId,
                date_from: selectedDate,
                date_to: selectedDate
            });
        } else {
            // If no aesthetician selected, create a resolved promise with empty array
            aestheticianBookingsPromise = $.Deferred().resolve({ items: [] });
        }
        
        // Wait for both API calls to complete
        $.when(userBookingsPromise, aestheticianBookingsPromise)
            .done(function(userRes, aestheticianRes) {
                const userBookings = userRes[0].items || [];
                const aestheticianBookings = aestheticianRes[0].items || [];
                
                // Normalize selected date for comparison
                const normalizedSelectedDate = normalizeDate(selectedDate);
                
                // Filter user's bookings for the selected date and exclude cancelled/rejected/expired
                const userBookedTimes = userBookings
                    .filter(booking => {
                        // Match the exact date (normalize both dates for comparison)
                        if (!booking.appointment_date) return false;
                        const bookingDateNormalized = normalizeDate(booking.appointment_date);
                        return bookingDateNormalized === normalizedSelectedDate;
                    })
                    .filter(booking => {
                        // Only exclude active bookings (not cancelled, rejected, or expired)
                        return !['cancelled', 'rejected', 'expired'].includes(booking.status);
                    })
                    .map(booking => {
                        // Normalize time format (handle both HH:MM:SS and HH:MM)
                        const time = booking.appointment_time || '';
                        return time.split(':').slice(0, 2).join(':'); // Get HH:MM part only
                    });
                
                // Filter aesthetician's approved/completed bookings for the selected date
                // These bookings block the time slot for that aesthetician
                const aestheticianBookedTimes = aestheticianBookings
                    .filter(booking => {
                        // Match the exact date
                        if (!booking.appointment_date) return false;
                        const bookingDateNormalized = normalizeDate(booking.appointment_date);
                        return bookingDateNormalized === normalizedSelectedDate;
                    })
                    .filter(booking => {
                        // Only exclude time slots where aesthetician has approved or completed bookings
                        return ['approved', 'completed'].includes(booking.status);
                    })
                    .map(booking => {
                        // Normalize time format (handle both HH:MM:SS and HH:MM)
                        const time = booking.appointment_time || '';
                        return time.split(':').slice(0, 2).join(':'); // Get HH:MM part only
                    });
                
                // Combine both sets of booked times
                const allBookedTimes = [...new Set([...userBookedTimes, ...aestheticianBookedTimes])];
                
                const timeSlots = [];
                // Generate slots from 9 AM (9) to 5 PM (17), excluding 12pm-1pm (lunch break)
                for (let hour = 9; hour < 17; hour++) {
                    // Skip the 12:00pm - 1:00pm slot (lunch break)
                    if (hour === 12) {
                        continue;
                    }
                    
                    const timeValue = formatTimeValue(hour);
                    
                    // Skip if this time slot is already booked by:
                    // 1. The user on this date (prevent double booking)
                    // 2. The selected aesthetician (if they have approved/completed booking)
                    if (allBookedTimes.includes(timeValue)) {
                        continue;
                    }
                    
                    const startTime = formatTimeDisplay(hour);
                    const endTime = formatTimeDisplay(hour + 1);
                    timeSlots.push({
                        display: `${startTime}-${endTime}`,
                        value: timeValue
                    });
                }
                
                // Populate dropdown
                let html = '<option value="">Select a time slot...</option>';
                if (timeSlots.length === 0) {
                    html += '<option value="" disabled>No available time slots for this date</option>';
                } else {
                    timeSlots.forEach(slot => {
                        html += `<option value="${slot.value}">${slot.display}</option>`;
                    });
                }
                $('#booking-time').html(html);
            })
            .fail(function() {
                // If API fails, show all time slots as fallback
                populateAllTimeSlots();
            });
    } else {
        // If no date selected, show all time slots
        populateAllTimeSlots();
    }
    
    function populateAllTimeSlots() {
        const timeSlots = [];
        for (let hour = 9; hour < 17; hour++) {
            if (hour === 12) {
                continue;
            }
            
            const startTime = formatTimeDisplay(hour);
            const endTime = formatTimeDisplay(hour + 1);
            const timeValue = formatTimeValue(hour);
            timeSlots.push({
                display: `${startTime}-${endTime}`,
                value: timeValue
            });
        }
        
        // Populate dropdown
        let html = '<option value="">Select a time slot...</option>';
        timeSlots.forEach(slot => {
            html += `<option value="${slot.value}">${slot.display}</option>`;
        });
        $('#booking-time').html(html);
    }
}

function createBooking(e) {
    e.preventDefault();
    
    // Validate date is not today (no same-day booking) - silently prevent
    const selectedDate = $('#booking-date').val();
    if (selectedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const appointmentDate = new Date(selectedDate + 'T00:00:00');
        appointmentDate.setHours(0, 0, 0, 0);
        
        if (appointmentDate <= today) {
            // Silently prevent - the min attribute should already prevent this
            $('#booking-date').val('');
            $('#booking-date-display').val('');
            return;
        }
    }
    
    // Date input already provides yyyy-mm-dd format, no conversion needed
    const serviceId = $('#booking-service-id').val() || selectedService?.id;
    if (!serviceId) {
        alert('Please select a service first');
        return;
    }
    
    const selectedTime = $('#booking-time').val();
    if (!selectedTime) {
        alert('Please select an appointment time');
        return;
    }
    
    // Validate no double booking (same date and time for the same user)
    if (selectedDate && selectedTime && currentUser) {
        // Check if user already has a booking for this date and time
        fbGetBookings({
            date_from: selectedDate,
            date_to: selectedDate
        })
            .done(function(res) {
                const bookings = res.items || [];
                const existingBooking = bookings.find(booking => {
                    // Check if booking is for the same date and time
                    if (!booking.appointment_date || !booking.appointment_time) return false;
                    const bookingDate = new Date(booking.appointment_date).toISOString().split('T')[0];
                    return bookingDate === selectedDate && 
                           booking.appointment_time === selectedTime &&
                           !['cancelled', 'rejected', 'expired'].includes(booking.status);
                });
                
                if (existingBooking) {
                    alert('You already have a booking for this date and time. Please select a different time slot.');
                    return;
                }
                
                // No double booking found, proceed with creating the booking
                proceedWithBooking();
            })
            .fail(function() {
                // If check fails, proceed anyway (backend will validate)
                proceedWithBooking();
            });
    } else {
        // If validation data is missing, proceed anyway (backend will validate)
        proceedWithBooking();
    }
    
    function proceedWithBooking() {
        const data = {
            service_id: serviceId,
            aesthetician_id: $('#booking-aesthetician').val(), // Required now
            appointment_date: selectedDate, // Already in yyyy-mm-dd format
            appointment_time: selectedTime,
            client_note: $('#booking-notes').val() || null
        };
        
        // Show loading indicator
        showLoading('Creating your booking...');
        
        fbCreateBooking(data)
            .done(function() {
                hideLoading();
                alert('Booking created successfully!');
                $('#booking-form')[0].reset();
                $('#booking-date-display').val('');
                selectedService = null;
                showStep('step-service-list');
                showTab('my-bookings');
                loadMyBookings();
            })
            .fail(function(xhr) {
                hideLoading();
                let errorMsg = 'Failed to create booking';
                if (xhr.responseJSON) {
                    if (xhr.responseJSON.error) {
                        errorMsg = xhr.responseJSON.error;
                    } else if (xhr.responseJSON.message) {
                        errorMsg = xhr.responseJSON.message;
                    } else if (xhr.responseJSON.errors) {
                        const errors = [];
                        Object.values(xhr.responseJSON.errors).forEach(arr => {
                            errors.push(arr.join(', '));
                        });
                        errorMsg = errors.join('\n');
                    }
                }
                alert('Error: ' + errorMsg);
            });
    }
}

function loadMyBookings() {
    const status = $('#booking-status-filter').val();
    
    fbGetBookings(status ? { status } : {})
        .done(function(res) {
            let bookings = res.items || [];
            
            // Sort bookings by status: Pending → Approved → Rejected → Cancelled → Completed → Expired
            const statusOrder = {
                'pending': 1,
                'approved': 2,
                'rejected': 3,
                'cancelled': 4,
                'completed': 5,
                'expired': 6
            };
            
            bookings.sort((a, b) => {
                const orderA = statusOrder[a.status] || 99;
                const orderB = statusOrder[b.status] || 99;
                return orderA - orderB;
            });
            
            let html = '<table><thead><tr><th>ID</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Aesthetician</th><th>Actions</th></tr></thead><tbody>';
            
            bookings.forEach(booking => {
                // Format date to mm/dd/yyyy
                let formattedDate = booking.appointment_date;
                if (booking.appointment_date) {
                    const date = new Date(booking.appointment_date);
                    if (!isNaN(date.getTime())) {
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const year = date.getFullYear();
                        formattedDate = `${month}/${day}/${year}`;
                    }
                }
                
                // Format time to show time slot format (e.g., 9:00am-10:00am)
                let formattedTime = booking.appointment_time;
                if (booking.appointment_time) {
                    const timeParts = booking.appointment_time.split(':');
                    const hour = parseInt(timeParts[0]);
                    const minute = timeParts[1] || '00';
                    
                    if (hour >= 0 && hour < 24) {
                        let displayHour = hour;
                        let ampm = 'am';
                        
                        if (hour === 0) {
                            displayHour = 12;
                        } else if (hour === 12) {
                            ampm = 'pm';
                        } else if (hour > 12) {
                            displayHour = hour - 12;
                            ampm = 'pm';
                        }
                        
                        const nextHour = hour + 1;
                        let nextDisplayHour = nextHour;
                        let nextAmpm = 'am';
                        
                        if (nextHour === 0) {
                            nextDisplayHour = 12;
                        } else if (nextHour === 12) {
                            nextAmpm = 'pm';
                        } else if (nextHour > 12) {
                            nextDisplayHour = nextHour - 12;
                            nextAmpm = 'pm';
                        } else if (nextHour === 24) {
                            nextDisplayHour = 12;
                        }
                        
                        formattedTime = `${displayHour}:${minute}${ampm}-${nextDisplayHour}:${minute}${nextAmpm}`;
                    }
                }
                
                html += `<tr>
                    <td>${booking.id}</td>
                    <td>${booking.service?.name}</td>
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
                    <td>${booking.aesthetician ? booking.aesthetician.first_name + ' ' + booking.aesthetician.last_name : 'Not assigned'}</td>
                    <td>${booking.status === 'pending' ? `<button onclick="cancelBooking(${booking.id})">Cancel</button>` : 'No actions'}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            $('#my-bookings-list').html(html);
        });
}

function cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    showLoading('Cancelling booking...');
    
    fbCancelBooking(bookingId)
        .done(function() {
            hideLoading();
            loadMyBookings();
        })
        .fail(function(xhr) {
            hideLoading();
            alert('Error: ' + (xhr.responseJSON?.message || xhr.responseJSON?.error || 'Failed to cancel booking'));
        });
}

