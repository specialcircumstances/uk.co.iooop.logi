# Logi Heating Scheduler

Heating Scheduler for Homey v2

In Norse mythology, Logi, Loge (Old Norse "fire") or Hálogi ("High Flame") is a fire giant, god and personification of fire. He is son of giant Fornjótr and brother of Ægir (sea giant) and Kári (god of the wind). Logi married fire giantess Glöð and she bore him two beautiful daughters—Eisa and Eimyrja.

This in fact is a Homey App to schedule changes to thermostats in your home. It's certainly not the only one, and probably not the best, but I figured I'd share it anyway. It's what I use at home.

## Current and Current Planned Feature Set

In no particular order...
- [x] Native Homey SDKv2 Application
- [x] MDL + Vue.js Settings Page (GUI?)
- [x] Aligned to Homey Zones, in a hierarchical manner
- [x] Option to show all zones, or just those with thermostats in them
- [x] Automatically detects and affects all thermostats in zone
- [x] Integration with Homey MQTT Client
- [ ] Option to exclude individual thermostats
- [x] Zone by Zone, Weekly Day by Day Schedules
- [x] As many setpoints per day per zone as you like
- [x] Clone schedule to other days
- [x] Easy to edit (I think)
- [x] Away Mode
- [ ] Retain deactivated schedules
- [ ] Schedule creation based on parent schedule.
- [ ] Flow Integration
- [ ] Internationalisation (I will need help there...)
- [ ] Hot Water Scheduling (e.g. if you have stored hot water)
- [ ] Temporary Heating Boost
- [ ] Call For Heat

## Instructions
### Installation
So, until I've published to the app store (assuming they approve it) if you want to try this application, you will need to download it into a directory and then install it manually using the Athom CLI (from that directory).
- Install Node.js
- Install athom cli (npm install -g athom-cli)
- Install the application to your Homey (athom app install)

### Setup
All setup is via the Application Settings in the Homey App on your phone. It should be fairly self explanatory.

You can choose which Homey zones you want an active schedule for, and then configure the schedule to suit your needs.

If a thermostat is in a zone without a schedule, then the schedule from the next zone in the hierarchy is used instead. So, setting a schedule in the top-level "Home" zone affects all thermostats in your house.

You can see in the Enabled Zones list how many thermostats are "in" a zone, including those in the various sub-zones.

You can also see how many thermostats a particular zone schedule is affecting. E.g. if you see Home (1/8) that means that the Home zone schedule is affecting 1 thermostat out of a possible 8. Why only one? That would be because the sub-zones have active schedules. This helps you understand which schedules are affecting which zones.

You can only configure the schedules for Active zones. If you deactivate the zone (currently) the schedule is deleted - I will add an option to retain the schedule soon. So (currently) when you activate a zone, it is created with a default schedule.

Each day in a schedule *must* have at least one set-point.

Time is 24 hour. Temperature is in C.


## Important Notes

Much credit to the Heimdall application (https://apps.athom.com/app/com.uc.heimdall) upon which I drew heavily.

If you have installed it, this application will also use the Homey MQTT Client (https://apps.athom.com/app/nl.scanno.mqtt).

So, here's the thing, this app is still beta. That means it may not work for you, or be suitable for your needs. I'd love you to try it though, and let me know if you like it (or if you have any problems).
