'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');
const { ManagerCron } = require('homey');
const ZoneDB = require('./logizonedb/ZoneDB.js');
const MQTTClient = require('./mqtt/MQTTClient.js');
const Message = require('./mqtt/Message.js');


var logiSettings = {};
var defaultSettings = {};
var myThermostats = [];
var myZoneDB = new ZoneDB();


// Most of this code from Heimdall

class Logi extends Homey.App {

    // Get API control function
    getApi() {
        if (!this.api) {
            this.api = HomeyAPI.forCurrentHomey();
        }
        return this.api;
    }

    async mlog(message) {
        if (this.mqttClient.isRegistered()) {
            const msg = new Message('log', message);
            this.mqttClient.publish(msg);
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

    async getZone(zoneId) {
        return myZoneDB.getName(zoneId);
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

    loadZoneDB() {
        // Loads zoneDB from Homey settings, if it is present.
        let result = JSON.parse(Homey.ManagerSettings.get('schedules'));
        if (typeof result.zonelist !== 'undefined') {
            myZoneDB.loadSavedSettings(result);
            this.mlog('Loaded saved schedules'); // should add more error handling
        } else {
            this.mlog('Could not load saved schedules from Homey.');
        }
    }

    async onInit() {
        this.log('Logi is initialising...');
        this.api = await this.getApi();
        // "Homey" or this.systemName
        this.mqttClient = new MQTTClient('homey/logi/logs');
        this.mlog('Logi Heating Scheduler initialising...');
        await this.loadZones();
        await this.enumerateDevices();
        await this.registerCronJob();
        this.loadZoneDB();
        this.mlog('Logi Heating Scheduler init complete.');
        //await this.saveZoneDB();
    }

    async registerCronJob() {
        let result;
        try {
            result = await ManagerCron.unregisterAllTasks();
        } catch (err) {
            this.mlog('Unregister All Cron Tasks error : ' + err);
        }
        try {
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

        this.registerCronListener();
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

    async getThermostatCurrentSetting(device) {
        const api = await this.getApi();
        let myDev = await api.devices.getDevice(device);
        return myDev.capabilitiesObj['target_temperature']['value'];
    }

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

    async processSchedules() {
    // called by Cron
    // Runs the one minute Checks
        this.mlog('Checking setpoints...');
        for (let device in myThermostats) {
            let thisDevice = myThermostats[device];
            let targetTemp = await this.getSchedule(thisDevice).getCurrentTarget();
            let actualTemp = await this.getThermostatCurrentSetting(thisDevice);
            //this.log(thisDevice.name + ' target temp: ' + targetTemp + ' actual setting: ' + actualTemp);
            if (targetTemp != actualTemp) {
                this.mlog('Updating ' + thisDevice.name + ' Target: ' + targetTemp + 'C, Current: ' + actualTemp + 'C');
                let opts = {
                    deviceId: thisDevice.id,
                    capabilityId: 'target_temperature',
                    value: targetTemp
                };
                await this.setThermostat(opts);
            }
        }
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
        myThermostats.push(device); // GLOBAL VAR???
        await this.addDeviceToZone(device);
        let targetTemp = this.getSchedule(device).getCurrentTarget();
        this.mlog(device.name + ' target temp: ' + targetTemp);
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
            this.registerThermostat(device);
            this.attachEventListener(device, 'thermostat');
        }

    } // End of addDevice


    async addDeviceToZone(device) {
        let zone = await this.getZone(device.zone);
        this.mlog('Thermostat ' + device.name + ' is in zone ID: ' + device.zone + ' (' + zone + ')');
    }

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
            device.makeCapabilityInstance('target_temperature', function(device) {
                this.stateChange(device);
            }.bind(this, device));
            break;
        }
        this.mlog('Attached Eventlistener to:  ' + device.name);
    } // End of attachEventListener


    // this function gets called when a device with an attached eventlistener fires an event.
    // At the moment this does nothing but log
    async stateChange(device) {
        this.mlog('stateChange:            ' + device.name);

    } // End of stateChange

} // End of Logi class

module.exports = Logi;

Homey.ManagerSettings.on('set', (variable) => {
    if (variable === 'settings') {
        logiSettings = Homey.ManagerSettings.get('settings');
        this.mlog('New settings:');
        this.mlog(logiSettings);
    }
});
