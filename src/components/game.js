import React from "react";
import * as d3 from "d3";
import openSocket from 'socket.io-client';
import LoginPrompt from "./Prompts/login";
import EatenPrompt from "./Prompts/eaten";
import Person from "./Characters/person";
import MainCharacter from "./Characters/mainCharacter";
import AudioHandler from "./Audio/AudioHandler";

var connectingState = "connecting";
var loggingInState = "logging in";
var playingState = "playing";
var eatenState = "eaten";

class Game extends React.Component {
	constructor(props){
		super(props);
		this.updateMousePosition = this.updateMousePosition.bind(this);
		this.state = {
			mainState:connectingState,
			people:{},
			me:{"name":"Big baby","size":10,"x":0,"y":0,state:"alive"},
			centerOfScreen:{x:0,y:0}
		}
		
	}
	render(){
		if(this.state.mainState == connectingState){
			return (
				<h1> Connecting... </h1>
			);
		}
		else if(this.state.mainState == loggingInState){
			return (
				<div style={{"margin":"0","width":"100%","height":"100%"}}>
					<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
						{Object.values(this.state.people)
							.map((person) => (
								<Person person={person}
									mainCharacter={this.state.me} 
									centerCoordinates={this.state.centerOfScreen}
								/>
							))
						}
						<LoginPrompt login={this.login.bind(this)}/>
					</svg>
				</div>
			);
		}
		else if(this.state.mainState == eatenState){
			return (
				<div style={{"margin":"0","width":"100%","height":"100%"}}>
					<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
						{Object.values(this.state.people)
							.map((person) => (
								<Person person={person}
									mainCharacter={this.state.me} 
									centerCoordinates={this.state.centerOfScreen}
								/>
							))
						}
						<EatenPrompt login={this.login.bind(this)}/>
					</svg>
				</div>
			);	
		}
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
		this.connectToServer();
	}
	componentDidUpdate(prevProps,prevState){
		if(prevState.mainState != this.state.mainState){
			if(this.state.mainState == loggingInState){
				this.updateCenterOfScreen();
				window.addEventListener('resize', this.updateCenterOfScreen.bind(this));
			}
			else if(this.state.mainState == playingState){
					
			}
			else if(this.state.mainState == eatenState){
					
			}
		}
	}
	connectToServer(){
		this.socket = openSocket();
		this.socket.on("connect", this.connected.bind(this));
		this.socket.on("disconnect", () => {
			this.setState({ mainState: connectingState});
		});
		this.socket.on("world_update", this.worldUpdate.bind(this));
		this.socket.on("d",this.audioRecieved.bind(this));
		this.socket.on("you_got_eaten",this.eaten.bind(this));
		//this.socket.emit("upstreamHi");
	}
	connected(){
		this.backgroundUpdateInterval = setInterval(() => this.requestBackgroundData(),50);	
		//this.audioHandler = new AudioHandler();
		//this.audioHandler.setSocketId(this.socket.id);
		//this.audioHandler.recordAudio(this.audioRecorded.bind(this));//get audio permission from user with callback to send audio to
		this.setState({ mainState: loggingInState});
	}
	login(name){
		clearInterval(this.backgroundUpdateInterval);

		let me = createPerson(this.socket.id,name);
		this.socket.emit("create_character",me);
		
		this.updateGameInterval = setInterval(() => this.updateGame(), 50);
		this.setState({ me:me, mainState: playingState});
	}
	eaten(){
		clearInterval(this.updateGameInterval);
		this.backgroundUpdateInterval = setInterval(() => this.requestBackgroundData(), 50);
		this.setState({ mainState: eatenState});
	}

	requestBackgroundData(){
		this.socket.emit("request_background_data");
	}
	worldUpdate(data){
		let newPeople = data.people;
		let oldPeople = this.state.people;
		delete newPeople[this.state.me.id];
		let peopleStillOnTheMap = Object.keys(newPeople);
		Object.keys(oldPeople).forEach((personId) => {
			if(peopleStillOnTheMap.includes(personId) && oldPeople[personId].state == "eaten"){
				newPeople[personId].state = "eaten";
			}
			if(!peopleStillOnTheMap.includes(personId)){
				newPeople[personId] = {"state":"deleted"};
			}
		});
		Object.keys(newPeople).forEach((personId) => {
			newPeople[personId].distance = getDistance(newPeople[personId],this.state.me);
		});
		this.setState({
			people:newPeople
		});
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
					newPeople[personId].state = "eaten";
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

	audioRecorded(audio){
		//this.socket.emit("u",audio);
	}
	audioRecieved(data){
		data.c.forEach((client,index) => {
			if(client.clientID != this.state.me.id){	 
				data.c[index].volume = Math.min(5,15/Math.pow(Math.max(5,this.state.people[client.clientID].distance-100),2) );
			}
		});
		//this.audioHandler.playAudio(data);

	}
	componentWillUnmount() {
		if(this.state.mainState == loggingInState || this.state.mainState == eatenState){
			clearInterval(this.backgroundUpdateInterval);
		}
		else if(this.state.mainState == playingState){
			clearInterval(this.updateGameInterval);
		}
	}

}
export default Game;

function createPerson(id, name){
        return {"name":name,"id":id,x:Math.random()*100,y:Math.random()*100,size:10,state:"alive"};
}
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
