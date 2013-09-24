
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 4130);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
app.use(express.session());
app.use(app.router);
app.use(require('less-middleware')({ src: __dirname + '/public' }));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

app.post('/yup', function(req, res){

});

var server = http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});


var gpio = require("gpio"),
    floodLightsSwitch
    , lightsSwitch
    , pin = '41300048';

var deviceIdCnt = 0;
var devices = {};

var device = function (pin, args) {
    if(!pin || typeof pin !== 'number')
        throw {
            name: 'invalid device pin/id',
            message: 'invalid device pin/id'
        };

    var self = new function() {};

    args = args || {};

    self.id = pin;
    self.name = args.name || 'unknown';
    self.state = args.state || 0;
    self.type = args.type || 'light';
    self.direction = args.direction || 'out';

    devices[pin.toString()] = gpio.export(pin, {
        direction: args.direction || 'out',
        interval: 200,
        ready: function() {
            devices[pin.toString()].on("change", function(val) {
                self.state = val;
            });
        }
    });

    return self;
};

var barn = [
    device(27, {
        name: 'Lights',
        type: 'light'
    }),
    device(17, {
        name: 'Flood Lights',
        type: 'light'
    }),
    device(24, {
        name: 'Motion',
        type: 'motion',
        direction: 'in'
    })
];

var io = require('socket.io').listen(server);

io.sockets.on('connection', function (socket) {
    var yup = false;
    socket.emit('yup', false);
    socket.on('yup', function (data) {
        yup = (data === pin);
        if(yup)
            socket.emit('init', barn);
        else
            socket.emit('yup', false);
    });
    socket.on('change', function (data) {
        if(!yup) {
            socket.emit('yup', false);
            return;
        }
        var device = devices[data.id];
        if(device)
            device.set(data.state, function() {
                console.log(device.value);
                io.sockets.emit('change', {id: data.id, state: device.value});
            });
        else
            console.log("can't find device for id ", data.id);
    });
});

floodLightsSwitch = gpio.export(22, {
    direction: 'in',
    ready: function() {
        floodLightsSwitch.on("change", function(val) {
            if(val === 1)
                return;

            var device = devices[17];

            if(device)
                device.set((1 - device.value), function() {
                    console.log(device.value);
                    io.sockets.emit('change', {id: 17, state: device.value});
                });
            else
                console.log("can't find device for id ", 17);
        });
    }
});

lightsSwitch = gpio.export(23, {
    direction: 'in',
    ready: function() {
        lightsSwitch.on("change", function(val) {
            if(val === 1)
                return;

            var device = devices[27];

            if(device)
                device.set((1 - device.value), function() {
                    console.log(device.value);
                    io.sockets.emit('change', {id: 27, state: device.value});
                });
            else
                console.log("can't find device for id ", 27);
        });
    }
});
