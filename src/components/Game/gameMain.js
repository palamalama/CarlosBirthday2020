import React from "react";
import * as d3 from "d3";
import openSocket from 'socket.io-client';
import Person from "./person";
import MainCharacter from "./mainCharacter";

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
		);
	}

	socket = openSocket();
	componentDidMount() {
		this.socket.on("setup",(response) => {
			console.log("SETUP");
			let people = response.data.people;
			let me = people[response.new_user_id];
			me.name = this.props.name;
			delete people[response.new_user_id];
			this.setState({
				people:people,
				me:me
			});
			this.updatePositionInterval = setInterval(() => this.updatePosition(), 50);
		});
		this.socket.on("update",(data) => {
			console.log("UPDATE");
			let newPeople = data.people;
			let oldPeople = this.state.people;
			delete newPeople[this.state.me.id];
			let peopleStillOnTheMap = Object.keys(newPeople);
			Object.keys(oldPeople).forEach((personId) => {
				if(!peopleStillOnTheMap.includes(personId)){
					newPeople[personId] = {"state":"deleted"};
				}
			});
			this.setState({
				people:newPeople
			});
		});
	}
	componentWillUnmount() {
		this.socket.emit("disconnect");
		clearInterval(this.updatePositionInterval);
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
		console.log("SENT UPDATE");
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
		this.setState(newState);
		this.socket.emit("update",this.state.me);
	}
}
export default Game;
