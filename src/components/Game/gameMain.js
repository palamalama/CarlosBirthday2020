import React from "react";
import * as d3 from "d3";
import openSocket from 'socket.io-client';
import Person from "./person";
import MainCharacter from "./mainCharacter";
import AudioHandler from "./Audio/AudioHandler";


class Game extends React.Component {
	constructor(props){
		super(props);
		this.updateMousePosition = this.updateMousePosition.bind(this);
		this.state = {
			people:{},
			me:{"name":"Big baby","size":10,"x":0,"y":0,state:"alive"},
			centerOfScreen:{x:0,y:0}
		}
		
	}
	render(){
		return (
			<div style={{"margin":"0","width":"100%","height":"100%"}}>
				<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
					<MainCharacter me={this.state.me} center={this.state.centerOfScreen}/>
					{Object.values(this.state.people)
						.map((person) => (
							<Person person={person}
								mainCharacter={this.state.me} 
								centerCoordinates={this.state.centerOfScreen}
							/>
						))
					}
				</svg>
			</div>
		);
	}

	componentDidMount() {
		this.setupGame();
		this.setupSocket();
		this.setupAudio();
	}
	componentWillUnmount() {
		this.teardownAudio();
		this.teardownSocket();
	}
	setupAudio(){
		//this.audioHandler.recordAudio(this.audioRecorded.bind(this));//get audio permission from user with callback to send audio to
	}
	audioRecorded(audio){
		this.socket.emit("u",audio);
	}
	teardownAudio(){
	}
	setupSocket(){
		this.socket = openSocket();
		this.audioHandler = new AudioHandler();
		this.socket.on("connect", () => {
			this.audioHandler.setSocketId(this.socket.id);
		});
		this.socket.on("setup",(response) => {
			let people = response.data.people;
			let me = people[response.new_user_id];
			me.name = this.props.name;
			delete people[response.new_user_id];
			this.setState({
				people:people,
				me:me
			});
			this.updateGameInterval = setInterval(() => this.updateGame(), 50);
		});
		this.socket.on("world_update",(data) => {
			let newPeople = data.people;
			let oldPeople = this.state.people;
			delete newPeople[this.state.me.id];
			let peopleStillOnTheMap = Object.keys(newPeople);
			Object.keys(oldPeople).forEach((personId) => {
				if(!peopleStillOnTheMap.includes(personId)){
					newPeople[personId] = {"state":"deleted"};
				}
				if(oldPeople[personId].state == "deleted"){
					newPeople[personId] = {"state": "deleted"};
				}
			});
			Object.keys(newPeople).forEach((personId) => {
				newPeople[personId].distance = getDistance(newPeople[personId],this.state.me);
			});
			this.setState({
				people:newPeople
			});
		});
		this.socket.on("you_got_eaten",() => {
			window.location.reload(false);

		});
		this.socket.on("d",(data) => {
			data.c.forEach((client,index) => {
				if(client.clientID != this.state.me.id){	 
					data.c[index].volume = Math.min(5,15/Math.pow(Math.max(5,this.state.people[client.clientID].distance-100),2) );
				}
			});
			this.audioHandler.playAudio(data);
		});
		this.socket.emit("upstreamHi");
	}
	teardownSocket(){
		this.socket.emit("disconnect");
		clearInterval(this.updateGameInterval);
	}
	setupGame(){	
		this.updateCenterOfScreen();
		window.addEventListener('resize', this.updateCenterOfScreen.bind(this));
	}
	updateCenterOfScreen(){
		this.setState({
			centerOfScreen:{x:this.svg.getBoundingClientRect().width/2,y: this.svg.getBoundingClientRect().height/2}
		});
	}
	updateMousePosition(e){
		this.mousePosition = {x:e.clientX,y:e.clientY};
	}
	updateGame(){
		this.updatePosition();
		this.checkForEdiblePeople();
	}
	updatePosition(){
		let newState = this.state;
		let velocity = determineVelocity(this.mousePosition|| this.state.centerOfScreen, this.state.centerOfScreen);
		newState.me.x += velocity.x;	
		newState.me.y += velocity.y;
		Object.keys(newState.people).forEach( personId => {
			newState.people[personId].distance = getDistance(newState.people[personId],newState.me);
		});
		this.setState(newState);
		this.socket.emit("character_update",this.state.me);
	}
	checkForEdiblePeople(){
		Object.keys(this.state.people).forEach((personId) => {
			if(this.state.people[personId].distance < Math.sqrt(this.state.me.size*3)){
				if(this.state.people[personId].size < this.state.me.size){
					console.log("I could have eaten him",personId);
					let newMe = this.state.me;
					newMe.size += this.state.people[personId].size;
					let newPeople = this.state.people;
					newPeople[personId] = {state:"deleted"};
					this.setState({
						people:newPeople,
						me:newMe
					})
					this.socket.emit("character_eaten",personId);
					this.socket.emit("character_update",this.state.me);
				}
			}
		});
	}

}
export default Game;

function getDistance(object1, object2){
	let dx = object1.x - object2.x;
	let dy = object1.y - object2.y;
	return Math.sqrt(dx*dx + dy*dy);
}
function determineVelocity(mousePos,characterPos){
	let relPos = {
		x: mousePos.x - characterPos.x,
		y: mousePos.y - characterPos.y
	};
	let distance = Math.max(1,getDistance(mousePos, characterPos));
	let unitVelocity = {x:relPos.x/distance,y:relPos.y/distance};
	if(distance < 20){
		return {x:0,y:0};
	}
	let speed = Math.min((distance-20)/40,5); //maxes out at a distance of 220 with a speed of 5
	return {x:unitVelocity.x*speed,y:unitVelocity.y*speed};
}
