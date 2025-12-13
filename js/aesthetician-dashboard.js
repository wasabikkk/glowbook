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
            
            // Table view (for desktop)
            let tableHtml = '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Client</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
            
            // Card view (for mobile)
            let cardHtml = '<div class="table-card-view">';
            
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
                
                const actionsHtml = getStatusActions(booking);
                
                // Table row
                tableHtml += `<tr>
                    <td>${booking.id}</td>
                    <td>${booking.client?.first_name} ${booking.client?.last_name}</td>
                    <td>${booking.service?.name}</td>
                    <td>${formattedDate}</td>
                    <td>${formattedTime}</td>
                    <td><span class="status-badge status-${booking.status}">${booking.status}</span></td>
                    <td>${actionsHtml}</td>
                </tr>`;
                
                // Card
                cardHtml += `<div class="table-card">
                    <div class="table-card-row">
                        <span class="table-card-label">ID:</span>
                        <span class="table-card-value">${booking.id}</span>
                    </div>
                    <div class="table-card-row">
                        <span class="table-card-label">Client:</span>
                        <span class="table-card-value">${booking.client?.first_name} ${booking.client?.last_name}</span>
                    </div>
                    <div class="table-card-row">
                        <span class="table-card-label">Service:</span>
                        <span class="table-card-value">${booking.service?.name}</span>
                    </div>
                    <div class="table-card-row">
                        <span class="table-card-label">Date:</span>
                        <span class="table-card-value">${formattedDate}</span>
                    </div>
                    <div class="table-card-row">
                        <span class="table-card-label">Time:</span>
                        <span class="table-card-value">${formattedTime}</span>
                    </div>
                    <div class="table-card-row">
                        <span class="table-card-label">Status:</span>
                        <span class="table-card-value"><span class="status-badge status-${booking.status}">${booking.status}</span></span>
                    </div>
                    ${actionsHtml !== 'No actions' ? `<div class="table-card-actions">${actionsHtml}</div>` : ''}
                </div>`;
            });
            
            tableHtml += '</tbody></table></div>';
            cardHtml += '</div>';
            
            $('#bookings-list').html(tableHtml + cardHtml);
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

