var fs = require("fs");
var express = require('express');
var app = express();

var privateKey  = fs.readFileSync('sslcert/express-selfsigned.key', 'utf8');
var certificate = fs.readFileSync('sslcert/express-selfsigned.crt', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var https = require("https").createServer(credentials,app);
app.use(express.static('public'))

app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});

https.listen(2100, () => {
	console.log('Listening on port 2100!')
});

var io = require("socket.io")(https);
io.origins("*:*");


let connection_id = 0;
let data = {
	people:{
		"-1":{
			"name": "A realtime random boy","size":10,"id":"-1","x":5,"y":5,state:"alive"
		},
	}
};
io.on("connection",(socket) => {
	let id = connection_id ++;
	let newPerson = {"name":id,"id":id,x:Math.random()*100,y:Math.random()*100,size:10,state:"alive"};
	data.people[id] = newPerson;
	data.people["-1"].x = 5;
	data.people["-1"].y = 5;
	socket.emit("setup",{data:data,new_user_id:id});
	console.log("Connected ",socket.handshake.address, newPerson);
	
	socket.on('disconnect',() => {
		delete data.people[id];
	});
	
	socket.on("update",(updatedPerson) => {
		data.people[updatedPerson.id] = updatedPerson;
	});
});
setInterval(() => {
	data.people["-1"].x += Math.random()*2-1;
	data.people["-1"].y += Math.random()*2-1;
	io.sockets.emit('update', data);
}, 50);

