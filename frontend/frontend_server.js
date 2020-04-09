var app = require('express')();
var http = require('http').createServer(app);

app.get('/', function(req, res){
	console.log("Someone requested the main page");
	res.sendFile(__dirname + '/index.html');
});

app.get("/main.js", function(req, res){
	console.log("Someone requested javascript");
	res.sendFile(__dirname + "/main.js");
});
http.listen(2200, () => {
	console.log('Listening on port 2200!')
});
