var logiSettings = {};

var defaultSettings = {
    'awayMode': false,
    'mqttLogging': true,
    'hwSchedule': false,
    'showAllZones': false,
};

function onHomeyReady(homeyReady) {
    Homey = homeyReady;
    logiSettings = defaultSettings;
    Homey.get('settings', function(err, savedSettings) {
        if (err) {
            Homey.alert(err);
        } else {
            if (savedSettings != (null || undefined)) {
                console.log('savedSettings:');
                console.log(savedSettings);
                logiSettings = savedSettings;
            }
        }
        /*
        document.getElementById('awayMode').checked = logiSettings.awayMode;
        document.getElementById('mqttLogging').checked = logiSettings.mqttLogging;
        document.getElementById('hwSchedule').checked = logiSettings.hwSchedule;
        document.getElementById('notificationNoCommunicationMotion').checked = heimdallSettings.notificationNoCommunicationMotion
        document.getElementById('notificationNoCommunicationContact').checked = heimdallSettings.notificationNoCommunicationContact
        if ( document.getElementById('autoRefresh').checked ) {
            document.getElementById("buttonRefresh").style = "display:none";
        } else {
            document.getElementById("buttonRefresh").style = "display:block";
        }
        */

        Vue.component('modal-del-setpoints', {
            props: ['setpoint'],
            filters: {
                pad: function(value) {
                    return String(value).padStart(2,0);
                }
            },
            template: '#modal-del-setpoints-template',
            methods: {
                deleteSetPoint(setpoint){
                    this.$parent.deleteSetPoint(setpoint);
                }
            }
        });

        Vue.component('modal-clone-setpoints', {
            props: ['cloneorigday', 'clonenewdays'],
            template: '#modal-clone-setpoints-template',
            data: function () {
                var week = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                return {
                    week: week,
                    myclonenewdays: this.clonenewdays.slice()
                };
            },
            methods: {
                cloneDays(orig, newd) {
                    this.$parent.cloneDays(orig, newd);
                }
            }
        });

        Vue.component('modal-edit-setpoints', {
            props: ['origsetpoint'],
            data: function () {
                // need to avoid mutation
                var sp = {};
                sp.time = {};
                sp.time.hours = this.origsetpoint.time.hours;
                sp.time.mins = this.origsetpoint.time.mins;
                sp.temp = this.origsetpoint.temp;
                return {
                    setpoint: sp
                };
            },
            filters: {
                pad: function(value) {
                    return String(value).padStart(2,0);
                }
            },
            template: '#modal-edit-setpoints-template',
            methods: {
                updateSetPoint: function(){
                    this.$parent.updateSetPoint(this.origsetpoint,this.setpoint);
                },
                incval: function(val,step,min,max) {
                    val += step;
                    if (val > max) {
                        val = min;
                    }
                    return val;
                },
                decval: function(val,step,min,max) {
                    val -= step;
                    if (val < min) {
                        val = max;
                    }
                    return val;
                },
                inchours: function() {
                    this.setpoint.time.hours = this.incval(this.setpoint.time.hours,1,0,23);
                },
                incmins: function() {
                    this.setpoint.time.mins = this.incval(this.setpoint.time.mins,5,0,59);
                },
                inctemp: function() {
                    this.setpoint.temp = this.incval(this.setpoint.temp,0.5,0,80);
                },
                dechours: function() {
                    this.setpoint.time.hours = this.decval(this.setpoint.time.hours,1,0,23);
                },
                decmins: function() {
                    this.setpoint.time.mins = this.decval(this.setpoint.time.mins,5,0,59);
                },
                dectemp: function() {
                    this.setpoint.temp = this.decval(this.setpoint.temp,0.5,0,0,80);
                },
            }
        });

        var app = new Vue({
            el: '#app',
            data: {
                zones: [
                    {
                        active: true,
                        id: 'nonsense',
                        name: 'NotHome',
                        icon: 'meeting_room',
                        parent: null,
                        schedule: null
                    }
                ],
                awayMode:logiSettings.awayMode,
                mqttLogging: logiSettings.mqttLogging,
                hwSchedule: logiSettings.hwSchedule,
                showAllZones: true,
                loaded: false,
                selectedZone: null,
                showingSettings: false,
                showingZones: false,
                showingSchedules: false,
                showModalDelSetpoints: false,
                dspmodalitem : {},
                showModalEditSetpoints: false,
                espmodalitem : {},
                newsetpointmode: false,
                showModalCloneSetpoints: false,
                cloneorigday: 0,
                clonenewdays: [],
                currentDay: 0
            },
            async mounted() {
                var myself = this;
                this.$nextTick(async function () {
                    await myself.getZones();
                    myself.loaded = true;
                });
            },
            computed: {
                activezones: function() {
                    var myzones = [];
                    for (var zone in this.zones) {
                        if (this.zones[zone].active === true) {
                            myzones.push(this.zones[zone]);
                        }
                    }
                    return myzones;
                },
                populatedzones: function() {
                    // returns a list of filtered list of zones
                    if (this.showAllZones === true) {
                        return this.zones;
                    }
                    // Else...
                    // show only zones with thermostats in them.
                    var myzones = [];
                    for (var zone in this.zones) {
                        if (this.zones[zone].members > 0) {
                            myzones.push(this.zones[zone]);
                        }
                    }
                    return myzones;
                },
                currentZone: function() {
                    for (var zone in this.zones) {
                        if (this.zones[zone].id == this.selectedZone) {
                            return this.zones[zone];
                        }
                    }
                    var myEmptyZone = {
                        active: false,
                        id: 'nonsense',
                        name: 'NotHome',
                        icon: 'meeting_room',
                        parent: null,
                        schedule: null
                    };
                    return myEmptyZone;
                },
                currentDayName: function() {
                    // returns the name of the current display day
                    const dayMapping = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                    if (this.currentDay < 0 || this.currentDay > 6) return 'undefined';
                    return dayMapping[this.currentDay];
                },
                displaySchedule: function() {
                    //currentZone.schedule.mon.setpoints
                    if (this.currentZone.schedule == null) return [];
                    switch(this.currentDay) {
                    case 0:
                        return this.currentZone.schedule.sun.setpoints;
                    case 1:
                        return this.currentZone.schedule.mon.setpoints;
                    case 2:
                        return this.currentZone.schedule.tue.setpoints;
                    case 3:
                        return this.currentZone.schedule.wed.setpoints;
                    case 4:
                        return this.currentZone.schedule.thu.setpoints;
                    case 5:
                        return this.currentZone.schedule.fri.setpoints;
                    case 6:
                        return this.currentZone.schedule.sat.setpoints;
                    default:
                        return [];
                    }
                }
            },
            filters: {
                pad: function(value) {
                    return String(value).padStart(2,0);
                }
            },
            methods: {
                getZones() {
                    var apiuri = '/getzones';
                    var myself = this;
                    Homey.api('GET', apiuri, null, function(err, result) {
                        if (err) return Homey.alert(err);
                        result.forEach(function (value, i) {
                            myself.$set(myself.zones, i, value);
                        });
                    });
                },
                enableZone(zoneId) {
                    // Enables the schedule for the zone
                    const apiuri = '/enablezone/'+ zoneId;
                    const myself = this;
                    Homey.api('PUT', apiuri, {}, function(err, result) {
                        if (err) return Homey.alert(err);
                        myself.getZones();
                    });
                },
                async disableZone(zoneId) {
                    // Enables the schedule for the zone
                    const apiuri = '/disablezone/'+ zoneId;
                    const myself = this;
                    Homey.api('PUT', apiuri, {andDelete:true}, function(err, result) {
                        if (err) return Homey.alert(err);
                        myself.getZones();
                    });
                },
                changeAwayMode: function() {
                    return;
                },
                changeMqttLogging: function() {
                    return;
                },
                changehwSchedule: function() {
                    return;
                },
                boostHeating: function() {
                    return;
                },
                boostHotWater: function() {
                    return;
                },
                isEnabled: function(zone) {
                    return zone.active;
                },
                isLoaded: function() {
                    return this.loaded;
                },
                getZone: function(zoneId) {
                    var result = 'unknown';
                    for (var zone in this.zones) {
                        if (this.zones[zone].id == zoneId) {
                            result = this.zones[zone].name;
                        }
                    }
                    return result;
                },
                getIcon: function(zone) {
                    try {
                        return '<img src="/manager/zones/assets/icons/' + zone.icon + '.svg" style="height:22px;width:auto;"/>';
                    } catch (e) {
                        return '<!-- no device.iconObj.url -->';
                    }
                },
                showSettings: function() {
                    if (this.showingSettings === true) {
                        this.showingSettings = false;
                    } else {
                        this.showingSettings = true;
                    }
                    this.showingZones = false;
                    this.showingSchedules = false;
                },
                showZones: function() {
                    if (this.showingZones === true) {
                        this.showingZones = false;
                    } else {
                        this.showingZones = true;
                    }
                    this.showingSettings = false;
                    this.showingSchedules = false;
                },
                showSchedules: function() {
                    if (this.showingSchedules === true) {
                        this.showingSchedules = false;
                    } else {
                        this.showingSchedules = true;
                    }
                    this.showingSettings = false;
                    this.showingZones = false;
                },
                nextDay: function() {
                    this.currentDay++;
                    if (this.currentDay > 6) this.currentDay = 0;
                },
                prevDay: function() {
                    this.currentDay--;
                    if (this.currentDay < 0) this.currentDay = 6;
                },
                deleteSetPoint: function(item) {
                    // Enables the schedule for the zone
                    const apiuri = '/setpoint/'+ this. selectedZone + '/' + this.currentDay + '/' + item.time.hours + '/' + item.time.mins;
                    const myself = this;
                    Homey.api('DELETE', apiuri, {}, function(err, result) {
                        if (err) return Homey.alert(err);
                        myself.getZones();
                    });
                    this.showModalDelSetpoints = false;
                },
                confirmDeleteSetpoint: function (item) {
                    // Brings up modal to confim the deletion
                    this.dspmodalitem = item;
                    this.showModalDelSetpoints = true;
                },
                editSetPoint: function(setpoint) {
                    this.showModalEditSetpoints = false;
                },
                showEditSetpoint: function (setpoint) {
                    this.espmodalitem = setpoint;
                    this.newsetpointmode = false;
                    this.showModalEditSetpoints = true;
                },
                showCreateSetpoint: function() {
                    // Make a phoney setpoint for the edit modal
                    // and set flag so updateSetPoint knows
                    this.espmodalitem = {
                        time: { hours: 12, mins: 0},
                        temp: 21
                    };
                    this.newsetpointmode = true;
                    this.showModalEditSetpoints = true;

                },
                updateSetPoint: function(origsetpoint,setpoint) {
                    // Enables the schedule for the zone
                    const apiuri = '/setpoint/'+ this. selectedZone + '/' + this.currentDay;
                    const myself = this;
                    if ( this.newsetpointmode === false ) {
                        const data = { orig: origsetpoint, new: setpoint };
                        Homey.api('PUT', apiuri, data, function(err, result) {
                            if (err) return Homey.alert(err);
                            myself.getZones();
                        });
                    } else {
                        const data = { new: setpoint };
                        Homey.api('POST', apiuri, data, function(err, result) {
                            if (err) return Homey.alert(err);
                            myself.getZones();
                        });
                    }
                    this.newsetpointmode = false;
                    this.showModalEditSetpoints = false;
                },
                showCloneSetpoints: function () {
                    this.cloneorigday = this.currentDay;
                    this.clonenewdays = [];
                    this.showModalCloneSetpoints = true;
                },
                cloneDays: function (srcDay, dstDays) {
                    // srcDay is a number
                    // dstDays is an array of numbers
                    const apiuri = '/clonedays/'+ this. selectedZone;
                    const myself = this;
                    const data = { src: srcDay, dsts: dstDays };
                    Homey.api('PUT', apiuri, data, function(err, result) {
                        if (err) return Homey.alert(err);
                        myself.getZones();
                    });
                    this.showModalCloneSetpoints = false;
                }

            }
        });

        Homey.ready();
    });
}


function saveSettings() {
    logiSettings.awayMode = document.getElementById('awayMode').checked;
    logiSettings.mqttLogging = document.getElementById('mqttLogging').checked;
    logiSettings.hwSchedule = document.getElementById('hwSchedule').checked;
    Homey.set('settings', logiSettings);
}


function getDateTime() {
    var date = new Date();

    var hour = date.getHours();
    hour = (hour < 10 ? '0' : '') + hour;

    var min = date.getMinutes();
    min = (min < 10 ? '0' : '') + min;

    var sec = date.getSeconds();
    sec = (sec < 10 ? '0' : '') + sec;

    var msec = ('00' + date.getMilliseconds()).slice(-3);

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? '0' : '') + month;

    var day = date.getDate();
    day = (day < 10 ? '0' : '') + day;

    return day + '-' + month + '-' + year + '  ||  ' + hour + ':' + min + ':' + sec + '.' + msec + '  ||  ';
}
