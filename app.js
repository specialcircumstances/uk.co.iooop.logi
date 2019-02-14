'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');
const { ManagerCron } = require('homey');
const ZoneDB = require('./logizonedb/ZoneDB.js');
const MQTTClient = require('./mqtt/MQTTClient.js');
const Message = require('./mqtt/Message.js');


let logiSettings = {};
let defaultSettings = {
    'awayMode': false,
    'awayTemp': 10,
    'mqttLogging': true,
    'hwSchedule': false,
    'showAllZones': false,    // This is a GUI only setting
    'manualOverride': true,
    'overridePeriod': 5,     // Time in minutes to suspend schedule
};
let myThermostats = [];
let myZoneDB = new ZoneDB();


// Some of this code from Heimdall :)

class Logi extends Homey.App {


    async onInit() {
        this.log('Logi is initialising...');
        this.api = await this.getApi();
        // "Homey" or this.systemName
        this.mqttClient = new MQTTClient('homey/logi/logs');
        this.mlog('Logi Heating Scheduler initialising...');
        await this.loadZones(); // Get zones from Homey
        await this.loadZoneDB();      // Load our zone DB
        await this.enumerateDevices();  // See what thermostats we have
        myZoneDB.updateZoneTree();
        await this.loadSettings();
        this.initSettingsListener();

        // OK - ready to rock and roll
        await this.registerCronJob();
        this.mlog('Logi Heating Scheduler init complete.');
        //await this.saveZoneDB();
    }

    // Get API control function
    getApi() {
        if (!this.api) {
            this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    async mlog(message) {
        if (logiSettings.mqttLogging === true) {
            if (this.mqttClient.isRegistered()) {
                const msg = new Message('log', message);
                this.mqttClient.publish(msg);
            }
        }
        this.log(message);
    }

    async getZones() {
        const api = await this.getApi();
        return await this.api.zones.getZones();
    }

    async loadZones() {
        const api = await this.getApi();
        const allZones = await this.api.zones.getZones()
        myZoneDB.refreshZones(allZones);
    }

    getUIZones() {
        this.mlog('Get UI Zones Called');
        return myZoneDB.getOrderedZoneList();
    }

    //uiEnableZone( args.params.id, args.body );
    uiEnableZone( id, argsBody ) {
        let result = myZoneDB.enableZone(id);
        if (result === true) {
            this.saveZoneDB();
        }
        return result;
    }

    uiDisableZone( id, argsBody ) {
        let result = myZoneDB.disableZone(id,argsBody.andDelete);
        if (result === true) {
            this.saveZoneDB();
        }
        return result;
    }

    uiDeleteSetpoint( params ) {
        let result = myZoneDB.getZoneById(params.zone).schedule.getByNum(params.day).uiDeleteSetpoint(params.hours,params.mins);
        if (result === true) {
            this.saveZoneDB();
        }
        return result;
    }

    uiUpdateSetpoint( params, body) {
        let result = myZoneDB.getZoneById(params.zone).schedule.getByNum(params.day).uiUpdateSetpoint(body.orig, body.new);
        if (result === true) {
            this.saveZoneDB();
        }
        return result;
    }

    uiCreateSetpoint(params, body) {
        let result = myZoneDB.getZoneById(params.zone).schedule.getByNum(params.day).uiCreateSetpoint(body.new);
        if (result === true) {
            this.saveZoneDB();
        }
        return result;
    }

    uiCloneDays(params, body) {
        let result = myZoneDB.getZoneById(params.zone).schedule.cloneDays(body.src, body.dsts);
        if (result === true) {
            this.saveZoneDB();
        }
        return result;
    }

    // Get all devices function for API
    async getDevices() {
        const api = await this.getApi();
        return await this.api.devices.getDevices();
    }

    replacer(key, value) {
        // Filtering out properties
        if (key === 'zonetree') {
            return undefined;
        }
        return value;
    }

    async saveZoneDB() {
        // Saves zoneDB to Homey settings.
        let zonedb = JSON.stringify(myZoneDB, this.replacer);
        let result = await Homey.ManagerSettings.set('schedules', zonedb);
        this.mlog('Saved schedules to Homey settings.');
    }

    async loadZoneDB() {
        // Loads zoneDB from Homey settings, if it is present.
        let schedules = await Homey.ManagerSettings.get('schedules');
        let result = JSON.parse(schedules);
        if (typeof result.zonelist !== 'undefined') {
            myZoneDB.loadSavedSettings(result);
            this.mlog('Loaded saved schedules'); // should add more error handling
        } else {
            this.mlog('Could not load saved schedules from Homey.');
        }
    }

    async registerCronJob() {
        let result;
        try {
            this.mlog('Unregistering All Cron Tasks...');
            result = await ManagerCron.unregisterAllTasks();
            this.mlog('Done.');
        } catch (err) {
            this.mlog('Unregister All Cron Tasks error : ' + err);
        }
        try {
            this.mlog('Registering my Cron Job...');
            result = await ManagerCron.registerTask('logiminutecron', '* * * * *', 'oneminute');
            this.mlog('Register Cron Job result: ' + JSON.stringify(result));
        } catch (err) {
            this.mlog('Register Cron Job error : ' + err);
        }
        try {
            result = await ManagerCron.getTasks();
            this.mlog('getTasks says we have ' + result.length + ' cron task registered.');
        } catch (err) {
            this.mlog('Register Cron Job error : ' + err);
        }

        await this.registerCronListener();
    }

    async registerCronListener() {
        let task;
        let ref = this;
        try {
            task = await ManagerCron.getTask('logiminutecron');
            let result = await task.on('run', function() {
                ref.processSchedules();
            });
            this.mlog('Registered Logi one minute Cron Listener ' + JSON.stringify(result));
        } catch (err) {
            this.mlog('Register Cron Listener error : ' + err);
        }
    }

    /*
    async getThermostatCurrentSetting(device) {
        const api = await this.getApi();
        let myDev = await api.devices.getDevice(device);
        return myDev.capabilitiesObj['target_temperature']['value'];
    }
    */

    /* old method
    async setThermostat(opts) {
        const api = await this.getApi();
        //this.log(opts)
        try {
            await api.devices.setCapabilityValue(opts);
        } catch (err) {
            this.mlog('Error setting thermostat: ' + err + ' Data: ');
            this.mlog(opts);
        }
        return;
    }
    */

    async processSchedules() {
    // called by Cron
    // Runs the one minute Checks
        this.mlog('Checking setpoints...');
        for (let device in myThermostats) {
            // check if device is eligible
            //this.mlog('Device: ' + device.name + ' overide ' + device.overide)
            let thisDevice = myThermostats[device];
            if (thisDevice.exclude === true) { continue; }
            if (thisDevice.override > 0) {
                this.mlog('Not updating device: ' + thisDevice.name + ' manual overide for ' + thisDevice.override + ' minutes.');
                thisDevice.override--;
                continue;
            }

            let targetTemp = 10;  // why not?
            if (logiSettings.awayMode === true) {
                targetTemp = logiSettings.awayTemp;
            } else {
                targetTemp = this.getSchedule(thisDevice).getCurrentTarget();
            }
            let actualTemp = thisDevice.cInst.target_temperature.value;
            //this.log(thisDevice.name + ' target temp: ' + targetTemp + ' actual setting: ' + actualTemp);
            if (targetTemp != actualTemp) {
                this.mlog('Updating ' + thisDevice.name + ' Target: ' + targetTemp + 'C, Current: ' + actualTemp + 'C');
                /* let opts = {
                    deviceId: thisDevice.id,
                    capabilityId: 'target_temperature',
                    value: targetTemp
                };
                await this.setThermostat(opts);
                use cap instance instead */
                try {
                    thisDevice.shadowset = targetTemp;
                    await thisDevice.cInst.target_temperature.setValue(targetTemp);
                } catch (err) {
                    this.mlog('Error setting thermostat: ' + err + ' Data: ');
                    this.mlog(thisDevice.id, targetTemp);
                }
            }
        }
        this.mlog('Done checking setpoints.');
    }

    async enumerateDevices() {
    // Get the homey object
        const api = await this.getApi();

        api.devices.on('device.create', async (id) => {
            this.mlog('New device found!');
            // V1 - const device = await api.devices.getDevice({id: id})

            // V2 - var device = await api.devices.getDevice({id: id.id})
            var device = await this.waitForDevice(id);

            await this.addDevice(device);
        });

        // before reading a newly created device you should wait until a device is ready, this is not emited though
        // https://github.com/athombv/homey-apps-sdk-issues/issues/23
        api.devices.on('device.ready', async (id) => {
            this.mlog('Device is ready' + id); // never runs...
        });

        api.devices.on('device.delete', async (id) => {
            this.mlog('Device deleted!: ' + id);
        });
        let allDevices = await this.getDevices();

        for (let device in allDevices) {
            this.addDevice(allDevices[device]);
        }
        this.mlog('Enumerating devices done.');
    }


    // Yolo function courtesy of Robert Klep ;)
    // via Heimdall
    async waitForDevice(id) {
        const device = await this.api.devices.getDevice({
            id: id.id
        });
        if (device.ready) {
            return device;
        }
        await delay(1000);
        return this.waitForDevice(id);
    } // End of waitForDevice


    // Add the device to application list
    async registerThermostat(device) {
        // Add some fields:
        device['exclude'] = false;  // Allow exclusion from Scheduling
        device['override'] = 0; // simple countdown to end of override in minutes
        device['shadowset'] = 0; // workaround for self trigger of stateChange listener
        myThermostats.push(device); // GLOBAL VAR???
        let zoneName = myZoneDB.getName(device.zone);
        this.mlog('Thermostat ' + device.name + ' is in zone ID: ' + device.zone + ' (' + zoneName + ')');
        myZoneDB.logNewDevice(device);
        let targetTemp = this.getSchedule(device).getCurrentTarget();
        this.mlog(device.name + ' target temp: ' + targetTemp);
    }


    setOverride(someDevice) {
        for (let myDevice in myThermostats) {
            if (myThermostats[myDevice].id == someDevice.id) {
                myThermostats[myDevice].override = logiSettings['overridePeriod'];
                return true;
            }
        }
        return false;
    }


    // Add device function, all device types with target_temperature capability
    addDevice(device) {

        // Find Away Mode Button
        if (device.data.id === 'aMode') {
            var aModeDevice = device;
            this.mlog('Found Away Mode Button named:   ' + device.name);
        }

        // console.log(device.capabilities.indexOf("target_temperature"))
        if ('target_temperature' in device.capabilitiesObj) {
            this.mlog('Found thermostat:        ' + device.name);
            device['cInst'] = [];
            this.attachEventListener(device, 'thermostat');
            this.registerThermostat(device);
        }

    } // End of addDevice


    getSchedule(device) {
        return myZoneDB.getSchedule(device.zone);
    }


    attachEventListener(device, sensorType) {
        switch (sensorType) {
        // Kept switch case for future capablities
        case 'thermostat':
        /* V1
        device.on('alarm_motion', this.debounce(alarm_motion => {
            this.stateChange(device,alarm_motion,sensorType)
        },250));
        */
            device['cInst']['target_temperature'] = device.makeCapabilityInstance('target_temperature', function(device) {
                this.stateChange(device);
            }.bind(this, device));
            break;
        }
        this.mlog('Attached Eventlistener to:  ' + device.name);
    } // End of attachEventListener


    // this function gets called when a device with an attached eventlistener fires an event.
    async stateChange(thisDevice) {
        // thisDevice being the Homey device, not my own list
        this.mlog('stateChange:            ' + thisDevice.name);
        //let actualTemp = await this.getThermostatCurrentSetting(thisDevice);
        //let actualTemp = thisDevice.cInst.target_temperature.value;
        let targetTemp = logiSettings.awayTemp;
        if (logiSettings.awayMode === false) {
            targetTemp = this.getSchedule(thisDevice).getCurrentTarget();
        }
        if ((thisDevice.shadowset != targetTemp) && (logiSettings.manualOverride === true)) {
            // Untested assertion is that this will only be the case with a manual intervention
            this.mlog('Setting manual override for ' + logiSettings['overridePeriod'] + ' minutes.');
            this.setOverride(thisDevice);
        }
    } // End of stateChange


    async loadSettings() {
        // New method, load all defaults then overwrite with any saved
        // Easier for upgrades
        // This is ONLY run at init.
        logiSettings = defaultSettings;
        let loadedSettings = await Homey.ManagerSettings.get('settings');
        //  Read in properties
        for (let property in loadedSettings) {
            if (loadedSettings.hasOwnProperty(property)) {
                logiSettings[property] = loadedSettings[property];
            }
        }
        // Resave for GUI, in case we have added anything
        await Homey.ManagerSettings.set('settings', logiSettings);
        this.mlog('Loaded settings....');
        this.mlog(logiSettings);
    }

    initSettingsListener() {
        Homey.ManagerSettings.on('set', (variable) => {
            if (variable === 'settings') {
                logiSettings = Homey.ManagerSettings.get('settings');
                this.mlog('New settings:');
                this.mlog(logiSettings);
            }
        });
    }


} // End of Logi class

module.exports = Logi;
