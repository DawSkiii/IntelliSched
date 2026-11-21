class Station:
    _name : str
    _capacity : int # How many can be assigned here at any time

    def __init__(self, init_name, init_capacity = 1):
        self._name = init_name
        self._capacity = init_capacity

    def getName(self) -> str:
        return self._name

    def setCapacity(self, new_capacity) -> None:
        self._capacity = new_capacity

class Nurse:
    from ScheduleClasses import Day
    _name : str
    _station : Station
    _assignments : list

    def __init__(self, init_name):
        from ScheduleClasses import Day
        self._name = init_name
        self._assignments : list[Day] = []

    def getName(self) -> str:
        return self._name

    def getStation(self) -> Station:
        return self._station

    def setStation(self, new_station : Station) -> None:
        self._station = new_station

    def addAssign(self, newAssign : Day):
        self._assignments.append(newAssign)

    def removeAssign(self, assignment : Day):
        if assignment in self._assignments:
            self._assignments.remove(assignment)

    def getAssignments(self) -> list[Day]:
        return self._assignments

    #====old code for multiple stations====

    #def add_stations(self, *new_stations : str):
    #    for station in new_stations:
    #        self._stations.add(station)

    #def remove_station(self, station):
    #    self._stations.remove(station)



class Hospital:
    _nurses : list[Nurse] = []
    _stations : list[Station] = []

    def __init__(self):
        pass

    def addNurse (self, nurse_name : str = None, station_name : str = None) -> Nurse:
        """
        Adds a Nurse object to the '_nurses' List
        
        nurse_name - Name of the Nurse, if empty, creates a random placeholder such as 'Nurse #1' number is random

        *stations - Enter any number of station names to assign to the nurse. Station name must exist in the '_stations' List to apply. If empty, randomly assigns stations

        returns the created Nurse object
        """
        

        name : str
        if nurse_name == None: # If nurse_name is empty, generate random nurse name
            import random
            while True: # Generate Random Nurse Name and Check if Duplicate
                name = "Nurse #" +  str(random.randint(1,999))

                isDuplicate : bool = False
                for index in range(len(self._nurses)): # Search Nurse List for Duplicate Nurses
                    if name == self._nurses[index]._name:
                        isDuplicate = True
                if not isDuplicate:
                    break
        else:
            name = nurse_name
        
        nurse = Nurse(name)

        if station_name: # Assign station names to nurse, if not empty
            for station in station_name:
                nurse.add_stations(station)
        else: #If no station names are given, assign random station
            import random
            nurse.setStation(self._stations[random.randint(0, len(self._stations) - 1)])

        


        self._nurses.append(nurse)

        return nurse

    def addStation (self, station_name : str, capacity : int = 1) -> bool:

        #Check for duplicate station names
        for station in self._stations:
            if station.getName == station_name:
                return False

        self._stations.append(Station(station_name, capacity))

        return True

    def getNurses(self) -> list[Nurse]:
        return self._nurses
    
    def getStations(self) -> list[Station]:
        return self._stations

    def getValidNurses(self, station_name : str) -> list[Nurse]:
        if station_name not in self._stations:
            return None

        validNurses : list[Nurse]
        for nurse in self._nurses:
            if station_name in nurse.getStations():
                validNurses.append(nurse)
        return validNurses

    def sampleHospital(self):
        for station_name in ["Pediatrics","Geriatrics","ICU","ER","OR"]:
            self._stations.append(Station(station_name))
        for index in range(10): #Generate 10 random nurses
            self.addNurse()

    def printAll(self):
        print("Nurses:", end =" ")
        for nurse in self._nurses:
            print(nurse.getName(), end = ", ")
        print("\nStations:", end = " ")
        for station in self._stations:
            print(station.getName(), end = ", ")
        print()