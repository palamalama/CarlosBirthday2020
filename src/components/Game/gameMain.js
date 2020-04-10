import React from "react";
import * as d3 from "d3";
import openSocket from 'socket.io-client';

class Game extends React.Component {
	constructor(props){
		super(props);
		this.updateMousePosition = this.updateMousePosition.bind(this);
		this.endpoint = "http://82.23.156.228:21100";
		this.state = {
			people:{},
			me:{}
		}
		console.log("Setting state is all good");
		
	}
	render(){
		return (
			<svg className="MainSVG" ref={(svg) => this.svg = svg} onMouseMove={this.updateMousePosition} style={{"margin":"0","width":"100%","height":"100%"}}>
				<circle ref={(center) => this.centerOfScreenElement = center} cx="50%" cy="50%" r="1" />
			</svg>
		);
	}

	draw(){
		this.drawPeople();
	}
	drawPeople(){
		let people = d3.select(this.svg)
			.selectAll(".people")
			.data(Object.values(this.state.people));

		let newGroup = people.enter()
			.append("g")
			.attr("class","people");
		newGroup.append("circle")
			.attr("stroke","crimson")
			.attr("fill","red");

		newGroup.append("text")
			.text((d) => d.name);

		people.exit().remove();
		
		let transition = people.transition()
			.duration(100)
		transition.select("circle")
			.attr("cx",(d) => (d.x-this.state.me.x)+"%")
			.attr("cy",(d) => (d.y-this.state.me.y)+"%")
			.attr("stroke-width",(d) => Math.sqrt(d.size*2))
			.attr("r", (d) => d.size);
		transition.select("text")
			.attr("x", (d) => (d.x-this.state.me.x)+"%")
			.attr("y", (d) => (d.y-this.state.me.y)+"%")
			.attr("font-size", (d) => Math.sqrt(d.size*2+200));
		let meData = [];
		meData.push(this.state.me);
		let me = d3.select(this.svg)
			.selectAll(".me")
			.data(meData);
		me.exit().remove();
		let newMe = me.enter()
			.append("g")
			.attr("class","me");
		newMe.append("circle")
			.attr("cx","50%")
			.attr("cy","50%")
			.attr("stroke","crimson")
			.attr("fill","red");
		newMe.append("text")
			.attr("x","50%")
			.attr("y","50%")
			.text((d) => d.name);
		
		let transitionMe = me.transition()
			.duration(100);
		transitionMe.select("circle")
			.attr("stroke-width",(d) => Math.sqrt(d.size*2)) 
			.attr("font-size", (d) => Math.sqrt(d.size*2+200))
			.attr("r",(d) => d.size);
		transitionMe.select("text")
			.text((d) => d.name)
			.attr("font-size",(d) => Math.sqrt(d.size*2+200));
			
	}

	componentDidMount() {
		this.socket = openSocket(this.endpoint);
		this.socket.on("setup",(response) => {
			let people = response.data.people;
			let me = people[response.new_user_id];
			me.name = this.props.name;
			delete people[response.new_user_id];
			this.setState({
				people:people,
				me:me
			});
		});
		this.socket.on("update",(data) => {
			let people = data.people;
			delete people[this.state.me.id];
			this.setState({
				people:people
			});
		});
		this.updatePositionInterval = setInterval(() => this.updatePosition(), 50);
		this.draw();
	}
	componentDidUpdate(){
		this.draw();
	}
	componentWillUnmount() {
		clearInterval(this.updatePositionInterval);
	}
	updatePosition(){
		let newState = this.state;
		let dx = 0;
		let dy = 0;
		if(this.mousePosition){
			dx = (this.mousePosition.x - screen.width /2)/100;
			dy = (this.mousePosition.y - screen.height /2)/100;
		}
		let length = Math.sqrt(dx*dx + dy*dy);
		newState.me.x += dx/(0.001+length)*Math.min(length,1);	
		newState.me.y += dy/(0.001+length)*Math.min(length,1);
		this.setState(newState);
		this.socket.emit("update",this.state.me);
	}
	updateMousePosition(e){
		this.mousePosition = {x:e.screenX,y:e.screenY};
	}
}
export default Game;
