var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
	console.log("Someone requested the main page");
	res.sendFile(__dirname + '/index.html');
});

app.get("/main.js", function(req, res){
	console.log("Someone requested javascript");
	res.sendFile(__dirname + "/main.js");
});
