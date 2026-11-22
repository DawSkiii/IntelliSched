



# Department staffing rules: min = minimum nurses required per shift. Editable by the
# Chief Nurse in Settings; drives open-shift detection and the generator.
DEFAULT_DEPTS = {
    'OPD': { 
        'name': 'Outpatient Department', 
        'min': { 'M': 2, 'A': 1, 'N': 0 } 
        },
    'Emergency': { 
        'name': 'Emergency Department', 
        'min': { 'M': 1, 'A': 1, 'N': 1 } 
        },
    'Ward A': { 
        'name': 'Medical Ward A', 
        'min': { 'M': 1, 'A': 1, 'N': 1 } 
        },
    'Ward B': { 
        'name': 'Surgical Ward B', 
        'min': { 'M': 1, 'A': 1, 'N': 1 } 
        },
    'ICU': { 
        'name': 'Intensive Care Unit', 
        'min': { 'M': 1, 'A': 1, 'N': 1 } 
        },
  }

ROSTER = [
    ['Sarah Wilson', 'OPD'], ['Aaron Vigan', 'Emergency'], ['Clara Ramos', 'Ward A', 'heavy'], ['Maria Santos', 'OPD'],
    ['Roberto Cruz', 'Emergency'], ['Elena Singson', 'Ward B', 'heavy'], ['Joy Dela Cruz', 'ICU'], ['Miguel Torres', 'OPD'],
    ['Angela Reyes', 'Emergency'], ['Paolo Mendoza', 'Ward A'], ['Liza Navarro', 'Ward B'], ['Carlo Bautista', 'ICU'],
    ['Jenny Garcia', 'OPD'], ['Rico Fernandez', 'Emergency'], ['Hannah Domingo', 'Ward A'], ['Mark Villanueva', 'Ward B'],
    ['Patricia Lim', 'ICU'], ['Jose Aquino', 'Emergency', 'heavy'], ['Cathy Santiago', 'Ward A'], ['Dennis Pascual', 'Ward B'],
    ['Faith Castillo', 'ICU'], ['Noel Rivera', 'ICU'], ['Ana Mercado', 'OPD'], ['Ben Soriano', 'Ward A'],
  ]


def nest_dicts() -> dict:
    """
    Returns all mock data as a nested dictionary for sending
    """
    return {'DEFAULT_DEPTS': DEFAULT_DEPTS,
            'ROSTER' : ROSTER}