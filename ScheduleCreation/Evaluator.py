from HospitalClasses import *
from ScheduleClasses import *


def evalNurseAssignments(nurse : Nurse) -> tuple:
    """
    Calculate different statistics of a nurse's assignments
    In order:
    Total times assigned
    Average number of days between assignments
    Minimum days between assignments
    Maximum days between assignments
    """

    if len(nurse.getAssignments()) == 0:
        print(nurse.getName(),"has no assignments")
        return (0,0,0,0)

    #Sort assignments by day for calculations
    sorted_days = sorted(nurse.getAssignments(), key=lambda day: day._nthDay)

    break_lengths : list[int] = []

    for index in range(len(sorted_days) - 1):
        break_lengths.append(sorted_days[index + 1].getDayNumber() - sorted_days[index].getDayNumber())

    total = len(sorted_days)

    if not break_lengths: # if break_lengths is empty (when there is only one assignment)
        avg = 0
        min_break = 0
        max_break = 0
    else:
        avg = sum(break_lengths) / len(break_lengths) 
        min_break = min(break_lengths)
        max_break= max(break_lengths)

    results : tuple = (total,
                        avg,
                        min_break,
                        max_break)
                        
    print(nurse.getName())
    for index, result in enumerate(results):
        match(index):
            case 0:
                print("Total assignments:",result)
            case 1:
                print("Average break time:",result)
            case 2:
                print("Minimum break time:",result)
            case 3:
                print("Maximum break time:",result)
        

    return results

def evalAllNurseAssignments(schedule : Schedule):
    for nurse in schedule._hospital.getNurses():
        evalNurseAssignments(nurse)