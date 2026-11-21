
from datetime import *

class Day:
    
    _nthDay : int
    _shifts : list 

    def __init__(self, nth_day : int):
        # prevent circular dependency
        from HospitalClasses import Nurse
        self._nthDay = nth_day
        self._shifts : list[Nurse] = [None,None,None]

    def assignNurse(self, nurse, shift_idx : int) -> bool:
        """
        Assign a nurse to one of the shifts

        Returns True if there is already a nurse assigned and was overwritten, False otherwise

        'shift_idx' values:
        0 = Morning
        1 = Noon
        2 = Night
        """  

        if shift_idx <= -1 or shift_idx >= 3:
            raise Exception("shift_idx is out of range (0,1,2)")

        if self._shifts[shift_idx] is None:
            isOverwritten = False
        else: #update overwritten nurse
            self._shifts[shift_idx].removeAssign(self)
            isOverwritten = True

        #Insert new nurse to assignment and update nurse object
        self._shifts[shift_idx] = nurse
        nurse.addAssign(self)

        return isOverwritten

    def getSpecificAssigned(self, shift_idx):
        return self._shifts[shift_idx]

    def getAssigned(self):
        return self._shifts

    def getDayNumber(self):
        return self._nthDay

    def printAssigned(self):
        print("Morning: ",
              self._shifts[0].getName(),
              ", Noon: ",
              self._shifts[1].getName(),
              ", Night: ",
              self._shifts[2].getName(),
              sep = "")

        
class Schedule:
    _start_date : date #Inclusive
    _end_date : date #Inclusive
    _days : list[Day] = []
    _hospital = None
    _station = None

    def __init__(self, hospital, station, start : date, end : date):
        from HospitalClasses import Hospital
        from HospitalClasses import Station
        self._hospital : Hospital = hospital
        self._station : Station = station
        self._start_date = start
        self._end_date = end

        duration = self._end_date - self._start_date # Compute length of timeframe

        
        for i in range(duration.days + 1): # +1 offset to include end day
            self._days.append(Day(i))
        print(len(self._days))

    def swapAssignments(self, day1 : Day, slot1 : int, day2 : Day, slot2 : int):
        nurse1 = day1.getSpecificAssigned(slot1)
        nurse2 = day2.getSpecificAssigned(slot2)
        day1.assignNurse(nurse2, slot1)
        day2.assignNurse(nurse1, slot2)

    def randomAssignAll(self):
        import random
        nurses = self._hospital.getNurses()
        for index, day in enumerate(self._days):
            for slot in range(3):
                day.assignNurse(nurses[random.randint(0, len(nurses) - 1)], slot)
            print("Day #",index+1)
            day.printAssigned()