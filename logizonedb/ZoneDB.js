'use strict';

const zoneDbVersion = 1;

class SetPointTime {
    // very lightweight (compared to moment)

    constructor(time) {
    // time is a 24 hour string e.g. 13:45
        let timearray = time.split(':');
        this.hours = parseInt(timearray[0]);
        if (this.hours < 0) {this.hours = 0;}
        if (this.hours > 23) {this.hours = 23;}
        this.mins = parseInt(timearray[1]);
        if (this.mins < 0) {this.mins = 0;}
        if (this.mins > 59) {this.mins = 59;}
    }

    gethours() {
        return this.hours;
    }

    getmins() {
        return this.mins;
    }

    getTimeStr() {
        let hour = this.hours + '';
        if (hour.length == 1) { hour = '0' + hour; }
        let minute = this.mins + '';
        if (minute.length == 1) { minute = '0' + minute; }
        return hour + ':' + minute;
    }

    getTimeInt() {
    // for compare functions
        const intCompTime = ( this.hours * 100) + this.mins;
        return intCompTime;
    }

}

class SetPoint {

    constructor(time,temp) {
    // a setpoint object
        this.time = new SetPointTime(time); // time is str e.g. '13:35'
        this.temp = Number(temp); // should be a decimal object
    }

    setTemp (temp) {
        // Expected to be a decimal e.g. 21.5
        this.temp = Number(temp);
    }

    getTemp () {
        // Expected to be a decimal e.g. 21.5
        return this.temp;
    }

    setTime (time) {
        // Accepts 24 hour time as string, e.g. "13:45"
        this.time = new SetPointTime(time);
    }

    getTime () {
    // Returns a 24 hours string
        return this.time.getTimeStr();
    }

    getCompTime () {
    // Returns a 24 hour time as an integer for comparisions/Sorts
        return this.time.getTimeInt();
    }

}


class ZoneDay {

    constructor () {
        // List of setpoint events in a day
        // initialised with a default setup
        this.setpoints = [];
        this.addSetPoint('06:00',22);
        this.addSetPoint('09:00',21);
        this.addSetPoint('12:30',22);
        this.addSetPoint('23:30',19);
    }

    loadDay (day) {
        let newsp = [];
        for (let sp in day) {
            let ntime = this.uiTimeToStr(day[sp].time.hours, day[sp].time.mins);
            newsp.push(new SetPoint(ntime,day[sp].temp));
        }
        this.setpoints = newsp;
    }

    sort () {
        // Sorts the setpoints in order.
        this.setpoints.sort(function (a,b) {
            return a.getCompTime() - b.getCompTime();
        }
        );
    }

    findSetPoint (time) {
        // Checks for and returns a setpoint object or null
        // Time is a 24 hour string at this point e.g. 23:45
        for (let setpoint in this.setpoints) {
        //console.log(this.setpoints[setpoint].getTime() + ' =? ' + time);
            if (this.setpoints[setpoint].getTime() == time) {
                return this.setpoints[setpoint];
            }
        }
        return null;
    }

    addSetPoint (time, setpoint) {
        // Adds a setpoint. If the time already exists it will overwrite.
        // Time is a 24 hour sting e.g. "23:45"
        let mySetPoint = this.findSetPoint(time);
        if (mySetPoint == null) {
        // Add a new set point
            this.setpoints.push(new SetPoint(time,setpoint));
            this.sort(); // Always resort when we add.
            return false;
        } else {
            mySetPoint.setTemp(setpoint);
            return true;
        }
    }

    deleteSetPoint (time) {
        // Don't care about the data, just the time.
        // list.splice( list.indexOf('foo'), 1 );
        if (this.setpoints.length <= 1) {
            console.log('Error. Will not delete last setpoint in zoneday.');
            return false; // Won't delete last setpoint. Must have at least one.
        }
        for (let setpoint in this.setpoints) {
            if (this.setpoints[setpoint].getTime() === time) {
                this.setpoints.splice( this.setpoints.indexOf(this.setpoints[setpoint]), 1);
                return true;
            }
        }
        console.log('Error: Could not find setpoint to delete.');
        return false; // could not Find
    }

    uiTimeToStr (hour, minute) {
        // force to string then convert to formatted string
        hour = hour + '';
        minute = minute + '';
        if (hour.length == 1) { hour = '0' + hour; }
        if (minute.length == 1) { minute = '0' + minute; }
        const timeStr = hour + ':' + minute;
        return timeStr;
    }

    uiDeleteSetpoint (hour, minute) {
        return this.deleteSetPoint(this.uiTimeToStr(hour, minute));
    }

    uiUpdateSetpoint (oldsp, newsp) {
        // because we can't delete the last setpoint better to edit in place
        const mySetpoint = this.findSetPoint(this.uiTimeToStr(oldsp.time.hours, oldsp.time.mins));
        //console.log('uiUpdateSetpoint');
        //console.log(mySetpoint);
        if ( mySetpoint != null) {
            mySetpoint.setTime(this.uiTimeToStr(newsp.time.hours, newsp.time.mins));
            mySetpoint.setTemp(newsp.temp);
            this.sort();
            return true;
        } else {
            return false;
        }
    }

    uiCreateSetpoint (newsp) {
        return this.addSetPoint(this.uiTimeToStr(newsp.time.hours, newsp.time.mins),newsp.temp);
    }

    moveSetPoint (oldtime, newtime) {
        for (let setpoint in this.setpoints) {
            if (this.setpoints[setpoint].getTime() == oldtime) {
                this.setpoints[setpoint].setTime(newtime);
                this.sort();
                return true;
            }
        }
        console.log('Error: Could not find setpoint to move.');
        return false; // could not Find
    }

    changeSetPoint (time, setpoint) {
        // Changes an existing set point, but does not add if it does not exist
        //
        let mySetPoint = this.findSetPoint(time);
        if (mySetPoint == null) {
            console.log('Error: Could not find setpoint to change.');
            return false;
        } else {
            mySetPoint.setTemp(setpoint);
            return true;
        }
    }

    getCurrentTarget () {
        // What should be the target for the current time of day
        // Will use cheaty integer times
        let targetSetPoint = null;
        let now = new Date();
        let time = (now.getHours()*100) + now.getMinutes(); // Int representation
        for (let setpoint in this.setpoints) {
            if (this.setpoints[setpoint].getCompTime() <= time) {
                targetSetPoint = this.setpoints[setpoint].getTemp();
            }
        }
        return targetSetPoint;    // May be null if nothing valid found
    }

    getLastTarget () {
        return this.setpoints[this.setpoints.length-1].getTemp();
    }

}


class ZoneSchedule {

    constructor () {
    // zone Schedule object
        this.sun = new ZoneDay();
        this.mon = new ZoneDay();
        this.tue = new ZoneDay();
        this.wed = new ZoneDay();
        this.thu = new ZoneDay();
        this.fri = new ZoneDay();
        this.sat = new ZoneDay();
    }

    loadSchedule(schedule) {
        // load a stringified schedule
        for (let day in this) {
            this[day].loadDay(schedule[day]['setpoints']);
        }
    }

    getDay (date) {
        // date is a Date object
        let day = date.getDay();
        return this.getByNum(day);
    }

    getByNum (num) {
        num = num * 1;
        switch(num) {
        case 0:
            return this.sun;
        case 1:
            return this.mon;
        case 2:
            return this.tue;
        case 3:
            return this.wed;
        case 4:
            return this.thu;
        case 5:
            return this.fri;
        case 6:
            return this.sat;
        default:
          // code block
        }
    }


    getToday  () {
        let now = new Date();
        return this.getDay(now);
    }


    getYesterday () {
        let date = new Date();
        date.setDate(date.getDate() - 1);
        return this.getDay(date);
    }

    getCurrentTarget  () {
        let targetTemp = this.getToday().getCurrentTarget();
        if (targetTemp == null) {
        // Any zoneDay MUST have at least one setpoint
            targetTemp = this.getYesterday().getLastTarget();
        }
        return targetTemp;
    }

    cloneDay (srcDay, dstDay) {
        // days are integers
        if (srcDay == dstDay) {return;} // none of that...
        this.getByNum(dstDay).setpoints = [];
        // dangerous times....
        for (let srcSp in this.getByNum(srcDay).setpoints) {
            // need to avoid mutation
            let time = this.getByNum(srcDay).setpoints[srcSp].getTime();
            let temp = this.getByNum(srcDay).setpoints[srcSp].getTemp();
            this.getByNum(dstDay).setpoints.push(new SetPoint(time,temp));
        }
        this.getByNum(dstDay).setpoints.sort();
    }

    cloneDays (srcDay, dstDays) {
        // dstDays is an array of day numbers
        for (let day in dstDays) {
            this.cloneDay(srcDay, dstDays[day]);
        }
        return true;
    }


}


class Zone {

    constructor (id,name,parent,icon) {
    // My zone object
        this.id = id;
        this.name = name;
        this.icon = this.mapIcons(icon);
        this.active = false;
        this.parent = parent;
        this.schedule = null;
        if ( parent == null ) {
            this.active = true;
            this.schedule = new ZoneSchedule();
        } // Top level schedule always active
    }


    loadZone(slz) {
        // slz should be a stringified zone
        // Want to support defined but inactive zones.
        // however, we only load activity and schedules never any of the
        // structure
        if (slz.active === true) { console.log('    Zone is active.'); }
        this.active = slz.active;
        if (slz.schedule !== null) {
            console.log('    Schedule is present.');
            this.schedule = new ZoneSchedule();
            this.schedule.loadSchedule(slz.schedule);
        }
    }


    mapIcons(icon) {
        // Mapping of homey icon names to material design icon names
        const iconMap = {
            'default': 'meeting_room',
            'bed': 'hotel',
            'books': 'local_library',
            'garden': 'local_florist',
            'home': 'home',
            'kitchen': 'restaurant',
            'living': 'weekend',
            'roof': 'store',
            'shower': 'grain',
            'stairs-down': 'trending_down',
            'stairs-up': 'trending_up',
            'toilet': 'wc'
        };
        const result = iconMap[icon] || 'meeting_room';
        return result;
    }

    addIcon(icon) {
        // Method to add and map the zone icon
        this.icon = this.mapIcons(icon);
    }

    enable() {
        // Enable the zone schedule
        // If it does not exist, create one
        if (this.active === true) {
            return false;
        }
        if (this.schedule === null) {
            this.schedule = new ZoneSchedule();
        }
        this.active = true;
        return true;
    }

    disable(andDelete) {
        // Disable the zone schedules
        // if andDelete is true delete
        if (this.active === false) {
            return false;
        }
        if (this.parent === null) {
            // Don't disable root zone
            return false;
        }
        this.active = false;
        if (andDelete === true) {
            this.schedule = null;
        }
        return true;
    }

}


class ZoneTreeObj {

    // Simple object
    constructor (zoneId, zoneName, level) {
        this.zoneId = zoneId;
        this.zoneName = zoneName; // for ease of sorting within the class
        this.level = level; // for ease of formatting
        this.children = []; // this is an array of ZoneTreeObjs
    }

    addChild(zonetreeobj) {
        if (zonetreeobj instanceof ZoneTreeObj) {
            this.children.push(zonetreeobj);
            this.sortChildren();  // keep children sorted as we go
        } else {
            console.log('Error adding object to ZoneTreeObj - wrong type');
        }
    }

    comparefunc(a, b) {
        if (a.zoneName < b.zoneName)
            return -1;
        if (a.zoneName > b.zoneName)
            return 1;
        return 0;
    }

    sortChildren() {
        this.children.sort(this.comparefunc);
    }

    walk() {
        // returns an ordered array by walking this sorted tree
        let result = [];
        let me = {
            id: this.zoneId,
            name: this.zoneName,
            level: this.level
        };
        result.push(me);
        for (let kid in this.children) {
            result.push(...this.children[kid].walk());
        }
        return result;
    }

}


class ZoneDB {

    constructor() {
        this.zonelist = [];
        this.zonetree = {};
        this.zoneDbVersion = zoneDbVersion;
    }

    addZone (zone) {
        // Will add (or update) a zone
        // passed zone is Homey format
        // Check if zone in list
        for (let myZone in this.zonelist) {
            if ( this.zonelist[myZone].id == zone.id ) {
            // We have a zone of the same ID, so we update
            //console.log('Updating zone ' + zone.name)
                this.zonelist[myZone].name = zone.name;
                this.zonelist[myZone].parent = zone.parent;
                this.zonelist[myZone].addIcon(zone.icon);
                this.updateZoneTree();
                return;
            }
        }
        // Else add zone
        // console.log('Adding zone ' + zone.name);
        let newZone = new Zone(zone.id, zone.name, zone.parent, zone.icon);
        this.zonelist.push(newZone);
        this.updateZoneTree();
        //console.log(this.zonelist);
    }

    refreshZones (zonelist) {
        //console.log('Refresh Zones Called');
        for (let zone in zonelist) {
        //console.log(zone)
        //console.log('Adding Zone ' + zonelist[zone].name);
            this.addZone(zonelist[zone]);
        }
    }

    findZonesWithParent (parentId) {
        // Set parentId to null to find Home root
        let result = [];
        for (let zone in this.zonelist) {
            if (this.zonelist[zone].parent == parentId) {
                result.push(this.zonelist[zone]);
            }
        }
        return result;
    }

    zoneTreeFindKids (parentId,level) {
        // this.zonetree is used mainly for display purposes
        // should be updated whenever zones change
        // returns a populated ZoneTreeObj
        // note root object will have name "unknown"
        let result = new ZoneTreeObj(parentId, this.getName(parentId), level);
        level++;
        let zoneArr = this.findZonesWithParent(parentId);
        for (let zone in zoneArr) {
            result.addChild(this.zoneTreeFindKids(zoneArr[zone].id,level));
        }
        return result;
    }

    updateZoneTree() {
        // Build zonetree, skipping null root object.
        this.zonetree = this.zoneTreeFindKids(null,0).children[0];
        // console.log(this.zonetree.walk());
    }

    getZones () {
        return this.zonelist;
    }

    getZoneById (theId) {
        for (let zone in this.zonelist) {
            if (this.zonelist[zone].id == theId) {
                return this.zonelist[zone];
            }
        }
        console.log('Error finding zone by ID');
        return null;
    }

    enableZone (theId) {
        for (let zone in this.zonelist) {
            if (this.zonelist[zone].id == theId) {
                return this.zonelist[zone].enable();
            }
        }
        console.log('Error finding zone by ID');
        return false;
    }

    disableZone (theId, andDelete) {
        for (let zone in this.zonelist) {
            if (this.zonelist[zone].id == theId) {
                return this.zonelist[zone].disable(andDelete);
            }
        }
        console.log('Error finding zone by ID');
        return false;
    }

    getOrderedZoneList () {
        // Use zonetree to return a reordered zonelist with levels
        // potentially could add caching here - but is it worth it?
        let result = [];
        let walk = this.zonetree.walk();
        for (let zone in walk) {
            let zobj = this.getZoneById(walk[zone].id);
            zobj.level = walk[zone].level;
            result.push(zobj);
        }
        return result;
    }


    getName (zoneId) {
        let result = 'unknown';
        for (let zone in this.zonelist) {
            if ( this.zonelist[zone].id == zoneId ) {
                result = this.zonelist[zone].name;
            }
        }
        return result;
    }


    getSchedule (zoneId) {
        // Returns a schedule, if zone does not have scheduleActive
        // then the schedule is returned from the parent
        // if parent is Null, then stop and return default Schedule
        for (let zone in this.zonelist) {
            if ( this.zonelist[zone].id == zoneId ) {
                if ( this.zonelist[zone].active === true ) {
                // console.log('Found schedule');
                    return this.zonelist[zone].schedule;
                } else if (this.zonelist[zone].parent == null) {
                // Should not really happen as root schedule always active
                // But JUST IN CASE
                    console.log('Error - root schedule inactive in getSchedule');
                    return [];
                } else {
                // Get Parents Schedule (recursive)
                // console.log('Getting parents schedule');
                    return this.getSchedule(this.zonelist[zone].parent);
                }
            }
        }
        // Should never get here, means an Invalid zoneId was provided
        console.log('Invalid Zone ID in getSchedule: ' + zoneId);
        return [];
    }


    loadSavedSettings(settings) {
        // Loads saved setting which were stringified me.
        if (settings.zoneDbVersion !== zoneDbVersion) {
            console.log('Zone DB in settings does not match.');
            console.log('Currently, this means I will not load these settings.');
            console.log('So they will be overwritten.... sorry....');
        }
        let slz = settings.zonelist;
        for (let zone in slz) {
            // do we (still) have this zone defined?
            let foundZone = this.getZoneById(slz[zone].id);
            if (foundZone !== null) {
                console.log('Loading zone schedule:' + slz[zone].name);
                foundZone.loadZone(slz[zone]);
            } else {
                console.log('Loaded zone no longer exists, discarding.');
            }
        }

    }

}


module.exports = ZoneDB;
