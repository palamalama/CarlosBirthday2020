import React from "react";
import * as d3 from "d3";
import openSocket from 'socket.io-client';
import Person from "./person";
import MainCharacter from "./mainCharacter";
import AudioHandler from "./Audio/AudioHandler";

var packetSequence = 0; 

class Game extends React.Component {
	constructor(props){
		super(props);
		this.updateMousePosition = this.updateMousePosition.bind(this);
		this.setCenterOfScreen = this.setCenterOfScreen.bind(this);
		this.state = {
			people:{},
			me:{"name":"Big baby","size":10,"x":0,"y":0,state:"alive"}
		}
		
	}
	render(){
		return (
			<div style={{"margin":"0","width":"100%","height":"100%"}}>
				<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
					<MainCharacter me={this.state.me} setCenterOfScreen={this.setCenterOfScreen}/>
					{Object.values(this.state.people)
						.map((person) => (
							<Person person={person}
								mainCharacter={this.state.me} 
								centerCoordinates={this.state.centerOfScreen || {x:0,y:0}}
							/>
						))
					}
				</svg>
			</div>
		);
	}

	componentDidMount() {
		this.setupSocket();
		this.setupAudio();
	}
	componentDidUpdate(){
	}	
	setupAudio(){
		this.audioHandler.recordAudio(this.audioRecorded.bind(this));//get audio permission from user with callback to send audio to
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
			this.updatePositionInterval = setInterval(() => this.updatePosition(), 100);
		});
		this.socket.on("update",(data) => {
			let newPeople = data.people;
			let oldPeople = this.state.people;
			delete newPeople[this.state.me.id];
			let peopleStillOnTheMap = Object.keys(newPeople);
			Object.keys(oldPeople).forEach((personId) => {
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
		clearInterval(this.updatePositionInterval);
	}
	componentWillUnmount() {
		teardownAudio();
		teardownSocket();
	}
	setCenterOfScreen(pos){
		this.setState({
			centerOfScreen:pos
		});
	}
	updateMousePosition(e){
		this.mousePosition = {x:e.clientX,y:e.clientY};
	}
	updatePosition(){
		let newState = this.state;
		let dx = 0;
		let dy = 0;
		if(this.mousePosition){
			dx = (this.mousePosition.x - this.state.centerOfScreen.x);
			dy = (this.mousePosition.y - this.state.centerOfScreen.y);
		}
		let length = Math.max(0.001,Math.sqrt(dx*dx + dy*dy)-200);
		newState.me.x += dx/length*Math.min(length/100,1);	
		newState.me.y += dy/length*Math.min(length/100,1);
		Object.keys(newState.people).forEach( personId => {
			newState.people[personId].distance = getDistance(newState.people[personId],newState.me);
		});
		this.setState(newState);
		this.socket.emit("update",this.state.me);
	}

}
export default Game;

function getDistance(object1, object2){
	let dx = object1.x - object2.x;
	let dy = object1.y - object2.y;
	return Math.sqrt(dx*dx + dy*dy);
}
