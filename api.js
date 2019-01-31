'use strict';

const Homey = require('homey');

module.exports = [

    {
        method: 'GET',
        path: '/getzones',
        public: false,
        fn: async function( args, callback ){
            const result = Homey.app.getUIZones();
            if( result instanceof Error ) return callback( result );
            return callback( null, result );

        // access /?foo=bar as args.query.foo
        }
    },

    {
        method: 'PUT',
        path: '/enablezone/:id', // Enable Zone Schedule
        fn: function( args, callback ){
            const result = Homey.app.uiEnableZone( args.params.id, args.body );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },

    {
        method: 'PUT',
        path: '/disablezone/:id', // Disable Zone Schedule
        fn: function( args, callback ){
            const result = Homey.app.uiDisableZone( args.params.id, args.body );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },

    {
        method: 'DELETE',
        path: '/setpoint/:zone/:day/:hours/:mins', // Disable Zone Schedule
        fn: function( args, callback ){
            const result = Homey.app.uiDeleteSetpoint( args.params );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },

    {
        method: 'PUT',
        path: '/setpoint/:zone/:day', // Disable Zone Schedule
        fn: function( args, callback ){
            const result = Homey.app.uiUpdateSetpoint( args.params, args.body );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },

    {
        method: 'POST',
        path: '/setpoint/:zone/:day', // Disable Zone Schedule
        fn: function( args, callback ){
            const result = Homey.app.uiCreateSetpoint( args.params, args.body );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },

    {
        method: 'PUT',
        path: '/clonedays/:zone', // Clone a day to others within a Zone
        fn: function( args, callback ){
            const result = Homey.app.uiCloneDays( args.params, args.body );
            if( result instanceof Error ) return callback( result );
            return callback( null, result );
        }
    },


];
