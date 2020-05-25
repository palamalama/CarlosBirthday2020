function ClientBuffer() { 	// Object to buffer audio from a specific client
	this.clientID = 0;	// ID of the socket in the client and server
	this.packets = [];	// buffer of audio packets
	this.newBuf = true;	// Flag used to allow buffer filling at start
}
var upstreamServer = null;	// socket ID for upstram server if connected
var upstreamBuffer = []; 	// Audio packets coming down from our upstream server 
var oldUpstreamBuffer = [];	// previous upstream packet kept in case more is needed
var receiveBuffer = []; 	// All client audio packets are held in this 2D buffer
const maxBufferSize = 6;	// Max number of packets to store per client
const mixTriggerLevel = 3;	// When all clients have this many packets we create a mix
var packetSize;			// Number of samples in the client audio packets
const SampleRate = 16000; 	// All audio in audence runs at this sample rate. 
const MaxOutputLevel = 1;	// Max output level for INT16, for auto gain control
var gain = 1;			// The gain applied to the mix 
var upstreamGain = 1;		// Gain applied to the final mix after adding upstream
const MaxGain = 1;		// Don't want to amplify more than x2
// Mix generation is done as fast as data comes in, but should keep up a rhythmn
// even if downstream audio isn't sufficient. The time the last mix was sent is here:
var nextMixTimeLimit = 0;

// Timing counters
//
// We use these to measure how many miliseconds we spend working on events
// and how much time we spend doing "nothing" (supposedly idle)
function stateTimer() {
	this.name = "";
	this.total = 0;
	this.start = 0;
}
var idleState = new stateTimer(); 	idleState.name = "Idle";
var upstreamState = new stateTimer();	upstreamState.name = "Upstream";
var downstreamState = new stateTimer();	downstreamState.name = "Downstream";
var genMixState = new stateTimer();	genMixState.name = "Generate Mix";
var currentState = idleState;		currentState.start = new Date().getTime();
function enterState( newState ) {
	let now = new Date().getTime();
	currentState.total += now - currentState.start;
	newState.start = now;
	currentState = newState;
}

// Accumulators for reporting purposes
//
var packetsIn = 0;
var packetsOut = 0;
var overflows = 0;
var shortages = 0;
var clientsLive = 0;
var forcedMixes = 0;
var packetClassifier = [];
packetClassifier.fill(0,0,30);




// Network code
//
//
var fs = require('fs');
var express = require('express');
var app = express();
app.use(express.static('public'));

var PORT = process.env.PORT; 
if (PORT == undefined) {		// Not running on heroku so use SSL
	var https = require('https');
	var SSLPORT = 443; //Default 443
	var HTTPPORT = 80; //Default 80 (Only used to redirect to SSL port)
	var privateKeyPath = "sslcert/express-selfsigned.key";
	var certificatePath = "sslcert/express-selfsigned.crt";
	var privateKey = fs.readFileSync( privateKeyPath );
	var certificate = fs.readFileSync( certificatePath );
	var server = https.createServer({
    		key: privateKey,
    		cert: certificate
	}, app).listen(SSLPORT);
	// Redirect from http to https
	var http = require('http');
	http.createServer(function (req, res) {
    		res.writeHead(301, { "Location": "https://" + req.headers['host'] + ":"+ SSLPORT + "" + req.url });
    		res.end();
	}).listen(HTTPPORT);
} else {				// On Heroku. No SSL needed
	var http = require('http');
	var server = http.Server(app);
	server.listen(PORT, function() {
		console.log("Server running on ",PORT);
	});
}

var io  = require('socket.io').listen(server, { log: false });


function createClientBuffer(client) {
	let buffer = new ClientBuffer();
	buffer.clientID = client;
	buffer.newBuf = true;
	receiveBuffer.push(buffer);
	return buffer;
}

let data = {
	people:{
		"-1":{
			"name": "A realtime random boy","size":10,"id":"-1","x":5,"y":5,state:"alive"
		},
	}
};


// socket event and audio handling area
io.sockets.on('connection', function (socket) {
	//ERIC STUFF
	let newPerson = {"name":socket.id,"id":socket.id,x:Math.random()*100,y:Math.random()*100,size:10,state:"alive"};
	data.people[socket.id] = newPerson;
	data.people["-1"].x = 5;
	data.people["-1"].y = 5;
	socket.emit("setup",{data:data,new_user_id:socket.id});
	console.log("Connected ",socket.handshake.address, newPerson);
	
	
	socket.on("update",(updatedPerson) => {
		data.people[updatedPerson.id] = updatedPerson;
		socket.emit('update', data);
	});

	//ERIC STUFF
	console.log("New connection:", socket.id);
	clientsLive++;

	socket.on('disconnect', function () {
		console.log("User disconnected:", socket.id);
		// No need to remove the client's buffer as it will happen automatically
		clientsLive--;

		delete data.people[socket.id];
	});

	socket.on('upstreamHi', function (data) {
		// A downstream server or client is registering with us
		// Add the downstream node to the group for notifications
		console.log("New client ", socket.id);
		socket.join('downstream');
	});

	// Audio coming up from one of our downstream clients
	socket.on('u', function (data) {
		enterState( downstreamState );
		let client = socket.id;
		let packet = {audio: data["audio"], sequence: data["sequence"], timeEmitted: data["timeEmitted"]};
		let buffer = null;
		packetSize = packet.audio.length;	// Need to know how much audio we are processing
		if (receiveBuffer.length == 0) {	// First client, so create buffer right now
			buffer = createClientBuffer(client);
			nextMixTimeLimit = 0;		// Stop sample timer until audio buffered
		} else					// Find this client's buffer
			receiveBuffer.forEach( b => { if ( b.clientID == client ) buffer = b; });
		if (buffer == null)  			// New client but not the first. Create buffer 
			buffer = createClientBuffer(client);
		buffer.packets.push( packet );
		if (buffer.packets.length > maxBufferSize) {
			buffer.packets.shift();
			overflows++;
		}
		if (buffer.packets.length >= mixTriggerLevel) 
			buffer.newBuf = false;		// Buffer has filled enough to form part of mix
		packetsIn++;
		enterState( genMixState );
		generateMix();
		enterState( idleState );
	});
});


setInterval(() => {
	data.people["-1"].x += Math.random()*2-1;
	data.people["-1"].y += Math.random()*2-1;
}, 50);

// Audio management, marshalling and manipulation code
//
//
function isTimeToMix() {	// Test if we must generate a mix regardless
	let now = new Date().getTime();
	if ((nextMixTimeLimit != 0) && (now >= nextMixTimeLimit))  {
		forcedMixes++;
		return true;
	} else
		return false;
}

function maxValue( arr ) { 			// Find max value in an array
	let max = arr[0];
	for (let i =  1; i < arr.length; i++)
		if (arr[i] > max) max = arr[i];
	return max;
}

function applyAutoGain(audio, startGain) {		// Auto gain control
	let tempGain, maxLevel, endGain, p, x, transitionLength; 
	maxLevel = maxValue(audio);			// Find peak audio level 
	endGain = MaxOutputLevel / maxLevel;		// Desired gain to avoid overload
	if (endGain > MaxGain) endGain = MaxGain;	// Gain is limited to MaxGain
	if (endGain >= startGain) {			// Gain adjustment speed varies
		transitionLength = audio.length;	// Gain increases are gentle
		endGain = startGain + ((endGain - startGain)/10);	// Slow the rate of gain change
	}
	else
		transitionLength = Math.floor(audio.length/10);	// Gain decreases are fast
	tempGain = startGain;				// Start at current gain level
	for (let i = 0; i < transitionLength; i++) {	// Adjust gain over transition
		x = i/transitionLength;
		if (i < (2*transitionLength/3))		// Use the Magic formula
			p = 3*x*x/2;
		else
			p = -3*x*x + 6*x -2;
		tempGain = startGain + (endGain - startGain) * p;
		audio[i] = audio[i] * tempGain;
	}
	if (transitionLength != audio.length) {		// Still audio left to adjust?
		tempGain = endGain;			// Apply endGain to rest
		for (let i = transitionLength; i < audio.length; i++)
			audio[i] = audio[i] * tempGain;
	}
	return endGain;
}

// The main working function where audio marsahlling, mixing and sending happens
function generateMix () {
	let readyToMix = false;
	let numberOfClients = receiveBuffer.length;
	if (isTimeToMix()) readyToMix = true;
	else {								// It isn't time to mix. Is there enough to mix anyway?
		let newBufs = 0; let bigBufs = 0;		// Very explicit logic because this has caused 
		receiveBuffer.forEach( b => {				// a lot of trouble!
			if (b.newBuf == true) newBufs++;
			if (b.packets.length > mixTriggerLevel) bigBufs++;
		});							// If all buffers are either new or full enough
		if ((newBufs + bigBufs) == numberOfClients) readyToMix = true;
	}
	if (readyToMix) {
		let mix = new Array(packetSize).fill(0); 		// The mixed audio we will return to all clients
		let clientPackets = []; 				// All client audio packets that are part of the mix
		let client = receiveBuffer.length -1;			// We start at the end of the array going backwards
		while (client >=0) { 					// mix all client (downstream) audio together
			let clientBuffer = receiveBuffer[client];	
			if (clientBuffer.newBuf == false) {			// Ignore new buffers that are filling up
				let newTrack = { packet: [], clientID: 0 };	// A track is an audio packet + client ID
				newTrack.clientID = clientBuffer.clientID;	// Get clientID for audio packet
				newTrack.packet = clientBuffer.packets.shift();	// Get first packet of audio
				if (newTrack.packet == undefined) {		// If this client buffer has been emptied...
					shortages++;
					receiveBuffer.splice(client, 1); 	// remove client buffer
					if (receiveBuffer.length == 1)		// if only one client left
						nextMixTimeLimit = 0;		// stop sample timer 
				}
				else {
					clientPackets.push( newTrack );		// Store packet of source audio 
				}
			}
			client--;						// next client down in buffer
		}
		if (clientPackets.length != 0) {		// Only send audio if we have some to send
			packetClassifier[clientPackets.length] = packetClassifier[clientPackets.length] + 1;
			io.sockets.in('downstream').emit('d', {
				"c": clientPackets,
			});
			packetsOut++;			// Sent data so log it and set time limit for next send
			if (nextMixTimeLimit == 0) {	// If this is the first send event then start at now
				let now = new Date().getTime();
				nextMixTimeLimit = now;
			}
			nextMixTimeLimit = nextMixTimeLimit + (mix.length * 1000)/SampleRate;
		}
	}
}


// Reporting code
// 
const updateTimer = 10000;	// Frequency of updates to the console
function printReport() {
	console.log("Idle = ", idleState.total, " upstream = ", upstreamState.total, " downstream = ", downstreamState.total, " genMix = ", genMixState.total);
	console.log("Clients = ",clientsLive,"  active = ", receiveBuffer.length,"In = ",packetsIn," Out = ",packetsOut," overflows = ",overflows," shortages = ",shortages," forced mixes = ",forcedMixes);
	let s = "Client buffer lengths: ";
	for (c in receiveBuffer)
		s = s + receiveBuffer[c].packets.length +" ";
	console.log(s);
	console.log(packetClassifier);
	packetClassifier.fill(0,0,30);
	packetsIn = 0;
	packetsOut = 0;
	overflows = 0;
	shortages = 0;
	forcedMixes = 0;
}
setInterval(printReport, updateTimer);



// We are all set up so let the idling begin!
enterState( idleState );
console.log("IDLING...");
