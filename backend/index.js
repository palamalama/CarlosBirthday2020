const express = require('express')
const app = express();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
io.origins('*:*');

let connection_id = 0;
let data = {
	people:{
		"-1":{
			"name": "A realtime random boy","size":10,"id":"-1","x":5,"y":5
		},
	}
};
io.on("connection",(socket) => {
	let id = connection_id ++;
	let newPerson = {"name":"Gimme a moment","id":id,x:Math.random()*100,y:Math.random()*100,size:10};
	data.people[id] = newPerson;
	data.people["-1"].x = 5;
	data.people["-1"].y = 5;
	socket.emit("setup",{data:data,new_user_id:id});
	console.log("Connected ",newPerson);

	socket.on('disconnect',() => {
		delete data.people[id];
	});
	
	socket.on("update",(updatedPerson) => {
		data.people[updatedPerson.id] = updatedPerson;
	});
});
setInterval(() => {
	data.people["-1"].x += Math.random()-0.5;
	data.people["-1"].y += Math.random()-0.5;
	io.sockets.emit('update', data);
}, 50);

http.listen(2100, () => {
	console.log('Listening on port 2100!')
});
