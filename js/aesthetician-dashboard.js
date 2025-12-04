let currentUser = null;

$(function() {
    fbRequireAuth();
    
    fbFetchProfile()
        .done(function(res) {
            currentUser = res.user;
            if (currentUser.role !== 'aesthetician') {
                window.location.href = 'login.html';
                return;
            }
            displayUserName(currentUser);
            loadBookings();
        })
        .fail(function() {
            window.location.href = 'login.html';
        });
});

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

function loadBookings() {
    const status = $('#booking-status-filter').val();
    
    fbGetBookings(status ? { status } : {})
        .done(function(res) {
            const bookings = res.items || [];
            let html = '<table><thead><tr><th>ID</th><th>Client</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            
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
                let formattedTime = '';
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
                        } else if (nextHour === 24) { // Handle 11pm-12am case
                            nextDisplayHour = 12;
                        }
                        
                        formattedTime = `${displayHour}:${minute}${ampm}-${nextDisplayHour}:${minute}${nextAmpm}`;
                    }
                }
                
                html += `<tr>
                    <td>${booking.id}</td>
                    <td>${booking.client?.first_name} ${booking.client?.last_name}</td>
                    <td>${booking.service?.name}</td>
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
                    <td>${getStatusActions(booking)}</td>
                </tr>`;
            });
            
            html += '</tbody></table>';
            $('#bookings-list').html(html);
        });
}

function getStatusActions(booking) {
    const status = booking.status;
    let actions = '';
    
    if (status === 'pending') {
        actions = `<button onclick="updateStatus(${booking.id}, 'approved')">Approve</button> `;
        actions += `<button onclick="updateStatus(${booking.id}, 'rejected')">Reject</button>`;
    } else if (status === 'approved') {
        actions = `<button onclick="updateStatus(${booking.id}, 'completed')">Mark Complete</button>`;
    }
    
    return actions || 'No actions';
}

function updateStatus(bookingId, newStatus) {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
    
    showLoading('Updating booking status...');
    
    fbUpdateBookingStatus(bookingId, newStatus)
        .done(function() {
            hideLoading();
            loadBookings();
        })
        .fail(function(xhr) {
            hideLoading();
            alert('Error: ' + (xhr.responseJSON?.message || xhr.responseJSON?.error || 'Failed to update status'));
        });
}

