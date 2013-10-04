
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var cookie  = require('cookie');
var connect = require('connect');
var secret = 'Askindl23@146Fscmaijnd523CXVWGN#63@#7efbsd23#$Rb';


var app = express();

// all environments
app.set('port', process.env.PORT || 4130);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({secret: secret, key: 'express.sid'}));app.use(app.router);
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
    self.actioType = args.actionType || 'onoff';
    self.direction = args.direction || 'out';

    devices[pin.toString()] = gpio.export(pin, {
        direction: args.direction || 'out',
        interval: 200,
        ready: function() {
            devices[pin.toString()].on("change", function(val) {
                self.state = val;
                if(self.direction === 'in') {
                    io.sockets.emit('change', {id: self.id, state: val});
                }
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

var sessionobj = {};
var io = require('socket.io').listen(server);

io.set('authorization', function (handshakeData, accept) {

    if (handshakeData.headers.cookie) {

        handshakeData.cookie = cookie.parse(handshakeData.headers.cookie);

        handshakeData.sessionID = connect.utils.parseSignedCookie(handshakeData.cookie['express.sid'], secret);

        if (handshakeData.cookie['express.sid'] == handshakeData.sessionID) {
            return accept('Cookie is invalid.', false);
        }

    } else {
        return accept('No cookie transmitted.', false);
    }

    accept(null, true);
});
io.sockets.on('connection', function (socket) {
    var sessId = sessionobj[cookie.parse(socket.handshake.sessionID)];
    var yup = sessionobj[sessId];

    if(yup === true)
        socket.emit('init', barn);
    else
        socket.emit('yup', false);

    socket.on('yup', function (data) {
        data = data || {};
        yup = (data.pin === pin);
        if(yup === true) {
            sessionobj[sessId] = data.remember;
            socket.emit('init', barn);
        } else {
            sessionobj[sessId] = false;
            socket.emit('yup', false);
        }
    });
    socket.on('change', function (data) {
        if(yup === false) {
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
