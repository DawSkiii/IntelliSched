from HospitalClasses import *
from ScheduleClasses import *
import Evaluator
from datetime import date

if __name__ == '__main__':
    
    hospital : Hospital = Hospital()
    hospital.sampleHospital()
    sched : Schedule = Schedule(hospital, hospital.getStations()[0],date(2026,1,1), date(2026,1,7))
    hospital.printAll()
    sched.randomAssignAll()
    Evaluator.evalAllNurseAssignments(sched)