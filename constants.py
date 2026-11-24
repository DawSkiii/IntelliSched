SHIFTS = {
    'M': { id: 'M', 'name': 'Morning Shift', 'label': 'Morning', 'time': '7:00 AM - 3:00 PM', 'startHour': 7, 'hours': 8 },
    'A': { id: 'A', 'name': 'Afternoon Shift', 'label': 'Afternoon', 'time': '3:00 PM - 11:00 PM', 'startHour': 15, 'hours': 8 },
    'N': { id: 'N', 'name': 'Night Shift', 'label': 'Night', 'time': '11:00 PM - 7:00 AM', 'startHour': 23, 'hours': 8 },
  }

SWAP_STATUS = {
    'awaiting_colleague': ['Awaiting colleague', 'warn'],
    'awaiting_chief': ['Awaiting Chief Nurse', 'info'],
    'approved': ['Approved', 'ok'],
    'declined': ['Declined by colleague', 'bad'],
    'rejected': ['Rejected', 'bad'],
    'cancelled': ['Cancelled', 'muted'],
  }

LEAVE_TYPES = { 
    'annual': 'Annual Leave', 
    'sick': 'Sick Leave', 
    'other': 'VL/SL (Other)' }

LEAVE_STATUS = {
    'pending': ['Pending', 'warn'], 
    'approved': ['Approved', 'ok'], 
    'rejected': ['Rejected', 'bad'], 
    'cancelled': ['Cancelled', 'muted'],
}

def nest_dicts() -> dict:
    """
    Returns all mock data as a nested dictionary for sending
    """
    return {'SHIFTS': SHIFTS,
            'SWAP_STATUS': SWAP_STATUS,
            'LEAVE_TYPES': LEAVE_TYPES,
            'LEAVE_STATUS': LEAVE_STATUS
            }